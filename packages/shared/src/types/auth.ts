/** ระดับบทบาทของผู้ใช้งานในระบบ (Roles) */
export enum UserRole {
  OWNER = 'OWNER',   // เจ้าของระบบ: มีอำนาจสูงสุด ทำได้ทุกอย่าง
  ADMIN = 'ADMIN',   // ผู้ดูแล: จัดการเซิร์ฟเวอร์ ดูแลผู้เล่นได้เกือบทั้งหมด
  USER = 'USER',     // ผู้ใช้ทั่วไป: ดูข้อมูลและสถานะได้อย่างเดียว
}

/** ข้อมูลโปรไฟล์ของผู้ใช้ที่ส่งกลับไปให้หน้าเว็บ */
export interface UserProfile {
  id: string;                      // รหัสผู้ใช้ (UUID)
  discordId: string;               // ไอดีบัญชี Discord
  username: string;                // ชื่อผู้ใช้งาน
  displayName: string;             // ชื่อที่ใช้แสดงผล
  avatarUrl: string | null;        // ลิงก์รูปภาพโปรไฟล์
  role: UserRole;                  // ระดับบทบาท
  isActive: boolean;               // บัญชีเปิดใช้งานอยู่หรือไม่
  lastLoginAt: string | null;      // เข้าสู่ระบบครั้งล่าสุดเมื่อไหร่
  createdAt: string;               // วันเวลาที่สร้างบัญชี
}

/** สิทธิ์การทำงานทั้งหมดในระบบ (Permissions) */
export enum Permission {
  // หมวด: ควบคุมเซิร์ฟเวอร์
  SERVER_VIEW = 'server.view',         // สิทธิ์ดูเซิร์ฟเวอร์
  SERVER_START = 'server.start',       // สิทธิ์เปิดเซิร์ฟเวอร์
  SERVER_STOP = 'server.stop',         // สิทธิ์ปิดเซิร์ฟเวอร์
  SERVER_RESTART = 'server.restart',   // สิทธิ์รีสตาร์ทเซิร์ฟเวอร์
  SERVER_KILL = 'server.kill',         // สิทธิ์บังคับปิด Process (Force Kill)
  SERVER_CREATE = 'server.create',     // สิทธิ์เพิ่มเซิร์ฟเวอร์ใหม่
  SERVER_DELETE = 'server.delete',     // สิทธิ์ลบเซิร์ฟเวอร์

  // หมวด: คอนโซลและคำสั่ง
  CONSOLE_VIEW = 'console.view',       // สิทธิ์ดูหน้าจอ Console
  CONSOLE_EXECUTE = 'console.execute', // สิทธิ์พิมพ์ส่งคำสั่งเข้าเซิร์ฟเวอร์

  // หมวด: จัดการผู้เล่น
  PLAYERS_VIEW = 'players.view',           // สิทธิ์ดูรายชื่อผู้เล่น
  PLAYERS_KICK = 'players.kick',           // สิทธิ์เตะผู้เล่น
  PLAYERS_BAN = 'players.ban',             // สิทธิ์แบนผู้เล่น
  PLAYERS_UNBAN = 'players.unban',         // สิทธิ์ปลดแบนผู้เล่น
  WHITELIST_MANAGE = 'whitelist.manage',   // สิทธิ์จัดการรายชื่อ Whitelist
  OP_MANAGE = 'op.manage',                 // สิทธิ์แต่งตั้งหรือปลด OP

  // หมวด: จัดการปลั๊กอิน
  PLUGINS_VIEW = 'plugins.view',       // สิทธิ์ดูรายชื่อปลั๊กอิน
  PLUGINS_UPLOAD = 'plugins.upload',   // สิทธิ์อัปโหลดปลั๊กอิน
  PLUGINS_DELETE = 'plugins.delete',   // สิทธิ์ลบปลั๊กอิน
  PLUGINS_TOGGLE = 'plugins.toggle',   // สิทธิ์เปิดหรือปิดปลั๊กอิน

  // หมวด: จัดการไฟล์ (File Manager)
  FILES_VIEW = 'files.view',           // สิทธิ์ดูไฟล์และโฟลเดอร์
  FILES_EDIT = 'files.edit',           // สิทธิ์แก้ไขข้อความในไฟล์
  FILES_UPLOAD = 'files.upload',       // สิทธิ์อัปโหลดไฟล์
  FILES_DELETE = 'files.delete',       // สิทธิ์ลบไฟล์

  // หมวด: สำรองข้อมูล (Backup)
  BACKUP_CREATE = 'backup.create',     // สิทธิ์กดสำรองข้อมูล
  BACKUP_RESTORE = 'backup.restore',   // สิทธิ์กู้คืนข้อมูลจากไฟล์สำรอง
  BACKUP_DELETE = 'backup.delete',     // สิทธิ์ลบไฟล์สำรองข้อมูล

  // หมวด: ผู้ดูแลระบบ
  SETTINGS_MANAGE = 'settings.manage', // สิทธิ์แก้ไขการตั้งค่าระบบ
  USERS_MANAGE = 'users.manage',       // สิทธิ์จัดการผู้ใช้งานและเปลี่ยนบทบาท
}

/** ชุดสิทธิ์เริ่มต้นสำหรับแต่ละบทบาท */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // เจ้าของระบบ: ได้รับสิทธิ์ครบทั้งหมด 100%
  [UserRole.OWNER]: Object.values(Permission),

  // ผู้ดูแลระบบ: ได้สิทธิ์ส่วนใหญ่ ยกเว้นการลบเซิร์ฟเวอร์, สิทธิ์ OP และการตั้งค่าระบบหลัก
  [UserRole.ADMIN]: [
    Permission.SERVER_VIEW,
    Permission.SERVER_START,
    Permission.SERVER_STOP,
    Permission.SERVER_RESTART,
    Permission.CONSOLE_VIEW,
    Permission.CONSOLE_EXECUTE,
    Permission.PLAYERS_VIEW,
    Permission.PLAYERS_KICK,
    Permission.PLAYERS_BAN,
    Permission.PLAYERS_UNBAN,
    Permission.WHITELIST_MANAGE,
    Permission.PLUGINS_VIEW,
    Permission.PLUGINS_UPLOAD,
    Permission.PLUGINS_TOGGLE,
    Permission.FILES_VIEW,
    Permission.FILES_EDIT,
    Permission.FILES_UPLOAD,
    Permission.BACKUP_CREATE,
  ],

  // ผู้ใช้ทั่วไป: ดูข้อมูลอย่างเดียว ห้ามแก้ไขหรือกดปุ่มสั่งการ
  [UserRole.USER]: [
    Permission.SERVER_VIEW,
    Permission.CONSOLE_VIEW,
    Permission.PLAYERS_VIEW,
    Permission.PLUGINS_VIEW,
  ],
};

/** หมวดหมู่ของสิทธิ์สำหรับจัดกลุ่มแสดงผลบนหน้าเว็บ */
export const PERMISSION_CATEGORIES: Record<string, Permission[]> = {
  'การจัดการเซิร์ฟเวอร์': [
    Permission.SERVER_VIEW,
    Permission.SERVER_START,
    Permission.SERVER_STOP,
    Permission.SERVER_RESTART,
    Permission.SERVER_KILL,
    Permission.SERVER_CREATE,
    Permission.SERVER_DELETE,
  ],
  'คอนโซลและคำสั่ง': [
    Permission.CONSOLE_VIEW,
    Permission.CONSOLE_EXECUTE,
  ],
  'การจัดการผู้เล่น': [
    Permission.PLAYERS_VIEW,
    Permission.PLAYERS_KICK,
    Permission.PLAYERS_BAN,
    Permission.PLAYERS_UNBAN,
    Permission.WHITELIST_MANAGE,
    Permission.OP_MANAGE,
  ],
  'การจัดการปลั๊กอิน': [
    Permission.PLUGINS_VIEW,
    Permission.PLUGINS_UPLOAD,
    Permission.PLUGINS_DELETE,
    Permission.PLUGINS_TOGGLE,
  ],
  'การจัดการไฟล์': [
    Permission.FILES_VIEW,
    Permission.FILES_EDIT,
    Permission.FILES_UPLOAD,
    Permission.FILES_DELETE,
  ],
  'การสำรองข้อมูล': [
    Permission.BACKUP_CREATE,
    Permission.BACKUP_RESTORE,
    Permission.BACKUP_DELETE,
  ],
  'การดูแลระบบ': [
    Permission.SETTINGS_MANAGE,
    Permission.USERS_MANAGE,
  ],
};
