import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

// ─── Referências de teste ────────────────────────────────────────────────────

const REFERRALS = [
  { code: 'tw%',  name: 'TW Percentual', email: 'tw-percent@trindadebra.com', commissionType: 'percentage', commissionValue: 10  },
  { code: 'twr$', name: 'TW Reais',      email: 'tw-reais@trindadebra.com',   commissionType: 'fixed',      commissionValue: 500 },
] as const;

// ─── Leaders de teste ────────────────────────────────────────────────────────

interface LeaderDef {
  name: string;
  email: string;
  shopName: string;
  slug: string;
  planId: 'FREE' | 'PREMIUM' | 'PRO';
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'CONFIRMED' | 'INACTIVE';
  refCode?: 'tw%' | 'twr$';
}

const LEADERS: LeaderDef[] = [
  // FREE — trial ativo
  {
    name: 'Beto Freitas',     email: 'beto@devtest.com',    shopName: 'Barbearia Beto',    slug: 'barbearia-beto',
    planId: 'FREE', subscriptionStatus: 'TRIAL',
  },
  // FREE — sem referência, trial expirado
  {
    name: 'Sônia Lima',       email: 'sonia@devtest.com',   shopName: 'Studio Sônia',      slug: 'studio-sonia',
    planId: 'FREE', subscriptionStatus: 'INACTIVE',
  },
  // PREMIUM — ativo com ref TW%
  {
    name: 'Marcos Andrade',   email: 'marcos@devtest.com',  shopName: 'Corte Perfeito',    slug: 'corte-perfeito',
    planId: 'PREMIUM', subscriptionStatus: 'ACTIVE', refCode: 'tw%',
  },
  // PREMIUM — confirmado com ref TW%
  {
    name: 'Fernanda Prado',   email: 'fernanda@devtest.com',shopName: 'Beleza F',          slug: 'beleza-f',
    planId: 'PREMIUM', subscriptionStatus: 'CONFIRMED', refCode: 'tw%',
  },
  // PRO — ativo com ref TWR$
  {
    name: 'Rodrigo Neto',     email: 'rodrigo@devtest.com', shopName: 'Navalha Pro',       slug: 'navalha-pro',
    planId: 'PRO', subscriptionStatus: 'ACTIVE', refCode: 'twr$',
  },
  // PRO — ativo sem referência
  {
    name: 'Carla Mendonça',   email: 'carla@devtest.com',   shopName: 'Studio Carla',      slug: 'studio-carla',
    planId: 'PRO', subscriptionStatus: 'CONFIRMED',
  },
];

// ─── Função principal ────────────────────────────────────────────────────────

export async function seedDev(prisma: PrismaClient): Promise<void> {
  console.log('Seed DEV: iniciando...');

  const passwordHash = await bcrypt.hash('Senha@123', 10);

  // Referências
  const referralMap = new Map<string, string>(); // code → id
  for (const ref of REFERRALS) {
    const upserted = await prisma.referral.upsert({
      where: { code: ref.code },
      update: { name: ref.name, email: ref.email, commissionType: ref.commissionType, commissionValue: ref.commissionValue },
      create: { code: ref.code, name: ref.name, email: ref.email, commissionType: ref.commissionType, commissionValue: ref.commissionValue },
    });
    referralMap.set(ref.code, upserted.id);
    console.log(`Seed DEV: referência OK — ${ref.code.toUpperCase()}`);
  }

  // Leaders
  for (const def of LEADERS) {
    const existingUser = await prisma.user.findUnique({ where: { email: def.email } });
    if (existingUser) {
      console.log(`Seed DEV: líder já existe — ${def.email}`);
      continue;
    }

    const referralId = def.refCode ? referralMap.get(def.refCode) : undefined;

    const shop = await prisma.shop.create({
      data: {
        name: def.shopName,
        email: def.email,
        phone: null,
        address: null,
        niche: 'barbearia',
      },
    });

    await prisma.unit.create({
      data: {
        shopId: shop.id,
        name: def.shopName,
        slug: def.slug,
        phone: null,
      },
    });

    // Horários padrão
    const defaultDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    for (const day of defaultDays) {
      await prisma.shopHour.create({ data: { shopId: shop.id, day, start: '09:00', end: '18:00' } });
    }
    await prisma.shopHour.create({ data: { shopId: shop.id, day: 'Domingo', start: null, end: null } });

    const user = await prisma.user.create({
      data: {
        shopId: shop.id,
        name: def.name,
        email: def.email,
        passwordHash,
        role: 'leader',
        ...(referralId ? { referralId } : {}),
      },
    });

    await prisma.userPlan.create({
      data: {
        userId: user.id,
        planId: def.planId,
        subscriptionStatus: def.subscriptionStatus,
      },
    });

    console.log(`Seed DEV: líder criado — ${def.name} (${def.planId} / ${def.subscriptionStatus}${def.refCode ? ` / ref: ${def.refCode.toUpperCase()}` : ''})`);
  }

  console.log('Seed DEV: concluído.');
}
