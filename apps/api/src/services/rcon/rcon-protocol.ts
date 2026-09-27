/**
 * RCON Protocol Types & Constants ตามมาตรฐาน Source RCON Protocol สำหรับ Minecraft
 *
 * โครงสร้าง Packet:
 * ┌───────────────┬─────────────────┬────────────────┬──────────────────────────┬──────────┐
 * │ Length (4B LE)│ Request ID(4B LE│ Type (4B LE)   │ Body (Null-terminated)   │ Pad (0x0)│
 * └───────────────┴─────────────────┴────────────────┴──────────────────────────┴──────────┘
 */

export enum RconPacketType {
  /** ตอบกลับผลการรันคำสั่ง (Response from server) */
  RESPONSE_VALUE = 0,
  /** ส่งคำสั่งไปประมวลผล (Execute command) */
  EXECCOMMAND = 2,
  /** ยืนยันสิทธิ์เข้าระบบ (Authenticate) */
  AUTH = 3,
  /** ตอบกลับผลการยืนยันสิทธิ์ (Auth response) */
  AUTH_RESPONSE = 2,
}

export interface RconPacket {
  id: number;
  type: number;
  body: string;
}

/**
 * แปลง Payload เป็น Binary Buffer เพื่อส่งผ่าน TCP Socket
 */
export function encodePacket(id: number, type: number, body: string): Buffer {
  const bodyBuffer = Buffer.from(body, 'utf8');
  // ขนาด: id (4) + type (4) + body length + null terminator (1) + padding null (1)
  const length = 4 + 4 + bodyBuffer.length + 2;
  const packet = Buffer.alloc(4 + length);

  // Little-endian 32-bit integer
  packet.writeInt32LE(length, 0);
  packet.writeInt32LE(id, 4);
  packet.writeInt32LE(type, 8);
  bodyBuffer.copy(packet, 12);
  packet.writeInt8(0, 12 + bodyBuffer.length); // Null terminator ของ Body
  packet.writeInt8(0, 12 + bodyBuffer.length + 1); // Padding Null

  return packet;
}

/**
 * ถอดรหัส Binary Buffer จาก TCP Socket กลับมาเป็น Packet
 * คืนค่า null หากข้อมูลใน Buffer ยังมาไม่ครบ packet (รอ chunk ถัดไป)
 */
export function decodePacket(buffer: Buffer): { packet: RconPacket; bytesRead: number } | null {
  // ต้องการอย่างน้อย 4 ไบต์สำหรับอ่าน Length
  if (buffer.length < 4) {
    return null;
  }

  const length = buffer.readInt32LE(0);
  const totalLength = 4 + length;

  // ตรวจสอบว่า buffer มีข้อมูลครบทั้ง packet หรือยัง
  if (buffer.length < totalLength) {
    return null;
  }

  const id = buffer.readInt32LE(4);
  const type = buffer.readInt32LE(8);

  // Body อยู่ระหว่าง offset 12 ถึง (totalLength - 2) เนื่องจากลงท้ายด้วย 2 null bytes
  const bodyBuffer = buffer.subarray(12, totalLength - 2);
  const body = bodyBuffer.toString('utf8');

  return {
    packet: { id, type, body },
    bytesRead: totalLength,
  };
}
