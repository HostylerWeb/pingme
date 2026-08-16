import { config } from 'dotenv';
import { resolve } from 'path';
import { AuthProvider, AdminRole, PrismaClient, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== '1') {
    throw new Error('Refusing to seed in production without ALLOW_SEED=1');
  }

  const PASSWORD = process.env.SEED_USER_PASSWORD ?? 'Password123!';
  const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'AdminPass123!';

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await prisma.adminUser.upsert({
    where: { email: 'admin@pingme.test' },
    update: {},
    create: {
      email: 'admin@pingme.test',
      passwordHash: adminPasswordHash,
      role: AdminRole.super_admin,
    },
  });

  for (let i = 1; i <= 10; i++) {
    const email = `user${i}@pingme.test`;
    const displayName = `Test User ${i}`;
    const dateOfBirth = new Date(1995, 0, i);

    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash,
        authProvider: AuthProvider.email,
        status: UserStatus.active,
        profile: {
          create: {
            displayName,
            bio: `Seed user ${i} for local development.`,
            dateOfBirth,
          },
        },
        settings: {
          create: {},
        },
      },
    });
  }

  console.log('Seeded 10 test users (local/dev only — rotate passwords on shared staging).');
  console.log(`Login with any user1@pingme.test … user10@pingme.test / ${PASSWORD}`);
  console.log(`Admin login: admin@pingme.test / ${ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
