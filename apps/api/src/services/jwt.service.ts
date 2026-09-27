import jwt from 'jsonwebtoken';
import { UserRole } from '@minecraft-panel/shared';

// โครงสร้าง Payload ที่บรรจุใน JWT Token
export interface JwtPayload {
  userId: string;
  username: string;
  role: UserRole;
  permissions: string[];
}

export class JwtService {
  private static readonly SECRET = process.env.AUTH_SECRET || 'mc_panel_dev_jwt_secret_99887766554433221100';
  private static readonly EXPIRES_IN = '7d'; // โทเค็นมีอายุ 7 วัน

  /** สร้าง JWT Token จากข้อมูลผู้ใช้ */
  public static sign(payload: JwtPayload): string {
    return jwt.sign(payload, this.SECRET, {
      expiresIn: this.EXPIRES_IN,
    });
  }

  /** ตรวจสอบและถอดรหัส JWT Token */
  public static verify(token: string): JwtPayload {
    return jwt.verify(token, this.SECRET) as JwtPayload;
  }
}
