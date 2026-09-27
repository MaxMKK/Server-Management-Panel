import { FastifyReply, FastifyRequest } from 'fastify';
import { ApiResponse, ErrorCode } from '@minecraft-panel/shared';
import { createLogger } from '../config/index.js';

const logger = createLogger('ตัวดักจับข้อผิดพลาด');

/**
 * ตัวดักจับข้อผิดพลาดส่วนกลางสำหรับ Fastify (Global Error Handler)
 * 
 * นโยบายความปลอดภัย:
 * - ห้ามส่ง Stack trace กลับไปให้ผู้ใช้หน้าเว็บเด็ดขาด
 * - ห้ามเปิดเผยข้อมูลโครงสร้างไดเรกทอรีหรือรหัสผ่าน
 * - บันทึกรายละเอียดข้อผิดพลาดตัวเต็มไว้ที่ฝั่ง Server เท่านั้น
 * - ส่งข้อมูลกลับในรูปแบบ ApiResponse ที่เป็นมาตรฐาน
 */
export function errorHandler(
  error: Error & { statusCode?: number; code?: string; validation?: unknown },
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  // บันทึกรายละเอียดข้อผิดพลาดตัวเต็มไว้ใน Log ของเซิร์ฟเวอร์
  logger.error({ err: error }, 'เกิดข้อผิดพลาดในการประมวลผลคำขอ');

  // ตรวจสอบรหัสสถานะ HTTP
  const statusCode = error.statusCode ?? 500;

  // ข้อผิดพลาดจากการตรวจสอบข้อมูลที่ส่งเข้ามา (Validation Error)
  if (error.validation) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'ข้อมูลที่ส่งมาไม่ถูกต้องตามเงื่อนไข',
      },
    };
    reply.status(400).send(response);
    return;
  }

  // ข้อผิดพลาดที่ทราบสาเหตุชัดเจน
  if (statusCode === 401) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.UNAUTHORIZED,
        message: 'จำเป็นต้องเข้าสู่ระบบก่อนทำรายการนี้',
      },
    };
    reply.status(401).send(response);
    return;
  }

  if (statusCode === 403) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.FORBIDDEN,
        message: 'คุณไม่มีสิทธิ์ในการทำรายการนี้',
      },
    };
    reply.status(403).send(response);
    return;
  }

  if (statusCode === 404) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.NOT_FOUND,
        message: 'ไม่พบหน้าที่ต้องการ',
      },
    };
    reply.status(404).send(response);
    return;
  }

  if (statusCode === 429) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.RATE_LIMITED,
        message: 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่',
      },
    };
    reply.status(429).send(response);
    return;
  }

  // กรณีอื่นๆ: ข้อผิดพลาดภายในเซิร์ฟเวอร์ (จะไม่ส่งข้อความดิบให้ผู้ใช้ เพื่อความปลอดภัย)
  const response: ApiResponse = {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'เกิดข้อผิดพลาดภายในระบบ กรุณาติดต่อผู้ดูแล',
    },
  };
  reply.status(500).send(response);
}
