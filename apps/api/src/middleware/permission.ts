import { FastifyRequest, FastifyReply } from 'fastify';
import { Permission, ApiResponse, ErrorCode, UserRole } from '@minecraft-panel/shared';

/**
 * Middleware ตรวจสอบสิทธิ์รายข้อ (RBAC Permission Guard)
 * หากผู้ใช้เป็น OWNER จะผ่านได้ทันที
 * หากเป็นบทบาทอื่น จะตรวจสอบว่ามี permissionKey ในรายการสิทธิ์หรือไม่
 */
export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user;

    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: 'กรุณาเข้าสู่ระบบก่อนทำรายการนี้',
        },
      };
      return reply.status(401).send(response);
    }

    // บทบาท OWNER มีสิทธิ์ครอบคลุมทุกอย่างเสมอ
    if (user.role === UserRole.OWNER) {
      return;
    }

    // ตรวจสอบว่ามีสิทธิ์ที่กำหนดหรือไม่
    const hasPermission = user.permissions.includes(permission);

    if (!hasPermission) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.FORBIDDEN,
          message: `คุณไม่มีสิทธิ์ในการกระทำนี้ (${permission})`,
        },
      };
      return reply.status(403).send(response);
    }
  };
}
