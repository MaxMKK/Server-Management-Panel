import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@minecraft-panel/database';
import { ApiResponse, ErrorCode, UserRole } from '@minecraft-panel/shared';
import { JwtService } from '../../services/jwt.service.js';
import { authenticate } from '../../middleware/auth.js';

// สคีมาตรวจสอบข้อมูลสำหรับ Login
const loginSchema = z.object({
  username: z.string().min(1, 'กรุณากรอกชื่อผู้ใช้'),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // ── 1. เข้าสู่ระบบด้วย Username & Password (POST /api/auth/login) ─────────
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = loginSchema.safeParse(request.body);

    if (!parseResult.success) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง',
        },
      };
      return reply.status(400).send(response);
    }

    const { username, password } = parseResult.data;

    // ค้นหาผู้ใช้พร้อมบทบาทและสิทธิ์ทั้งหมด
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.passwordHash || !user.isActive) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
        },
      };
      return reply.status(401).send(response);
    }

    // ตรวจสอบรหัสผ่านด้วย bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
        },
      };
      return reply.status(401).send(response);
    }

    // ดึงรายการ Permission keys ทั้งหมดที่ Role นี้ได้รับ
    const permissions = user.role.permissions.map(
      (rp: { permission: { key: string } }) => rp.permission.key
    );

    // สร้าง JWT Token
    const token = JwtService.sign({
      userId: user.id,
      username: user.username,
      role: user.role.name as UserRole,
      permissions,
    });

    // บันทึกวันเวลาที่เข้าสู่ระบบล่าสุด
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // บันทึก Audit Log การเข้าสู่ระบบ
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'AUTH_LOGIN',
        category: 'SECURITY',
        details: JSON.stringify({ username: user.username, method: 'PASSWORD' }),
        ipAddress: request.ip,
        result: 'SUCCESS',
      },
    });

    // กำหนด HTTP-Only Cookie เพื่อความปลอดภัยสูงสุด (ป้องกัน XSS)
    reply.setCookie('session_token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 วัน
    });

    const response: ApiResponse = {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          role: user.role.name,
          permissions,
        },
      },
    };

    return reply.status(200).send(response);
  });

  // ── 2. ดึงข้อมูลผู้ใช้ปัจจุบัน (GET /api/auth/me) ──────────────────────────
  fastify.get('/me', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionUser = request.user!;

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: 'ไม่พบผู้ใช้หรือบัญชีถูกระงับการใช้งาน',
        },
      };
      return reply.status(401).send(response);
    }

    const permissions = user.role.permissions.map(
      (rp: { permission: { key: string } }) => rp.permission.key
    );

    const response: ApiResponse = {
      success: true,
      data: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role.name,
        permissions,
      },
    };

    return reply.status(200).send(response);
  });

  // ── 3. ออกจากระบบ (POST /api/auth/logout) ──────────────────────────────────
  fastify.post('/logout', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionUser = request.user;

    if (sessionUser) {
      await prisma.auditLog.create({
        data: {
          userId: sessionUser.userId,
          action: 'AUTH_LOGOUT',
          category: 'SECURITY',
          ipAddress: request.ip,
          result: 'SUCCESS',
        },
      });
    }

    // ล้าง Cookie
    reply.clearCookie('session_token', { path: '/' });

    const response: ApiResponse = {
      success: true,
      data: { message: 'ออกจากระบบเรียบร้อยแล้ว' },
    };

    return reply.status(200).send(response);
  });
}
