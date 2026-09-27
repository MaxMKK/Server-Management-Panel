import { RconClient, RconOptions } from './rcon-client.js';

interface PooledConnection {
  client: RconClient;
  lastUsed: number;
  options: RconOptions;
}

/**
 * RconPool บริการจัดการ Pool การเชื่อมต่อ RCON แยกตาม Server ID
 * ช่วยลด Overhead ในการเปิด/ปิด TCP Socket ซ้ำซ้อน และเคลียร์การเชื่อมต่อที่ค้างไม่ได้ใช้งาน
 */
export class RconPool {
  private static instance: RconPool;
  private connections = new Map<string, PooledConnection>();
  private idleTimeoutMs = 60000; // ตัดการเชื่อมต่อหากไม่ได้ใช้งานเกิน 1 นาที
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startCleanupTimer();
  }

  public static getInstance(): RconPool {
    if (!RconPool.instance) {
      RconPool.instance = new RconPool();
    }
    return RconPool.instance;
  }

  /**
   * ดึง Client ที่มีอยู่หรือสร้างการเชื่อมต่อใหม่
   */
  public async getClient(serverId: string, options: RconOptions): Promise<RconClient> {
    const existing = this.connections.get(serverId);

    if (existing && existing.client.isConnected()) {
      // ตรวจสอบว่า host/port ตรงกันหรือไม่
      if (existing.options.host === options.host && existing.options.port === options.port) {
        existing.lastUsed = Date.now();
        return existing.client;
      }
      // หาก config เปลี่ยน ให้ disconnect ตัวเก่า
      existing.client.disconnect();
      this.connections.delete(serverId);
    }

    const client = new RconClient(options);
    await client.connect();

    client.on('close', () => {
      this.connections.delete(serverId);
    });

    client.on('error', () => {
      this.connections.delete(serverId);
    });

    this.connections.set(serverId, {
      client,
      lastUsed: Date.now(),
      options,
    });

    return client;
  }

  /**
   * รันคำสั่ง RCON โดยดึงการเชื่อมต่อจาก Pool อัตโนมัติ
   */
  public async executeCommand(serverId: string, options: RconOptions, command: string): Promise<string> {
    const client = await this.getClient(serverId, options);
    const pooled = this.connections.get(serverId);
    if (pooled) {
      pooled.lastUsed = Date.now();
    }
    return client.send(command);
  }

  /**
   * ปิดการเชื่อมต่อของเซิร์ฟเวอร์ที่ระบุ
   */
  public disconnect(serverId: string): void {
    const existing = this.connections.get(serverId);
    if (existing) {
      existing.client.disconnect();
      this.connections.delete(serverId);
    }
  }

  /**
   * ตรวจสอบว่าเซิร์ฟเวอร์มีการเชื่อมต่อ RCON ค้างอยู่หรือไม่
   */
  public isConnected(serverId: string): boolean {
    const existing = this.connections.get(serverId);
    return !!existing?.client.isConnected();
  }

  /**
   * ตั้งเวลาตรวจสอบการเชื่อมต่อที่หมดเวลาใช้งาน (Idle Connections)
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [serverId, pooled] of this.connections.entries()) {
        if (now - pooled.lastUsed > this.idleTimeoutMs) {
          pooled.client.disconnect();
          this.connections.delete(serverId);
        }
      }
    }, 30000);

    // ป้องกันไม่ให้ timer ขัดขวาง node process exit
    this.cleanupInterval.unref();
  }

  /**
   * ปิดการเชื่อมต่อทั้งหมดเมื่อแอปพลิเคชันปิดตัวลง
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    for (const [, pooled] of this.connections.entries()) {
      pooled.client.disconnect();
    }
    this.connections.clear();
  }
}
