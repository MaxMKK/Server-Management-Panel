import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@minecraft-panel/database';
import { ApiResponse, ErrorCode, Permission } from '@minecraft-panel/shared';
import { ServerManager } from '../../services/server-manager/server-manager.js';
import { CryptoService } from '../../services/crypto.service.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';

// สคีมาตรวจสอบข้อมูลสำหรับสร้างเซิร์ฟเวอร์ใหม่
const createServerSchema = z.object({
  name: z.string().min(1, 'ต้องระบุชื่อเซิร์ฟเวอร์'),
  rootPath: z.string().min(1, 'ต้องระบุเส้นทางโฟลเดอร์เซิร์ฟเวอร์'),
  jarFile: z.string().default('paper.jar'),
  javaPath: z.string().default('java'),
  javaArgs: z.string().default(''),
  gamePort: z.number().int().min(1024).max(65535),
  rconPort: z.number().int().min(1024).max(65535),
  rconPassword: z.string().min(1, 'ต้องระบุรหัสผ่าน RCON'),
  minMemory: z.string().default('2G'),
  maxMemory: z.string().default('4G'),
  autoRestart: z.boolean().default(false),
});

interface ServerIdParams {
  id: string;
}

interface ServerLogsQuery {
  limit?: string;
}

export async function serverRoutes(fastify: FastifyInstance): Promise<void> {
  const serverManager = ServerManager.getInstance();

  // ── 1. ดึงข้อมูลเซิร์ฟเวอร์ทั้งหมดพร้อมสถานะ (GET /api/servers) ───────────
  fastify.get(
    '/',
    { preHandler: [authenticate, requirePermission(Permission.SERVER_VIEW)] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const servers = await serverManager.getAllServersInfo();
      const response: ApiResponse = {
        success: true,
        data: servers,
      };
      return reply.status(200).send(response);
    }
  );

  // ── 2. ลงทะเบียนเซิร์ฟเวอร์ใหม่ (POST /api/servers) ─────────────────────
  fastify.post(
    '/',
    { preHandler: [authenticate, requirePermission(Permission.SERVER_CREATE)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = createServerSchema.safeParse(request.body);

      if (!parseResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'ข้อมูลเซิร์ฟเวอร์ไม่ถูกต้อง',
          },
        };
        return reply.status(400).send(response);
      }

      const data = parseResult.data;

      // ตรวจสอบพอร์ตชนกันในฐานข้อมูล
      const existingPort = await prisma.server.findFirst({
        where: {
          OR: [{ gamePort: data.gamePort }, { rconPort: data.rconPort }],
        },
      });

      if (existingPort) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.PORT_CONFLICT,
            message: 'พอร์ตเกมหรือพอร์ต RCON นี้ถูกใช้งานแล้ว',
          },
        };
        return reply.status(409).send(response);
      }

      // สร้าง slug อัตโนมัติจากชื่อ
      const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      // เข้ารหัสผ่าน RCON ด้วย AES-256 ก่อนบันทึกลงฐานข้อมูล
      const encryptedRconPassword = CryptoService.encrypt(data.rconPassword);

      const newServer = await prisma.server.create({
        data: {
          name: data.name,
          slug,
          rootPath: data.rootPath,
          jarFile: data.jarFile,
          javaPath: data.javaPath,
          javaArgs: data.javaArgs,
          gamePort: data.gamePort,
          rconPort: data.rconPort,
          rconPasswordEncrypted: encryptedRconPassword,
          minMemory: data.minMemory,
          maxMemory: data.maxMemory,
          autoRestart: data.autoRestart,
        },
      });

      // ลงทะเบียน ProcessInstance ใน ServerManager ทันที
      serverManager.registerServer({
        id: newServer.id,
        name: newServer.name,
        rootPath: newServer.rootPath,
        jarFile: newServer.jarFile,
        javaPath: newServer.javaPath,
        javaArgs: newServer.javaArgs,
        gamePort: newServer.gamePort,
        rconPort: newServer.rconPort,
        minMemory: newServer.minMemory,
        maxMemory: newServer.maxMemory,
        autoRestart: newServer.autoRestart,
        maxCrashRestarts: newServer.maxCrashRestarts,
      });

      // บันทึก Audit Log
      await prisma.auditLog.create({
        data: {
          userId: request.user?.userId,
          serverId: newServer.id,
          action: 'SERVER_CREATE',
          category: 'SERVER',
          details: JSON.stringify({ name: newServer.name, port: newServer.gamePort }),
          ipAddress: request.ip,
          result: 'SUCCESS',
        },
      });

      const response: ApiResponse = {
        success: true,
        data: newServer,
      };

      return reply.status(201).send(response);
    }
  );

  // ── 3. สั่งเปิดเซิร์ฟเวอร์ (POST /api/servers/:id/start) ─────────────────
  fastify.post<{ Params: ServerIdParams }>(
    '/:id/start',
    { preHandler: [authenticate, requirePermission(Permission.SERVER_START)] },
    async (request, reply) => {
      const { id } = request.params;

      try {
        await serverManager.startServer(id);

        await prisma.auditLog.create({
          data: {
            userId: request.user?.userId,
            serverId: id,
            action: 'SERVER_START',
            category: 'SERVER',
            ipAddress: request.ip,
            result: 'SUCCESS',
          },
        });

        const response: ApiResponse = {
          success: true,
          data: { message: 'สั่งเปิดเซิร์ฟเวอร์เรียบร้อยแล้ว' },
        };
        return reply.status(200).send(response);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเปิดเซิร์ฟเวอร์';
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.SERVER_START_FAILED,
            message: msg,
          },
        };
        return reply.status(400).send(response);
      }
    }
  );

  // ── 4. สั่งปิดเซิร์ฟเวอร์ (POST /api/servers/:id/stop) ───────────────────
  fastify.post<{ Params: ServerIdParams }>(
    '/:id/stop',
    { preHandler: [authenticate, requirePermission(Permission.SERVER_STOP)] },
    async (request, reply) => {
      const { id } = request.params;

      try {
        await serverManager.stopServer(id);

        await prisma.auditLog.create({
          data: {
            userId: request.user?.userId,
            serverId: id,
            action: 'SERVER_STOP',
            category: 'SERVER',
            ipAddress: request.ip,
            result: 'SUCCESS',
          },
        });

        const response: ApiResponse = {
          success: true,
          data: { message: 'สั่งปิดเซิร์ฟเวอร์เรียบร้อยแล้ว' },
        };
        return reply.status(200).send(response);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการปิดเซิร์ฟเวอร์';
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: msg,
          },
        };
        return reply.status(400).send(response);
      }
    }
  );

  // ── 5. สั่งรีสตาร์ทเซิร์ฟเวอร์ (POST /api/servers/:id/restart) ────────────
  fastify.post<{ Params: ServerIdParams }>(
    '/:id/restart',
    { preHandler: [authenticate, requirePermission(Permission.SERVER_RESTART)] },
    async (request, reply) => {
      const { id } = request.params;

      try {
        await serverManager.restartServer(id);

        await prisma.auditLog.create({
          data: {
            userId: request.user?.userId,
            serverId: id,
            action: 'SERVER_RESTART',
            category: 'SERVER',
            ipAddress: request.ip,
            result: 'SUCCESS',
          },
        });

        const response: ApiResponse = {
          success: true,
          data: { message: 'สั่งรีสตาร์ทเซิร์ฟเวอร์เรียบร้อยแล้ว' },
        };
        return reply.status(200).send(response);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการรีสตาร์ท';
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: msg,
          },
        };
        return reply.status(400).send(response);
      }
    }
  );

  // ── 6. บังคับปิดทันที (POST /api/servers/:id/kill) ─────────────────────
  fastify.post<{ Params: ServerIdParams }>(
    '/:id/kill',
    { preHandler: [authenticate, requirePermission(Permission.SERVER_KILL)] },
    async (request, reply) => {
      const { id } = request.params;

      serverManager.forceKillServer(id);

      await prisma.auditLog.create({
        data: {
          userId: request.user?.userId,
          serverId: id,
          action: 'SERVER_KILL',
          category: 'SECURITY',
          ipAddress: request.ip,
          result: 'SUCCESS',
        },
      });

      const response: ApiResponse = {
        success: true,
        data: { message: 'สั่ง Force Kill เซิร์ฟเวอร์เรียบร้อยแล้ว' },
      };
      return reply.status(200).send(response);
    }
  );

  // ── 7. ดึง Log คอนโซลล่าสุด (GET /api/servers/:id/logs) ──────────────────
  fastify.get<{ Params: ServerIdParams; Querystring: ServerLogsQuery }>(
    '/:id/logs',
    { preHandler: [authenticate, requirePermission(Permission.CONSOLE_VIEW)] },
    async (request, reply) => {
      const { id } = request.params;
      const limit = parseInt(request.query.limit || '100', 10);

      const instance = serverManager.getInstance(id);
      if (!instance) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.SERVER_NOT_FOUND,
            message: 'ไม่พบเซิร์ฟเวอร์นี้ในระบบ',
          },
        };
        return reply.status(404).send(response);
      }

      const logs = instance.getLogs(limit);

      const response: ApiResponse = {
        success: true,
        data: logs,
      };
      return reply.status(200).send(response);
    }
  );
}
