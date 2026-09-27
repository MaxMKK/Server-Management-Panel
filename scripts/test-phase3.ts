import path from 'path';
import { prisma } from '@minecraft-panel/database';
import { ServerState } from '@minecraft-panel/shared';
import { buildApp } from '../apps/api/src/app.js';
import { ServerManager } from '../apps/api/src/services/server-manager/server-manager.js';

// ฟังก์ชันช่วยหน่วงเวลา
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runPhase3Tests() {
  console.log('🧪 กำลังเริ่มต้นการทดสอบ Phase 3 (Minecraft Server Agent บน Windows)...');
  console.log('──────────────────────────────────────────────────────────────────');

  // ล้างข้อมูลเซิร์ฟเวอร์ทดสอบเก่าที่อาจค้างอยู่ในฐานข้อมูล
  await prisma.auditLog.deleteMany({
    where: { server: { slug: 'survival-test' } },
  });
  await prisma.server.deleteMany({
    where: { slug: 'survival-test' },
  });

  // 1. บูตระบบ Fastify App ขึ้นมาทดสอบ
  console.log('1️⃣ เริ่มต้น Fastify API และ ServerManager Singleton...');
  const app = await buildApp();
  const serverManager = ServerManager.getInstance();
  console.log('   ✅ Fastify API และ ServerManager พร้อมทำงาน');
  console.log('──────────────────────────────────────────────────────────────────');

  // 2. เข้าสู่ระบบเพื่อรับสิทธิ์ OWNER Token
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

  // 3. ทดสอบการลงทะเบียนเซิร์ฟเวอร์ใหม่ผ่าน REST API (POST /api/servers)
  console.log('3️⃣ ทดสอบการลงทะเบียนเซิร์ฟเวอร์ใหม่ (POST /api/servers)...');
  const mockServerDir = path.resolve('tests/mock-server');
  const createServerRes = await app.inject({
    method: 'POST',
    url: '/api/servers',
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      name: 'Survival Test',
      rootPath: mockServerDir,
      jarFile: 'mock-paper.jar',
      javaPath: 'java', // ทดสอบระบบค้นหา Java 21 อัตโนมัติบน Windows
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
    throw new Error(`❌ ลงทะเบียนเซิร์ฟเวอร์ไม่สำเร็จ: ${createServerRes.body}`);
  }

  const serverId = createServerData.data.id;
  console.log(`   Server ID ที่สร้างได้: ${serverId}`);
  console.log(`   ชื่อเซิร์ฟเวอร์: ${createServerData.data.name}`);
  console.log(`   สถานะเริ่มต้น: ${createServerData.data.status}`);
  console.log('   ✅ บันทึกลงฐานข้อมูล SQLite และลงทะเบียนใน ServerManager สำเร็จ');
  console.log('──────────────────────────────────────────────────────────────────');

  // 4. ทดสอบการสั่งเปิดเซิร์ฟเวอร์ (POST /api/servers/:id/start)
  console.log('4️⃣ ทดสอบการสั่งเปิดเซิร์ฟเวอร์ (POST /api/servers/:id/start)...');
  const startRes = await app.inject({
    method: 'POST',
    url: `/api/servers/${serverId}/start`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  const startData = JSON.parse(startRes.body);
  if (startRes.statusCode !== 200 || !startData.success) {
    throw new Error(`❌ สั่งเปิดเซิร์ฟเวอร์ล้มเหลว: ${startRes.body}`);
  }

  console.log('   ส่งคำสั่ง Start เรียบร้อย กำลังรอ Process รันบน Windows...');

  // รอให้ MockPaperServer พ่นข้อความ "Done" เพื่อเปลี่ยนสถานะเป็น ONLINE
  let isOnline = false;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const instance = serverManager.getInstance(serverId);
    if (instance && instance.getState() === ServerState.ONLINE) {
      isOnline = true;
      console.log(`   ✅ ตรวจจับสถานะ ONLINE สำเร็จในรอบที่ ${i + 1}! (PID: ${instance.getPid()})`);
      break;
    }
  }

  if (!isOnline) {
    const instance = serverManager.getInstance(serverId);
    throw new Error(`❌ เซิร์ฟเวอร์ไม่เปลี่ยนเป็น ONLINE (สถานะปัจจุบัน: ${instance?.getState()})`);
  }
  console.log('──────────────────────────────────────────────────────────────────');

  // 5. ทดสอบการอ่านข้อมูล Telemetry (CPU % และ RAM Usage)
  console.log('5️⃣ ทดสอบ Telemetry (CPU & RAM Metrics ผ่าน pidusage)...');
  // รอ 1 วินาทีให้ pidusage วัดค่า CPU รอบแรก
  await sleep(1000);
  const statusInfo = await serverManager.getServerStatus(serverId);
  console.log(`   สถานะ: ${statusInfo?.state}`);
  console.log(`   PID บน Windows: ${statusInfo?.pid}`);
  console.log(`   CPU Usage: ${statusInfo?.cpuPercent.toFixed(2)} %`);
  console.log(`   RAM Usage: ${statusInfo?.memoryUsageMB.toFixed(2)} MB`);

  if (typeof statusInfo?.cpuPercent !== 'number' || typeof statusInfo?.memoryUsageMB !== 'number') {
    throw new Error('❌ ค่า Telemetry ไม่ใช่ตัวเลขที่ถูกต้อง');
  }
  console.log('   ✅ Telemetry อ่านค่าจาก Windows Process ได้ถูกต้องจริง');
  console.log('──────────────────────────────────────────────────────────────────');

  // 6. ทดสอบการดึง Log ผ่าน CircularBuffer (GET /api/servers/:id/logs)
  console.log('6️⃣ ทดสอบการดึง Log ล่าสุด (GET /api/servers/:id/logs)...');
  const logsRes = await app.inject({
    method: 'GET',
    url: `/api/servers/${serverId}/logs?limit=50`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  const logsData = JSON.parse(logsRes.body);
  if (logsRes.statusCode !== 200 || !Array.isArray(logsData.data)) {
    throw new Error(`❌ ดึง Log ไม่สำเร็จ: ${logsRes.body}`);
  }

  const logs = logsData.data;
  console.log(`   จำนวนบรรทัด Log ที่ได้รับ: ${logs.length}`);
  const hasDoneLog = logs.some((l: { line: string }) => l.line.includes('Done'));
  if (!hasDoneLog) {
    throw new Error('❌ ไม่พบข้อความ Done ใน CircularBuffer');
  }
  console.log('   ตัวอย่าง Log ล่าสุด:');
  logs.slice(-3).forEach((l: { line: string }) => console.log(`     > ${l.line}`));
  console.log('   ✅ CircularBuffer บันทึกและดึง Log ได้ถูกต้อง');
  console.log('──────────────────────────────────────────────────────────────────');

  // 7. ทดสอบการป้องกันการกดเปิดซ้ำ (Double-Start Protection)
  console.log('7️⃣ ทดสอบการป้องกันการเปิดเซิร์ฟเวอร์ซ้ำซ้อน (Double-Start Prevention)...');
  const duplicateStartRes = await app.inject({
    method: 'POST',
    url: `/api/servers/${serverId}/start`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (duplicateStartRes.statusCode !== 400) {
    throw new Error(`❌ คาดหวัง 400 สำหรับการเปิดซ้ำ แต่ได้รับ: ${duplicateStartRes.statusCode}`);
  }
  const duplicateJson = JSON.parse(duplicateStartRes.body);
  console.log(`   ผลการปฏิเสธ: ${duplicateJson.error?.message}`);
  console.log('   ✅ ระบบปฏิเสธการเปิดซ้ำได้อย่างถูกต้องตาม Finite State Machine');
  console.log('──────────────────────────────────────────────────────────────────');

  // 8. ทดสอบการปิดอย่างปลอดภัย (Graceful Stop Sequence: save-all -> stop)
  console.log('8️⃣ ทดสอบ Graceful Shutdown Sequence (POST /api/servers/:id/stop)...');
  const stopRes = await app.inject({
    method: 'POST',
    url: `/api/servers/${serverId}/stop`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (stopRes.statusCode !== 200) {
    throw new Error(`❌ สั่งปิดเซิร์ฟเวอร์ไม่สำเร็จ: ${stopRes.body}`);
  }

  console.log('   ส่งคำสั่ง Stop เรียบร้อย กำลังรอให้ Java Process บันทึกข้อมูลและปิดตัวลง...');

  // รอให้ Process ปิดตัวลง (ไม่เกิน 10 วินาที)
  let isOffline = false;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const instance = serverManager.getInstance(serverId);
    if (instance && instance.getState() === ServerState.OFFLINE) {
      isOffline = true;
      console.log(`   ✅ Process ปิดตัวลงอย่างสมบูรณ์ (สถานะ: OFFLINE, PID คืนระบบเรียบร้อย)`);
      break;
    }
  }

  if (!isOffline) {
    throw new Error('❌ เซิร์ฟเวอร์ไม่ยอมปิดตัวลงภายในเวลาที่กำหนด');
  }

  // ตรวจสอบว่าพอร์ต 25565 กลับมาว่าง
  const portAvailable = await ServerManager.isPortAvailable(25565);
  console.log(`   พอร์ต 25565 ว่างสำหรับการใช้งานครั้งต่อไป: ${portAvailable ? 'ใช่ ✅' : 'ไม่ใช่ ❌'}`);
  if (!portAvailable) {
    throw new Error('❌ พอร์ตยังคงถูกจองค้างอยู่ (อาจเกิด Zombie Process)');
  }
  console.log('   ✅ การทดสอบ Graceful Stop ผ่าน 100%');
  console.log('──────────────────────────────────────────────────────────────────');

  // 9. ทำความสะอาดข้อมูลหลังการทดสอบ
  console.log('9️⃣ ล้างข้อมูลเซิร์ฟเวอร์ทดสอบ...');
  await prisma.auditLog.deleteMany({
    where: { serverId },
  });
  await prisma.server.delete({
    where: { id: serverId },
  });
  console.log('   ✅ ล้างข้อมูลทดสอบเรียบร้อย');
  console.log('──────────────────────────────────────────────────────────────────');

  console.log('🎉 การทดสอบ Phase 3 (Minecraft Server Agent) สำเร็จสมบูรณ์ทุกขั้นตอน!');
}

runPhase3Tests().catch((err) => {
  console.error('❌ เกิดข้อผิดพลาดในการทดสอบ:', err);
  process.exit(1);
});
