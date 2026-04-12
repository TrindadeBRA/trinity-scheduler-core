# Lógica de Agendamentos — Kronuz

## 1. Entidades Envolvidas

### Shop
A entidade raiz do sistema multi-tenant. Toda a configuração de horários e agendamentos pertence a um shop.

- **bookingBuffer** — antecedência mínima (em minutos) para aceitar um agendamento no dia atual. Ex: `60` significa que o cliente só pode agendar horários com pelo menos 1 hora de antecedência.

---

### ShopHour (Horário de Funcionamento da Loja)
Define os dias e horários em que a loja funciona.

- Um registro por dia da semana (Domingo, Segunda, Terça, Quarta, Quinta, Sexta, Sábado)
- `start` e `end` em formato HH:MM
- Se `start` ou `end` for nulo, a loja está **fechada** naquele dia
- Restrição: combinação (shopId + day) é única

---

### Professional (Profissional)
Funcionários que realizam os serviços.

- Pode estar vinculado a uma unidade pelo campo legado `unitId` (vínculo único) ou a múltiplas unidades via tabela junction `ProfessionalUnit`
- Possui `active` (boolean) e `deletedAt` (soft delete) — profissionais deletados ou inativos são ignorados em todos os cálculos
- Cada profissional tem seus próprios `WorkingHours` (horários de trabalho)

---

### WorkingHour (Horário de Trabalho do Profissional)
Define quando cada profissional trabalha, por dia da semana.

- `start` e `end` — horário de trabalho do dia (HH:MM ou nulo se não trabalhar)
- `lunchStart` e `lunchEnd` — intervalo de almoço (opcional)
- Um registro por profissional por dia da semana
- Restrição: combinação (professionalId + day) é única

---

### Service (Serviço)
O que pode ser agendado.

- Tem `duration` (minutos) e `price` (centavos)
- `type` pode ser `service` (serviço principal) ou `addon` (adicional)
- Apenas serviços com `active = true` podem ser agendados

---

### Unit (Unidade)
Filiais ou locais físicos da loja. Um agendamento pode estar associado a uma unidade específica.

---

### TimeBlock (Bloqueio de Horário)
Períodos em que um profissional está **indisponível**, sem ser um agendamento.

- Tem `date` (data), `startTime` (HH:MM) e `duration` (minutos)
- Campo `reason` opcional (ex: "Almoço", "Treinamento", "Férias")
- Tratado da mesma forma que um agendamento existente na detecção de conflitos

---

### Appointment (Agendamento)
O registro central do sistema.

**Campos principais:**
- `date` — data no formato YYYY-MM-DD
- `time` — hora no formato HH:MM (24h)
- `duration` — duração total em minutos (serviço + addons)
- `price` — valor total em centavos (serviço + addons)
- `status` — `confirmed`, `cancelled` ou `completed`
- `cancelReason` — motivo do cancelamento (quando aplicável)
- `notes` — observações do cliente

**Relações:**
- Pertence a: Shop, Unit (opcional), Client, Service, Professional
- Tem: AppointmentAddon[] (serviços adicionais)

---

### AppointmentAddon (Adicional do Agendamento)
Snapshot do addon no momento do agendamento (nome, duração, preço).

---

## 2. Criação de um Agendamento

### Dados necessários
- `shopId` — loja
- `clientId` — cliente
- `serviceId` — serviço principal
- `date` — data desejada (YYYY-MM-DD)
- `time` — horário desejado (HH:MM)
- `professionalId` *(opcional)* — se não informado, o sistema escolhe automaticamente
- `addonIds[]` *(opcional)* — serviços adicionais
- `notes` *(opcional)* — observações
- `unitId` *(opcional)* — unidade específica

### Fluxo de validação

1. **Serviço existe?** — Valida que o `serviceId` pertence ao shop e está ativo
2. **Addons válidos?** — Todos os `addonIds` devem ser do tipo `addon` e pertencer ao shop
3. **Cálculo de duração total** — `service.duration` + soma das durações dos addons
4. **Cálculo de preço total** — `service.price` + soma dos preços dos addons
5. **Slot disponível?** — Verifica se o horário está disponível conforme as regras de disponibilidade
6. **Atribuição de profissional:**
   - Se `professionalId` foi informado: valida que ele tem disponibilidade naquele horário
   - Se não foi informado: percorre todos os profissionais ativos e atribui o primeiro com disponibilidade

### Erros possíveis
- `404 NOT_FOUND` — serviço não encontrado
- `409 CONFLICT` — horário indisponível ou nenhum profissional livre

---

## 3. Cálculo de Slots Disponíveis

### Parâmetros de entrada
- `shopId` — obrigatório
- `date` — obrigatório (YYYY-MM-DD)
- `serviceDuration` — duração do serviço em minutos (padrão: 30)
- `professionalId` *(opcional)* — se não informado, retorna a união de todos os profissionais
- `unitId` *(opcional)* — filtra profissionais por unidade

### Saída
Lista de slots no formato `{ time: "HH:MM", available: boolean }`, em intervalos fixos de **30 minutos**.

---

### Filtros aplicados (em ordem)

#### 1. Horário de funcionamento da loja
- Busca o `ShopHour` correspondente ao dia da semana da data solicitada
- Se a loja estiver fechada naquele dia (`start` ou `end` nulos), **retorna vazio**
- Todos os slots devem estar dentro do intervalo `shop.start` → `shop.end`

#### 2. Buffer de antecedência (somente para agendamentos no dia atual)
- Usa o fuso horário `America/Sao_Paulo`
- Se a data solicitada for hoje, filtra todos os slots em que:
  `horário do slot <= hora atual + bookingBuffer (em minutos)`
- Ex: se são 14h e o buffer é 60 min, slots até 15h são removidos

#### 3. Horário de trabalho do profissional
- Busca o `WorkingHour` do profissional para o dia da semana
- Se não existir ou `start`/`end` forem nulos, o profissional **não atende** naquele dia
- O horário efetivo é a **interseção** entre o horário da loja e o do profissional:
  - `MAX(profissional.start, loja.start)` → `MIN(profissional.end, loja.end)`

#### 4. Intervalo de almoço
- Se o profissional tiver `lunchStart` e `lunchEnd` definidos:
- Remove qualquer slot que **conflite** com o intervalo, incluindo slots que começam antes mas terminam durante o almoço
- Regra: um slot conflita se `slot_inicio < lunchEnd` E `slot_fim > lunchStart`

#### 5. Agendamentos existentes
- Busca agendamentos do profissional na data com `status = confirmed` ou `completed`
- Remove slots que conflitem com qualquer agendamento existente
- Regra de conflito: `slot_inicio < agendamento_fim` E `slot_fim > agendamento_inicio`
  - Onde `agendamento_fim = agendamento.time + agendamento.duration`
  - E `slot_fim = slot.time + serviceDuration`

#### 6. TimeBlocks (bloqueios manuais)
- Busca TimeBlocks do profissional na data
- Aplica a mesma regra de conflito usada para agendamentos
- Bloqueios têm precedência exatamente igual a agendamentos

#### 7. Filtro por unidade (quando `unitId` for informado)
- Inclui apenas profissionais com `unitId == unitId` (campo legado) **ou** que tenham a unidade na relação `ProfessionalUnit`

#### 8. União de múltiplos profissionais (quando `professionalId` não é informado)
- Calcula a disponibilidade de cada profissional ativo separadamente
- Um slot está disponível se **pelo menos um profissional** tiver disponibilidade nele

---

## 4. Datas Desabilitadas

Retorna as datas em que **nenhum slot** está disponível dentro de um intervalo.

**Parâmetros:** `startDate`, `endDate`, `professionalId` (opcional), `unitId` (opcional)

**Lógica:** Para cada data no intervalo, roda o cálculo de slots com `serviceDuration = 30`. Se nenhum slot tiver `available = true`, a data entra na lista de desabilitadas.

**Uso:** Desabilitar dias no calendário do portal de agendamento antes mesmo do cliente escolher um horário.

---

## 5. Regras de Negócio

### Criação
- Só é possível agendar em slots disponíveis
- O profissional deve estar ativo e não deletado
- O serviço deve estar ativo
- Addons devem ser do tipo `addon`

### Cancelamento
- Não é possível cancelar um agendamento já cancelado
- Se o agendamento estava `completed`, o valor é subtraído do `totalSpent` do cliente
- O motivo do cancelamento é registrado em `cancelReason`

### Conclusão (status → `completed`)
- Incrementa `client.totalSpent` com o valor do agendamento
- Atualiza `client.lastVisit` com a data do agendamento

### Revertendo conclusão (saindo de `completed`)
- Decrementa `client.totalSpent` com o valor do agendamento

### Soft delete de profissional
- Profissionais são marcados com `deletedAt` em vez de removidos do banco
- São excluídos de todos os cálculos de disponibilidade e listagens

### Alocação de profissional em unidades
- Um profissional pode estar em nenhuma, uma ou várias unidades
- Suporta campo legado `unitId` (vínculo único) e relação many-to-many via `ProfessionalUnit`
- Quando um agendamento é filtrado por unidade, ambas as formas de vínculo são consideradas

---

## 6. Filtros da Listagem de Agendamentos (Admin)

| Filtro | Descrição |
|---|---|
| `date` | Data exata |
| `startDate` / `endDate` | Intervalo de datas |
| `professionalId` | Profissional específico |
| `status` | Status(es) separados por vírgula |
| `serviceId` | Serviço específico |
| `clientId` | Cliente específico |
| `unitId` | Unidade específica |
| `search` | Texto livre (nome do cliente, serviço ou profissional) |
| `page` / `pageSize` | Paginação (padrão: página 1, 25 por página) |
| `sortBy` | Campo de ordenação: `date`, `time`, `clientName`, `serviceName`, `professionalName`, `status`, `price`, `duration` |
| `sortOrder` | `asc` ou `desc` (padrão: `desc`) |

---

## 7. Detalhes de Implementação

- **Fuso horário:** Todo cálculo de "hoje" usa `America/Sao_Paulo`
- **Formato de tempo:** Sempre `HH:MM` (24h) como string
- **Formato de data:** Sempre `YYYY-MM-DD` como string
- **Valores monetários:** Sempre em centavos (inteiro)
- **Intervalo de slots:** Fixo em 30 minutos
- **Nomes dos dias:** Em português: `Domingo`, `Segunda`, `Terça`, `Quarta`, `Quinta`, `Sexta`, `Sábado`
- **Detecção de conflito:** Baseada em aritmética de minutos — converte `HH:MM` → total de minutos desde meia-noite para comparar intervalos
