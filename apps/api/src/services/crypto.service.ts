import crypto from 'crypto';
import { config } from '../config/index.js';

/**
 * บริการเข้ารหัสและถอดรหัสลับด้วย AES-256-GCM (Authenticated Encryption)
 * ใช้สำหรับป้องกันไม่ให้รหัสผ่าน RCON หรือ Discord Webhook หลุดเป็น Plaintext ในฐานข้อมูล
 */
export class CryptoService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12; // 12 ไบต์สำหรับ GCM mode

  /** ดึง Key 32 ไบต์จาก config */
  private static getKey(): Buffer {
    const rawKey = config.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    // สร้าง Buffer ขนาด 32 ไบต์
    return crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * เข้ารหัสข้อความ (Plaintext ──► Ciphertext)
   * ผลลัพธ์จะอยู่ในรูป: iv:tag:encryptedData (Hex string)
   */
  public static encrypt(plainText: string): string {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const key = this.getKey();

    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * ถอดรหัสข้อความ (Ciphertext ──► Plaintext)
   */
  public static decrypt(cipherText: string): string {
    const parts = cipherText.split(':');
    if (parts.length !== 3) {
      throw new Error('รูปแบบข้อมูลที่เข้ารหัสไม่ถูกต้อง');
    }

    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const key = this.getKey();

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
