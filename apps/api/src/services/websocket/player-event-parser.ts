/**
 * ตัวช่วยวิเคราะห์ Log ข้อความของ Minecraft เพื่อตรวจจับความเคลื่อนไหวของผู้เล่น
 * รองรับทั้ง Vanilla, Paper, Purpur และ Spigot
 */

export interface PlayerParsedEvent {
  username: string;
  action: 'join' | 'leave';
}

export class PlayerEventParser {
  // Regex รูปแบบ: PlayerName joined the game หรือ PlayerName[/127.0.0.1:port] logged in with entity id
  private static readonly JOIN_PATTERNS = [
    /([a-zA-Z0-9_]{3,16})\s+(?:logged in with entity id|joined the game)/i,
    /UUID of player\s+([a-zA-Z0-9_]{3,16})\s+is/i,
  ];

  // Regex รูปแบบ: PlayerName left the game หรือ PlayerName lost connection: Disconnected
  private static readonly LEAVE_PATTERNS = [
    /([a-zA-Z0-9_]{3,16})\s+(?:lost connection|left the game)/i,
  ];

  /**
   * ตรวจสอบว่าบรรทัด log นั้นเกี่ยวข้องกับการเข้าหรือออกจากเซิร์ฟเวอร์ของผู้เล่นหรือไม่
   */
  public static parse(line: string): PlayerParsedEvent | null {
    // ตรวจสอบเหตุการณ์ Join
    for (const pattern of this.JOIN_PATTERNS) {
      const match = line.match(pattern);
      if (match && match[1]) {
        return {
          username: match[1],
          action: 'join',
        };
      }
    }

    // ตรวจสอบเหตุการณ์ Leave
    for (const pattern of this.LEAVE_PATTERNS) {
      const match = line.match(pattern);
      if (match && match[1]) {
        return {
          username: match[1],
          action: 'leave',
        };
      }
    }

    return null;
  }
}
