/**
 * สถานะของเซิร์ฟเวอร์ Minecraft (State Machine)
 * 
 * ลำดับการเปลี่ยนสถานะ:
 *   OFFLINE (ปิดอยู่) ──► STARTING (กำลังเปิด) ──► ONLINE (ออนไลน์พร้อมเล่น) ──► STOPPING (กำลังปิด) ──► OFFLINE
 *   STARTING ──► CRASHED (เปิดไม่ขึ้น / เออเร่อ)
 *   ONLINE ──► CRASHED (เซิร์ฟเวอร์ดับกะทันหัน)
 *   STOPPING ──► CRASHED (ปิดเซิร์ฟเวอร์ไม่สำเร็จ / ค้าง)
 *   CRASHED ──► STARTING (สั่งรีสตาร์ทใหม่)
 *   CRASHED ──► OFFLINE (กดยืนยันรับทราบข้อผิดพลาด)
 */
export enum ServerState {
  OFFLINE = 'OFFLINE',     // ปิดอยู่
  STARTING = 'STARTING',   // กำลังเริ่มทำงาน
  ONLINE = 'ONLINE',       // เปิดใช้งานปกติ
  STOPPING = 'STOPPING',   // กำลังปิดตัวลงอย่างปลอดภัย
  CRASHED = 'CRASHED',     // เกิดข้อผิดพลาด / เซิร์ฟเวอร์ดับ
}

/** ข้อมูลการตั้งค่าเซิร์ฟเวอร์ที่บันทึกไว้ในฐานข้อมูล */
export interface ServerConfig {
  id: string;                      // รหัสประจำเซิร์ฟเวอร์ (UUID)
  name: string;                    // ชื่อเซิร์ฟเวอร์ เช่น "Survival", "Skyblock"
  slug: string;                    // ชื่ออ้างอิงภาษาอังกฤษตัวพิมพ์เล็ก
  rootPath: string;                // เส้นทางโฟลเดอร์เซิร์ฟเวอร์บน Windows เช่น C:\MinecraftServers\survival
  jarFile: string;                 // ชื่อไฟล์หลัก เช่น paper.jar
  javaPath: string;                // เส้นทางไฟล์ Java เช่น java หรือ C:\Program Files\Java\...
  javaArgs: string;                // พารามิเตอร์เริ่มต้นสำหรับ JVM
  gamePort: number;                // พอร์ตสำหรับให้ผู้เล่นเชื่อมต่อ (ปกติ 25565)
  rconPort: number;                // พอร์ตสำหรับส่งคำสั่ง RCON (ปกติ 25575)
  minMemory: string;               // แรมขั้นต่ำ เช่น "2G"
  maxMemory: string;               // แรมสูงสุด เช่น "8G"
  autoRestart: boolean;            // เปิดใช้งานรีสตาร์ทอัตโนมัติเมื่อเซิร์ฟเวอร์ดับหรือไม่
  autoBackup: boolean;             // เปิดใช้งานสำรองข้อมูลอัตโนมัติตามกำหนดการหรือไม่
  maxCrashRestarts: number;        // จำนวนครั้งสูงสุดที่จะพยายามเปิดใหม่หากเซิร์ฟเวอร์ดับติดๆ กัน
  sortOrder: number;               // ลำดับการแสดงผลบนหน้า Dashboard
  createdAt: string;               // วันเวลาที่สร้าง
  updatedAt: string;               // วันเวลาที่แก้ไขล่าสุด
}

/** สถานะการทำงานจริงของเซิร์ฟเวอร์ ณ ปัจจุบัน (เก็บในหน่วยความจำ RAM ไม่ได้เก็บลงฐานข้อมูล) */
export interface ServerStatus {
  id: string;                      // รหัสเซิร์ฟเวอร์
  state: ServerState;              // สถานะปัจจุบัน (OFFLINE, ONLINE ฯลฯ)
  pid: number | null;              // หมายเลข Process ID ใน Windows
  playerCount: number;             // จำนวนผู้เล่นที่ออนไลน์อยู่ในขณะนี้
  maxPlayers: number;              // จำนวนผู้เล่นสูงสุดที่รับได้
  cpuPercent: number;              // เปอร์เซ็นต์การใช้งาน CPU
  memoryUsageMB: number;           // แรมที่ใช้งานจริง (MB)
  memoryAllocatedMB: number;       // แรมที่จัดสรรไว้ (MB)
  diskUsageMB: number;             // ขนาดพื้นที่โฟลเดอร์เซิร์ฟเวอร์ที่ใช้ไป (MB)
  uptimeSeconds: number;           // ระยะเวลาที่เปิดเซิร์ฟเวอร์มา (วินาที)
  minecraftVersion: string | null;  // เวอร์ชัน Minecraft เช่น "1.21.x"
  startedAt: string | null;        // วันเวลาที่เริ่มรัน
  lastCrashAt: string | null;      // วันเวลาที่เซิร์ฟเวอร์ดับครั้งล่าสุด
  crashCount: number;              // จำนวนครั้งที่เซิร์ฟเวอร์ดับไป
}

/** ข้อมูลรวมของเซิร์ฟเวอร์สำหรับแสดงผลบนหน้าต่าง Dashboard */
export interface ServerInfo {
  config: ServerConfig;            // ข้อมูลการตั้งค่า
  status: ServerStatus;            // ข้อมูลสถานะการทำงานจริง
}

/** ข้อมูลที่ต้องส่งมาเมื่อต้องการสร้างเซิร์ฟเวอร์ใหม่ */
export interface CreateServerPayload {
  name: string;                    // ชื่อเซิร์ฟเวอร์
  rootPath: string;                // โฟลเดอร์เซิร์ฟเวอร์
  jarFile: string;                 // ชื่อไฟล์ jar
  javaPath?: string;               // เส้นทาง Java
  javaArgs?: string;               // คำสั่งพิเศษของ Java
  gamePort: number;                // พอร์ตเกม
  rconPort: number;                // พอร์ต RCON
  rconPassword: string;            // รหัสผ่าน RCON (จะถูกเข้ารหัสก่อนบันทึก)
  minMemory: string;               // แรมขั้นต่ำ เช่น "2G"
  maxMemory: string;               // แรมสูงสุด เช่น "6G"
  autoRestart?: boolean;           // เปิดใช้งานรีสตาร์ทอัตโนมัติหรือไม่
  autoBackup?: boolean;            // เปิดใช้งานสำรองข้อมูลอัตโนมัติหรือไม่
  maxCrashRestarts?: number;       // รีสตาร์ทได้สูงสุดกี่ครั้ง
}

/** ข้อมูลที่ต้องส่งมาเมื่อต้องการแก้ไขการตั้งค่าเซิร์ฟเวอร์ */
export interface UpdateServerPayload {
  name?: string;
  jarFile?: string;
  javaPath?: string;
  javaArgs?: string;
  gamePort?: number;
  rconPort?: number;
  rconPassword?: string;
  minMemory?: string;
  maxMemory?: string;
  autoRestart?: boolean;
  autoBackup?: boolean;
  maxCrashRestarts?: number;
}

/** ข้อมูลสำหรับส่งคำสั่งผ่าน RCON */
export interface RconCommandPayload {
  command: string;
}

/** ผลลัพธ์จากการรันคำสั่ง RCON */
export interface RconCommandResult {
  command: string;
  response: string;
  executionTimeMs: number;
}

/** สถานะการเชื่อมต่อ RCON */
export interface RconStatus {
  connected: boolean;
  host: string;
  port: number;
}
