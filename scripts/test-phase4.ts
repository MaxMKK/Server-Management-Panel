import path from 'path';
import { prisma } from '@minecraft-panel/database';
import { ServerState, ErrorCode } from '@minecraft-panel/shared';
import { buildApp } from '../apps/api/src/app.js';
import { ServerManager } from '../apps/api/src/services/server-manager/server-manager.js';
import { RconPool } from '../apps/api/src/services/rcon/rcon-pool.js';

// ฟังก์ชันช่วยหน่วงเวลา
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runPhase4Tests() {
  console.log('🧪 กำลังเริ่มต้นการทดสอบ Phase 4 (RCON Protocol Integration บน Windows)...');
  console.log('──────────────────────────────────────────────────────────────────');

  // ล้างข้อมูลเซิร์ฟเวอร์ทดสอบเก่าที่อาจค้างอยู่ในฐานข้อมูล
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { server: { slug: 'rcon-test-server' } },
        { server: { gamePort: 25565 } },
        { server: { rconPort: 25575 } },
      ],
    },
  });
  await prisma.server.deleteMany({
    where: {
      OR: [
        { slug: 'rcon-test-server' },
        { gamePort: 25565 },
        { rconPort: 25575 },
      ],
    },
  });

  // 1. บูตระบบ Fastify App
  console.log('1️⃣ เริ่มต้น Fastify API และ ServerManager...');
  const app = await buildApp();
  const serverManager = ServerManager.getInstance();
  console.log('   ✅ Fastify API พร้อมทำงาน');
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

  // 3. สร้างและลงทะเบียนเซิร์ฟเวอร์ใหม่
  console.log('3️⃣ ลงทะเบียนเซิร์ฟเวอร์จำลองที่มี RCON (POST /api/servers)...');
  const mockServerDir = path.resolve('tests/mock-server');
  const createServerRes = await app.inject({
    method: 'POST',
    url: '/api/servers',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: 'RCON Test Server',
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

  // 4. สั่งเปิดเซิร์ฟเวอร์และรอจน ONLINE
  console.log('4️⃣ สั่งเปิดเซิร์ฟเวอร์ (POST /api/servers/:id/start)...');
  const startRes = await app.inject({
    method: 'POST',
    url: `/api/servers/${serverId}/start`,
    headers: { authorization: `Bearer ${token}` },
  });

  if (startRes.statusCode !== 200) {
    throw new Error(`❌ เปิดเซิร์ฟเวอร์ไม่สำเร็จ: ${startRes.body}`);
  }

  console.log('   ⏳ กำลังรอให้เซิร์ฟเวอร์และ RCON พร้อมทำงาน...');
  const instance = serverManager.getInstance(serverId);
  let attempts = 0;
  while (attempts < 15) {
    await sleep(1000);
    attempts++;
    if (instance?.getState() === ServerState.ONLINE) {
      break;
    }
  }

  if (instance?.getState() !== ServerState.ONLINE) {
    throw new Error(`❌ เซิร์ฟเวอร์ไม่เข้าสู่สถานะ ONLINE ภายใน 15 วินาที (สถานะ: ${instance?.getState()})`);
  }
  console.log(`   ✅ เซิร์ฟเวอร์และ RCON พอร์ต 25575 พร้อมใช้งานแล้ว (PID: ${instance.getPid()})`);
  console.log('──────────────────────────────────────────────────────────────────');

  // 5. ทดสอบส่งคำสั่งผ่าน RCON (POST /api/servers/:id/rcon/exec)
  console.log('5️⃣ ทดสอบรันคำสั่งผ่าน RCON: list...');
  const rconListRes = await app.inject({
    method: 'POST',
    url: `/api/servers/${serverId}/rcon/exec`,
    headers: { authorization: `Bearer ${token}` },
    payload: { command: 'list' },
  });

  const rconListData = JSON.parse(rconListRes.body);
  console.log('   ผลลัพธ์ RCON list:', rconListData);
  if (rconListRes.statusCode !== 200 || !rconListData.data?.response.includes('players online')) {
    throw new Error(`❌ คำสั่ง RCON list ล้มเหลว: ${rconListRes.body}`);
  }
  console.log('   ✅ คำสั่ง RCON list สำเร็จตรงตามสเปก!');

  console.log('   ทดสอบรันคำสั่งผ่าน RCON: version...');
  const rconVerRes = await app.inject({
    method: 'POST',
    url: `/api/servers/${serverId}/rcon/exec`,
    headers: { authorization: `Bearer ${token}` },
    payload: { command: 'version' },
  });
  const rconVerData = JSON.parse(rconVerRes.body);
  console.log('   ผลลัพธ์ RCON version:', rconVerData);
  if (rconVerRes.statusCode !== 200 || !rconVerData.data?.response.includes('git-Paper-1.21.1')) {
    throw new Error(`❌ คำสั่ง RCON version ล้มเหลว: ${rconVerRes.body}`);
  }
  console.log('   ✅ คำสั่ง RCON version สำเร็จ!');

  console.log('   ทดสอบรันคำสั่งผ่าน RCON: say Hello from Minecraft Panel!...');
  const rconSayRes = await app.inject({
    method: 'POST',
    url: `/api/servers/${serverId}/rcon/exec`,
    headers: { authorization: `Bearer ${token}` },
    payload: { command: 'say Hello from Minecraft Panel!' },
  });
  const rconSayData = JSON.parse(rconSayRes.body);
  if (rconSayRes.statusCode !== 200 || !rconSayData.data?.response.includes('Hello from Minecraft Panel!')) {
    throw new Error(`❌ คำสั่ง RCON say ล้มเหลว: ${rconSayRes.body}`);
  }
  console.log('   ✅ คำสั่ง RCON say สำเร็จ!');
  console.log('──────────────────────────────────────────────────────────────────');

  // 6. ตรวจสอบสถานะการเชื่อมต่อ RCON (GET /api/servers/:id/rcon/status)
  console.log('6️⃣ ตรวจสอบสถานะการเชื่อมต่อ RCON (GET /api/servers/:id/rcon/status)...');
  const rconStatusRes = await app.inject({
    method: 'GET',
    url: `/api/servers/${serverId}/rcon/status`,
    headers: { authorization: `Bearer ${token}` },
  });
  const rconStatusData = JSON.parse(rconStatusRes.body);
  console.log('   สถานะ RCON:', rconStatusData);
  if (rconStatusRes.statusCode !== 200 || !rconStatusData.data?.connected) {
    throw new Error(`❌ สถานะ RCON ไม่ถูกต้อง: ${rconStatusRes.body}`);
  }
  console.log('   ✅ สถานะ RCON Pool ถูกต้อง (connected: true)');
  console.log('──────────────────────────────────────────────────────────────────');

  // 7. ตรวจสอบ Audit Log ว่ามีการบันทึกการรัน RCON หรือไม่
  console.log('7️⃣ ตรวจสอบ Audit Log ของคำสั่ง RCON ในฐานข้อมูล...');
  const rconAuditLogs = await prisma.auditLog.findMany({
    where: {
      serverId,
      action: 'RCON_EXECUTE',
    },
  });
  console.log(`   พบประวัติ Audit Log RCON ทั้งหมด: ${rconAuditLogs.length} รายการ`);
  if (rconAuditLogs.length < 3) {
    throw new Error('❌ บันทึก Audit Log ของ RCON ไม่ครบถ้วน');
  }
  console.log('   ✅ บันทึก Audit Log ปลอดภัยครบถ้วน');
  console.log('──────────────────────────────────────────────────────────────────');

  // 8. สั่งปิดเซิร์ฟเวอร์แบบ Graceful Stop
  console.log('8️⃣ สั่งปิดเซิร์ฟเวอร์ (POST /api/servers/:id/stop)...');
  const stopRes = await app.inject({
    method: 'POST',
    url: `/api/servers/${serverId}/stop`,
    headers: { authorization: `Bearer ${token}` },
  });

  if (stopRes.statusCode !== 200) {
    throw new Error(`❌ ปิดเซิร์ฟเวอร์ไม่สำเร็จ: ${stopRes.body}`);
  }

  console.log('   ⏳ รอเซิร์ฟเวอร์ปิดตัว...');
  let stopAttempts = 0;
  while (stopAttempts < 15) {
    await sleep(1000);
    stopAttempts++;
    if (instance.getState() === ServerState.OFFLINE) {
      break;
    }
  }

  if (instance.getState() !== ServerState.OFFLINE) {
    throw new Error(`❌ เซิร์ฟเวอร์ไม่ปิดตัวลงภายในเวลาที่กำหนด (สถานะ: ${instance.getState()})`);
  }
  console.log('   ✅ เซิร์ฟเวอร์ปิดตัวลงอย่างสมบูรณ์ (OFFLINE)');

  // ตรวจสอบว่า RconPool ปลดการเชื่อมต่อแล้ว
  const isStillConnected = RconPool.getInstance().isConnected(serverId);
  console.log(`   สถานะ RCON Pool หลังปิดเซิร์ฟเวอร์: connected = ${isStillConnected}`);
  if (isStillConnected) {
    throw new Error('❌ RCON Pool ยังไม่ได้ปลดการเชื่อมต่อเมื่อเซิร์ฟเวอร์ดับ');
  }
  console.log('   ✅ RCON Pool ตัดการเชื่อมต่อทันทีที่เซิร์ฟเวอร์ปิดตัว');
  console.log('──────────────────────────────────────────────────────────────────');

  // 9. เคลียร์ข้อมูลการทดสอบ
  console.log('9️⃣ ล้างข้อมูลการทดสอบออกจากระบบ...');
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
  console.log('🎉 การทดสอบ Phase 4 (RCON Integration) ผ่านฉลุย 100%! 🎉');
}

runPhase4Tests().catch((err) => {
  console.error('💥 การทดสอบ Phase 4 ล้มเหลว:', err);
  process.exit(1);
});
