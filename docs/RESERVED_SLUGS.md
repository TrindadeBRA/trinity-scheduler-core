# Slugs Reservados

## Visão Geral

O sistema de slugs para subdomínios possui uma lista de palavras reservadas que não podem ser usadas como identificadores de unidades. Isso previne conflitos com subdomínios técnicos e do sistema.

## Lista de Slugs Reservados

### Subdomínios do Sistema
- `admin` - Painel administrativo
- `app` - Aplicação principal
- `painel` - Painel em português
- `dashboard` - Dashboard
- `manage` - Gerenciamento
- `portal` - Portal
- `api` - API endpoints
- `www` - Website principal

### Subdomínios Técnicos
- `mail`, `email`, `smtp`, `pop`, `imap` - Serviços de email
- `ftp`, `sftp`, `ssh` - Transferência de arquivos
- `vpn` - Rede privada virtual
- `cdn`, `static`, `assets`, `media` - Conteúdo estático
- `files`, `uploads`, `download`, `downloads` - Arquivos

### Ambientes
- `test`, `testing` - Ambiente de testes
- `dev`, `development` - Ambiente de desenvolvimento
- `staging` - Ambiente de staging
- `prod`, `production` - Ambiente de produção
- `demo` - Demonstração
- `sandbox` - Sandbox
- `localhost` - Desenvolvimento local

### Segurança e Sistema
- `security` - Segurança
- `admin-panel` - Painel administrativo
- `administrator` - Administrador
- `root` - Root/raiz
- `system` - Sistema
- `config`, `configuration` - Configuração

### Outros
- `help` - Ajuda
- `support` - Suporte
- `docs`, `documentation` - Documentação
- `blog` - Blog
- `news` - Notícias
- `about` - Sobre
- `contact` - Contato
- `legal` - Legal
- `privacy` - Privacidade
- `terms` - Termos

## Validação

A validação de slugs reservados é feita automaticamente em:

1. **Criação de unidade** (`POST /admin/units`)
2. **Atualização de unidade** (`PUT /admin/units/:id`)

### Exemplo de Erro

```json
{
  "status": 400,
  "code": "VALIDATION_ERROR",
  "message": "Este slug está reservado e não pode ser usado"
}
```

## Adicionando Novos Slugs Reservados

Para adicionar novos slugs reservados, edite o arquivo:

```
src/utils/slug.ts
```

Adicione o slug na constante `RESERVED_SLUGS`:

```typescript
const RESERVED_SLUGS = [
  // ... slugs existentes
  'novo-slug-reservado',
];
```

## Estrutura de Domínios Recomendada

```
https://kronuz.xyz                    → Landing page
https://app.kronuz.xyz                → Painel administrativo
https://trinitybarber.kronuz.xyz      → Cliente Trinity Barber
https://outrounidade.kronuz.xyz       → Outra unidade
```

## Testes

Os testes de validação de slugs reservados estão em:

```
src/utils/slug.test.ts
```

Execute com:

```bash
npm test -- slug.test.ts
```
