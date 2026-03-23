# Forgot/Reset Password Flow — Bugfix Design

## Overview

O fluxo de recuperação de senha está ~30% implementado. O backend já gera e persiste o `resetToken` no banco, mas não envia o email. O endpoint `POST /admin/auth/reset-password` não existe. No frontend, `ForgotPassword.tsx` simula o envio com `setTimeout` sem chamar nenhuma API, e a página `ResetPassword` não existe nem está roteada.

A estratégia de correção é mínima e cirúrgica:
1. Adicionar `sendPasswordResetEmail()` em `email.ts` e chamá-la (fire-and-forget) no endpoint existente de `forgot-password`
2. Criar o endpoint `POST /admin/auth/reset-password` em `auth.routes.ts`
3. Criar `authService.ts` no frontend admin
4. Substituir o `setTimeout` fake em `ForgotPassword.tsx` pela chamada real
5. Criar `ResetPassword.tsx` e registrar a rota em `App.tsx`

## Glossary

- **Bug_Condition (C)**: Conjunto de entradas que ativam o defeito — qualquer tentativa de usar o fluxo de recuperação de senha (solicitar reset ou consumir o token)
- **Property (P)**: Comportamento correto esperado — o email é enviado, o token é consumível, a senha é atualizada e o token é invalidado
- **Preservation**: Comportamentos existentes que não devem ser alterados — login, registro, autenticação JWT, endpoints não relacionados
- **resetToken**: UUID v4 gerado por `crypto.randomUUID()`, armazenado em `User.resetToken`
- **resetTokenExp**: `DateTime` com validade de 1 hora, armazenado em `User.resetTokenExp`
- **sendPasswordResetEmail**: Nova função em `src/utils/email.ts` que envia o link de redefinição
- **isBugCondition**: Função pseudocódigo que identifica entradas que ativam o bug

## Bug Details

### Bug Condition

O bug se manifesta em dois pontos distintos do fluxo:

**Ponto 1 — Backend `forgot-password`**: O token é salvo no banco mas o email nunca é enviado, tornando o token inacessível ao usuário.

**Ponto 2 — Frontend + Backend `reset-password`**: A rota `/reset-password` não existe no frontend, e o endpoint `POST /admin/auth/reset-password` não existe no backend, tornando o token completamente inutilizável mesmo que o usuário o obtivesse por outro meio.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input de tipo { action: string, email?: string, token?: string, password?: string }
  OUTPUT: boolean

  IF input.action = 'forgot-password'
    RETURN input.email IS NOT NULL
           AND userExistsWithEmail(input.email)
           AND NOT emailWasSent(input.email)   -- bug: email nunca é enviado

  IF input.action = 'reset-password'
    RETURN input.token IS NOT NULL
           AND input.password IS NOT NULL
           AND NOT endpointExists('/admin/auth/reset-password')  -- bug: endpoint não existe

  RETURN false
END FUNCTION
```

### Examples

- **Exemplo 1**: Usuário `joao@barbearia.com` clica em "Esqueci minha senha" → frontend exibe "Email enviado!" após 800ms sem chamar nenhuma API → nenhum email chega na caixa de entrada
- **Exemplo 2**: Backend recebe `POST /admin/auth/forgot-password` com `joao@barbearia.com` → salva `resetToken=abc-123` e `resetTokenExp=+1h` no banco → retorna 200 → nenhum email é disparado
- **Exemplo 3**: Usuário tenta acessar `/reset-password?token=abc-123` → frontend retorna 404 (rota não registrada em `App.tsx`)
- **Exemplo 4**: Cliente HTTP faz `POST /admin/auth/reset-password` com `{ token: "abc-123", password: "Nova@123" }` → backend retorna 404 (endpoint não existe)
- **Edge case**: Usuário com email não cadastrado faz `POST /admin/auth/forgot-password` → deve continuar retornando 200 sem vazar informação (comportamento correto já implementado, não deve ser alterado)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `POST /admin/auth/login` deve continuar autenticando com email/senha e retornando JWT
- `POST /admin/auth/login` com credenciais inválidas deve continuar retornando 401
- `POST /admin/auth/forgot-password` com email **não cadastrado** deve continuar retornando 200 com mensagem genérica (sem vazar informação)
- `POST /admin/auth/register` deve continuar funcionando e enviando email de boas-vindas
- `GET /admin/auth/me` e `PATCH /admin/auth/profile` devem continuar funcionando normalmente
- Todas as outras rotas admin não relacionadas à autenticação devem permanecer inalteradas

**Scope:**
Todas as entradas que NÃO envolvem o fluxo de recuperação de senha devem ser completamente não afetadas por este fix. Isso inclui:
- Login com email/senha
- Registro de novos estabelecimentos
- Atualização de perfil autenticado
- Qualquer endpoint fora de `auth.routes.ts`

## Hypothesized Root Cause

Com base na análise do código existente, as causas são diretas e confirmadas (não hipotéticas):

1. **Email não enviado no `forgot-password`**: O handler em `auth.routes.ts` (linhas ~220-240) salva o token mas não importa nem chama nenhuma função de envio de email. A função `sendPasswordResetEmail` simplesmente não existe ainda.

2. **Endpoint `reset-password` ausente**: Não há nenhum `router.post('/reset-password', ...)` em `auth.routes.ts`. O endpoint precisa ser criado do zero.

3. **`ForgotPassword.tsx` usa `setTimeout` fake**: O `handleSubmit` em `ForgotPassword.tsx` usa `await new Promise((r) => setTimeout(r, 800))` ao invés de chamar a API. Não existe `authService.ts` no projeto admin.

4. **Rota `/reset-password` não registrada**: `App.tsx` não tem `<Route path="/reset-password" ... />` e o componente `ResetPassword.tsx` não existe.

## Correctness Properties

Property 1: Bug Condition — Envio de Email no Forgot-Password

_For any_ requisição `POST /admin/auth/forgot-password` onde o email está cadastrado no banco (isBugCondition retorna true para `action='forgot-password'`), o endpoint corrigido SHALL chamar `sendPasswordResetEmail` com o email do usuário e a URL contendo o `resetToken` gerado, de forma fire-and-forget.

**Validates: Requirements 2.2**

Property 2: Bug Condition — Endpoint Reset-Password Funcional

_For any_ requisição `POST /admin/auth/reset-password` com token válido, não expirado e senha que atende os requisitos de complexidade (isBugCondition retorna true para `action='reset-password'`), o endpoint corrigido SHALL atualizar `passwordHash`, setar `resetToken: null` e `resetTokenExp: null`, e retornar `{ message: 'Senha redefinida com sucesso' }`.

**Validates: Requirements 2.4, 2.5**

Property 3: Preservation — Idempotência do Forgot-Password

_For any_ número de chamadas `POST /admin/auth/forgot-password` com o mesmo email (cadastrado ou não), o endpoint SHALL sempre retornar HTTP 200 com a mensagem genérica, sobrescrevendo o token anterior quando o email existir.

**Validates: Requirements 3.1**

Property 4: Preservation — Limpeza Pós-Reset

_For any_ reset bem-sucedido, após a execução do endpoint `POST /admin/auth/reset-password`, os campos `resetToken` e `resetTokenExp` do usuário no banco SHALL ser `null`, impossibilitando reutilização do token.

**Validates: Requirements 2.5**

Property 5: Preservation — Rejeição de Token Expirado

_For any_ requisição `POST /admin/auth/reset-password` onde `resetTokenExp < now()`, o endpoint SHALL rejeitar com HTTP 400 e código `VALIDATION_ERROR`, independentemente da validade do token em si.

**Validates: Requirements 3.4**

Property 6: Preservation — Rejeição de Senha Fraca

_For any_ requisição `POST /admin/auth/reset-password` onde a senha não atende todos os requisitos (mín. 8 chars, maiúscula, minúscula, número, caractere especial), o endpoint SHALL rejeitar com HTTP 400 e código `VALIDATION_ERROR`.

**Validates: Requirements 3.5**

## Fix Implementation

### Changes Required

Assumindo que a análise de causa raiz está correta:

**Arquivo 1**: `trinity-scheduler-core/src/utils/email.ts`

**Função**: `sendPasswordResetEmail` (nova)

**Mudanças específicas**:
1. Adicionar função `sendPasswordResetEmail(email, details)` seguindo o mesmo padrão dark-themed das funções existentes (`sendWelcomeLeader`, `sendProfessionalCredentials`)
2. Parâmetros: `email: string`, `details: { name: string, resetUrl: string, shopName?: string }`
3. Template HTML com botão "Redefinir senha →" apontando para `resetUrl`
4. Aviso de expiração em 1 hora
5. Aviso de segurança: "Se você não solicitou, ignore este email"

---

**Arquivo 2**: `trinity-scheduler-core/src/routes/admin/auth.routes.ts`

**Função**: handler `POST /forgot-password` (modificar) + `POST /reset-password` (criar)

**Mudanças específicas**:
1. Importar `sendPasswordResetEmail` de `../../utils/email`
2. No handler `forgot-password`, após o `prisma.user.update`, adicionar chamada fire-and-forget:
   ```typescript
   sendPasswordResetEmail(user.email, {
     name: user.name,
     resetUrl: `${env.ADMIN_URL}/reset-password?token=${resetToken}`,
   }).catch((err) => console.error('[FORGOT-PASSWORD] Falha ao enviar email:', err));
   ```
3. Criar `router.post('/reset-password', ...)` com:
   - Validação: `token` e `password` presentes (400 se ausentes)
   - `prisma.user.findFirst({ where: { resetToken: token } })` — busca por token
   - Verificação: user existe E `resetTokenExp > new Date()` (400 se inválido/expirado)
   - Validação de complexidade de senha (mesma lógica do `/profile` patch)
   - `prisma.user.update` com `passwordHash`, `resetToken: null`, `resetTokenExp: null`
   - Retorno: `{ message: 'Senha redefinida com sucesso' }`

---

**Arquivo 3**: `trinity-scheduler-admin/src/services/authService.ts` (novo)

**Mudanças específicas**:
1. Criar arquivo seguindo o padrão de `profileService.ts`
2. Exportar `authService` com dois métodos:
   - `forgotPassword(email: string): Promise<void>` — `POST /admin/auth/forgot-password`
   - `resetPassword(token: string, password: string): Promise<void>` — `POST /admin/auth/reset-password`
3. Usar `adminApi` de `@/lib/api` sem token (rotas públicas)
4. Throw `new Error(body?.message ?? 'fallback')` em caso de erro

---

**Arquivo 4**: `trinity-scheduler-admin/src/pages/ForgotPassword.tsx` (modificar)

**Mudanças específicas**:
1. Importar `authService` de `@/services/authService`
2. Substituir o bloco `await new Promise((r) => setTimeout(r, 800))` por:
   ```typescript
   await authService.forgotPassword(email);
   ```
3. Mover `setSent(true)` e `toast(...)` para dentro do try, após a chamada
4. Adicionar catch com `toast({ title: "Erro", description: err.message, variant: "destructive" })`
5. Manter o estado `sent` e o layout de confirmação inalterados

---

**Arquivo 5**: `trinity-scheduler-admin/src/pages/ResetPassword.tsx` (novo)

**Mudanças específicas**:
1. Criar página seguindo o padrão visual de `Login.tsx` e `ForgotPassword.tsx`
2. Usar `useSearchParams()` para ler `token`
3. Se `!token`: `useEffect` com `navigate('/forgot-password', { replace: true })`
4. Formulário com dois campos: nova senha + confirmar senha (ambos com toggle show/hide)
5. Validação client-side: senhas iguais, mín. 8 chars (feedback inline)
6. Chamar `authService.resetPassword(token, password)` no submit
7. Sucesso: `toast({ title: "Senha redefinida!" })` + `navigate('/login')`
8. Erro: `toast({ title: "Erro", description: err.message, variant: "destructive" })`
9. Ícones: `KeyRound`, `Eye`, `EyeOff`, `CheckCircle2` de `lucide-react`
10. Usar `AuthLayout` com `footerLinks={[{ to: "/login", label: "Voltar ao login" }]}`

---

**Arquivo 6**: `trinity-scheduler-admin/src/App.tsx` (modificar)

**Mudanças específicas**:
1. Importar `ResetPasswordPage` de `./pages/ResetPassword`
2. Adicionar `<Route path="/reset-password" element={<ResetPasswordPage />} />` após a rota `/forgot-password`

## Testing Strategy

### Validation Approach

A estratégia segue duas fases: primeiro, confirmar o bug no código não corrigido (exploratory); depois, verificar que o fix funciona corretamente e não introduz regressões (fix checking + preservation checking).

### Exploratory Bug Condition Checking

**Goal**: Demonstrar o bug ANTES de implementar o fix. Confirmar ou refutar a análise de causa raiz.

**Test Plan**: Escrever testes que chamam os handlers existentes e verificam que o comportamento bugado ocorre. Rodar no código não corrigido para observar as falhas.

**Test Cases**:
1. **Email não enviado**: Chamar `POST /admin/auth/forgot-password` com email cadastrado e verificar que `sendPasswordResetEmail` NÃO foi chamada (vai falhar no código corrigido — confirma o bug)
2. **Endpoint inexistente**: Fazer `POST /admin/auth/reset-password` e verificar que retorna 404 (vai passar no código não corrigido — confirma o bug)
3. **Frontend fake**: Renderizar `ForgotPassword.tsx`, submeter o form e verificar que nenhuma chamada de rede foi feita (vai passar no código não corrigido — confirma o bug)

**Expected Counterexamples**:
- `sendPasswordResetEmail` nunca é invocada no handler `forgot-password`
- `POST /admin/auth/reset-password` retorna 404 Not Found
- `ForgotPassword.tsx` não faz nenhuma chamada HTTP

### Fix Checking

**Goal**: Verificar que para todas as entradas onde a condição de bug se aplica, o código corrigido produz o comportamento esperado.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedHandler(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Test Cases**:
1. `POST /admin/auth/forgot-password` com email cadastrado → `sendPasswordResetEmail` é chamada com URL correta
2. `POST /admin/auth/reset-password` com token válido + senha forte → retorna 200, `resetToken` e `resetTokenExp` são null no banco
3. `ForgotPassword.tsx` submit → `authService.forgotPassword` é chamada (não setTimeout)
4. `ResetPassword.tsx` com token válido → chama `authService.resetPassword` e navega para `/login`

### Preservation Checking

**Goal**: Verificar que para todas as entradas onde a condição de bug NÃO se aplica, o código corrigido produz o mesmo resultado que o código original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalHandler(input) = fixedHandler(input)
END FOR
```

**Testing Approach**: Property-based testing é recomendado para preservation checking porque:
- Gera muitos casos de teste automaticamente no domínio de entrada
- Captura edge cases que testes unitários manuais podem perder
- Fornece garantias fortes de que o comportamento é preservado para todas as entradas não-bugadas

**Test Cases**:
1. **Idempotência do forgot-password** (P3): Gerar N chamadas com mesmo email → sempre retorna 200
2. **Token expirado rejeitado** (P5): Gerar tokens com `resetTokenExp` no passado → sempre retorna 400
3. **Senha fraca rejeitada** (P6): Gerar senhas que violam cada requisito → sempre retorna 400
4. **Limpeza pós-reset** (P4): Após reset bem-sucedido → `resetToken` e `resetTokenExp` são null
5. **Login preservado**: Login com credenciais válidas continua retornando JWT após o fix

### Unit Tests

- Testar `sendPasswordResetEmail` com mock do `sendEmail` — verificar subject, destinatário e presença da URL no HTML
- Testar handler `POST /admin/auth/reset-password` com token válido, token expirado, token inexistente, senha fraca
- Testar `authService.forgotPassword` e `authService.resetPassword` com mock do `adminApi`
- Testar `ResetPassword.tsx`: sem token redireciona, com token exibe formulário, submit com senhas diferentes mostra erro

### Property-Based Tests

- **P3 — Idempotência**: `fc.string()` como email → múltiplas chamadas ao `forgot-password` sempre retornam 200 (usando fast-check)
- **P5 — Expiração**: `fc.date({ max: new Date() })` como `resetTokenExp` → `reset-password` sempre retorna 400
- **P6 — Complexidade de senha**: `fc.string()` filtrado para senhas que violam pelo menos um requisito → sempre retorna 400
- **P4 — Limpeza**: Para qualquer reset bem-sucedido, verificar que `resetToken IS NULL` e `resetTokenExp IS NULL` no banco

### Integration Tests

- Fluxo completo: `forgot-password` → verificar token no banco → `reset-password` → verificar senha atualizada e token limpo → `login` com nova senha
- Fluxo de expiração: salvar token com `resetTokenExp` no passado → `reset-password` retorna 400
- Fluxo frontend: `ForgotPassword` → mock API → estado `sent=true` exibido; `ResetPassword` → mock API → redirect para `/login`
