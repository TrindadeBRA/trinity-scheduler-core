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
  let professionalIds: string[] = [];

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
      const profs = await prisma.professional.findMany({ where: { shopId }, select: { id: true } });
      professionalIds = profs.map(p => p.id);
    } else {
      unitId = '';
      professionalIds = [];
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

    const professionalsData = [
      { name: 'Carlos Silva', phone: '11987654321', specialties: ['Corte', 'Barba'] },
      { name: 'Ana Oliveira', phone: '11987654322', specialties: ['Corte', 'Coloração'] },
      { name: 'Rafael Costa', phone: '11987654323', specialties: ['Barba', 'Pigmentação'] },
    ];

    const emailDomain = ADMIN_EMAIL.split('@')[1]; // ex: thetrinityweb.com.br

    for (const prof of professionalsData) {
      const firstName = prof.name.split(' ')[0].toLowerCase(); // carlos, ana, rafael
      const profEmail = `${firstName}@${emailDomain}`;

      const professional = await prisma.professional.create({
        data: {
          shopId,
          unitId,
          name: prof.name,
          phone: prof.phone,
          email: profEmail,
          specialties: prof.specialties,
          active: true,
        },
      });
      professionalIds.push(professional.id);

      // Cria credenciais de login (User) para o profissional
      await prisma.user.create({
        data: {
          shopId,
          name: prof.name,
          email: profEmail,
          passwordHash,
          role: 'professional',
          professionalId: professional.id,
        },
      });

      console.log(`Seed: profissional criado — ${professional.name} (login: ${profEmail})`);
    }
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

  // ─── Disponibilidade dos profissionais ────────────────────────────────────
  // Mesmos dias da shop, com horário de almoço nos dias úteis
  if (professionalIds.length > 0) {
    for (const profId of professionalIds) {
      const oldWorkingHours = await prisma.workingHour.findMany({ where: { professionalId: profId } });
      const hasOldEnglishWorkingDays = oldWorkingHours.some((h) => !ALL_DAYS_PT.includes(h.day));
      if (hasOldEnglishWorkingDays) {
        await prisma.workingHour.deleteMany({ where: { professionalId: profId } });
      }

      for (const day of WEEKDAYS_PT) {
        await prisma.workingHour.upsert({
          where:  { professionalId_day: { professionalId: profId, day } },
          update: {
            start:      '09:00',
            end:        day === 'Sábado' ? '14:00' : '18:00',
            lunchStart: day === 'Sábado' ? null : '12:00',
            lunchEnd:   day === 'Sábado' ? null : '13:00',
          },
          create: {
            professionalId: profId,
            day,
            start:      '09:00',
            end:        day === 'Sábado' ? '14:00' : '18:00',
            lunchStart: day === 'Sábado' ? null : '12:00',
            lunchEnd:   day === 'Sábado' ? null : '13:00',
          },
        });
      }
    }

    console.log('Seed: disponibilidade dos profissionais — seg–sex 09:00–18:00 (almoço 12–13), sáb 09:00–14:00.');
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

  // ─── Dados de faturamento (últimos 3 meses) ──────────────────────────────
  if (professionalIds.length > 0 && shopId) {
    const DAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const WORK_DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const TIME_SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    startDate.setDate(1);

    const existingAppointments = await prisma.appointment.findFirst({ where: { shopId } });

    if (!existingAppointments) {
      const clientIds = (await prisma.client.findMany({ where: { shopId }, select: { id: true } })).map((c) => c.id);
      if (clientIds.length === 0) {
        console.log('Seed: sem clientes cadastrados, pulando agendamentos de faturamento.');
      } else {
        const allServices = await prisma.service.findMany({ where: { shopId, type: 'service' }, select: { id: true, name: true, price: true, duration: true } });
        if (allServices.length === 0) {
          console.log('Seed: sem serviços cadastrados, pulando agendamentos de faturamento.');
        } else {
          const appointments: Array<{
            shopId: string;
            clientId: string;
            serviceId: string;
            professionalId: string;
            unitId: string;
            date: string;
            time: string;
            duration: number;
            price: number;
            status: string;
            cancelReason: string | null;
            notes: string;
          }> = [];

          // Agendamentos futuros (semana atual) — status 'confirmed' para aparecer na agenda
          const futureEnd = new Date();
          futureEnd.setDate(futureEnd.getDate() + 7);
          const currentFuture = new Date();

          while (currentFuture <= futureEnd) {
            const dayName = DAYS_PT[currentFuture.getDay()];
            if (WORK_DAYS.includes(dayName)) {
              const slotsPerDay = dayName === 'Sábado' ? 2 + Math.floor(Math.random() * 2) : 3 + Math.floor(Math.random() * 3);
              const shuffledSlots = [...TIME_SLOTS].sort(() => Math.random() - 0.5);
              const pickedSlots = shuffledSlots.slice(0, Math.min(slotsPerDay, shuffledSlots.length));

              for (const slot of pickedSlots) {
                if (dayName !== 'Sábado' && slot >= '12:00' && slot < '13:00') continue;

                const svc = allServices[Math.floor(Math.random() * allServices.length)];
                const clientId = clientIds[Math.floor(Math.random() * clientIds.length)];
                const profId = professionalIds[Math.floor(Math.random() * professionalIds.length)];

                appointments.push({
                  shopId,
                  clientId,
                  serviceId: svc.id,
                  professionalId: profId,
                  unitId,
                  date: currentFuture.toISOString().slice(0, 10),
                  time: slot,
                  duration: svc.duration,
                  price: svc.price,
                  status: 'confirmed',
                  cancelReason: null,
                  notes: '',
                });
              }
            }
            currentFuture.setDate(currentFuture.getDate() + 1);
          }

          // Agendamentos passados (últimos 3 meses) — status completed/cancelled
          const current = new Date(startDate);
          const today = new Date();

          while (current <= today) {
            const dayName = DAYS_PT[current.getDay()];
            if (WORK_DAYS.includes(dayName)) {
              const slotsPerDay = dayName === 'Sábado' ? 3 + Math.floor(Math.random() * 3) : 5 + Math.floor(Math.random() * 4);
              const shuffledSlots = [...TIME_SLOTS].sort(() => Math.random() - 0.5);
              const pickedSlots = shuffledSlots.slice(0, Math.min(slotsPerDay, shuffledSlots.length));

              for (const slot of pickedSlots) {
                if (dayName !== 'Sábado' && slot >= '12:00' && slot < '13:00') continue;

                const svc = allServices[Math.floor(Math.random() * allServices.length)];
                const clientId = clientIds[Math.floor(Math.random() * clientIds.length)];
                const profId = professionalIds[Math.floor(Math.random() * professionalIds.length)];

                const rand = Math.random();
                let status: string;
                let cancelReason: string | null = null;

                // Se é hoje e o horário ainda não passou, não pode ser completed
                const isToday = current.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
                const currentTime = today.toTimeString().slice(0, 5);
                const isFutureSlot = isToday && slot >= currentTime;

                if (isFutureSlot) {
                  status = 'confirmed';
                } else if (rand < 0.12) {
                  status = 'cancelled';
                  const reasons = [
                    'Cliente desistiu',
                    'Imprevisto pessoal',
                    'Mudança de horário',
                    'Problema de transporte',
                    'Motivos de saúde',
                  ];
                  cancelReason = reasons[Math.floor(Math.random() * reasons.length)];
                } else if (rand < 0.15) {
                  status = 'cancelled';
                  cancelReason = 'Não compareceu';
                } else {
                  status = 'completed';
                }

                appointments.push({
                  shopId,
                  clientId,
                  serviceId: svc.id,
                  professionalId: profId,
                  unitId,
                  date: current.toISOString().slice(0, 10),
                  time: slot,
                  duration: svc.duration,
                  price: svc.price,
                  status,
                  cancelReason,
                  notes: status === 'completed' ? '' : '',
                });
              }
            }
            current.setDate(current.getDate() + 1);
          }

          await prisma.appointment.createMany({ data: appointments });

          // ─── Adicionais aleatórios em ~30% dos agendamentos ─────────────
          const addonServices = await prisma.service.findMany({
            where: { shopId, type: 'addon' },
            select: { id: true, name: true, price: true, duration: true },
          });

          if (addonServices.length > 0) {
            const createdAppointments = await prisma.appointment.findMany({
              where: { shopId },
              select: { id: true },
            });

            const addonRecords: Array<{
              appointmentId: string;
              serviceId: string;
              name: string;
              duration: number;
              price: number;
            }> = [];

            for (const appt of createdAppointments) {
              const rand = Math.random();
              if (rand < 0.15) {
                // ~15% com 2 adicionais
                const shuffled = [...addonServices].sort(() => Math.random() - 0.5);
                const picked = shuffled.slice(0, Math.min(2, shuffled.length));
                for (const addon of picked) {
                  addonRecords.push({
                    appointmentId: appt.id,
                    serviceId: addon.id,
                    name: addon.name,
                    duration: addon.duration,
                    price: addon.price,
                  });
                }
              } else if (rand < 0.35) {
                // ~20% com 1 adicional
                const addon = addonServices[Math.floor(Math.random() * addonServices.length)];
                addonRecords.push({
                  appointmentId: appt.id,
                  serviceId: addon.id,
                  name: addon.name,
                  duration: addon.duration,
                  price: addon.price,
                });
              }
              // ~65% sem adicional
            }

            if (addonRecords.length > 0) {
              await prisma.appointmentAddon.createMany({ data: addonRecords });
              console.log(`Seed: ${addonRecords.length} adicionais vinculados a agendamentos.`);
            }
          }

          const confirmedCount = appointments.filter((a) => a.status === 'confirmed').length;
          const completedCount = appointments.filter((a) => a.status === 'completed').length;
          const cancelledCount = appointments.filter((a) => a.status === 'cancelled').length;
          console.log(`Seed: ${appointments.length} agendamentos criados (${confirmedCount} confirmados, ${completedCount} concluídos, ${cancelledCount} cancelados).`);

          // ─── Atualizar totalSpent e lastVisit dos clientes ──────────────
          const completedAppointments = await prisma.appointment.findMany({
            where: { shopId, status: 'completed' },
            include: { addons: true },
          });

          const clientTotals = new Map<string, { spent: number; lastDate: string }>();
          for (const appt of completedAppointments) {
            const addonTotal = appt.addons.reduce((sum, a) => sum + a.price, 0);
            const total = appt.price + addonTotal;
            const prev = clientTotals.get(appt.clientId);
            if (!prev) {
              clientTotals.set(appt.clientId, { spent: total, lastDate: appt.date });
            } else {
              prev.spent += total;
              if (appt.date > prev.lastDate) prev.lastDate = appt.date;
            }
          }

          for (const [clientId, { spent, lastDate }] of clientTotals) {
            await prisma.client.update({
              where: { id: clientId },
              data: { totalSpent: spent, lastVisit: new Date(lastDate + 'T12:00:00Z') },
            });
          }

          console.log(`Seed: totalSpent e lastVisit atualizados para ${clientTotals.size} clientes.`);
        }
      }
    } else {
      console.log('Seed: agendamentos de faturamento já existem. Pulando.');
    }
  }

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
