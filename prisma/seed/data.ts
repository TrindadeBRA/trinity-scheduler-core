// ─── Dados estáticos do seed ────────────────────────────────────────────────

export const WEEKDAYS_PT = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const ALL_DAYS_PT = [...WEEKDAYS_PT, 'Domingo'];

export const PLANS = [
  { id: 'FREE',    name: 'Free',    price: 0,    packagePrice: 0,     unitLimit: 1,  professionalLimit: 3  },
  { id: 'PREMIUM', name: 'Premium', price: 2999, packagePrice: 3999,  unitLimit: 2,  professionalLimit: 8  },
  { id: 'PRO',     name: 'Pro',     price: 9999, packagePrice: 12999, unitLimit: 5,  professionalLimit: 30 },
  { id: 'ADMIN',   name: 'Admin',   price: 0,    packagePrice: 0,     unitLimit: -1, professionalLimit: -1 },
];

export const UNITS = [
  {
    name: 'Unidade Centro', slug: 'unidade-centro', phone: '11912345678',
    zipcode: '13801360', street: 'Rua das Flores', number: '42',
    district: 'Centro', city: 'Mogi Mirim', state: 'SP',
  },
  {
    name: 'Unidade Jardim', slug: 'unidade-jardim', phone: '11912345679',
    zipcode: '13801400', street: 'Av. Brasil', number: '310',
    district: 'Jardim Paulista', city: 'Mogi Mirim', state: 'SP',
  },
];

export interface ProfessionalDef {
  name: string;
  phone: string;
  specialties: string[];
  unitIndex: number; // índice em UNITS
  lunchStart: string;
  lunchEnd: string;
}

export const PROFESSIONALS: ProfessionalDef[] = [
  // Unidade Centro
  { name: 'Carlos Silva',   phone: '11987654321', specialties: ['Corte', 'Barba'],                 unitIndex: 0, lunchStart: '12:00', lunchEnd: '13:00' },
  { name: 'Ana Oliveira',   phone: '11987654322', specialties: ['Corte', 'Coloração'],              unitIndex: 0, lunchStart: '13:00', lunchEnd: '14:00' },
  { name: 'Rafael Costa',   phone: '11987654323', specialties: ['Barba', 'Pigmentação'],            unitIndex: 0, lunchStart: '11:30', lunchEnd: '12:30' },
  // Unidade Jardim
  { name: 'Juliana Mendes', phone: '11987654324', specialties: ['Corte', 'Hidratação'],             unitIndex: 1, lunchStart: '12:30', lunchEnd: '13:30' },
  { name: 'Pedro Almeida',  phone: '11987654325', specialties: ['Corte', 'Barba', 'Sobrancelha'],   unitIndex: 1, lunchStart: '11:00', lunchEnd: '12:00' },
];

export const SERVICES = [
  { name: 'Corte de Cabelo', duration: 30, price: 3500, description: 'Corte masculino com acabamento',       type: 'service' },
  { name: 'Barba',           duration: 20, price: 2500, description: 'Barba com navalha e acabamento',       type: 'service' },
  { name: 'Corte + Barba',   duration: 45, price: 5000, description: 'Combo corte e barba com valor especial', type: 'service' },
  { name: 'Hidratação',      duration: 20, price: 1500, description: 'Hidratação capilar complementar',      type: 'addon'   },
  { name: 'Bepantol',        duration: 10, price: 2000, description: 'Bepantol styling pós-barba',           type: 'addon'   },
  { name: 'Pigmentação',     duration: 30, price: 4500, description: 'Pigmentação capilar',                  type: 'service' },
];

export const CLIENTS = [
  { name: 'João Mendes',      phone: '11977771001', email: 'joao.mendes@email.com',     notes: 'Cliente frequente, prefere corte baixo' },
  { name: 'Maria Santos',     phone: '11977771002', email: 'maria.santos@email.com',    notes: '' },
  { name: 'Lucas Ferreira',   phone: '11977771003', email: 'lucas.ferreira@email.com',  notes: 'Alérgico a bepantol' },
  { name: 'Camila Rocha',     phone: '11977771004', email: 'camila.rocha@email.com',    notes: '' },
  { name: 'Bruno Almeida',    phone: '11977771005', email: 'bruno.almeida@email.com',   notes: 'Prefere horário de manhã' },
  { name: 'Fernanda Lima',    phone: '11977771006', email: 'fernanda.lima@email.com',   notes: '' },
  { name: 'Gustavo Pereira',  phone: '11977771007', email: 'gustavo.pereira@email.com', notes: '' },
  { name: 'Juliana Costa',    phone: '11977771008', email: 'juliana.costa@email.com',   notes: 'Sempre pede hidratação' },
  { name: 'Ricardo Souza',    phone: '11977771009', email: 'ricardo.souza@email.com',   notes: '' },
  { name: 'Patrícia Nunes',   phone: '11977771010', email: 'patricia.nunes@email.com',  notes: '' },
  { name: 'Thiago Martins',   phone: '11977771011', email: 'thiago.martins@email.com',  notes: 'Barba toda semana' },
  { name: 'Amanda Oliveira',  phone: '11977771012', email: 'amanda.oliveira@email.com', notes: '' },
  { name: 'Felipe Barbosa',   phone: '11977771013', email: 'felipe.barbosa@email.com',  notes: '' },
  { name: 'Larissa Gomes',    phone: '11977771014', email: 'larissa.gomes@email.com',   notes: 'Prefere sábado' },
  { name: 'Matheus Ribeiro',  phone: '11977771015', email: 'matheus.ribeiro@email.com', notes: '' },
  { name: 'Carolina Dias',    phone: '11977771016', email: 'carolina.dias@email.com',   notes: '' },
  { name: 'André Moreira',    phone: '11977771017', email: 'andre.moreira@email.com',   notes: 'Pigmentação mensal' },
  { name: 'Isabela Cardoso',  phone: '11977771018', email: 'isabela.cardoso@email.com', notes: '' },
  { name: 'Daniel Araújo',    phone: '11977771019', email: 'daniel.araujo@email.com',   notes: '' },
  { name: 'Vanessa Teixeira', phone: '11977771020', email: 'vanessa.teixeira@email.com', notes: '' },
  { name: 'Rodrigo Campos',   phone: '11977771021', email: 'rodrigo.campos@email.com',  notes: 'Corte + barba sempre' },
  { name: 'Bianca Monteiro',  phone: '11977771022', email: 'bianca.monteiro@email.com', notes: '' },
  { name: 'Henrique Pinto',   phone: '11977771023', email: 'henrique.pinto@email.com',  notes: '' },
  { name: 'Letícia Azevedo',  phone: '11977771024', email: 'leticia.azevedo@email.com', notes: '' },
  { name: 'Marcos Vieira',    phone: '11977771025', email: 'marcos.vieira@email.com',   notes: 'Sempre no horário do almoço' },
  { name: 'Renata Correia',   phone: '11977771026', email: 'renata.correia@email.com',  notes: '' },
  { name: 'Paulo Henrique',   phone: '11977771027', email: 'paulo.henrique@email.com',  notes: '' },
  { name: 'Tatiana Freitas',  phone: '11977771028', email: 'tatiana.freitas@email.com', notes: '' },
  { name: 'Eduardo Lopes',    phone: '11977771029', email: 'eduardo.lopes@email.com',   notes: 'Cliente VIP' },
  { name: 'Aline Nascimento', phone: '11977771030', email: 'aline.nascimento@email.com', notes: '' },
];

export const SPECIALTY_SERVICE_MAP: Record<string, string[]> = {
  'Corte':        ['Corte de Cabelo', 'Corte + Barba'],
  'Barba':        ['Barba', 'Corte + Barba'],
  'Coloração':    ['Corte de Cabelo'],
  'Hidratação':   ['Corte de Cabelo'],
  'Pigmentação':  ['Pigmentação'],
  'Sobrancelha':  ['Barba'],
};

export const SHOP_HOURS: Record<string, { start: string | null; end: string | null }> = {
  'Segunda': { start: '09:00', end: '18:00' },
  'Terça':   { start: '09:00', end: '18:00' },
  'Quarta':  { start: '09:00', end: '18:00' },
  'Quinta':  { start: '09:00', end: '18:00' },
  'Sexta':   { start: '09:00', end: '18:00' },
  'Sábado':  { start: '09:00', end: '14:00' },
  'Domingo': { start: null,    end: null     },
};
