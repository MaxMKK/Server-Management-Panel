import net from 'node:net';
import { EventEmitter } from 'node:events';
import { encodePacket, decodePacket, RconPacketType } from './rcon-protocol.js';

export interface RconOptions {
  host: string;
  port: number;
  password: string;
  timeoutMs?: number;
}

interface PendingRequest {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

/**
 * RconClient จัดการการเชื่อมต่อไปยัง Minecraft RCON ผ่าน TCP Socket
 * พร้อมระบบจัดการ Timeout, Queue และ Authentication อัตโนมัติ
 */
export class RconClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private currentRequestId = 100;
  private pendingRequests = new Map<number, PendingRequest>();
  private authenticated = false;
  private connected = false;

  constructor(private readonly options: RconOptions) {
    super();
  }

  public isConnected(): boolean {
    return this.connected && this.authenticated;
  }

  /**
   * เชื่อมต่อ TCP Socket และทำการ Authenticate ด้วยรหัสผ่าน
   */
  public async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = this.options.timeoutMs ?? 5000;
      let connectTimer: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (connectTimer) clearTimeout(connectTimer);
      };

      try {
        this.socket = net.connect({
          host: this.options.host,
          port: this.options.port,
        });

        connectTimer = setTimeout(() => {
          cleanup();
          this.disconnect();
          reject(new Error(`การเชื่อมต่อ RCON ไปยัง ${this.options.host}:${this.options.port} หมดเวลา (Timeout ${timeout}ms)`));
        }, timeout);

        this.socket.on('connect', async () => {
          this.connected = true;
          try {
            await this.authenticate();
            cleanup();
            resolve();
          } catch (err) {
            cleanup();
            this.disconnect();
            reject(err);
          }
        });

        this.socket.on('data', (chunk: Buffer) => {
          this.handleData(chunk);
        });

        this.socket.on('error', (err: Error) => {
          cleanup();
          this.emit('error', err);
          this.rejectAllPending(err);
          if (!this.connected) {
            reject(err);
          }
        });

        this.socket.on('close', () => {
          this.connected = false;
          this.authenticated = false;
          this.rejectAllPending(new Error('การเชื่อมต่อ RCON ถูกปิด'));
          this.emit('close');
        });
      } catch (err) {
        cleanup();
        reject(err);
      }
    });
  }

  /**
   * ส่งแพ็กเก็ต Authenticate ไปยังเซิร์ฟเวอร์
   */
  private async authenticate(): Promise<void> {
    const authId = this.nextId();
    const packet = encodePacket(authId, RconPacketType.AUTH, this.options.password);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(authId);
        reject(new Error('การยืนยันสิทธิ์ RCON หมดเวลา (Auth Timeout)'));
      }, this.options.timeoutMs ?? 5000);

      this.pendingRequests.set(authId, {
        resolve: () => {
          this.authenticated = true;
          resolve();
        },
        reject: (err) => {
          reject(err);
        },
        timer,
      });

      this.socket?.write(packet);
    });
  }

  /**
   * ส่งคำสั่ง RCON ไปยังเซิร์ฟเวอร์ Minecraft และรอรับผลลัพธ์
   */
  public async send(command: string): Promise<string> {
    if (!this.isConnected() || !this.socket) {
      throw new Error('RCON Client ยังไม่ได้เชื่อมต่อหรือยังไม่ผ่านการ Authenticate');
    }

    const reqId = this.nextId();
    const packet = encodePacket(reqId, RconPacketType.EXECCOMMAND, command);

    return new Promise((resolve, reject) => {
      const timeout = this.options.timeoutMs ?? 10000;
      const timer = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error(`คำสั่ง RCON "${command}" หมดเวลาการรอผลลัพธ์ (${timeout}ms)`));
      }, timeout);

      this.pendingRequests.set(reqId, {
        resolve,
        reject,
        timer,
      });

      this.socket?.write(packet);
    });
  }

  /**
   * ตัดการเชื่อมต่อ RCON
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    this.authenticated = false;
    this.buffer = Buffer.alloc(0);
    this.rejectAllPending(new Error('RCON client ถูกสั่ง disconnect'));
  }

  private nextId(): number {
    this.currentRequestId = (this.currentRequestId + 1) % 1000000;
    return this.currentRequestId;
  }

  private rejectAllPending(err: Error): void {
    for (const [, req] of this.pendingRequests.entries()) {
      clearTimeout(req.timer);
      req.reject(err);
    }
    this.pendingRequests.clear();
  }

  private handleData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.buffer.length >= 4) {
      const decoded = decodePacket(this.buffer);
      if (!decoded) {
        break; // ข้อมูลยังมาไม่ครบแพ็กเก็ต รอ chunk ถัดไป
      }

      this.buffer = this.buffer.subarray(decoded.bytesRead);
      const { packet } = decoded;

      // ตรวจสอบผลการ Authenticate
      if (packet.id === -1) {
        // -1 แสดงว่ารหัสผ่าน RCON ไม่ถูกต้อง
        for (const [id, req] of this.pendingRequests.entries()) {
          clearTimeout(req.timer);
          req.reject(new Error('รหัสผ่าน RCON ไม่ถูกต้อง (Authentication Failed)'));
          this.pendingRequests.delete(id);
          break;
        }
        continue;
      }

      const pending = this.pendingRequests.get(packet.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(packet.id);
        pending.resolve(packet.body);
      }
    }
  }
}
