import { buildApp } from '../apps/api/src/app.js';
import { CryptoService } from '../apps/api/src/services/crypto.service.js';

async function runTests() {
  console.log('🧪 กำลังเริ่มต้นการทดสอบ Phase 2 (Database & Authentication)...');
  console.log('──────────────────────────────────────────────────');

  // 1. ทดสอบการเข้ารหัสและถอดรหัส AES-256 (CryptoService)
  console.log('1️⃣ ทดสอบบริการเข้ารหัส AES-256-GCM...');
  const secretRconPassword = 'SuperSecretRconPassword2026!';
  const encrypted = CryptoService.encrypt(secretRconPassword);
  const decrypted = CryptoService.decrypt(encrypted);

  if (decrypted !== secretRconPassword) {
    throw new Error(`❌ ถอดรหัสไม่ตรงกับต้นฉบับ! ได้: ${decrypted}`);
  }
  console.log(`   ต้นฉบับ: ${secretRconPassword}`);
  console.log(`   เข้ารหัส: ${encrypted.substring(0, 32)}...`);
  console.log(`   ถอดรหัส: ${decrypted}`);
  console.log('   ✅ การทดสอบ AES-256 ผ่านเรียบร้อย');
  console.log('──────────────────────────────────────────────────');

  // 2. บูตแอป Fastify API ขึ้นมาในหน่วยความจำสำหรับการทดสอบ
  const app = await buildApp();

  // 3. ทดสอบ Login ด้วยรหัสผ่านที่ผิด
  console.log('2️⃣ ทดสอบการส่งรหัสผ่านที่ผิด (Invalid Password)...');
  const invalidLoginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'admin',
      password: 'wrongpassword',
    },
  });

  const invalidJson = JSON.parse(invalidLoginRes.body);
  if (invalidLoginRes.statusCode !== 401 || invalidJson.success !== false) {
    throw new Error(`❌ คาดหวัง 401 แต่ได้รับ: ${invalidLoginRes.statusCode}`);
  }
  console.log(`   รหัสสถานะ: ${invalidLoginRes.statusCode} (${invalidJson.error?.code})`);
  console.log('   ✅ การปฏิเสธรหัสผ่านผิด ทำงานถูกต้อง');
  console.log('──────────────────────────────────────────────────');

  // 4. ทดสอบ Login ด้วยบัญชี Owner เริ่มต้น (admin / admin1234)
  console.log('3️⃣ ทดสอบการเข้าสู่ระบบด้วยบัญชี Owner เริ่มต้น (admin / admin1234)...');
  const validLoginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'admin',
      password: 'admin1234',
    },
  });

  const validJson = JSON.parse(validLoginRes.body);
  if (validLoginRes.statusCode !== 200 || !validJson.data?.token) {
    throw new Error(`❌ เข้าสู่ระบบไม่สำเร็จ: ${validLoginRes.body}`);
  }

  const token = validJson.data.token;
  const user = validJson.data.user;
  console.log(`   รหัสสถานะ: ${validLoginRes.statusCode} OK`);
  console.log(`   ผู้ใช้งาน: ${user.username} (บทบาท: ${user.role})`);
  console.log(`   จำนวนสิทธิ์ที่ได้รับ: ${user.permissions?.length} สิทธิ์`);
  console.log(`   ตัวอย่าง Token: ${token.substring(0, 24)}...`);
  console.log('   ✅ การเข้าสู่ระบบและสร้าง Token ทำงานถูกต้อง');
  console.log('──────────────────────────────────────────────────');

  // 5. ทดสอบเรียก GET /api/auth/me โดยแนบ Token ใน Authorization Header
  console.log('4️⃣ ทดสอบเรียกข้อมูลโปรไฟล์ผ่าน GET /api/auth/me...');
  const meRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  const meJson = JSON.parse(meRes.body);
  if (meRes.statusCode !== 200 || meJson.data?.username !== 'admin') {
    throw new Error(`❌ เรียก me ไม่สำเร็จ: ${meRes.body}`);
  }
  console.log(`   รหัสสถานะ: ${meRes.statusCode} OK`);
  console.log(`   ผู้ใช้ที่ได้รับ: ${meJson.data.username}`);
  console.log('   ✅ การตรวจสอบ Token ผ่าน Middleware ทำงานถูกต้อง');
  console.log('──────────────────────────────────────────────────');

  console.log('🎉 การทดสอบทุกขั้นตอนของ Phase 2 ผ่านสมบูรณ์ 100%!');
  await app.close();
}

runTests().catch((err) => {
  console.error('💥 การทดสอบล้มเหลว:', err);
  process.exit(1);
});
