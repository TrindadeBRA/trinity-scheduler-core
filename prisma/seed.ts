import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    ?? '';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? '';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Seed: SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD são obrigatórios.');
  process.exit(1);
}

// Nomes dos dias em português — devem bater com availability.service.ts
const WEEKDAYS_PT = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const ALL_DAYS_PT = [...WEEKDAYS_PT, 'Domingo'];

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

  // ─── Admin / Shop / Unit / Professional (idempotente) ─────────────────────
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

  let shopId: string;
  let unitId: string;
  let professionalId: string;

  if (existing) {
    console.log('Seed: admin já existe. Reutilizando dados existentes.');

    const existingShop = await prisma.shop.findFirst({
      where: { users: { some: { email: ADMIN_EMAIL } } },
      select: { id: true },
    });
    shopId = existingShop?.id ?? '';

    if (shopId) {
      const u = await prisma.unit.findFirst({ where: { shopId }, select: { id: true } });
      unitId = u?.id ?? '';
      const p = await prisma.professional.findFirst({ where: { shopId }, select: { id: true } });
      professionalId = p?.id ?? '';
    } else {
      unitId = '';
      professionalId = '';
    }
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const shop = await prisma.shop.create({
      data: {
        name:    'Trinity Web',
        email:   ADMIN_EMAIL,
        phone:   '11952498126',
        address: 'Rua Professora Anisabel de Campos Costa, 130 - Aterrado, Mogi Mirim - SP, CEP 13801-360',
      },
    });
    shopId = shop.id;

    await prisma.user.create({
      data: {
        shopId,
        name:         'Lucas Trindade',
        email:        ADMIN_EMAIL,
        passwordHash,
        role:         'admin',
      },
    });

    await prisma.userPlan.create({
      data: {
        userId:             await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } }).then((u) => u.id),
        planId:             'ADMIN',
        subscriptionStatus: 'ACTIVE',
      },
    });

    console.log(`Seed: admin criado — ${ADMIN_EMAIL}`);

    const unit = await prisma.unit.create({
      data: {
        shopId,
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
    unitId = unit.id;

    console.log(`Seed: unidade criada — ${unit.name}`);

    const professional = await prisma.professional.create({
      data: {
        shopId,
        unitId,
        name:        'Carlos Silva',
        phone:       '11987654321',
        email:       'carlos@exemplo.com',
        specialties: ['Corte', 'Barba'],
        active:      true,
      },
    });
    professionalId = professional.id;

    console.log(`Seed: profissional criado — ${professional.name}`);
  }

  // Se não encontrou dados existentes, não há nada para popular
  if (!shopId) {
    console.log('Seed: shop não encontrado, pulando configuração de horários e serviços.');
    return;
  }

  // ─── Horário de funcionamento da shop ─────────────────────────────────────
  // Seg–Sex 09:00–18:00, Sáb 09:00–14:00, Dom fechado
  const existingShopHours = await prisma.shopHour.findMany({ where: { shopId } });
  const hasEnglishDays = existingShopHours.some((h) =>
    !ALL_DAYS_PT.includes(h.day)
    && ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(h.day)
  );
  if (hasEnglishDays) {
    await prisma.shopHour.deleteMany({ where: { shopId } });
  }

  const shopHourSchedule: Record<string, { start: string | null; end: string | null }> = {
    'Segunda': { start: '09:00', end: '18:00' },
    'Terça':   { start: '09:00', end: '18:00' },
    'Quarta':  { start: '09:00', end: '18:00' },
    'Quinta':  { start: '09:00', end: '18:00' },
    'Sexta':   { start: '09:00', end: '18:00' },
    'Sábado':  { start: '09:00', end: '14:00' },
    'Domingo': { start: null,      end: null      },
  };

  for (const day of ALL_DAYS_PT) {
    const hours = shopHourSchedule[day];
    await prisma.shopHour.upsert({
      where:  { shopId_day: { shopId, day } },
      update: { start: hours.start, end: hours.end },
      create: { shopId, day, start: hours.start, end: hours.end },
    });
  }

  console.log('Seed: horários da shop — seg–sex 09:00–18:00, sáb 09:00–14:00, dom fechado.');

  // ─── Disponibilidade do profissional ──────────────────────────────────────
  // Mesmos dias da shop, com horário de almoço nos dias úteis
  if (professionalId) {
    const oldWorkingHours = await prisma.workingHour.findMany({ where: { professionalId } });
    const hasOldEnglishWorkingDays = oldWorkingHours.some((h) => !ALL_DAYS_PT.includes(h.day));
    if (hasOldEnglishWorkingDays) {
      await prisma.workingHour.deleteMany({ where: { professionalId } });
    }

    for (const day of WEEKDAYS_PT) {
      await prisma.workingHour.upsert({
        where:  { professionalId_day: { professionalId, day } },
        update: {
          start:      '09:00',
          end:        day === 'Sábado' ? '14:00' : '18:00',
          lunchStart: day === 'Sábado' ? null : '12:00',
          lunchEnd:   day === 'Sábado' ? null : '13:00',
        },
        create: {
          professionalId,
          day,
          start:      '09:00',
          end:        day === 'Sábado' ? '14:00' : '18:00',
          lunchStart: day === 'Sábado' ? null : '12:00',
          lunchEnd:   day === 'Sábado' ? null : '13:00',
        },
      });
    }

    console.log('Seed: disponibilidade do profissional — seg–sex 09:00–18:00 (almoço 12–13), sáb 09:00–14:00.');
  }

  // ─── Serviços ─────────────────────────────────────────────────────────────
  const services = [
    {
      name:        'Corte de Cabelo',
      duration:    30,
      price:       3500,
      description: 'Corte masculino com acabamento',
      type:        'service',
    },
    {
      name:        'Barba',
      duration:    20,
      price:       2500,
      description: 'Barba com navalha e acabamento',
      type:        'service',
    },
    {
      name:        'Corte + Barba',
      duration:    45,
      price:       5000,
      description: 'Combo corte e barba com valor especial',
      type:        'service',
    },
    {
      name:        'Hidratação',
      duration:    20,
      price:       1500,
      description: 'Hidratação capilar complementar',
      type:        'addon',
    },
    {
      name:        'Bepantol',
      duration:    10,
      price:       2000,
      description: 'Bepantol styling pós-barba',
      type:        'addon',
    },
    {
      name:        'Pigmentação',
      duration:    30,
      price:       4500,
      description: 'Pigmentação capilar',
      type:        'service',
    },
  ];

  const existingServices = await prisma.service.findMany({
    where: { shopId },
    select: { name: true },
  });
  const existingNames = new Set(existingServices.map((s) => s.name));

  const servicesToCreate = services.filter((s) => !existingNames.has(s.name));

  if (servicesToCreate.length > 0) {
    await prisma.service.createMany({
      data: servicesToCreate.map((s) => ({ shopId, ...s, active: true })),
    });
  }

  console.log(`Seed: ${servicesToCreate.length} novos serviços criados (${services.length} total).`);

  // ─── Clientes de exemplo ──────────────────────────────────────────────────
  const clients = [
    {
      name:    'João Mendes',
      phone:   '11977771111',
      email:   'joao@email.com',
      notes:   'Cliente frequente, prefere corte baixo',
    },
    {
      name:    'Maria Santos',
      phone:   '11977772222',
      email:   'maria@email.com',
      notes:   '',
    },
  ];

  for (const client of clients) {
    await prisma.client.upsert({
      where: { shopId_phone: { shopId, phone: client.phone } },
      update: {},
      create: { shopId, ...client },
    });
  }

  console.log(`Seed: ${clients.length} clientes de exemplo criados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
