import { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '@minecraft-panel/database';
import {
  WsEvent,
  ConsoleOutput,
  MetricsUpdate,
  Permission,
  PlayerEvent,
} from '@minecraft-panel/shared';
import { config, createLogger } from '../../config/index.js';
import { JwtService, JwtPayload } from '../jwt.service.js';
import { ServerManager } from '../server-manager/server-manager.js';
import { PlayerEventParser } from './player-event-parser.js';

// ขยาย Socket ให้เก็บข้อมูล User ที่ยืนยันตัวตนแล้ว
interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

/**
 * WebSocketServer
 * จัดการการเชื่อมต่อแบบ Real-Time ระหว่าง Backend API และ Dashboard Frontend ด้วย Socket.io
 */
export class WebSocketServer {
  private static instance: WebSocketServer | null = null;
  private io: SocketIOServer | null = null;
  private logger = createLogger('websocket');
  private metricsTimer: NodeJS.Timeout | null = null;
  private listeningServers = new Set<string>();

  private constructor() {}

  public static getInstance(): WebSocketServer {
    if (!WebSocketServer.instance) {
      WebSocketServer.instance = new WebSocketServer();
    }
    return WebSocketServer.instance;
  }

  /**
   * เริ่มต้นการทำงานของ Socket.io Server โดยผูกเข้ากับ HTTP Server
   */
  public initialize(httpServer: HttpServer): void {
    if (this.io) {
      return;
    }

    this.logger.info('🔌 กำลังเริ่มต้นระบบ Socket.io WebSocket Server...');

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.FRONTEND_URL,
        credentials: true,
      },
      pingTimeout: 20000,
      pingInterval: 10000,
    });

    // 1. ตั้งค่า Authentication Middleware
    this.setupAuthMiddleware();

    // 2. จัดการ Event การเชื่อมต่อของ Client
    this.setupConnectionHandlers();

    // 3. เริ่มต้นลูปส่งข้อมูล Metrics (CPU, RAM) ไปยัง Dashboard
    this.startMetricsBroadcasting();

    this.logger.info('✅ ระบบ Socket.io WebSocket Server พร้อมให้บริการแล้ว');
  }

  /**
   * Socket.io Middleware ตรวจสอบความถูกต้องของ JWT Token
   */
  private setupAuthMiddleware(): void {
    if (!this.io) return;

    this.io.use((socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          (socket.handshake.headers.authorization
            ? socket.handshake.headers.authorization.replace('Bearer ', '')
            : null);

        if (!token) {
          return next(new Error('AUTHENTICATION_ERROR: ไม่พบ Token สำหรับยืนยันตัวตน'));
        }

        const payload = JwtService.verify(token);
        socket.user = payload;
        next();
      } catch (err) {
        return next(new Error('AUTHENTICATION_ERROR: Token ไม่ถูกต้องหรือหมดอายุ'));
      }
    });
  }

  /**
   * จัดการเหตุการณ์เมื่อ Client เชื่อมต่อเข้ามา
   */
  private setupConnectionHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const user = socket.user!;
      this.logger.info(`👤 ผู้ใช้ ${user.username} (ID: ${user.userId}) เชื่อมต่อ WebSocket สำเร็จ`);

      // ── Event 1: ขอเข้าห้องของเซิร์ฟเวอร์ (join:server) ──────────────────────
      socket.on(WsEvent.JOIN_SERVER, async (serverId: string) => {
        if (!serverId || typeof serverId !== 'string') return;

        // ตรวจสอบว่าผู้ใช้มีสิทธิ์ดูคอนโซลของเซิร์ฟเวอร์หรือไม่
        if (!user.permissions.includes(Permission.CONSOLE_VIEW) && !user.permissions.includes(Permission.SERVER_VIEW)) {
          socket.emit(WsEvent.AUTH_ERROR, {
            message: 'คุณไม่มีสิทธิ์เข้าถึงห้องของเซิร์ฟเวอร์นี้',
          });
          return;
        }

        const roomName = `server:${serverId}`;
        socket.join(roomName);
        this.logger.debug(`ผู้ใช้ ${user.username} เข้าสู่ห้อง ${roomName}`);

        // เริ่มต้น Hook ดักจับ Log และ Event ของเซิร์ฟเวอร์นี้ (ถ้ายังไม่ได้เริ่ม)
        this.hookServerEvents(serverId);

        // ส่งประวัติ Log ล่าสุด 50 บรรทัดให้ทันทีที่เข้าห้อง
        const instance = ServerManager.getInstance().getInstance(serverId);
        if (instance) {
          const recentLogs = instance.getLogs(50);
          for (const log of recentLogs) {
            socket.emit(WsEvent.CONSOLE_OUTPUT, log);
          }
        }
      });

      // ── Event 2: ออกจากห้องของเซิร์ฟเวอร์ (leave:server) ─────────────────────
      socket.on(WsEvent.LEAVE_SERVER, (serverId: string) => {
        if (!serverId || typeof serverId !== 'string') return;
        const roomName = `server:${serverId}`;
        socket.leave(roomName);
        this.logger.debug(`ผู้ใช้ ${user.username} ออกจากห้อง ${roomName}`);
      });

      // ── Event 3: ส่งคำสั่งคอนโซลสดแบบสองทาง (console:command) ────────────────
      socket.on(WsEvent.CONSOLE_COMMAND, async (payload: { serverId: string; command: string }) => {
        if (!payload || !payload.serverId || !payload.command) return;

        // ตรวจสอบสิทธิ์สั่งการคอนโซล
        if (!user.permissions.includes(Permission.CONSOLE_EXECUTE)) {
          socket.emit(WsEvent.AUTH_ERROR, {
            message: 'คุณไม่มีสิทธิ์ส่งคำสั่งไปยังคอนโซล',
          });
          return;
        }

        const instance = ServerManager.getInstance().getInstance(payload.serverId);
        if (!instance) {
          return;
        }

        const cleanCmd = payload.command.replace(/[\r\n\0]/g, '').trim();
        if (!cleanCmd) return;

        // ส่งคำสั่งเข้าท่อ stdin ของ ProcessInstance
        instance.sendCommand(cleanCmd);

        // บันทึกลงใน AuditLog
        await prisma.auditLog.create({
          data: {
            userId: user.userId,
            serverId: payload.serverId,
            action: 'CONSOLE_EXECUTE',
            category: 'SERVER',
            details: JSON.stringify({ command: cleanCmd }),
            ipAddress: socket.handshake.address,
            result: 'SUCCESS',
          },
        });
      });

      // ── Event 4: ลูกค้าตัดการเชื่อมต่อ ────────────────────────────────────────
      socket.on('disconnect', (reason) => {
        this.logger.info(`🔌 ผู้ใช้ ${user.username} ตัดการเชื่อมต่อ WebSocket (${reason})`);
      });
    });
  }

  /**
   * ดักจับ Event จาก ProcessInstance เพื่อสตรีมไปยังห้อง server:${serverId}
   */
  public hookServerEvents(serverId: string): void {
    if (this.listeningServers.has(serverId)) {
      return;
    }

    const instance = ServerManager.getInstance().getInstance(serverId);
    if (!instance) return;

    this.listeningServers.add(serverId);
    const roomName = `server:${serverId}`;

    // 1. ดักจับ Log ใหม่แล้ว Broadcast ออกไปที่ห้อง
    instance.on('log', (log: ConsoleOutput) => {
      if (this.io) {
        this.io.to(roomName).emit(WsEvent.CONSOLE_OUTPUT, log);
      }

      // ตรวจจับ Player Join/Leave ผ่าน Regex
      const playerEventData = PlayerEventParser.parse(log.line);
      if (playerEventData && this.io) {
        const playerEvent: PlayerEvent = {
          serverId,
          username: playerEventData.username,
          uuid: null,
          action: playerEventData.action,
          timestamp: new Date().toISOString(),
        };

        const targetEvent =
          playerEventData.action === 'join' ? WsEvent.PLAYER_JOIN : WsEvent.PLAYER_LEAVE;
        this.io.to(roomName).emit(targetEvent, playerEvent);
      }
    });

    // 2. ดักจับการเปลี่ยนสถานะของเซิร์ฟเวอร์
    instance.on('state_change', ({ serverId: sId, oldState, newState }) => {
      if (this.io) {
        this.io.to(`server:${sId}`).emit(WsEvent.SERVER_STATE_CHANGE, {
          serverId: sId,
          oldState,
          newState,
          timestamp: new Date().toISOString(),
        });

        // ส่งให้ทุกห้องที่กำลังดูหน้าสรุป Dashboard ด้วย
        this.io.emit(WsEvent.SERVER_STATE_CHANGE, {
          serverId: sId,
          oldState,
          newState,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  /**
   * ลูปสตรีมข้อมูลสถิติเครื่อง (CPU, RAM, Uptime) ส่งไปยัง Client ทุกๆ 2 วินาที
   */
  private startMetricsBroadcasting(): void {
    this.metricsTimer = setInterval(async () => {
      if (!this.io) return;

      const serverManager = ServerManager.getInstance();
      const allServers = await serverManager.getAllServersInfo();

      for (const server of allServers) {
        if (server.status.pid) {
          const metrics: MetricsUpdate = {
            serverId: server.config.id,
            cpuPercent: server.status.cpuPercent,
            memoryUsageMB: server.status.memoryUsageMB,
            playerCount: server.status.playerCount,
            tps: null,
            timestamp: new Date().toISOString(),
          };

          // ส่งให้เฉพาะผู้ที่อยู่ในห้องของเซิร์ฟเวอร์นั้น
          this.io.to(`server:${server.config.id}`).emit(WsEvent.METRICS_UPDATE, metrics);
        }
      }
    }, 2000);

    this.metricsTimer.unref();
  }

  /**
   * สั่งปิดการทำงานของ WebSocket Server อย่างปลอดภัย
   */
  public async close(): Promise<void> {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    if (this.io) {
      this.logger.info('⏹️  กำลังปิดการเชื่อมต่อทั้งหมดของ Socket.io Server...');
      await this.io.close();
      this.io = null;
      this.listeningServers.clear();
      this.logger.info('✅ ปิด Socket.io Server เรียบร้อยแล้ว');
    }
  }

  public getIO(): SocketIOServer | null {
    return this.io;
  }
}
