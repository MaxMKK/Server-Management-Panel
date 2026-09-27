import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { config, logger } from './config/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { serverRoutes } from './modules/servers/server.routes.js';
import { ServerManager } from './services/server-manager/server-manager.js';

/**
 * ฟังก์ชันสร้างและตั้งค่า Fastify Application พร้อมปลั๊กอินความปลอดภัยทั้งหมด
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // ใช้ Pino Logger ที่เราปรับแต่งไว้เอง
    trustProxy: true,
  });

  // ── ปลั๊กอินด้านความปลอดภัย ──────────────────────────────
  
  // ปลั๊กอิน CORS: อนุญาตเฉพาะคำขอที่มาจากหน้าเว็บ Frontend ของเราเท่านั้น
  await app.register(cors, {
    origin: config.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ปลั๊กอิน Helmet: ป้องกันช่องโหว่ทาง HTTP Header
  await app.register(helmet, {
    contentSecurityPolicy: false, // Next.js จะเป็นผู้ดูแล CSP ฝั่งเว็บ
  });

  // ปลั๊กอิน Rate Limit: ป้องกันการยิงสแปมคำขอหรือโจมตีแบบ Brute-force
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX_REQUESTS,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
  });

  // ปลั๊กอิน Cookie: สำหรับอ่านและเขียน Cookie ยืนยันตัวตนแบบปลอดภัย
  await app.register(cookie);

  // ── ตัวจัดการข้อผิดพลาดส่วนกลาง ────────────────────────────
  app.setErrorHandler(errorHandler);

  // ── จุดตรวจสอบสุขภาพระบบ (Health Check Endpoint) ─────────
  app.get('/api/health', async (_request, reply) => {
    const health = {
      success: true,
      data: {
        status: 'ok',
        service: 'minecraft-panel-api',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.NODE_ENV,
        memory: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
      },
    };
    return reply.status(200).send(health);
  });

  // ── เส้นทาง API สำหรับ Authentication ──────────────────
  await app.register(authRoutes, { prefix: '/api/auth' });

  // ── เส้นทาง API สำหรับ จัดการเซิร์ฟเวอร์ Minecraft ────────
  await app.register(serverRoutes, { prefix: '/api/servers' });

  // ── เริ่มต้นระบบ ServerManager โหลดข้อมูลเซิร์ฟเวอร์ ─────
  await ServerManager.getInstance().initialize();

  // ── ข้อมูลเบื้องต้นของ API ────────────────────────────────
  app.get('/api', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      data: {
        name: 'Minecraft Server Control Panel API',
        version: '0.1.0',
        documentation: '/api/docs',
      },
    });
  });

  // ── จัดการหน้า 404 (Route Not Found) ─────────────────────
  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'ไม่พบเส้นทาง API นี้ในระบบ',
      },
    });
  });

  logger.info('✅ ประกอบแอปพลิเคชัน Fastify เรียบร้อยแล้ว');
  return app;
}
