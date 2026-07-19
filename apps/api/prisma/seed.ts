import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const categories = [
  { slug: 'plumber', nameUz: 'Santexnik', nameRu: 'Сантехник', basePriceMin: 80_000, basePriceMax: 160_000, iconKey: 'droplet', sortOrder: 1 },
  { slug: 'electrician', nameUz: 'Elektrik', nameRu: 'Электрик', basePriceMin: 70_000, basePriceMax: 150_000, iconKey: 'bolt', sortOrder: 2 },
  { slug: 'ac-technician', nameUz: 'Konditsioner ustasi', nameRu: 'Мастер по кондиционерам', basePriceMin: 100_000, basePriceMax: 250_000, iconKey: 'snowflake', sortOrder: 3 },
  { slug: 'cleaner', nameUz: 'Tozalash xizmati', nameRu: 'Уборка', basePriceMin: 60_000, basePriceMax: 120_000, iconKey: 'sparkles', sortOrder: 4 },
  { slug: 'handyman', nameUz: 'Umumiy usta', nameRu: 'Мастер на час', basePriceMin: 50_000, basePriceMax: 200_000, iconKey: 'tools', sortOrder: 5 },
  { slug: 'renovation', nameUz: "Ta'mirlash", nameRu: 'Ремонт', basePriceMin: 150_000, basePriceMax: 500_000, iconKey: 'wall', sortOrder: 6 },
];

async function main(): Promise<void> {
  for (const c of categories) {
    await prisma.serviceCategory.upsert({ where: { slug: c.slug }, update: c, create: c });
  }
  console.log(`✓ Seeded ${categories.length} service categories`);

  const adminPhone = process.env.SEED_ADMIN_PHONE ?? '+998900000000';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';
  const existing = await prisma.user.findUnique({ where: { phone: adminPhone } });
  if (!existing) {
    await prisma.user.create({
      data: {
        phone: adminPhone,
        passwordHash: await argon2.hash(adminPassword, { type: argon2.argon2id }),
        role: 'ADMIN',
        status: 'ACTIVE',
        locale: 'uz',
        referralCode: `ADMIN${randomBytes(2).toString('hex').toUpperCase()}`,
      },
    });
    console.log(`✓ Seeded dev admin  ${adminPhone}  /  ${adminPassword}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
