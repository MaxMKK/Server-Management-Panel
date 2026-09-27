/** รายชื่อ Event ของ WebSocket — ใช้ร่วมกันระหว่างฝั่ง Client และ Server */
export enum WsEvent {
  // สถานะเซิร์ฟเวอร์
  SERVER_STATUS = 'server:status',             // ข้อมูลสถานะทั่วไป (ผู้เล่น, แรม, cpu)
  SERVER_STATE_CHANGE = 'server:state-change', // การเปลี่ยนสถานะ (เช่น OFFLINE -> STARTING)

  // คอนโซลสด
  CONSOLE_OUTPUT = 'console:output',           // ข้อความ output จากคอนโซล
  CONSOLE_COMMAND = 'console:command',         // คำสั่งที่ถูกส่งไป
  CONSOLE_CLEAR = 'console:clear',             // สั่งล้างหน้าจอคอนโซล

  // เหตุการณ์เกี่ยวกับผู้เล่น
  PLAYER_JOIN = 'player:join',                 // ผู้เล่นเข้าเซิร์ฟเวอร์
  PLAYER_LEAVE = 'player:leave',               // ผู้เล่นออกจากเซิร์ฟเวอร์
  PLAYER_LIST = 'player:list',                 // รายชื่อผู้เล่นที่ออนไลน์ล่าสุด

  // เหตุการณ์สำรองข้อมูล
  BACKUP_PROGRESS = 'backup:progress',         // ความคืบหน้าการสำรองข้อมูล
  BACKUP_COMPLETE = 'backup:complete',         // สำรองข้อมูลเสร็จสิ้น
  BACKUP_FAILED = 'backup:failed',             // สำรองข้อมูลล้มเหลว

  // สถิติระบบ
  METRICS_UPDATE = 'metrics:update',           // อัปเดตข้อมูล CPU/RAM/Disk

  // การจัดการห้อง (Room) สำหรับรับข้อความเฉพาะเซิร์ฟเวอร์ที่เลือก
  JOIN_SERVER = 'join:server',                 // เข้าห้องรับข้อมูลของเซิร์ฟเวอร์นี้
  LEAVE_SERVER = 'leave:server',               // ออกจากห้องรับข้อมูล

  // ข้อผิดพลาดในการยืนยันตัวตน
  AUTH_ERROR = 'auth:error',                   // เกิดข้อผิดพลาดด้านสิทธิ์การเชื่อมต่อ
}

/** โครงสร้างข้อมูลแต่ละบรรทัดที่ส่งออกจาก Console */
export interface ConsoleOutput {
  serverId: string;                            // รหัสเซิร์ฟเวอร์
  timestamp: string;                           // วันเวลาที่ข้อความออก
  line: string;                                // ข้อความในบรรทัดนั้น
  source: 'stdout' | 'stderr';                 // แหล่งที่มา (ข้อมูลทั่วไป หรือ ข้อผิดพลาด)
}

/** ข้อมูลสถิติของเซิร์ฟเวอร์แบบ Real-time */
export interface MetricsUpdate {
  serverId: string;                            // รหัสเซิร์ฟเวอร์
  cpuPercent: number;                          // อัตราการใช้ CPU (%)
  memoryUsageMB: number;                       // อัตราการใช้แรม (MB)
  playerCount: number;                         // จำนวนผู้เล่นปัจจุบัน
  tps: number | null;                          // ค่า Tick per second (TPS) ถ้ามี
  timestamp: string;                           // วันเวลาที่บันทึก
}

/** ข้อมูลเหตุการณ์ของผู้เล่น */
export interface PlayerEvent {
  serverId: string;                            // รหัสเซิร์ฟเวอร์
  username: string;                            // ชื่อผู้เล่น
  uuid: string | null;                         // รหัสประจำตัวสากลของผู้เล่น (UUID)
  action: 'join' | 'leave';                    // เข้า หรือ ออก
  timestamp: string;                           // วันเวลา
}
