import net from 'net';
import { prisma } from '@minecraft-panel/database';
import { ServerInfo, ServerStatus } from '@minecraft-panel/shared';
import { ProcessInstance, ProcessConfig } from './process-instance.js';
import { createLogger } from '../../config/index.js';

/**
 * ServerManager (Singleton)
 * ศูนย์กลางการจัดการเซิร์ฟเวอร์ Minecraft ทั้งหมดบนระบบ
 */
export class ServerManager {
  private static instance: ServerManager | null = null;
  private instances: Map<string, ProcessInstance> = new Map();
  private logger = createLogger('server-manager');

  private constructor() {}

  /** ดึง Instance เดียวของ ServerManager */
  public static getInstance(): ServerManager {
    if (!this.instance) {
      this.instance = new ServerManager();
    }
    return this.instance;
  }

  /** โหลดและลงทะเบียนเซิร์ฟเวอร์ทั้งหมดจากฐานข้อมูลเข้าสู่หน่วยความจำ */
  public async initialize(): Promise<void> {
    this.logger.info('🚀 กำลังเริ่มต้นระบบ ServerManager และโหลดข้อมูลเซิร์ฟเวอร์...');
    const servers = await prisma.server.findMany();

    for (const server of servers) {
      this.registerServer({
        id: server.id,
        name: server.name,
        rootPath: server.rootPath,
        jarFile: server.jarFile,
        javaPath: server.javaPath,
        javaArgs: server.javaArgs,
        gamePort: server.gamePort,
        rconPort: server.rconPort,
        minMemory: server.minMemory,
        maxMemory: server.maxMemory,
        autoRestart: server.autoRestart,
        maxCrashRestarts: server.maxCrashRestarts,
      });
    }

    this.logger.info(`✅ ลงทะเบียนเซิร์ฟเวอร์เรียบร้อยแล้ว: ${this.instances.size} เซิร์ฟเวอร์`);
  }

  /** ลงทะเบียน ProcessInstance ใหม่ */
  public registerServer(config: ProcessConfig): ProcessInstance {
    if (this.instances.has(config.id)) {
      return this.instances.get(config.id)!;
    }

    const instance = new ProcessInstance(config);

    // ดักจับ Event จาก Instance
    instance.on('state_change', ({ serverId, oldState, newState }) => {
      this.logger.info(`[Server: ${config.name} (${serverId})] สถานะเปลี่ยนจาก ${oldState} ➔ ${newState}`);
    });

    this.instances.set(config.id, instance);
    return instance;
  }

  /** ดึง ProcessInstance ตาม ID */
  public getInstance(serverId: string): ProcessInstance | undefined {
    return this.instances.get(serverId);
  }

  /** ดึงสถานะและ Telemetry ของเซิร์ฟเวอร์ตาม ID */
  public async getServerStatus(serverId: string): Promise<ServerStatus> {
    const instance = this.instances.get(serverId);
    if (!instance) {
      throw new Error('ไม่พบเซิร์ฟเวอร์นี้ในระบบ');
    }
    return instance.getTelemetry();
  }

  /** ตรวจสอบว่าพอร์ตว่างหรือไม่ */
  public static async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on('error', () => resolve(false));
      server.listen(port, '0.0.0.0', () => {
        server.close(() => resolve(true));
      });
    });
  }

  /** สั่งเปิดเซิร์ฟเวอร์ */
  public async startServer(serverId: string): Promise<void> {
    const instance = this.instances.get(serverId);
    if (!instance) {
      throw new Error('ไม่พบเซิร์ฟเวอร์นี้ในระบบ');
    }

    // ตรวจสอบพอร์ตเกมว่ามีอะไรใช้งานอยู่หรือไม่
    const isPortFree = await ServerManager.isPortAvailable(instance.config.gamePort);
    if (!isPortFree) {
      throw new Error(`พอร์ตเกม ${instance.config.gamePort} ถูกใช้งานอยู่แล้วในระบบ`);
    }

    await instance.start();
  }

  /** สั่งปิดเซิร์ฟเวอร์แบบ Graceful */
  public async stopServer(serverId: string): Promise<void> {
    const instance = this.instances.get(serverId);
    if (!instance) {
      throw new Error('ไม่พบเซิร์ฟเวอร์นี้ในระบบ');
    }
    await instance.stop();
  }

  /** สั่งรีสตาร์ทเซิร์ฟเวอร์ */
  public async restartServer(serverId: string): Promise<void> {
    const instance = this.instances.get(serverId);
    if (!instance) {
      throw new Error('ไม่พบเซิร์ฟเวอร์นี้ในระบบ');
    }
    await instance.restart();
  }

  /** บังคับปิด Process ทันที (Force Kill) */
  public forceKillServer(serverId: string): void {
    const instance = this.instances.get(serverId);
    if (!instance) {
      throw new Error('ไม่พบเซิร์ฟเวอร์นี้ในระบบ');
    }
    instance.forceKill();
  }

  /** ดึงข้อมูลรวมของเซิร์ฟเวอร์ทั้งหมดสำหรับ Dashboard */
  public async getAllServersInfo(): Promise<ServerInfo[]> {
    const dbServers = await prisma.server.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    const result: ServerInfo[] = [];

    for (const dbServer of dbServers) {
      let instance = this.instances.get(dbServer.id);
      if (!instance) {
        instance = this.registerServer({
          id: dbServer.id,
          name: dbServer.name,
          rootPath: dbServer.rootPath,
          jarFile: dbServer.jarFile,
          javaPath: dbServer.javaPath,
          javaArgs: dbServer.javaArgs,
          gamePort: dbServer.gamePort,
          rconPort: dbServer.rconPort,
          minMemory: dbServer.minMemory,
          maxMemory: dbServer.maxMemory,
          autoRestart: dbServer.autoRestart,
          maxCrashRestarts: dbServer.maxCrashRestarts,
        });
      }

      const telemetry = await instance.getTelemetry();

      result.push({
        config: {
          id: dbServer.id,
          name: dbServer.name,
          slug: dbServer.slug,
          rootPath: dbServer.rootPath,
          jarFile: dbServer.jarFile,
          javaPath: dbServer.javaPath,
          javaArgs: dbServer.javaArgs,
          gamePort: dbServer.gamePort,
          rconPort: dbServer.rconPort,
          minMemory: dbServer.minMemory,
          maxMemory: dbServer.maxMemory,
          autoRestart: dbServer.autoRestart,
          autoBackup: dbServer.autoBackup,
          maxCrashRestarts: dbServer.maxCrashRestarts,
          sortOrder: dbServer.sortOrder,
          createdAt: dbServer.createdAt.toISOString(),
          updatedAt: dbServer.updatedAt.toISOString(),
        },
        status: telemetry,
      });
    }

    return result;
  }
}
