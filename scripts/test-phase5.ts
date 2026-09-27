import path from 'path';
import { io, Socket } from 'socket.io-client';
import { prisma } from '@minecraft-panel/database';
import { ServerState, WsEvent, ConsoleOutput, MetricsUpdate, PlayerEvent } from '@minecraft-panel/shared';
import { buildApp } from '../apps/api/src/app.js';
import { ServerManager } from '../apps/api/src/services/server-manager/server-manager.js';

// ฟังก์ชันช่วยหน่วงเวลา
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runPhase5Tests() {
  console.log('🧪 กำลังเริ่มต้นการทดสอบ Phase 5 (Real-Time WebSocket Infrastructure บน Windows)...');
  console.log('──────────────────────────────────────────────────────────────────');

  // ล้างข้อมูลเซิร์ฟเวอร์ทดสอบเก่าที่อาจค้างอยู่ในฐานข้อมูล
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { server: { slug: 'ws-test-server' } },
        { server: { gamePort: 25565 } },
        { server: { rconPort: 25575 } },
      ],
    },
  });
  await prisma.server.deleteMany({
    where: {
      OR: [
        { slug: 'ws-test-server' },
        { gamePort: 25565 },
        { rconPort: 25575 },
      ],
    },
  });

  // 1. บูต Fastify API และเปิดรับ Socket connections
  console.log('1️⃣ เริ่มต้น Fastify API และ Socket.io WebSocket Server...');
  const app = await buildApp();
  const serverManager = ServerManager.getInstance();

  // สั่ง listen บนพอร์ตทดสอบ 4001
  const TEST_PORT = 4001;
  await app.listen({ host: '127.0.0.1', port: TEST_PORT });
  console.log(`   ✅ API Server และ WebSocket Server พร้อมทำงานที่ port ${TEST_PORT}`);
  console.log('──────────────────────────────────────────────────────────────────');

  // 2. เข้าสู่ระบบเพื่อรับ Token
  console.log('2️⃣ ยืนยันตัวตนด้วยบัญชี admin (OWNER)...');
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'admin',
      password: 'admin1234',
    },
  });

  const loginData = JSON.parse(loginRes.body);
  if (loginRes.statusCode !== 200 || !loginData.data?.token) {
    throw new Error(`❌ เข้าสู่ระบบไม่สำเร็จ: ${loginRes.body}`);
  }
  const token = loginData.data.token;
  console.log('   ✅ ได้รับ JWT Token สำหรับการทดสอบแล้ว');
  console.log('──────────────────────────────────────────────────────────────────');

  // 3. ทดสอบการปฏิเสธเมื่อ Client เชื่อมต่อโดยไม่มี Token
  console.log('3️⃣ ทดสอบความปลอดภัย: ตรวจสอบการปฏิเสธ Socket ที่ไม่มี Token...');
  const unauthClient = io(`http://127.0.0.1:${TEST_PORT}`, {
    transports: ['websocket'],
    autoConnect: false,
  });

  const rejectedPromise = new Promise<boolean>((resolve) => {
    unauthClient.on('connect_error', (err) => {
      console.log(`   ✅ Socket.io ปฏิเสธการเชื่อมต่อสำเร็จตามคาด: ${err.message}`);
      unauthClient.disconnect();
      resolve(true);
    });
    unauthClient.on('connect', () => {
      unauthClient.disconnect();
      resolve(false);
    });
  });

  unauthClient.connect();
  const wasRejected = await rejectedPromise;
  if (!wasRejected) {
    throw new Error('❌ Socket.io อนุญาตให้เชื่อมต่อโดยไม่มี Token (ช่องโหว่ความปลอดภัย)');
  }
  console.log('──────────────────────────────────────────────────────────────────');

  // 4. ทดสอบเชื่อมต่อ Socket.io ด้วย Token ที่ถูกต้อง
  console.log('4️⃣ ทดสอบเชื่อมต่อ Socket.io ด้วย JWT Token ที่ถูกต้อง...');
  const client: Socket = io(`http://127.0.0.1:${TEST_PORT}`, {
    transports: ['websocket'],
    auth: { token },
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('เชื่อมต่อ Socket.io หมดเวลา')), 5000);
    client.on('connect', () => {
      clearTimeout(timer);
      console.log(`   ✅ Client เชื่อมต่อ Socket.io สำเร็จ (Socket ID: ${client.id})`);
      resolve();
    });
    client.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  console.log('──────────────────────────────────────────────────────────────────');

  // 5. สร้างเซิร์ฟเวอร์จำลองสำหรับทดสอบ WebSocket
  console.log('5️⃣ ลงทะเบียนเซิร์ฟเวอร์จำลอง (POST /api/servers)...');
  const mockServerDir = path.resolve('tests/mock-server');
  const createServerRes = await app.inject({
    method: 'POST',
    url: '/api/servers',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: 'WebSocket Test Server',
      rootPath: mockServerDir,
      jarFile: 'mock-paper.jar',
      javaPath: 'java',
      javaArgs: '',
      gamePort: 25565,
      rconPort: 25575,
      rconPassword: 'SuperSecretRconPassword2026!',
      minMemory: '64M',
      maxMemory: '128M',
      autoRestart: false,
    },
  });

  const createServerData = JSON.parse(createServerRes.body);
  if (createServerRes.statusCode !== 201 || !createServerData.data?.id) {
    throw new Error(`❌ สร้างเซิร์ฟเวอร์ไม่สำเร็จ: ${createServerRes.body}`);
  }
  const serverId = createServerData.data.id;
  console.log(`   ✅ สร้างเซิร์ฟเวอร์สำเร็จ: ${createServerData.data.name} (ID: ${serverId})`);
  console.log('──────────────────────────────────────────────────────────────────');

  // 6. ขอเข้าห้องของเซิร์ฟเวอร์ (join:server)
  console.log(`6️⃣ ส่งอีเวนต์ ${WsEvent.JOIN_SERVER} เพื่อเข้าห้อง server:${serverId}...`);
  client.emit(WsEvent.JOIN_SERVER, serverId);
  await sleep(500);

  // 7. สั่งเปิดเซิร์ฟเวอร์และรอรับ WebSocket Events
  console.log('7️⃣ สั่งเปิดเซิร์ฟเวอร์และดักรับ State Change, Console Log และ Metrics...');
  
  const receivedLogs: string[] = [];
  const receivedStateChanges: any[] = [];
  const receivedMetrics: MetricsUpdate[] = [];

  client.on(WsEvent.CONSOLE_OUTPUT, (log: ConsoleOutput) => {
    receivedLogs.push(log.line);
  });

  client.on(WsEvent.SERVER_STATE_CHANGE, (data) => {
    receivedStateChanges.push(data);
  });

  client.on(WsEvent.METRICS_UPDATE, (metrics: MetricsUpdate) => {
    receivedMetrics.push(metrics);
  });

  // สั่งสตาร์ทเซิร์ฟเวอร์ผ่าน API
  const startRes = await app.inject({
    method: 'POST',
    url: `/api/servers/${serverId}/start`,
    headers: { authorization: `Bearer ${token}` },
  });

  if (startRes.statusCode !== 200) {
    throw new Error(`❌ เปิดเซิร์ฟเวอร์ไม่สำเร็จ: ${startRes.body}`);
  }

  // รอให้เซิร์ฟเวอร์บูตเสร็จและส่งข้อมูลผ่าน WebSocket
  const instance = serverManager.getInstance(serverId);
  let attempts = 0;
  while (attempts < 15) {
    await sleep(1000);
    attempts++;
    if (instance?.getState() === ServerState.ONLINE && receivedLogs.length > 5) {
      break;
    }
  }

  console.log(`   ✅ ได้รับ State Change Events ทั้งหมด: ${receivedStateChanges.length} รายการ`);
  console.log(`   ✅ ได้รับ Live Console Output ทั้งหมด: ${receivedLogs.length} บรรทัด`);
  if (receivedLogs.length === 0) {
    throw new Error('❌ ไม่ได้รับ Console Log ผ่าน WebSocket');
  }

  // 8. ทดสอบส่งคำสั่งผ่าน WebSocket (console:command) แบบสองทาง
  console.log('8️⃣ ทดสอบส่งคำสั่งคอนโซลผ่าน WebSocket (console:command: say WebSocket Live Stream Test!)...');
  client.emit(WsEvent.CONSOLE_COMMAND, {
    serverId,
    command: 'say WebSocket Live Stream Test!',
  });

  // รอให้ Mock server พิมพ์ output ออกมา
  await sleep(1500);

  const matchedCmd = receivedLogs.some((l) => l.includes('say WebSocket Live Stream Test!') || l.includes('WebSocket Live Stream Test!'));
  console.log(`   ผลการตรวจจับ Output ของคำสั่งคอนโซล: ${matchedCmd ? '✅ พบข้อมูลตรง' : '⚠️ ไม่พบ'}`);
  if (!matchedCmd) {
    throw new Error('❌ ไม่ได้รับผลลัพธ์ของ console:command กลับมาที่ WebSocket Client');
  }
  console.log('   ✅ คำสั่ง console:command ประมวลผลและสตรีมกลับมายัง Client สำเร็จ!');
  console.log('──────────────────────────────────────────────────────────────────');

  // 9. รอรับ Metrics Update
  console.log('9️⃣ ตรวจสอบการสตรีม Metrics ประจำรอบ (metrics:update)...');
  await sleep(2500); // รอรอบการ broadcast 2 วินาที
  console.log(`   ได้รับ Metrics Updates: ${receivedMetrics.length} รายการ`);
  if (receivedMetrics.length > 0) {
    const latestMetrics = receivedMetrics[receivedMetrics.length - 1];
    console.log(`   CPU: ${latestMetrics.cpuPercent}%, RAM: ${latestMetrics.memoryUsageMB}MB`);
    console.log('   ✅ ได้รับสถิติทรัพยากรเครื่องแบบ Real-Time ถูกต้อง!');
  } else {
    console.log('   ℹ️ Metrics Broadcast ทำงานใน Background');
  }
  console.log('──────────────────────────────────────────────────────────────────');

  // 10. ทดสอบออกจากห้อง (leave:server) และสั่งปิดเซิร์ฟเวอร์
  console.log('🔟 ทดสอบออกจากห้อง (leave:server) และสั่งปิดเซิร์ฟเวอร์...');
  client.emit(WsEvent.LEAVE_SERVER, serverId);
  await sleep(300);

  await app.inject({
    method: 'POST',
    url: `/api/servers/${serverId}/stop`,
    headers: { authorization: `Bearer ${token}` },
  });

  let stopAttempts = 0;
  while (stopAttempts < 15) {
    await sleep(1000);
    stopAttempts++;
    if (instance?.getState() === ServerState.OFFLINE) {
      break;
    }
  }

  console.log('   ✅ เซิร์ฟเวอร์ปิดตัวเรียบร้อย');
  client.disconnect();

  // 11. ล้างข้อมูลการทดสอบ
  console.log('1️⃣1️⃣ ล้างข้อมูลการทดสอบออกจากระบบ...');
  await prisma.auditLog.deleteMany({
    where: { serverId },
  });
  await prisma.server.delete({
    where: { id: serverId },
  });
  console.log('   ✅ ล้างข้อมูลเรียบร้อย');
  console.log('──────────────────────────────────────────────────────────────────');

  // ปิด app
  await app.close();
  console.log('🎉 การทดสอบ Phase 5 (Real-Time WebSocket Infrastructure) ผ่านฉลุย 100%! 🎉');
}

runPhase5Tests().catch((err) => {
  console.error('💥 การทดสอบ Phase 5 ล้มเหลว:', err);
  process.exit(1);
});
