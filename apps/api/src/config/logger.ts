import pino from 'pino';
import { config } from './env.js';

/**
 * ตัวบันทึก Log ของระบบโดยใช้ Pino
 * 
 * ในโหมด Development: แสดงผลแบบสีสัน อ่านง่าย สบายตา
 * ในโหมด Production: บันทึกเป็น JSON สำหรับส่งต่อไปยังระบบ Log Analytics
 */
export const logger = pino({
  level: config.LOG_LEVEL,
  transport: config.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

/** ฟังก์ชันสร้าง Logger ย่อยโดยระบุชื่อโมดูลที่ทำงาน */
export function createLogger(module: string) {
  return logger.child({ module });
}
