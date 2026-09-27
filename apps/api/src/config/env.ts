import dotenv from 'dotenv';
import { z } from 'zod';

// โหลดตัวแปรสภาพแวดล้อมจากไฟล์ .env ที่รูทของโปรเจกต์
dotenv.config({ path: '../../.env' });

/**
 * โครงสร้างการตรวจสอบตัวแปรสภาพแวดล้อม (Environment Variables) ด้วย Zod
 * หากมีค่าที่จำเป็นขาดหายไป ระบบจะหยุดทำงานทันทีพร้อมแจ้งฟิลด์ที่มีปัญหา
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_PORT: z.coerce.number().default(4000),
  APP_HOST: z.string().default('0.0.0.0'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // การเชื่อมต่อฐานข้อมูล — จำเป็นตั้งแต่ Phase 2 เป็นต้นไป
  DATABASE_URL: z.string().optional(),

  // คีย์เข้ารหัสสำหรับรหัสผ่าน RCON — จำเป็นตั้งแต่ Phase 2 เป็นต้นไป
  ENCRYPTION_KEY: z.string().optional(),

  // ระดับการบันทึก Log
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // การจำกัดความถี่การส่งคำขอ (Rate Limiting)
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // โฟลเดอร์และโปรแกรม Java ของ Minecraft
  MC_SERVERS_BASE_PATH: z.string().default('C:\\MinecraftServers'),
  MC_DEFAULT_JAVA_PATH: z.string().default('java'),

  // โฟลเดอร์สำหรับเก็บไฟล์สำรองข้อมูล
  BACKUP_BASE_PATH: z.string().default('C:\\MinecraftBackups'),
  BACKUP_MAX_SIZE_GB: z.coerce.number().default(50),
});

export type Env = z.infer<typeof envSchema>;

/** ฟังก์ชันโหลดและตรวจสอบความถูกต้องของค่า Config */
function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ ตัวแปรสภาพแวดล้อม (.env) ไม่ถูกต้อง:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
