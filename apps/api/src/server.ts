import { config, logger } from './config/index.js';
import { buildApp } from './app.js';

/**
 * จุดเริ่มต้นการทำงานของ Backend API Server
 * 
 * หน้าที่หลัก:
 * - บูตระบบและเชื่อมต่อส่วนประกอบต่างๆ
 * - จัดการปิดระบบอย่างนุ่มนวลเมื่อได้รับสัญญาณ (SIGINT, SIGTERM)
 * - ดักจับข้อผิดพลาดร้ายแรงที่ไม่ได้จัดการ (Uncaught Exceptions)
 */
async function main(): Promise<void> {
  logger.info('🎮 กำลังเริ่มต้นระบบ Minecraft Panel API...');
  logger.info(`   สภาพแวดล้อม: ${config.NODE_ENV}`);
  logger.info(`   โฮสต์: ${config.APP_HOST}`);
  logger.info(`   พอร์ต: ${config.APP_PORT}`);
  logger.info(`   URL หน้าเว็บ: ${config.FRONTEND_URL}`);

  const app = await buildApp();

  // ── การปิดระบบอย่างนุ่มนวล (Graceful Shutdown) ──────────
  const shutdown = async (signal: string) => {
    logger.info(`⏹️  ได้รับสัญญาณ ${signal} กำลังปิดเซิร์ฟเวอร์อย่างปลอดภัย...`);
    
    try {
      await app.close();
      logger.info('✅ ปิดเซิร์ฟเวอร์เรียบร้อยแล้ว');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, '❌ เกิดข้อผิดพลาดขณะกำลังปิดเซิร์ฟเวอร์');
      process.exit(1);
    }
  };

  // ดักจับเมื่อผู้ใช้กด Ctrl+C ใน Terminal หรือระบบส่งสัญญาณปิด
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // ── ดักจับข้อผิดพลาดร้ายแรงที่ไม่ได้คาดคิด ───────────────
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, '💥 เกิด Uncaught Exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, '💥 เกิด Unhandled Rejection');
    process.exit(1);
  });

  // ── เปิดให้เซิร์ฟเวอร์เริ่มรับคำขอ ────────────────────────
  try {
    await app.listen({
      host: config.APP_HOST,
      port: config.APP_PORT,
    });
    logger.info(`🚀 API Server กำลังทำงานที่ http://${config.APP_HOST}:${config.APP_PORT}`);
    logger.info(`📋 ตรวจสอบสถานะได้ที่: http://localhost:${config.APP_PORT}/api/health`);
  } catch (err) {
    logger.fatal({ err }, '❌ ไม่สามารถเปิดเซิร์ฟเวอร์ได้');
    process.exit(1);
  }
}

main();
