import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  PLANS, UNITS, PROFESSIONALS, SERVICES, CLIENTS,
  SHOP_HOURS, ALL_DAYS_PT, WEEKDAYS_PT,
} from './seed/data';
import { seedAppointments } from './seed/appointments';

const prisma = new PrismaClient();

const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    ?? '';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? '';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Seed: SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD são obrigatórios.');
  process.exit(1);
}

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const emailDomain = ADMIN_EMAIL.split('@')[1];

  // ─── Planos ─────────────────────────────────────────────────────────────
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: { packagePrice: plan.packagePrice },
      create: plan,
    });
  }
  console.log('Seed: planos OK.');

  // ─── Shop ───────────────────────────────────────────────────────────────
  let shop = await prisma.shop.findFirst({
    where: { users: { some: { email: ADMIN_EMAIL } } },
  });

  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        name: 'Trinity Web', email: ADMIN_EMAIL,
        phone: '11952498126',
        address: 'Rua Professora Anisabel de Campos Costa, 130 - Aterrado, Mogi Mirim - SP',
      },
    });
    console.log('Seed: shop criada.');
  }
  const shopId = shop.id;

  // ─── Admin user ─────────────────────────────────────────────────────────
  const adminUser = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!adminUser) {
    const user = await prisma.user.create({
      data: { shopId, name: 'Lucas Trindade', email: ADMIN_EMAIL, passwordHash, role: 'admin' },
    });
    await prisma.userPlan.create({
      data: { userId: user.id, planId: 'ADMIN', subscriptionStatus: 'ACTIVE' },
    });
    console.log(`Seed: admin criado — ${ADMIN_EMAIL}`);
  }

  // ─── Unidades ───────────────────────────────────────────────────────────
  const unitIds: string[] = [];
  for (const unitDef of UNITS) {
    let unit = await prisma.unit.findUnique({ where: { slug: unitDef.slug } });
    if (!unit) {
      unit = await prisma.unit.create({ data: { shopId, ...unitDef } });
      console.log(`Seed: unidade criada — ${unit.name}`);
    }
    unitIds.push(unit.id);
  }

  // ─── Profissionais ─────────────────────────────────────────────────────
  const profIds: string[] = [];
  const profLunchMap = new Map<string, { lunchStart: string; lunchEnd: string }>();

  for (const profDef of PROFESSIONALS) {
    const firstName = profDef.name.split(' ')[0].toLowerCase();
    const profEmail = `${firstName}@${emailDomain}`;
    const profUnitId = unitIds[profDef.unitIndex];

    let prof = await prisma.professional.findFirst({ where: { shopId, email: profEmail } });
    if (!prof) {
      prof = await prisma.professional.create({
        data: {
          shopId, unitId: profUnitId, name: profDef.name,
          phone: profDef.phone, email: profEmail,
          specialties: profDef.specialties, active: true,
        },
      });

      // Cria login para o profissional
      const existingUser = await prisma.user.findUnique({ where: { email: profEmail } });
      if (!existingUser) {
        await prisma.user.create({
          data: { shopId, name: profDef.name, email: profEmail, passwordHash, role: 'professional', professionalId: prof.id },
        });
      }
      console.log(`Seed: profissional criado — ${prof.name} (${profEmail})`);
    }

    profIds.push(prof.id);
    profLunchMap.set(prof.id, { lunchStart: profDef.lunchStart, lunchEnd: profDef.lunchEnd });

    // Garante registro em ProfessionalUnit (tabela de alocação)
    const allocUnitId = unitIds[profDef.unitIndex];
    await prisma.professionalUnit.upsert({
      where: { professionalId_unitId: { professionalId: prof.id, unitId: allocUnitId } },
      update: {},
      create: { professionalId: prof.id, unitId: allocUnitId },
    });
  }

  // ─── Horários da shop ──────────────────────────────────────────────────
  for (const day of ALL_DAYS_PT) {
    const hours = SHOP_HOURS[day];
    await prisma.shopHour.upsert({
      where: { shopId_day: { shopId, day } },
      update: { start: hours.start, end: hours.end },
      create: { shopId, day, start: hours.start, end: hours.end },
    });
  }
  console.log('Seed: horários da shop OK.');

  // ─── Disponibilidade dos profissionais ─────────────────────────────────
  for (const profId of profIds) {
    const lunch = profLunchMap.get(profId);

    for (const day of WEEKDAYS_PT) {
      const isSaturday = day === 'Sábado';
      await prisma.workingHour.upsert({
        where: { professionalId_day: { professionalId: profId, day } },
        update: {
          start: '09:00', end: isSaturday ? '14:00' : '18:00',
          lunchStart: isSaturday ? null : (lunch?.lunchStart ?? '12:00'),
          lunchEnd:   isSaturday ? null : (lunch?.lunchEnd ?? '13:00'),
        },
        create: {
          professionalId: profId, day,
          start: '09:00', end: isSaturday ? '14:00' : '18:00',
          lunchStart: isSaturday ? null : (lunch?.lunchStart ?? '12:00'),
          lunchEnd:   isSaturday ? null : (lunch?.lunchEnd ?? '13:00'),
        },
      });
    }
  }
  console.log('Seed: disponibilidade dos profissionais OK.');

  // ─── Serviços ──────────────────────────────────────────────────────────
  for (const svc of SERVICES) {
    const exists = await prisma.service.findFirst({ where: { shopId, name: svc.name } });
    if (!exists) {
      await prisma.service.create({ data: { shopId, ...svc, active: true } });
    }
  }
  console.log('Seed: serviços OK.');

  // ─── Clientes ──────────────────────────────────────────────────────────
  for (const client of CLIENTS) {
    await prisma.client.upsert({
      where: { shopId_phone: { shopId, phone: client.phone } },
      update: {},
      create: { shopId, ...client },
    });
  }
  console.log(`Seed: ${CLIENTS.length} clientes OK.`);

  // ─── Agendamentos (70% de ocupação, 3 meses + 7 dias) ─────────────────
  await seedAppointments(prisma, shopId, unitIds[0]);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
