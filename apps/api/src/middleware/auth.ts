import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtService, JwtPayload } from '../services/jwt.service.js';
import { ApiResponse, ErrorCode } from '@minecraft-panel/shared';

// ขยาย Type ของ FastifyRequest เพื่อให้มีฟิลด์ user
declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

/**
 * Middleware ตรวจสอบการเข้าสู่ระบบ (Authentication Guard)
 * ดึง Token จาก Cookie "session_token" หรือ Authorization Header "Bearer <token>"
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  let token: string | undefined;

  // 1. ลองดึงจาก Authorization Header
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 2. ถ้าไม่มีใน Header ให้ลองดึงจาก Cookie
  if (!token && request.cookies?.session_token) {
    token = request.cookies.session_token;
  }

  if (!token) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.UNAUTHORIZED,
        message: 'กรุณาเข้าสู่ระบบก่อนทำรายการนี้',
      },
    };
    return reply.status(401).send(response);
  }

  try {
    const payload = JwtService.verify(token);
    request.user = payload;
  } catch (_err) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.INVALID_TOKEN,
        message: 'เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
      },
    };
    return reply.status(401).send(response);
  }
}
