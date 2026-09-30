import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@minecraft-panel/database';
import { ApiResponse, ErrorCode, Permission } from '@minecraft-panel/shared';
import { ServerManager } from '../../services/server-manager/server-manager.js';
import { CryptoService } from '../../services/crypto.service.js';
import { RconPool } from '../../services/rcon/rcon-pool.js';
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

  // ── 1.1 ดึงข้อมูลเซิร์ฟเวอร์เดี่ยวพร้อมสถานะ (GET /api/servers/:id) ───────
  fastify.get<{ Params: ServerIdParams }>(
    '/:id',
    { preHandler: [authenticate, requirePermission(Permission.SERVER_VIEW)] },
    async (request, reply) => {
      const { id } = request.params;
      const server = await serverManager.getServerInfo(id);

      if (!server) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.SERVER_NOT_FOUND,
            message: 'ไม่พบเซิร์ฟเวอร์นี้ในระบบ',
          },
        };
        return reply.status(404).send(response);
      }

      const response: ApiResponse = {
        success: true,
        data: server,
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

        // ตรวจสอบว่า error เกิดจากสถานะไม่ถูกต้อง (เช่น เซิร์ฟเวอร์ไม่ได้ทำงานอยู่)
        const isStateError = msg.includes('สถานะปัจจุบันคือ') || msg.includes('ไม่พบเซิร์ฟเวอร์');
        const code = isStateError ? ErrorCode.SERVER_NOT_RUNNING : ErrorCode.INTERNAL_ERROR;
        const statusCode = isStateError ? 409 : 400;

        const response: ApiResponse = {
          success: false,
          error: {
            code,
            message: msg,
          },
        };
        return reply.status(statusCode).send(response);
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

      let instance = serverManager.getInstance(id);
      if (!instance) {
        // ตรวจสอบว่าเซิร์ฟเวอร์มีอยู่ในฐานข้อมูลหรือไม่
        const serverExists = await prisma.server.findUnique({ where: { id } });
        if (!serverExists) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: ErrorCode.SERVER_NOT_FOUND,
              message: 'ไม่พบเซิร์ฟเวอร์นี้ในระบบ',
            },
          };
          return reply.status(404).send(response);
        }
        // เซิร์ฟเวอร์มีอยู่แต่ยังไม่เคยรัน
        const response: ApiResponse = {
          success: true,
          data: [],
        };
        return reply.status(200).send(response);
      }

      const logs = instance.getLogs(limit);

      const response: ApiResponse = {
        success: true,
        data: logs,
      };
      return reply.status(200).send(response);
    }
  );

  // ── 8. ส่งคำสั่งผ่าน RCON (POST /api/servers/:id/rcon/exec) ───────────────
  fastify.post<{ Params: ServerIdParams }>(
    '/:id/rcon/exec',
    { preHandler: [authenticate, requirePermission(Permission.CONSOLE_EXECUTE)] },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as { command?: string };

      if (!body?.command || typeof body.command !== 'string' || !body.command.trim()) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'กรุณาระบุคำสั่งที่ต้องการส่ง',
          },
        };
        return reply.status(400).send(response);
      }

      // ป้องกันคำสั่งที่มีการแทรก null byte หรือ newline อันตราย
      const cleanCommand = body.command.replace(/[\r\n\0]/g, '').trim();

      const server = await prisma.server.findUnique({
        where: { id },
      });

      if (!server) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.SERVER_NOT_FOUND,
            message: 'ไม่พบเซิร์ฟเวอร์นี้ในระบบ',
          },
        };
        return reply.status(404).send(response);
      }

      let rconPassword = '';
      try {
        rconPassword = CryptoService.decrypt(server.rconPasswordEncrypted);
      } catch (err) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: 'ไม่สามารถถอดรหัสผ่าน RCON สำหรับเชื่อมต่อได้',
          },
        };
        return reply.status(500).send(response);
      }

      const rconPool = RconPool.getInstance();
      const startTime = Date.now();

      try {
        const rconResponse = await rconPool.executeCommand(
          server.id,
          {
            host: '127.0.0.1', // บังคับเชื่อมต่อผ่าน Localhost เพื่อความปลอดภัย
            port: server.rconPort,
            password: rconPassword,
            timeoutMs: 10000,
          },
          cleanCommand
        );

        const executionTimeMs = Date.now() - startTime;

        // บันทึกประวัติการรันคำสั่งลงใน AuditLog
        await prisma.auditLog.create({
          data: {
            userId: request.user?.userId,
            serverId: id,
            action: 'RCON_EXECUTE',
            category: 'SERVER',
            ipAddress: request.ip,
            details: JSON.stringify({ command: cleanCommand, executionTimeMs }),
            result: 'SUCCESS',
          },
        });

        const response: ApiResponse = {
          success: true,
          data: {
            command: cleanCommand,
            response: rconResponse,
            executionTimeMs,
          },
        };
        return reply.status(200).send(response);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งคำสั่ง RCON';
        const isAuthError = msg.includes('Authentication Failed') || msg.includes('รหัสผ่าน RCON ไม่ถูกต้อง');
        const isTimeout = msg.includes('หมดเวลา') || msg.includes('Timeout');

        let code = ErrorCode.RCON_COMMAND_FAILED;
        if (isAuthError) {
          code = ErrorCode.RCON_AUTH_FAILED;
        } else if (isTimeout) {
          code = ErrorCode.RCON_TIMEOUT;
        }

        const response: ApiResponse = {
          success: false,
          error: {
            code,
            message: msg,
          },
        };
        return reply.status(400).send(response);
      }
    }
  );

  // ── 9. ตรวจสอบสถานะการเชื่อมต่อ RCON (GET /api/servers/:id/rcon/status) ────
  fastify.get<{ Params: ServerIdParams }>(
    '/:id/rcon/status',
    { preHandler: [authenticate, requirePermission(Permission.CONSOLE_VIEW)] },
    async (request, reply) => {
      const { id } = request.params;
      const server = await prisma.server.findUnique({
        where: { id },
      });

      if (!server) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.SERVER_NOT_FOUND,
            message: 'ไม่พบเซิร์ฟเวอร์นี้ในระบบ',
          },
        };
        return reply.status(404).send(response);
      }

      const rconPool = RconPool.getInstance();
      const connected = rconPool.isConnected(id);

      const response: ApiResponse = {
        success: true,
        data: {
          connected,
          host: '127.0.0.1',
          port: server.rconPort,
        },
      };
      return reply.status(200).send(response);
    }
  );
}
