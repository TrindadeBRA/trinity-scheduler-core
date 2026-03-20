# Paginação de Endpoints

## Visão Geral

Todos os endpoints de listagem do backend agora suportam paginação padronizada. A implementação segue o padrão esperado pelo frontend conforme definido no Design Document de Table Standardization.

## Formato de Resposta

Todos os endpoints paginados retornam o seguinte formato:

```json
{
  "data": [...],      // Array com os itens da página atual
  "total": 150        // Total de registros (sem paginação)
}
```

## Parâmetros de Query

Todos os endpoints de listagem aceitam os seguintes parâmetros opcionais:

- `page` (integer, default: 1) - Número da página (1-indexed)
- `pageSize` (integer, default: 25) - Quantidade de itens por página
- `sortBy` (string) - Campo para ordenação (varia por endpoint)
- `sortOrder` (enum: "asc" | "desc", default: varia) - Direção da ordenação

## Endpoints Paginados

### Admin Endpoints

#### 1. GET /admin/professionals
**Paginação:** ✅ Implementada  
**Default pageSize:** 25  
**Campos ordenáveis:** name, email, phone, active  
**Filtros adicionais:** search, unitId

```bash
GET /admin/professionals?page=1&pageSize=25&sortBy=name&sortOrder=asc&search=João
```

#### 2. GET /admin/services
**Paginação:** ✅ Implementada  
**Default pageSize:** 25  
**Campos ordenáveis:** name, duration, price, type, active  
**Filtros adicionais:** search, type

```bash
GET /admin/services?page=1&pageSize=25&sortBy=name&sortOrder=asc&type=service
```

#### 3. GET /admin/clients
**Paginação:** ✅ Implementada  
**Default pageSize:** 20  
**Campos ordenáveis:** name, phone, email, totalSpent, lastVisit, createdAt  
**Filtros adicionais:** search

```bash
GET /admin/clients?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc&search=Maria
```

#### 4. GET /admin/appointments
**Paginação:** ✅ Implementada  
**Default pageSize:** 25  
**Campos ordenáveis:** date, time, clientName, serviceName, professionalName, status, price, duration  
**Filtros adicionais:** date, professionalId, status, serviceId, clientId, search, startDate, endDate, unitId

```bash
GET /admin/appointments?page=1&pageSize=25&sortBy=date&sortOrder=desc&status=confirmed
```

#### 5. GET /admin/units
**Paginação:** ✅ Implementada  
**Default pageSize:** 25  
**Campos ordenáveis:** name, address, phone  
**Filtros adicionais:** search

```bash
GET /admin/units?page=1&pageSize=25&sortBy=name&sortOrder=asc
```

### Client Endpoints

Os endpoints públicos (client) **não possuem paginação** pois retornam apenas dados ativos e filtrados:

- GET /professionals - Retorna todos os profissionais ativos
- GET /services - Retorna todos os serviços ativos
- GET /addons - Retorna todos os adicionais ativos

## Utilitário de Paginação

O arquivo `src/utils/pagination.ts` fornece funções auxiliares para padronizar a paginação:

### parsePagination(params)

Converte parâmetros de query string em valores de paginação validados:

```typescript
const pagination = parsePagination({ page: '2', pageSize: '50' });
// Retorna: { page: 2, pageSize: 50, skip: 50, take: 50 }
```

**Validações:**
- `page` mínimo: 1
- `pageSize` mínimo: 1, máximo: 100
- Valores inválidos são convertidos para defaults

### createPaginatedResponse(data, total, page, pageSize)

Cria a resposta paginada padronizada:

```typescript
const response = createPaginatedResponse(items, 150, 2, 25);
// Retorna: { data: items, total: 150, page: 2, pageSize: 25, totalPages: 6 }
```

## Implementação no Backend

### Exemplo de Implementação

```typescript
import { parsePagination, createPaginatedResponse } from '../../utils/pagination';

router.get('/items', async (req, res) => {
  const { page = '1', pageSize = '25', sortBy = 'name', sortOrder = 'asc' } = req.query;
  
  const pageNum = parseInt(page as string, 10);
  const perPageNum = parseInt(pageSize as string, 10);
  const skip = (pageNum - 1) * perPageNum;

  const where = { /* filtros */ };
  const orderBy = { [sortBy]: sortOrder };

  const [data, total] = await prisma.$transaction([
    prisma.item.findMany({ where, skip, take: perPageNum, orderBy }),
    prisma.item.count({ where }),
  ]);

  res.json({ data, total });
});
```

## Integração com Frontend

O frontend utiliza o hook `useQueryParams` para gerenciar o estado de paginação na URL:

```typescript
const paramConfig = {
  search: { default: "" },
  page: { default: "1" },
  pageSize: { default: "25" },
};

const { params, setParam } = useQueryParams(paramConfig);

// Handlers
const handlePageChange = (newPage: number) => 
  setParam("page", newPage.toString());

const handlePageSizeChange = (newSize: number) => {
  setParam("pageSize", newSize.toString());
  setParam("page", "1"); // Reset para primeira página
};
```

## Benefícios

1. **Performance:** Reduz a quantidade de dados transferidos e processados
2. **Consistência:** Todos os endpoints seguem o mesmo padrão
3. **Escalabilidade:** Suporta grandes volumes de dados sem degradação
4. **UX:** Permite navegação eficiente em listas grandes
5. **State Management:** Paginação persistida na URL (bookmarkable, shareable)

## Notas Técnicas

- A paginação é implementada usando `skip` e `take` do Prisma
- O `total` é calculado com `count()` na mesma transação para garantir consistência
- Valores de `pageSize` são limitados a 100 para evitar sobrecarga
- Todos os filtros e buscas são aplicados antes da paginação
