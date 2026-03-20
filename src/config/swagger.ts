import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Trinity Scheduler Core API',
      version: '1.0.0',
      description: 'API backend do Trinity Scheduler — serve o painel do cliente e o painel administrativo',
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
      { name: 'Client Shop', description: 'Informações públicas do estabelecimento' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
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
            unitId: { type: 'string', format: 'uuid', nullable: true },
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
            status: { type: 'string', enum: ['confirmed', 'cancelled', 'completed', 'noshow'] },
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
            status: { type: 'string', enum: ['confirmed', 'cancelled', 'completed', 'noshow'] },
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
              },
            },
            professional: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string' },
                avatar: { type: 'string' },
                specialties: { type: 'array', items: { type: 'string' } },
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
