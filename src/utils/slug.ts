/**
 * Slug utilities for unit subdomain system
 * Provides sanitization, validation, and generation of URL-safe slugs
 */

/**
 * Lista de slugs reservados que não podem ser usados
 * Inclui subdomínios técnicos e palavras-chave do sistema
 */
const RESERVED_SLUGS = [
  // Subdomínios do sistema
  'admin',
  'app',
  'painel',
  'dashboard',
  'manage',
  'portal',
  'api',
  'www',
  
  // Subdomínios técnicos
  'mail',
  'email',
  'smtp',
  'pop',
  'imap',
  'ftp',
  'sftp',
  'ssh',
  'vpn',
  'cdn',
  'static',
  'assets',
  'media',
  'files',
  'uploads',
  'download',
  'downloads',
  
  // Palavras reservadas comuns
  'test',
  'testing',
  'dev',
  'development',
  'staging',
  'prod',
  'production',
  'demo',
  'sandbox',
  'localhost',
  
  // Segurança
  'security',
  'admin-panel',
  'administrator',
  'root',
  'system',
  'config',
  'configuration',
  
  // Outros
  'help',
  'support',
  'docs',
  'documentation',
  'blog',
  'news',
  'about',
  'contact',
  'legal',
  'privacy',
  'terms',
];

/**
 * Sanitiza uma string para ser um slug válido
 * Remove acentos, converte para lowercase, substitui espaços por hífens
 * 
 * @param input - String a ser sanitizada
 * @returns Slug sanitizado
 */
export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()                           // Converte para minúsculas
    .trim()                                  // Remove espaços nas pontas
    .normalize('NFD')                        // Normaliza para decompor acentos
    .replace(/[\u0300-\u036f]/g, '')        // Remove marcas diacríticas
    .replace(/[^a-z0-9-]/g, '-')            // Substitui caracteres inválidos por hífen
    .replace(/-+/g, '-')                     // Substitui múltiplos hífens por um
    .replace(/^-+|-+$/g, '');               // Remove hífens do início e fim
}

/**
 * Valida se um slug atende aos requisitos DNS e não é reservado
 * - 3-63 caracteres
 * - Apenas lowercase, números e hífens
 * - Inicia e termina com letra ou número
 * - Não pode ser uma palavra reservada
 * 
 * @param slug - Slug a ser validado
 * @returns Objeto com resultado da validação e mensagem de erro opcional
 */
export function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug || slug.length < 3) {
    return { valid: false, error: 'Slug deve ter no mínimo 3 caracteres' };
  }
  
  if (slug.length > 63) {
    return { valid: false, error: 'Slug deve ter no máximo 63 caracteres' };
  }
  
  if (!/^[a-z0-9]/.test(slug)) {
    return { valid: false, error: 'Slug deve iniciar com letra ou número' };
  }
  
  if (!/[a-z0-9]$/.test(slug)) {
    return { valid: false, error: 'Slug deve terminar com letra ou número' };
  }
  
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { valid: false, error: 'Slug deve conter apenas letras minúsculas, números e hífens' };
  }
  
  // Verifica se é uma palavra reservada
  if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
    return { valid: false, error: 'Este slug está reservado e não pode ser usado' };
  }
  
  return { valid: true };
}

/**
 * Gera um slug a partir de um nome de unidade
 * Aplica sanitização e garante validade
 * 
 * @param unitName - Nome da unidade
 * @returns Slug gerado e válido
 */
export function generateSlug(unitName: string): string {
  const sanitized = sanitizeSlug(unitName);
  
  // Se após sanitização o slug ficou vazio ou muito curto, usa fallback
  if (!sanitized || sanitized.length < 3) {
    return 'unit-' + Math.random().toString(36).substring(2, 9);
  }
  
  // Garante que não excede o limite
  const truncated = sanitized.substring(0, 63);
  
  // Remove hífen final se houver após truncamento
  return truncated.replace(/-+$/, '');
}

/**
 * Sugere slugs alternativos quando há conflito
 * Adiciona sufixos numéricos: slug-2, slug-3, etc.
 * 
 * @param baseSlug - Slug base que está em conflito
 * @param existingSlugs - Array de slugs já existentes
 * @returns Primeiro slug disponível com sufixo numérico
 */
export function suggestAlternativeSlugs(baseSlug: string, existingSlugs: string[]): string {
  let counter = 2;
  let suggestion = `${baseSlug}-${counter}`;
  
  // Continua incrementando até encontrar um slug disponível
  while (existingSlugs.includes(suggestion)) {
    counter++;
    suggestion = `${baseSlug}-${counter}`;
  }
  
  return suggestion;
}
