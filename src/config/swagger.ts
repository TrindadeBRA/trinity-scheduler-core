import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Trinity Scheduler Core API',
      version: '1.0.0',
      description: `API backend do Trinity Scheduler — serve o painel do cliente e o painel administrativo

## Role-Based Access Control (RBAC)

O sistema implementa controle de acesso baseado em roles (papéis) para usuários administrativos:

### Roles Disponíveis

- **admin**: Acesso completo a todas as funcionalidades do sistema
- **leader**: Gerenciamento completo do estabelecimento (equipe, agendamentos, relatórios)
- **professional**: Acesso restrito aos próprios dados (agendamentos, receita, perfil)

### Comportamento por Role

#### Admin
- Acesso irrestrito a todos os endpoints administrativos
- Visualização de dados de todos os estabelecimentos (cross-tenant)
- Todas as operações CRUD permitidas

#### Leader
- Acesso completo aos dados do estabelecimento
- Visualização de todos os profissionais, clientes e agendamentos
- Criação e gerenciamento de profissionais (incluindo credenciais)
- Todas as operações CRUD dentro do estabelecimento

#### Professional
- Acesso restrito aos próprios dados
- Dashboard: apenas estatísticas pessoais
- Revenue: apenas faturamento pessoal
- Professionals: apenas visualização e edição do próprio perfil
- Agendamentos: apenas os próprios agendamentos
- Sem permissão para criar/excluir profissionais ou acessar dados de outros profissionais

### Filtragem Automática de Dados

Para usuários com role **professional**, o sistema aplica automaticamente filtros de dados:
- Todos os endpoints de dashboard, revenue e appointments filtram por \`professionalId\`
- O filtro é aplicado no nível de query do banco de dados (Prisma)
- Impossível acessar dados de outros profissionais, mesmo manipulando parâmetros

### Autenticação

- JWT token contém: \`userId\`, \`shopId\`, \`role\`, \`professionalId\` (quando aplicável)
- Token incluído no header: \`Authorization: Bearer <token>\`
- Expiração: 7 dias

### Respostas de Erro

- **401 UNAUTHORIZED**: Token ausente, inválido ou expirado
- **403 FORBIDDEN**: Role sem permissão para o recurso solicitado
- Tentativas de acesso negado são registradas em logs estruturados para auditoria`,
    },
    servers: [{ url: '/', description: 'API Server' }],
    tags: [
      { name: 'Client Auth', description: 'Autenticação do cliente (telefone + UUID)' },
      { name: 'Client Services', description: 'Serviços disponíveis (público)' },
      { name: 'Client Addons', description: 'Adicionais disponíveis (público)' },
      { name: 'Client Professionals', description: 'Profissionais disponíveis (público)' },
      { name: 'Client Availability', description: 'Disponibilidade de horários (público)' },
      { name: 'Client Appointments', description: 'Agendamentos do cliente' },
      { name: 'Admin Auth', description: 'Autenticação admin (login, registro, forgot-password)' },
      { name: 'Admin Shop', description: 'Gestão do estabelecimento' },
      { name: 'Admin Appointments', description: 'Gestão de agendamentos (admin panel)' },
      { name: 'Admin Clients', description: 'Gestão de clientes' },
      { name: 'Admin Services', description: 'Gestão de serviços e adicionais' },
      { name: 'Admin Professionals', description: 'Gestão de profissionais' },
      { name: 'Admin Units', description: 'Gestão de unidades' },
      { name: 'Admin Dashboard', description: 'Métricas e relatórios' },
      { name: 'Admin Upload', description: 'Upload de imagens (presigned URL)' },
      { name: 'Admin Revenue', description: 'Faturamento e relatórios financeiros' },
      { name: 'Client Shop', description: 'Informações públicas do estabelecimento' },
      { name: 'Client Units', description: 'Resolução de slug para shopId/unitId' },
      { name: 'Public', description: 'Endpoints públicos sem autenticação' },
      { name: 'Admin - System', description: 'Utilitários do sistema (apenas admin)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: `JWT token contendo informações do usuário autenticado.

**Payload do Token:**
\`\`\`json
{
  "id": "user-uuid",
  "shopId": "shop-uuid",
  "role": "admin | leader | professional",
  "professionalId": "professional-uuid (apenas para role=professional)"
}
\`\`\`

**Roles e Permissões:**
- \`admin\`: Acesso completo a todos os recursos
- \`leader\`: Acesso completo ao estabelecimento
- \`professional\`: Acesso restrito aos próprios dados

**Nota:** Endpoints protegidos verificam automaticamente a role do usuário e aplicam filtros de dados quando necessário.`,
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'VALIDATION_ERROR' },
            message: { type: 'string', example: 'Campo phone é obrigatório' },
          },
          required: ['error', 'message'],
        },
        Shop: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            phone: { type: 'string', nullable: true },
            email: { type: 'string', nullable: true },
            address: { type: 'string', nullable: true },
            niche: { type: 'string', enum: ['barbearia', 'salao-beleza'], example: 'barbearia' },
            bookingBuffer: { type: 'integer', description: 'Minutos de antecedência mínima para agendamento', example: 0 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ShopHour: {
          type: 'object',
          properties: {
            day: { type: 'string', example: 'Segunda' },
            start: { type: 'string', nullable: true, example: '09:00' },
            end: { type: 'string', nullable: true, example: '19:00' },
          },
        },
        Client: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            shopId: { type: 'string', format: 'uuid' },
            name: { type: 'string', nullable: true },
            phone: { type: 'string' },
            email: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            birthday: { type: 'string', nullable: true },
            totalSpent: { type: 'integer', description: 'Total gasto em centavos' },
            lastVisit: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ClientInput: {
          type: 'object',
          required: ['phone'],
          properties: {
            name: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            notes: { type: 'string' },
            birthday: { type: 'string' },
          },
        },
        Service: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            shopId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            duration: { type: 'integer', description: 'Duração em minutos' },
            price: { type: 'integer', description: 'Preço em centavos' },
            description: { type: 'string', nullable: true },
            icon: { type: 'string', nullable: true },
            image: { type: 'string', nullable: true },
            type: { type: 'string', enum: ['service', 'addon'] },
            active: { type: 'boolean' },
          },
        },
        ServiceInput: {
          type: 'object',
          required: ['name', 'duration', 'price', 'type'],
          properties: {
            name: { type: 'string' },
            duration: { type: 'integer' },
            price: { type: 'integer', description: 'Preço em centavos' },
            description: { type: 'string' },
            icon: { type: 'string' },
            image: { type: 'string' },
            type: { type: 'string', enum: ['service', 'addon'] },
            active: { type: 'boolean' },
          },
        },
        WorkingHour: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            day: { type: 'string' },
            start: { type: 'string', nullable: true },
            end: { type: 'string', nullable: true },
            lunchStart: { type: 'string', nullable: true },
            lunchEnd: { type: 'string', nullable: true },
          },
        },
        Professional: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            shopId: { type: 'string', format: 'uuid' },
            unitId: { type: 'string', format: 'uuid', nullable: true, description: 'Unidade principal (legado)' },
            unitIds: { type: 'array', items: { type: 'string', format: 'uuid' }, description: 'IDs de todas as unidades alocadas' },
            name: { type: 'string' },
            avatar: { type: 'string', nullable: true },
            specialties: { type: 'array', items: { type: 'string' } },
            phone: { type: 'string', nullable: true },
            email: { type: 'string', nullable: true },
            active: { type: 'boolean' },
            workingHours: { type: 'array', items: { $ref: '#/components/schemas/WorkingHour' } },
          },
        },
        ProfessionalInput: {
          type: 'object',
          required: ['name'],
          properties: {
            unitId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            avatar: { type: 'string' },
            specialties: { type: 'array', items: { type: 'string' } },
            phone: { type: 'string' },
            email: { type: 'string' },
            active: { type: 'boolean' },
            workingHours: { type: 'array', items: { $ref: '#/components/schemas/WorkingHour' } },
            credentials: {
              type: 'object',
              description: 'Credenciais de acesso ao painel admin (opcional)',
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string' },
              },
            },
          },
        },
        Appointment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            shopId: { type: 'string', format: 'uuid' },
            unitId: { type: 'string', format: 'uuid', nullable: true, description: 'ID da unidade (opcional)' },
            clientId: { type: 'string', format: 'uuid' },
            serviceId: { type: 'string', format: 'uuid' },
            serviceName: { type: 'string' },
            professionalId: { type: 'string', format: 'uuid' },
            professionalName: { type: 'string' },
            date: { type: 'string', example: '2024-12-25' },
            time: { type: 'string', example: '09:00' },
            duration: { type: 'integer', description: 'Duração em minutos' },
            price: { type: 'integer', description: 'Preço em centavos' },
            status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'] },
            cancelReason: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AppointmentInput: {
          type: 'object',
          required: ['clientId', 'serviceId', 'date', 'time'],
          properties: {
            clientId: { type: 'string', format: 'uuid' },
            serviceId: { type: 'string', format: 'uuid' },
            professionalId: { type: 'string', format: 'uuid', nullable: true },
            addonIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
            date: { type: 'string', example: '2024-12-25' },
            time: { type: 'string', example: '09:00' },
            notes: { type: 'string' },
            unitId: { type: 'string', format: 'uuid', nullable: true, description: 'ID da unidade (opcional)' },
          },
        },
        Unit: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            shopId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            slug: { type: 'string', description: 'Identificador único para URL de agendamento', example: 'barbearia-centro' },
            address: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
          },
        },
        UnitInput: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            address: { type: 'string' },
            phone: { type: 'string' },
          },
        },
        Slot: {
          type: 'object',
          properties: {
            time: { type: 'string', example: '09:00' },
            available: { type: 'boolean' },
          },
        },
        DashboardStats: {
          type: 'object',
          properties: {
            revenue: { type: 'integer', description: 'Faturamento em centavos' },
            appointmentCount: { type: 'integer' },
            topService: { type: 'string', nullable: true },
            newClients: { type: 'integer' },
          },
        },
        WeeklyRevenue: {
          type: 'object',
          properties: {
            date: { type: 'string', example: '2024-12-25' },
            revenue: { type: 'integer', description: 'Faturamento em centavos' },
          },
        },
        AppointmentUpdateInput: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'] },
            notes: { type: 'string' },
            cancelReason: { type: 'string' },
            date: { type: 'string', example: '2024-12-25' },
            time: { type: 'string', example: '09:00' },
            professionalId: { type: 'string', format: 'uuid' },
          },
        },
        UploadPresignRequest: {
          type: 'object',
          required: ['contentType', 'folder'],
          properties: {
            contentType: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'], example: 'image/webp' },
            folder: { type: 'string', enum: ['services', 'professionals', 'shop'] },
          },
        },
        UploadPresignResponse: {
          type: 'object',
          properties: {
            uploadUrl: { type: 'string', description: 'URL pré-assinada para PUT do arquivo' },
            publicUrl: { type: 'string', description: 'URL pública da imagem após upload' },
            key: { type: 'string', description: 'Chave do objeto no storage' },
          },
        },
        RevenueSummary: {
          type: 'object',
          description: 'Resumo de faturamento. Valores monetários em centavos.',
          properties: {
            totalRevenue:     { type: 'integer', description: 'Receita total em centavos (status=completed)' },
            averageTicket:    { type: 'integer', description: 'Ticket médio em centavos' },
            completedCount:   { type: 'integer', description: 'Número de agendamentos concluídos' },
            lostRevenue:      { type: 'integer', description: 'Receita perdida em centavos (status=cancelled)' },
            dailyRevenue:     { type: 'array', items: { $ref: '#/components/schemas/DailyRevenueEntry' } },
            serviceBreakdown: { type: 'array', items: { $ref: '#/components/schemas/ServiceRevenueEntry' } },
            staffRanking:     { type: 'array', items: { $ref: '#/components/schemas/StaffRankingEntry' } },
          },
        },
        DailyRevenueEntry: {
          type: 'object',
          properties: {
            date:  { type: 'string', example: '2024-06-15', description: 'Data no formato yyyy-MM-dd' },
            label: { type: 'string', example: '15/06', description: 'Rótulo formatado dd/MM' },
            total: { type: 'integer', description: 'Faturamento do dia em centavos' },
          },
        },
        ServiceRevenueEntry: {
          type: 'object',
          properties: {
            serviceName: { type: 'string', description: 'Nome do serviço' },
            total:       { type: 'integer', description: 'Faturamento do serviço em centavos' },
            percentage:  { type: 'number', format: 'float', description: 'Percentual sobre totalRevenue (0-100)' },
          },
        },
        StaffRankingEntry: {
          type: 'object',
          properties: {
            staffId:   { type: 'string', format: 'uuid' },
            staffName: { type: 'string' },
            total:     { type: 'integer', description: 'Faturamento do profissional em centavos' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['phone'],
          properties: {
            phone: { type: 'string', example: '11999999999' },
          },
        },
        AdminLoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        AdminLoginResponse: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string' },
                avatar: { type: 'string', nullable: true },
                role: { type: 'string', enum: ['admin', 'leader', 'professional'] },
              },
            },
            token: { type: 'string' },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['owner', 'shop', 'professional'],
          properties: {
            owner: {
              type: 'object',
              required: ['name', 'email', 'password'],
              properties: {
                name: { type: 'string' },
                email: { type: 'string', format: 'email' },
                phone: { type: 'string' },
                password: { type: 'string' },
              },
            },
            shop: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string' },
                phone: { type: 'string' },
                email: { type: 'string' },
                address: { type: 'string' },
                niche: { type: 'string', enum: ['barbearia', 'salao-beleza'], default: 'barbearia' },
                slug: { type: 'string', description: 'Slug da primeira unidade (gerado automaticamente se omitido)', example: 'barbearia-centro' },
              },
            },
            professional: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string' },
                avatar: { type: 'string' },
                specialties: { type: 'array', items: { type: 'string' } },
                isOwner: { type: 'boolean', description: 'Se true, usa os dados do owner como profissional' },
              },
            },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Token JWT ausente, inválido ou expirado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        Forbidden: {
          description: 'Role sem permissão para este endpoint',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        NotFound: {
          description: 'Recurso não encontrado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
