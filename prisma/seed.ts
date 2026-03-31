import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    ?? '';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? '';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Seed: SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD são obrigatórios.');
  process.exit(1);
}

async function main() {
  // ─── Planos ───────────────────────────────────────────────────────────────
  const plans = [
    { id: 'FREE',    name: 'Free',    price: 0,    unitLimit: 1,  professionalLimit: 3  },
    { id: 'PREMIUM', name: 'Premium', price: 4990, unitLimit: 3,  professionalLimit: 10 },
    { id: 'PRO',     name: 'Pro',     price: 9990, unitLimit: -1, professionalLimit: -1 },
    { id: 'ADMIN',   name: 'Admin',   price: 0,    unitLimit: -1, professionalLimit: -1 },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: {},
      create: plan,
    });
  }

  console.log('Seed: planos inseridos/atualizados.');

  // ─── Admin Lucas Trindade (idempotente) ───────────────────────────────────
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

  if (existing) {
    console.log('Seed: admin já existe, pulando criação.');
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const shop = await prisma.shop.create({
    data: {
      name:    'Trinity Web',
      email:   ADMIN_EMAIL,
      phone:   '11952498126',
      address: 'Rua Professora Anisabel de Campos Costa, 130 - Aterrado, Mogi Mirim - SP, CEP 13801-360',
    },
  });

  const user = await prisma.user.create({
    data: {
      shopId:       shop.id,
      name:         'Lucas Trindade',
      email:        ADMIN_EMAIL,
      passwordHash,
      role:         'admin',
    },
  });

  await prisma.userPlan.create({
    data: {
      userId:             user.id,
      planId:             'ADMIN',
      subscriptionStatus: 'ACTIVE',
    },
  });

  console.log(`Seed: admin criado — ${user.email}`);

  // ─── Unidade ──────────────────────────────────────────────────────────────
  const unit = await prisma.unit.create({
    data: {
      shopId:   shop.id,
      name:     'Unidade Centro',
      slug:     'unidade-centro',
      phone:    '11912345678',
      zipcode:  '13801360',
      street:   'Rua das Flores',
      number:   '42',
      district: 'Centro',
      city:     'Mogi Mirim',
      state:    'SP',
    },
  });

  console.log(`Seed: unidade criada — ${unit.name}`);

  // ─── Profissional ─────────────────────────────────────────────────────────
  const professional = await prisma.professional.create({
    data: {
      shopId:     shop.id,
      unitId:     unit.id,
      name:       'Carlos Silva',
      phone:      '11987654321',
      email:      'carlos@exemplo.com',
      specialties: ['Corte', 'Barba'],
      active:     true,
    },
  });

  console.log(`Seed: profissional criado — ${professional.name}`);

  // ─── Horário de funcionamento da shop ─────────────────────────────────────
  const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  for (const day of weekDays) {
    await prisma.shopHour.upsert({
      where:  { shopId_day: { shopId: shop.id, day } },
      update: {},
      create: { shopId: shop.id, day, start: '09:00', end: '18:00' },
    });
  }

  console.log('Seed: horários de funcionamento criados (seg–sex 09:00–18:00).');

  // ─── Disponibilidade do profissional ──────────────────────────────────────
  for (const day of weekDays) {
    await prisma.workingHour.upsert({
      where:  { professionalId_day: { professionalId: professional.id, day } },
      update: {},
      create: {
        professionalId: professional.id,
        day,
        start:      '09:00',
        end:        '18:00',
        lunchStart: '12:00',
        lunchEnd:   '13:00',
      },
    });
  }

  console.log('Seed: disponibilidade do profissional criada (seg–sex 09:00–18:00).');

  // ─── Serviços ─────────────────────────────────────────────────────────────
  await prisma.service.createMany({
    data: [
      {
        shopId:      shop.id,
        name:        'Corte de Cabelo',
        duration:    30,
        price:       3500,
        description: 'Corte masculino com acabamento',
        type:        'service',
        active:      true,
      },
      {
        shopId:      shop.id,
        name:        'Hidratação',
        duration:    20,
        price:       1500,
        description: 'Hidratação capilar complementar',
        type:        'addon',
        active:      true,
      },
    ],
  });

  console.log('Seed: serviços criados — Corte de Cabelo, Hidratação (addon).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
