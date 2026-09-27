/**
 * ตัวเชื่อมต่อฐานข้อมูล Prisma Client แบบ Singleton
 * ป้องกันปัญหา Connection รั่วไหล (Connection Leak) ในช่วง Development ที่มีการ Hot-reload บ่อยๆ
 * 
 * วิธีเรียกใช้งานในโปรเจกต์:
 *   import { prisma } from '@minecraft-panel/database';
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  // ในโหมด Development จะแสดง Query เพื่อช่วยในการ Debug
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'warn', 'error'] 
    : ['warn', 'error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };
export default prisma;
