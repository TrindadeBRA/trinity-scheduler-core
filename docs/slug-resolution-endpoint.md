# Slug Resolution Endpoint

## Overview

O endpoint `GET /client/units/resolve/:slug` permite resolver um slug de unidade para obter os IDs e nomes necessários para identificar a unidade e o estabelecimento.

## Características

- **Público**: Não requer autenticação
- **Sem X-Shop-Id**: Não requer o header X-Shop-Id (este é o propósito do endpoint - resolver o shopId a partir do slug)
- **Case-insensitive**: O slug é normalizado para lowercase antes da busca
- **Retorna**: unitId, shopId, unitName, shopName

## Endpoint

```
GET /client/units/resolve/:slug
```

### Parâmetros

- `slug` (path parameter): Slug da unidade (case-insensitive)

### Resposta de Sucesso (200)

```json
{
  "unitId": "123e4567-e89b-12d3-a456-426614174000",
  "shopId": "123e4567-e89b-12d3-a456-426614174001",
  "unitName": "Trinity Barber - Centro",
  "shopName": "Trinity Barber Shop"
}
```

### Resposta de Erro (404)

```json
{
  "error": "Unidade não encontrada"
}
```

## Exemplos de Uso

### cURL

```bash
# Resolver slug existente
curl http://localhost:3000/client/units/resolve/trinitybarber

# Case-insensitive
curl http://localhost:3000/client/units/resolve/TRINITYBARBER

# Slug inexistente (retorna 404)
curl http://localhost:3000/client/units/resolve/nao-existe
```

### JavaScript/TypeScript

```typescript
async function resolveSlug(slug: string) {
  const response = await fetch(
    `${API_URL}/client/units/resolve/${slug}`
  );
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Unidade não encontrada');
    }
    throw new Error('Erro ao resolver slug');
  }
  
  return response.json();
}

// Uso
const result = await resolveSlug('trinitybarber');
console.log(result);
// {
//   unitId: "...",
//   shopId: "...",
//   unitName: "Trinity Barber - Centro",
//   shopName: "Trinity Barber Shop"
// }
```

## Testando o Endpoint

### 1. Verificar unidades com slugs

```bash
yarn verify:slugs
```

### 2. Testar com unidade existente

Se você tem uma unidade com slug `trinitybarber`:

```bash
curl http://localhost:3000/client/units/resolve/trinitybarber
```

### 3. Executar testes automatizados

```bash
yarn test src/routes/client/units.routes.test.ts
```

## Integração com Client App

O client app usará este endpoint para:

1. Extrair o slug do subdomínio da URL (ex: `trinitybarber.domain.app`)
2. Chamar este endpoint para resolver o slug
3. Armazenar shopId e unitId no localStorage
4. Usar shopId no header X-Shop-Id para requisições subsequentes

## Requisitos Atendidos

Este endpoint implementa os seguintes requisitos da especificação:

- **5.1**: Endpoint GET /client/units/resolve/:slug
- **5.2**: Retorna shopId e unitId
- **5.3**: Retorna unit name e shop name
- **5.4**: Retorna 404 se slug não existe
- **5.5**: Lookup case-insensitive
- **5.6**: Não requer autenticação
- **5.7**: Não requer X-Shop-Id header

## Documentação Swagger

O endpoint está documentado no Swagger em `/api-docs` quando o servidor está rodando.
