import { spawn, exec, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import pidusage from 'pidusage';
import { ServerState, ServerStatus, ConsoleOutput } from '@minecraft-panel/shared';
import { CircularBuffer } from '../../utils/circular-buffer.js';
import { config, createLogger } from '../../config/index.js';
import { RconPool } from '../rcon/rcon-pool.js';

export interface ProcessConfig {
  id: string;
  name: string;
  rootPath: string;
  jarFile: string;
  javaPath: string;
  javaArgs: string;
  gamePort: number;
  rconPort: number;
  minMemory: string;
  maxMemory: string;
  autoRestart: boolean;
  maxCrashRestarts: number;
}

/**
 * ProcessInstance
 * ตัวแทนจัดการ Java Child Process ของเซิร์ฟเวอร์ Minecraft แต่ละตัวบน Windows
 */
export class ProcessInstance extends EventEmitter {
  public readonly config: ProcessConfig;
  private state: ServerState = ServerState.OFFLINE;
  private process: ChildProcess | null = null;
  private pid: number | null = null;
  private startedAt: Date | null = null;
  private lastCrashAt: Date | null = null;
  private crashCount: number = 0;
  private consoleBuffer: CircularBuffer<ConsoleOutput>;
  private logger = createLogger('process-instance');
  private stopTimeoutTimer: NodeJS.Timeout | null = null;
  private minecraftVersion: string | null = null;

  constructor(config: ProcessConfig) {
    super();
    this.config = config;
    this.consoleBuffer = new CircularBuffer<ConsoleOutput>(1000);
  }

  /** ดึงสถานะปัจจุบันของ ProcessInstance */
  public getState(): ServerState {
    return this.state;
  }

  /** ดึง PID ปัจจุบัน */
  public getPid(): number | null {
    return this.pid;
  }

  /** ดึง Log ล่าสุด */
  public getLogs(limit: number = 100): ConsoleOutput[] {
    return this.consoleBuffer.getRecent(limit);
  }

  /** ค้นหาและระบุตำแหน่งของ Java Runtime บน Windows อัตโนมัติ */
  private resolveJavaPath(configuredPath: string): string {
    if (configuredPath && configuredPath !== 'java' && fs.existsSync(configuredPath)) {
      return configuredPath;
    }
    if (config.MC_DEFAULT_JAVA_PATH && fs.existsSync(config.MC_DEFAULT_JAVA_PATH)) {
      return config.MC_DEFAULT_JAVA_PATH;
    }
    const adoptiumBase = 'C:\\Program Files\\Eclipse Adoptium';
    if (fs.existsSync(adoptiumBase)) {
      const dirs = fs.readdirSync(adoptiumBase);
      for (const dir of dirs) {
        const candidate = path.join(adoptiumBase, dir, 'bin', 'java.exe');
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }
    return configuredPath || 'java';
  }

  /** สั่งเปิดเซิร์ฟเวอร์ (Start Sequence) */
  public async start(): Promise<void> {
    if (this.state !== ServerState.OFFLINE && this.state !== ServerState.CRASHED) {
      throw new Error(`ไม่สามารถเปิดเซิร์ฟเวอร์ได้เนื่องจากสถานะปัจจุบันคือ ${this.state}`);
    }

    // 1. ตรวจสอบโฟลเดอร์ Root บน Windows
    if (!fs.existsSync(this.config.rootPath)) {
      throw new Error(`ไม่พบโฟลเดอร์เซิร์ฟเวอร์: ${this.config.rootPath}`);
    }

    // 2. ตรวจสอบไฟล์ JAR
    const jarFullPath = path.isAbsolute(this.config.jarFile)
      ? this.config.jarFile
      : path.join(this.config.rootPath, this.config.jarFile);

    if (!fs.existsSync(jarFullPath)) {
      throw new Error(`ไม่พบไฟล์ JAR: ${jarFullPath}`);
    }

    // 3. เตรียม Argument สำหรับ JVM
    const args: string[] = [
      `-Xms${this.config.minMemory}`,
      `-Xmx${this.config.maxMemory}`,
    ];

    if (this.config.javaArgs.trim()) {
      const extraArgs = this.config.javaArgs.trim().split(/\s+/);
      args.push(...extraArgs);
    }

    args.push('-jar', path.basename(jarFullPath), 'nogui');

    const effectiveJavaPath = this.resolveJavaPath(this.config.javaPath);
    this.logger.info(`[${this.config.name}] กำลังเปิดเซิร์ฟเวอร์: ${effectiveJavaPath} ${args.join(' ')}`);
    this.setState(ServerState.STARTING);

    try {
      // 4. สั่ง Spawn Process บน Windows โดยตั้ง cwd เป็นโฟลเดอร์เซิร์ฟเวอร์
      this.process = spawn(effectiveJavaPath, args, {
        cwd: this.config.rootPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      this.pid = this.process.pid ?? null;
      this.startedAt = new Date();

      this.logger.info(`[${this.config.name}] Process เริ่มทำงานแล้ว (PID: ${this.pid})`);

      // 5. ดักจับท่อส่งข้อมูล stdout
      this.process.stdout?.on('data', (data: Buffer) => {
        this.handleOutput(data.toString('utf8'), 'stdout');
      });

      // 6. ดักจับท่อส่งข้อมูล stderr
      this.process.stderr?.on('data', (data: Buffer) => {
        this.handleOutput(data.toString('utf8'), 'stderr');
      });

      // 7. ดักจับข้อผิดพลาดของ Process
      this.process.on('error', (err: Error) => {
        this.logger.error({ err }, `[${this.config.name}] เกิดข้อผิดพลาดของ Process`);
        this.handleProcessExit(1);
      });

      // 8. ดักจับการปิดตัวของ Process
      this.process.on('close', (code: number | null) => {
        this.logger.info(`[${this.config.name}] Process ปิดตัวลง (Exit Code: ${code})`);
        this.handleProcessExit(code ?? 0);
      });

    } catch (err) {
      this.setState(ServerState.CRASHED);
      throw err;
    }
  }

  /** สั่งปิดเซิร์ฟเวอร์อย่างปลอดภัย (Graceful Stop Sequence) */
  public async stop(): Promise<void> {
    if (this.state !== ServerState.ONLINE && this.state !== ServerState.STARTING) {
      throw new Error(`ไม่สามารถสั่งปิดเซิร์ฟเวอร์ได้เนื่องจากสถานะปัจจุบันคือ ${this.state}`);
    }

    this.logger.info(`[${this.config.name}] กำลังสั่งปิดเซิร์ฟเวอร์แบบ Graceful...`);
    this.setState(ServerState.STOPPING);

    // 1. ส่งคำสั่งบันทึกข้อมูลโลกทั้งหมด (save-all)
    this.sendCommand('save-all');

    // 2. หน่วงเวลา 2 วินาทีให้เซิร์ฟเวอร์เขียนดิสก์เสร็จ แล้วส่งคำสั่ง stop
    setTimeout(() => {
      this.sendCommand('stop');
    }, 2000);

    // 3. กำหนดเวลา Timeout สูงสุด 30 วินาที หากเซิร์ฟเวอร์ค้าง ให้ใช้ taskkill บน Windows
    if (this.stopTimeoutTimer) clearTimeout(this.stopTimeoutTimer);

    this.stopTimeoutTimer = setTimeout(() => {
      if (this.state === ServerState.STOPPING && this.pid) {
        this.logger.warn(`[${this.config.name}] เซิร์ฟเวอร์ไม่ตอบสนองหลังผ่านไป 30 วินาที กำลังใช้ Taskkill บังคับปิด...`);
        this.forceKill();
      }
    }, 30000);
  }

  /** สั่งรีสตาร์ทเซิร์ฟเวอร์ */
  public async restart(): Promise<void> {
    this.logger.info(`[${this.config.name}] กำลังสั่งรีสตาร์ทเซิร์ฟเวอร์...`);
    if (this.state === ServerState.ONLINE) {
      // รอให้เซิร์ฟเวอร์ปิดสนิทก่อน แล้วจึงเปิดใหม่
      const onExit = () => {
        this.removeListener('exit', onExit);
        setTimeout(() => this.start(), 2000);
      };
      this.once('exit', onExit);
      await this.stop();
    } else if (this.state === ServerState.OFFLINE || this.state === ServerState.CRASHED) {
      await this.start();
    }
  }

  /** บังคับปิด Process บน Windows ทันทีด้วย Taskkill (Force Kill) */
  public forceKill(): void {
    if (!this.pid) return;

    this.logger.warn(`[${this.config.name}] ดำเนินการ Taskkill /PID ${this.pid} /T /F...`);
    exec(`taskkill /PID ${this.pid} /T /F`, (err) => {
      if (err) {
        this.logger.error({ err }, `[${this.config.name}] ไม่สามารถรัน taskkill ได้`);
      }
    });
  }

  /** ส่งคำสั่งข้อความเข้าไปยังท่อ stdin ของ Minecraft */
  public sendCommand(cmd: string): void {
    if (!this.process || !this.process.stdin || this.process.killed) {
      return;
    }
    const cleanCmd = cmd.trim();
    this.process.stdin.write(cleanCmd + '\n');
    this.logger.debug(`[${this.config.name}] stdin << ${cleanCmd}`);
  }

  /** จัดการข้อความที่ออกมาจาก stdout / stderr */
  private handleOutput(text: string, source: 'stdout' | 'stderr'): void {
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      if (!line.trim()) continue;

      const output: ConsoleOutput = {
        serverId: this.config.id,
        timestamp: new Date().toISOString(),
        line,
        source,
      };

      this.consoleBuffer.push(output);
      this.emit('log', output);

      // ตรวจจับว่าเซิร์ฟเวอร์เปิดเสร็จสมบูรณ์หรือยัง (Minecraft / Paper Done pattern)
      if (this.state === ServerState.STARTING) {
        if (/Done \([0-9.]+s\)! For help, type/i.test(line) || /Done \([0-9.]+s\)!/i.test(line)) {
          this.logger.info(`[${this.config.name}] ตรวจพบเซิร์ฟเวอร์พร้อมใช้งาน (ONLINE)!`);
          this.setState(ServerState.ONLINE);
          this.crashCount = 0; // รีเซ็ตจำนวนครั้งที่แครช
        }

        // ตรวจจับเวอร์ชันของ Minecraft
        const verMatch = line.match(/Starting minecraft server version ([0-9.]+)/i);
        if (verMatch) {
          this.minecraftVersion = verMatch[1];
        }
      }
    }
  }

  /** จัดการเมื่อ Process จบการทำงาน */
  private handleProcessExit(code: number): void {
    if (this.stopTimeoutTimer) {
      clearTimeout(this.stopTimeoutTimer);
      this.stopTimeoutTimer = null;
    }

    const wasStopping = this.state === ServerState.STOPPING;
    this.process = null;
    this.pid = null;

    // ตัดการเชื่อมต่อ RCON ทันทีที่เซิร์ฟเวอร์ปิดตัวลง
    RconPool.getInstance().disconnect(this.config.id);

    if (code === 0 || wasStopping) {
      this.setState(ServerState.OFFLINE);
    } else {
      this.lastCrashAt = new Date();
      this.crashCount++;
      this.logger.warn(`[${this.config.name}] เซิร์ฟเวอร์ปิดตัวผิดปกติ (Crash Count: ${this.crashCount})`);
      this.setState(ServerState.CRASHED);

      // ตรวจสอบระบบ Auto-Restart
      if (this.config.autoRestart && this.crashCount <= this.config.maxCrashRestarts) {
        this.logger.info(`[${this.config.name}] เตรียมรีสตาร์ทอัตโนมัติในอีก 5 วินาที... (ครั้งที่ ${this.crashCount})`);
        setTimeout(() => {
          this.start().catch((err) => {
            this.logger.error({ err }, `[${this.config.name}] ล้มเหลวในการรีสตาร์ทอัตโนมัติ`);
          });
        }, 5000);
      }
    }

    this.emit('exit', code);
  }

  /** ดึงสถิติ CPU, RAM, Uptime ในปัจจุบัน */
  public async getTelemetry(): Promise<ServerStatus> {
    let cpuPercent = 0;
    let memoryUsageMB = 0;

    if (this.pid && (this.state === ServerState.ONLINE || this.state === ServerState.STARTING)) {
      try {
        const stats = await pidusage(this.pid);
        cpuPercent = Math.round(stats.cpu * 10) / 10;
        memoryUsageMB = Math.round(stats.memory / 1024 / 1024);
      } catch (_err) {
        // pid อาจจบการทำงานไปแล้ว
      }
    }

    const uptimeSeconds = this.startedAt && this.state === ServerState.ONLINE
      ? Math.floor((Date.now() - this.startedAt.getTime()) / 1000)
      : 0;

    return {
      id: this.config.id,
      state: this.state,
      pid: this.pid,
      playerCount: 0, // ใน Phase 4 จะดึงผ่าน RCON
      maxPlayers: 20,
      cpuPercent,
      memoryUsageMB,
      memoryAllocatedMB: parseInt(this.config.maxMemory) * 1024 || 2048,
      diskUsageMB: 0,
      uptimeSeconds,
      minecraftVersion: this.minecraftVersion,
      startedAt: this.startedAt ? this.startedAt.toISOString() : null,
      lastCrashAt: this.lastCrashAt ? this.lastCrashAt.toISOString() : null,
      crashCount: this.crashCount,
    };
  }

  /** ปรับเปลี่ยนสถานะและกระจาย Event */
  private setState(newState: ServerState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.logger.info(`[${this.config.name}] เปลี่ยนสถานะ: ${oldState} ──► ${newState}`);
      this.emit('state_change', { serverId: this.config.id, oldState, newState });
    }
  }
}
