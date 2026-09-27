/** รูปแบบมาตรฐานของการตอบกลับจาก API (Standard API Response) */
export interface ApiResponse<T = unknown> {
  success: boolean;                // สถานะว่าคำขอสำเร็จหรือไม่ (true / false)
  data?: T;                        // ข้อมูลที่ส่งกลับเมื่อสำเร็จ
  error?: ApiError;                // รายละเอียดข้อผิดพลาดเมื่อไม่สำเร็จ
  meta?: PaginationMeta;           // ข้อมูลแบ่งหน้า (ถ้ามี)
}

/** โครงสร้างของข้อผิดพลาดจาก API */
export interface ApiError {
  code: string;                    // รหัสข้อผิดพลาด เช่น "SERVER_NOT_FOUND"
  message: string;                 // ข้อความอธิบายข้อผิดพลาดที่เข้าใจง่าย
  details?: Record<string, string[]>; // รายละเอียดเพิ่มเติม เช่น ฟิลด์ที่กรอกไม่ถูกต้อง
}

/** ข้อมูลสำหรับการแบ่งหน้า (Pagination) */
export interface PaginationMeta {
  page: number;                    // หน้าปัจจุบัน
  pageSize: number;                // จำนวนรายการต่อหน้า
  totalCount: number;              // จำนวนรายการทั้งหมด
  totalPages: number;              // จำนวนหน้าทั้งหมด
}

/** พารามิเตอร์ที่ส่งไปเพื่อขอข้อมูลแบบแบ่งหน้า */
export interface PaginationParams {
  page?: number;                   // หน้าที่ต้องการ
  pageSize?: number;               // จำนวนที่ต้องการดู
  sortBy?: string;                 // เรียงลำดับตามฟิลด์ใด
  sortOrder?: 'asc' | 'desc';      // เรียงจากน้อยไปมาก หรือมากไปน้อย
}

/** รหัสข้อผิดพลาดมาตรฐานที่ใช้ทั่วทั้งระบบ (Error Codes) */
export enum ErrorCode {
  // ข้อผิดพลาดด้านการยืนยันตัวตนและสิทธิ์
  UNAUTHORIZED = 'UNAUTHORIZED',               // ยังไม่ได้เข้าสู่ระบบ
  FORBIDDEN = 'FORBIDDEN',                     // ไม่มีสิทธิ์เข้าถึงส่วนนี้
  INVALID_TOKEN = 'INVALID_TOKEN',             // โทเค็นไม่ถูกต้อง
  SESSION_EXPIRED = 'SESSION_EXPIRED',         // เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่

  // ข้อผิดพลาดด้านข้อมูลนำเข้า
  VALIDATION_ERROR = 'VALIDATION_ERROR',       // ข้อมูลที่ส่งมาไม่ถูกต้องตามเงื่อนไข
  INVALID_INPUT = 'INVALID_INPUT',             // รูปแบบข้อมูลไม่ถูกต้อง

  // ข้อผิดพลาดด้านเซิร์ฟเวอร์ Minecraft
  SERVER_NOT_FOUND = 'SERVER_NOT_FOUND',               // ไม่พบเซิร์ฟเวอร์นี้ในระบบ
  SERVER_ALREADY_RUNNING = 'SERVER_ALREADY_RUNNING',   // เซิร์ฟเวอร์กำลังเปิดทำงานอยู่แล้ว
  SERVER_NOT_RUNNING = 'SERVER_NOT_RUNNING',           // เซิร์ฟเวอร์ไม่ได้เปิดอยู่
  SERVER_STARTING = 'SERVER_STARTING',                 // เซิร์ฟเวอร์กำลังอยู่ในขั้นตอนการเปิด
  SERVER_STOPPING = 'SERVER_STOPPING',                 // เซิร์ฟเวอร์กำลังอยู่ในขั้นตอนการปิด
  SERVER_START_FAILED = 'SERVER_START_FAILED',         // เปิดเซิร์ฟเวอร์ไม่สำเร็จ
  JAVA_NOT_FOUND = 'JAVA_NOT_FOUND',                   // ตรวจไม่พบโปรแกรม Java บนเครื่อง
  INVALID_SERVER_PATH = 'INVALID_SERVER_PATH',         // เส้นทางโฟลเดอร์เซิร์ฟเวอร์ไม่ถูกต้อง
  INVALID_JAR = 'INVALID_JAR',                         // ไม่พบไฟล์ .jar ที่ระบุ
  PORT_CONFLICT = 'PORT_CONFLICT',                     // พอร์ตนี้ถูกใช้งานซ้ำซ้อน

  // ข้อผิดพลาดด้าน RCON
  RCON_CONNECTION_FAILED = 'RCON_CONNECTION_FAILED',   // เชื่อมต่อ RCON ไม่สำเร็จ
  RCON_COMMAND_FAILED = 'RCON_COMMAND_FAILED',         // ส่งคำสั่ง RCON ไม่สำเร็จ
  RCON_TIMEOUT = 'RCON_TIMEOUT',                       // การเชื่อมต่อ RCON หมดเวลา
  RCON_AUTH_FAILED = 'RCON_AUTH_FAILED',               // รหัสผ่าน RCON ไม่ถูกต้อง

  // ข้อผิดพลาดด้านระบบไฟล์
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',           // ไม่พบไฟล์ที่ต้องการ
  PATH_TRAVERSAL = 'PATH_TRAVERSAL',           // ตรวจพบความพยายามเข้าถึงไฟล์นอก Sandbox
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',           // ขนาดไฟล์ใหญ่เกินขีดจำกัด
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',     // ประเภทไฟล์ไม่อนุญาต

  // ข้อผิดพลาดด้านการสำรองข้อมูล
  BACKUP_NOT_FOUND = 'BACKUP_NOT_FOUND',       // ไม่พบไฟล์สำรองข้อมูลนี้
  BACKUP_IN_PROGRESS = 'BACKUP_IN_PROGRESS',   // มีการสำรองข้อมูลกำลังดำเนินการอยู่
  BACKUP_FAILED = 'BACKUP_FAILED',             // สำรองข้อมูลไม่สำเร็จ
  RESTORE_FAILED = 'RESTORE_FAILED',           // กู้คืนข้อมูลไม่สำเร็จ

  // ข้อผิดพลาดทั่วไป
  INTERNAL_ERROR = 'INTERNAL_ERROR',           // ข้อผิดพลาดภายในเซิร์ฟเวอร์
  NOT_FOUND = 'NOT_FOUND',                     // ไม่พบทรัพยากรที่ร้องขอ
  RATE_LIMITED = 'RATE_LIMITED',               // มีการส่งคำขอถี่เกินไป
  CONFLICT = 'CONFLICT',                       // ข้อมูลขัดแย้งกับที่มีอยู่เดิม
}
