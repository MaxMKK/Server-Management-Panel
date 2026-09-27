import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ข้อมูลสิทธิ์ทั้งหมดในระบบ (28 สิทธิ์)
const PERMISSIONS = [
  // การจัดการเซิร์ฟเวอร์
  { key: 'server.view', category: 'Server Management', description: 'View server status and details' },
  { key: 'server.start', category: 'Server Management', description: 'Start Minecraft server instance' },
  { key: 'server.stop', category: 'Server Management', description: 'Stop Minecraft server instance gracefully' },
  { key: 'server.restart', category: 'Server Management', description: 'Restart Minecraft server instance' },
  { key: 'server.kill', category: 'Server Management', description: 'Force kill Minecraft server process' },
  { key: 'server.create', category: 'Server Management', description: 'Register new Minecraft server' },
  { key: 'server.delete', category: 'Server Management', description: 'Delete Minecraft server instance' },

  // คอนโซลและคำสั่ง
  { key: 'console.view', category: 'Console', description: 'View real-time console stdout and stderr' },
  { key: 'console.execute', category: 'Console', description: 'Execute Minecraft commands via console or RCON' },

  // การจัดการผู้เล่น
  { key: 'players.view', category: 'Player Management', description: 'View online players list' },
  { key: 'players.kick', category: 'Player Management', description: 'Kick player from server' },
  { key: 'players.ban', category: 'Player Management', description: 'Ban player from server' },
  { key: 'players.unban', category: 'Player Management', description: 'Unban player' },
  { key: 'whitelist.manage', category: 'Player Management', description: 'Manage server whitelist' },
  { key: 'op.manage', category: 'Player Management', description: 'Grant or revoke OP permissions' },

  // การจัดการปลั๊กอิน
  { key: 'plugins.view', category: 'Plugin Management', description: 'View installed plugins list' },
  { key: 'plugins.upload', category: 'Plugin Management', description: 'Upload plugin jar file' },
  { key: 'plugins.delete', category: 'Plugin Management', description: 'Delete plugin jar file' },
  { key: 'plugins.toggle', category: 'Plugin Management', description: 'Enable or disable plugin' },

  // การจัดการไฟล์
  { key: 'files.view', category: 'File Management', description: 'Browse and view server files' },
  { key: 'files.edit', category: 'File Management', description: 'Edit configuration files' },
  { key: 'files.upload', category: 'File Management', description: 'Upload files into server sandbox' },
  { key: 'files.delete', category: 'File Management', description: 'Delete files or directories' },

  // การสำรองข้อมูล
  { key: 'backup.create', category: 'Backup Management', description: 'Create backup archive' },
  { key: 'backup.restore', category: 'Backup Management', description: 'Restore server from backup' },
  { key: 'backup.delete', category: 'Backup Management', description: 'Delete backup archive' },

  // การดูแลระบบ
  { key: 'settings.manage', category: 'Administration', description: 'Manage global system settings' },
  { key: 'users.manage', category: 'Administration', description: 'Manage users and role assignments' },
];

async function main() {
  console.log('🌱 เริ่มต้นกระบวนการ Seed ฐานข้อมูล...');

  // 1. สร้างสิทธิ์ทั้งหมด (Permissions)
  console.log('📦 กำลังสร้างสิทธิ์ (Permissions)...');
  const permissionMap = new Map<string, string>();

  for (const p of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { key: p.key },
      update: { category: p.category, description: p.description },
      create: p,
    });
    permissionMap.set(p.key, perm.id);
  }
  console.log(`✅ บันทึกสิทธิ์เรียบร้อยแล้ว: ${permissionMap.size} รายการ`);

  // 2. สร้างระดับบทบาท (Roles)
  console.log('👥 กำลังสร้างบทบาท (Roles)...');
  
  const ownerRole = await prisma.role.upsert({
    where: { name: 'OWNER' },
    update: { description: 'System Owner with full unrestricted access' },
    create: {
      name: 'OWNER',
      description: 'System Owner with full unrestricted access',
      priority: 100,
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: { description: 'Server Administrator with operational access' },
    create: {
      name: 'ADMIN',
      description: 'Server Administrator with operational access',
      priority: 50,
    },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'USER' },
    update: { description: 'Standard User with read-only access' },
    create: {
      name: 'USER',
      description: 'Standard User with read-only access',
      priority: 10,
    },
  });

  // 3. ผูกสิทธิ์ให้กับแต่ละบทบาท (Role Permissions)
  console.log('🔗 กำลังกำหนดสิทธิ์ให้กับแต่ละบทบาท...');

  // ล้างการผูกสิทธิ์เดิมเพื่อป้องกันข้อมูลซ้ำซ้อน
  await prisma.rolePermission.deleteMany({});

  // OWNER: ได้รับสิทธิ์ครบทั้งหมด 100%
  const ownerPermData = Array.from(permissionMap.values()).map((permId) => ({
    roleId: ownerRole.id,
    permissionId: permId,
  }));
  await prisma.rolePermission.createMany({ data: ownerPermData });

  // ADMIN: สิทธิ์การดูแลและจัดการทั่วไป (ไม่รวม kill process, delete server, op.manage, และ user settings)
  const adminKeys = [
    'server.view', 'server.start', 'server.stop', 'server.restart',
    'console.view', 'console.execute',
    'players.view', 'players.kick', 'players.ban', 'players.unban', 'whitelist.manage',
    'plugins.view', 'plugins.upload', 'plugins.toggle',
    'files.view', 'files.edit', 'files.upload',
    'backup.create',
  ];
  const adminPermData = adminKeys
    .filter((k) => permissionMap.has(k))
    .map((k) => ({
      roleId: adminRole.id,
      permissionId: permissionMap.get(k)!,
    }));
  await prisma.rolePermission.createMany({ data: adminPermData });

  // USER: สิทธิ์ดูอย่างเดียว
  const userKeys = ['server.view', 'console.view', 'players.view', 'plugins.view'];
  const userPermData = userKeys
    .filter((k) => permissionMap.has(k))
    .map((k) => ({
      roleId: userRole.id,
      permissionId: permissionMap.get(k)!,
    }));
  await prisma.rolePermission.createMany({ data: userPermData });

  // 4. สร้างบัญชีผู้ใช้งานระดับ OWNER เริ่มต้น
  console.log('👤 กำลังสร้างบัญชีผู้ใช้เริ่มต้น (Default Owner Account)...');
  const defaultPassword = 'admin1234';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(defaultPassword, salt);

  const defaultUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash,
      roleId: ownerRole.id,
      isActive: true,
    },
    create: {
      username: 'admin',
      displayName: 'System Administrator',
      email: 'admin@localhost.internal',
      passwordHash,
      roleId: ownerRole.id,
      isActive: true,
    },
  });

  console.log('──────────────────────────────────────────────────');
  console.log('🎉 Seed ฐานข้อมูลสำเร็จสมบูรณ์!');
  console.log(`   บัญชีเริ่มต้น: ${defaultUser.username}`);
  console.log(`   รหัสผ่าน:      ${defaultPassword}`);
  console.log(`   ระดับบทบาท:    OWNER (สิทธิ์เต็ม 100%)`);
  console.log('──────────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ เกิดข้อผิดพลาดขณะ Seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
