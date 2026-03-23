# Implementation Plan

- [x] 1. Escrever teste de exploração da condição de bug (ANTES do fix)
  - **Property 1: Bug Condition** - Fluxo de recuperação de senha não funcional
  - **CRITICAL**: Este teste DEVE FALHAR no código não corrigido — a falha confirma que o bug existe
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: Este teste codifica o comportamento esperado — ele validará o fix quando passar após a implementação
  - **GOAL**: Surfaçar contraexemplos que demonstram o bug
  - **Scoped PBT Approach**: Para bugs determinísticos, escopar a propriedade aos casos concretos de falha para garantir reprodutibilidade
  - Arquivo backend: `trinity-scheduler-core/src/routes/admin/__tests__/auth.routes.bugcondition.test.ts`
  - Arquivo frontend: `trinity-scheduler-admin/src/services/authService.bugcondition.test.ts`
  - **Caso 1 — Email não enviado (backend)**: Chamar o handler `POST /admin/auth/forgot-password` com email cadastrado e verificar que `sendPasswordResetEmail` FOI chamada (isBugCondition: `action='forgot-password' AND userExistsWithEmail(email) AND NOT emailWasSent(email)`)
    - Mockar `sendPasswordResetEmail` e verificar que o spy foi invocado
    - Rodar no código não corrigido → FALHA (confirma: email nunca é enviado)
    - Contraexemplo esperado: `sendPasswordResetEmail` nunca é invocada no handler
  - **Caso 2 — Endpoint reset-password inexistente (backend)**: Fazer `POST /admin/auth/reset-password` com token válido e senha forte e verificar que retorna 200 (isBugCondition: `action='reset-password' AND NOT endpointExists('/admin/auth/reset-password')`)
    - Rodar no código não corrigido → FALHA com 404 (confirma: endpoint não existe)
    - Contraexemplo esperado: `POST /admin/auth/reset-password` retorna 404 Not Found
  - **Caso 3 — Frontend usa setTimeout fake**: Renderizar `ForgotPassword.tsx`, submeter o form e verificar que `authService.forgotPassword` foi chamada (isBugCondition: `action='forgot-password' AND frontendUsesSetTimeout`)
    - Rodar no código não corrigido → FALHA (confirma: nenhuma chamada de rede é feita)
    - Contraexemplo esperado: `ForgotPassword.tsx` não faz nenhuma chamada HTTP
  - Marcar a task como completa quando os testes estiverem escritos, executados e as falhas documentadas
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Escrever testes de preservação (ANTES do fix)
  - **Property 2: Preservation** - Comportamentos existentes não afetados pelo fix
  - **IMPORTANT**: Seguir a metodologia observation-first
  - Arquivo backend: `trinity-scheduler-core/src/routes/admin/__tests__/auth.routes.preservation.test.ts`
  - Arquivo frontend: `trinity-scheduler-admin/src/services/authService.preservation.test.ts`
  - **Observar no código não corrigido** (casos onde isBugCondition retorna false):
    - `POST /admin/auth/forgot-password` com email NÃO cadastrado → retorna 200 com mensagem genérica
    - `POST /admin/auth/login` com credenciais válidas → retorna JWT
    - `POST /admin/auth/login` com credenciais inválidas → retorna 401
  - **Property 2a — Idempotência do forgot-password (P3)**: Para qualquer email (cadastrado ou não), múltiplas chamadas a `POST /admin/auth/forgot-password` sempre retornam HTTP 200 com mensagem genérica
    - Usar `fc.emailAddress()` para gerar emails arbitrários
    - Verificar que o status é sempre 200 e a mensagem não vaza informação
    - Verificar que o teste PASSA no código não corrigido
  - **Property 2b — Login preservado**: Para qualquer par email/senha válido, `POST /admin/auth/login` continua retornando JWT após o fix
    - Usar `fc.record({ email: fc.emailAddress(), password: fc.string() })` para gerar credenciais
    - Verificar que o endpoint de login não foi afetado
    - Verificar que o teste PASSA no código não corrigido
  - **Property 2c — Rejeição de token expirado (P5)**: Para qualquer `resetTokenExp` no passado, `POST /admin/auth/reset-password` retorna 400
    - Usar `fc.date({ max: new Date() })` para gerar datas de expiração no passado
    - Verificar que o teste PASSA no código não corrigido (comportamento já implementado ou a ser preservado)
  - **Property 2d — Rejeição de senha fraca (P6)**: Para qualquer senha que viole pelo menos um requisito (mín. 8 chars, maiúscula, minúscula, número, caractere especial), `POST /admin/auth/reset-password` retorna 400
    - Usar `fc.string()` filtrado para senhas que violam pelo menos um requisito
    - Verificar que o teste PASSA no código não corrigido
  - Verificar que TODOS os testes de preservação PASSAM no código não corrigido antes de prosseguir
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Implementar o fix do fluxo de recuperação de senha

  - [x] 3.1 Adicionar `sendPasswordResetEmail()` em `email.ts`
    - Arquivo: `trinity-scheduler-core/src/utils/email.ts`
    - Criar função `sendPasswordResetEmail(email: string, details: { name: string, resetUrl: string, shopName?: string }): Promise<void>`
    - Seguir o mesmo padrão dark-themed de `sendWelcomeLeader` e `sendProfessionalCredentials`
    - Template HTML com botão "Redefinir senha →" apontando para `details.resetUrl`
    - Incluir aviso de expiração em 1 hora
    - Incluir aviso de segurança: "Se você não solicitou, ignore este email"
    - _Bug_Condition: isBugCondition({ action: 'forgot-password', email }) where userExistsWithEmail(email) AND NOT emailWasSent(email)_
    - _Expected_Behavior: sendPasswordResetEmail é chamada com email do usuário e URL contendo resetToken_
    - _Requirements: 2.2_

  - [x] 3.2 Atualizar handler `forgot-password` e criar endpoint `reset-password` em `auth.routes.ts`
    - Arquivo: `trinity-scheduler-core/src/routes/admin/auth.routes.ts`
    - Importar `sendPasswordResetEmail` de `../../utils/email`
    - No handler `POST /forgot-password`, após `prisma.user.update`, adicionar chamada fire-and-forget:
      ```typescript
      sendPasswordResetEmail(user.email, {
        name: user.name,
        resetUrl: `${env.ADMIN_URL}/reset-password?token=${resetToken}`,
      }).catch((err) => console.error('[FORGOT-PASSWORD] Falha ao enviar email:', err));
      ```
    - Criar `router.post('/reset-password', ...)` com:
      - Validação: `token` e `password` presentes (400 se ausentes)
      - `prisma.user.findFirst({ where: { resetToken: token } })`
      - Verificação: user existe E `resetTokenExp > new Date()` (400 se inválido/expirado)
      - Validação de complexidade de senha (mesma lógica do `/profile` patch)
      - `prisma.user.update` com `passwordHash`, `resetToken: null`, `resetTokenExp: null`
      - Retorno: `{ message: 'Senha redefinida com sucesso' }`
    - _Bug_Condition: isBugCondition({ action: 'forgot-password' }) AND isBugCondition({ action: 'reset-password' })_
    - _Expected_Behavior: email enviado fire-and-forget; reset-password retorna 200 e limpa token_
    - _Preservation: forgot-password com email não cadastrado continua retornando 200; login inalterado_
    - _Requirements: 2.2, 2.4, 2.5, 3.1, 3.4, 3.5_

  - [x] 3.3 Criar `authService.ts` no frontend admin
    - Arquivo: `trinity-scheduler-admin/src/services/authService.ts`
    - Seguir o padrão de `profileService.ts` usando `adminApi` de `@/lib/api`
    - Exportar `authService` com dois métodos:
      - `forgotPassword(email: string): Promise<void>` — `POST /admin/auth/forgot-password` (sem token, rota pública)
      - `resetPassword(token: string, password: string): Promise<void>` — `POST /admin/auth/reset-password` (sem token, rota pública)
    - Usar `adminApi` sem token de autenticação (rotas públicas)
    - Throw `new Error(body?.message ?? 'fallback')` em caso de erro
    - _Requirements: 2.1, 2.4_

  - [x] 3.4 Substituir `setTimeout` fake em `ForgotPassword.tsx` pela chamada real
    - Arquivo: `trinity-scheduler-admin/src/pages/ForgotPassword.tsx`
    - Importar `authService` de `@/services/authService`
    - Substituir `await new Promise((r) => setTimeout(r, 800))` por `await authService.forgotPassword(email)`
    - Mover `setSent(true)` e `toast(...)` para dentro do try, após a chamada
    - Adicionar catch com `toast({ title: "Erro", description: err.message, variant: "destructive" })`
    - Manter o estado `sent` e o layout de confirmação inalterados
    - _Bug_Condition: isBugCondition({ action: 'forgot-password' }) where frontendUsesSetTimeout_
    - _Expected_Behavior: authService.forgotPassword é chamada; setSent(true) só após resposta da API_
    - _Requirements: 2.1_

  - [x] 3.5 Criar página `ResetPassword.tsx`
    - Arquivo: `trinity-scheduler-admin/src/pages/ResetPassword.tsx`
    - Seguir o padrão visual de `Login.tsx` e `ForgotPassword.tsx`
    - Usar `useSearchParams()` para ler `token` da URL
    - Se `!token`: `useEffect` com `navigate('/forgot-password', { replace: true })`
    - Formulário com dois campos: nova senha + confirmar senha (ambos com toggle show/hide)
    - Validação client-side: senhas iguais, mín. 8 chars (feedback inline)
    - Chamar `authService.resetPassword(token, password)` no submit
    - Sucesso: `toast({ title: "Senha redefinida!" })` + `navigate('/login')`
    - Erro: `toast({ title: "Erro", description: err.message, variant: "destructive" })`
    - Ícones: `KeyRound`, `Eye`, `EyeOff` de `lucide-react`
    - Usar `AuthLayout` com `footerLinks={[{ to: "/login", label: "Voltar ao login" }]}`
    - _Bug_Condition: isBugCondition({ action: 'reset-password' }) where frontendRouteNotFound_
    - _Expected_Behavior: página exibe formulário; submit chama authService.resetPassword; redireciona para /login_
    - _Requirements: 2.3, 2.4_

  - [x] 3.6 Registrar rota `/reset-password` em `App.tsx`
    - Arquivo: `trinity-scheduler-admin/src/App.tsx`
    - Importar `ResetPasswordPage` de `./pages/ResetPassword`
    - Adicionar `<Route path="/reset-password" element={<ResetPasswordPage />} />` após a rota `/forgot-password`
    - _Bug_Condition: isBugCondition({ action: 'reset-password' }) where frontendRouteNotFound_
    - _Expected_Behavior: /reset-password renderiza ResetPassword.tsx_
    - _Requirements: 2.3_

  - [x] 3.7 Verificar que o teste de exploração da condição de bug agora passa
    - **Property 1: Expected Behavior** - Fluxo de recuperação de senha funcional
    - **IMPORTANT**: Re-executar os MESMOS testes da task 1 — NÃO escrever novos testes
    - Os testes da task 1 codificam o comportamento esperado
    - Quando estes testes passarem, confirma que o comportamento esperado foi satisfeito
    - Re-executar `auth.routes.bugcondition.test.ts` e `authService.bugcondition.test.ts`
    - **EXPECTED OUTCOME**: Todos os testes PASSAM (confirma que o bug foi corrigido)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.8 Verificar que os testes de preservação ainda passam
    - **Property 2: Preservation** - Comportamentos existentes não afetados
    - **IMPORTANT**: Re-executar os MESMOS testes da task 2 — NÃO escrever novos testes
    - Re-executar `auth.routes.preservation.test.ts` e `authService.preservation.test.ts`
    - **EXPECTED OUTCOME**: Todos os testes PASSAM (confirma que não há regressões)
    - Confirmar que login, forgot-password com email não cadastrado e validações continuam funcionando
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint — Garantir que todos os testes passam
  - Executar `yarn test` no `trinity-scheduler-core` e verificar que todos os testes passam
  - Executar `npm run test` no `trinity-scheduler-admin` e verificar que todos os testes passam
  - Verificar manualmente o fluxo completo: forgot-password → email recebido → reset-password → login com nova senha
  - Perguntar ao usuário se houver dúvidas antes de finalizar
