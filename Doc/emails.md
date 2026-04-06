# E-mails Enviados pelo Sistema

O Trinity Scheduler envia 3 tipos de e-mail transacional:

---

## 1. Credenciais de Acesso do Profissional

**Situação:** Quando o admin cadastra um profissional e cria seu login no painel.

**Destinatário:** O profissional recém-cadastrado

**O que o e-mail contém:**

- E-mail e senha temporária de acesso
- Link direto para o painel
- Aviso para trocar a senha no primeiro acesso

**Assunto:** `Suas credenciais de acesso - {nome da loja}`

---

## 2. Boas-vindas ao Responsável do Estabelecimento

**Situação:** Quando alguém cria um novo estabelecimento (se registra na plataforma).

**Destinatário:** A pessoa que criou a conta (owner/leader)

**O que o e-mail contém:**

- Mensagem de boas-vindas
- O que ela pode fazer no painel (cadastrar profissionais, gerenciar agendamentos, configurar horários, ver relatórios)
- Dica para começar configurando serviços e profissionais

**Assunto:** `Bem-vindo(a) ao {nome da loja}! Sua conta está pronta`

---

## 3. Redefinição de Senha

**Situação:** Quando o usuário clica em "Esqueci minha senha" na tela de login.

**Destinatário:** O dono da conta que solicitou a redefinição

**O que o e-mail contém:**

- Link para definir uma nova senha (válido por 1 hora)
- Aviso para ignorar o e-mail caso não tenha solicitado

**Assunto:** `Redefinição de senha — {nome da loja}`

---

## Resumo

| Situação | Destinatário |
|---|---|
| Novo profissional criado | O profissional |
| Novo estabelecimento registrado | Quem criou a conta (owner) |
| "Esqueci minha senha" | O próprio solicitante |
