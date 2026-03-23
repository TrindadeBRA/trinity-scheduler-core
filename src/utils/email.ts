import nodemailer from 'nodemailer';
import { env } from '../config/env';
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});



const NICHE_COLORS: Record<string, { primary: string; accent: string; warningBg: string; warningBorder: string; warningText: string }> = {
  barbearia:     { primary: '#EAB308', accent: '#000000', warningBg: '#1a1500', warningBorder: '#3a2e00', warningText: '#a89030' },
  'salao-beleza':{ primary: '#EC4899', accent: '#ffffff', warningBg: '#1a0010', warningBorder: '#3a0025', warningText: '#c0507a' },
};

function getNicheColors(niche: string) {
  return NICHE_COLORS[niche?.toLowerCase()] ?? NICHE_COLORS['barbearia'];
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const mailOptions = {
    from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('[EMAIL] Erro ao enviar email:', {
      to: options.to,
      subject: options.subject,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    throw error;
  }
}

/**
 * Envia as credenciais de acesso ao profissional recém-cadastrado
 */
export async function sendProfessionalCredentials(
  email: string,
  details: {
    name: string;
    shopName: string;
    niche?: string;
    loginEmail: string;
    password: string;
    loginUrl?: string;
  }
): Promise<void> {
  const loginUrl = details.loginUrl || env.ADMIN_URL || 'http://localhost:8080';
  const c = getNicheColors(details.niche || 'barbearia');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; background-color: #0a0a0a; color: #e5e5e5; line-height: 1.6; }
          .wrapper { background-color: #0a0a0a; padding: 40px 20px; }
          .container { max-width: 560px; margin: 0 auto; }
          .header { background-color: #111111; border: 1px solid #222222; border-bottom: 3px solid ${c.primary}; border-radius: 10px 10px 0 0; padding: 32px 36px; text-align: center; }
          .header h1 { color: ${c.primary}; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
          .header p { color: #888888; font-size: 13px; margin-top: 6px; }
          .content { background-color: #111111; border: 1px solid #222222; border-top: none; padding: 32px 36px; }
          .greeting { color: #e5e5e5; font-size: 15px; margin-bottom: 8px; }
          .subtitle { color: #888888; font-size: 14px; margin-bottom: 24px; }
          .credentials { background-color: #1a1a1a; border: 1px solid #2a2a2a; border-left: 3px solid ${c.primary}; border-radius: 6px; padding: 20px 24px; margin: 24px 0; }
          .row { display: flex; align-items: center; margin: 10px 0; gap: 10px; }
          .label { color: #888888; font-size: 13px; min-width: 60px; }
          .value { font-family: 'Courier New', monospace; background-color: #0a0a0a; color: ${c.primary}; padding: 4px 10px; border-radius: 4px; font-size: 14px; border: 1px solid #2a2a2a; word-break: break-all; }
          .btn-wrap { text-align: center; margin: 28px 0 8px; }
          .btn { display: inline-block; padding: 13px 32px; background-color: ${c.primary}; color: ${c.accent}; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 14px; letter-spacing: 0.3px; }
          .warning { background-color: ${c.warningBg}; border: 1px solid ${c.warningBorder}; border-left: 3px solid ${c.primary}; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: ${c.warningText}; margin-top: 24px; }
          .footer { background-color: #0d0d0d; border: 1px solid #1a1a1a; border-top: none; border-radius: 0 0 10px 10px; padding: 20px 36px; text-align: center; }
          .footer p { color: #555555; font-size: 12px; line-height: 1.8; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <h1>${details.shopName}</h1>
              <p>Painel Administrativo</p>
            </div>
            <div class="content">
              <p class="greeting">Olá, <strong style="color:#EAB308">${details.name}</strong>!</p>
              <p class="subtitle">Seu acesso ao painel foi criado. Use as credenciais abaixo para entrar:</p>

              <div class="credentials">
                <div class="row">
                  <span class="label">Email</span>
                  <span class="value">${details.loginEmail}</span>
                </div>
                <div class="row">
                  <span class="label">Senha</span>
                  <span class="value">${details.password}</span>
                </div>
              </div>

              <div class="btn-wrap">
                <a href="${loginUrl}" class="btn">Acessar o painel →</a>
              </div>

              <div class="warning">
                ⚠️ Por segurança, recomendamos alterar sua senha no primeiro acesso.
              </div>
            </div>
            <div class="footer">
              <p>Este é um email automático, por favor não responda.</p>
              <p>&copy; ${new Date().getFullYear()} ${details.shopName}. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Bem-vindo ao ${details.shopName}!

Olá, ${details.name}!

Seu acesso ao painel administrativo foi criado. Use as credenciais abaixo para entrar:

Email: ${details.loginEmail}
Senha: ${details.password}

Acesse: ${loginUrl}

Por segurança, recomendamos alterar sua senha no primeiro acesso.

---
Este é um email automático, por favor não responda.
© ${new Date().getFullYear()} ${details.shopName}. Todos os direitos reservados.
  `;

  await sendEmail({
    to: email,
    subject: `Suas credenciais de acesso - ${details.shopName}`,
    html,
    text,
  });
}

export default transporter;

/**
 * Envia email de boas-vindas ao leader que criou a conta
 */
export async function sendWelcomeLeader(
  email: string,
  details: {
    name: string;
    shopName: string;
    niche?: string;
    loginUrl?: string;
  }
): Promise<void> {
  const loginUrl = details.loginUrl || env.ADMIN_URL || 'http://localhost:8080';
  const c = getNicheColors(details.niche || 'barbearia');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; background-color: #0a0a0a; color: #e5e5e5; line-height: 1.6; }
          .wrapper { background-color: #0a0a0a; padding: 40px 20px; }
          .container { max-width: 560px; margin: 0 auto; }
          .header { background-color: #111111; border: 1px solid #222222; border-bottom: 3px solid ${c.primary}; border-radius: 10px 10px 0 0; padding: 32px 36px; text-align: center; }
          .header h1 { color: ${c.primary}; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
          .header p { color: #888888; font-size: 13px; margin-top: 6px; }
          .content { background-color: #111111; border: 1px solid #222222; border-top: none; padding: 32px 36px; }
          .greeting { color: #e5e5e5; font-size: 15px; margin-bottom: 8px; }
          .subtitle { color: #888888; font-size: 14px; margin-bottom: 24px; }
          .highlight { background-color: #1a1a1a; border: 1px solid #2a2a2a; border-left: 3px solid ${c.primary}; border-radius: 6px; padding: 20px 24px; margin: 24px 0; }
          .highlight p { color: #cccccc; font-size: 14px; line-height: 1.7; }
          .btn-wrap { text-align: center; margin: 28px 0 8px; }
          .btn { display: inline-block; padding: 13px 32px; background-color: ${c.primary}; color: ${c.accent}; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 14px; letter-spacing: 0.3px; }
          .warning { background-color: ${c.warningBg}; border: 1px solid ${c.warningBorder}; border-left: 3px solid ${c.primary}; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: ${c.warningText}; margin-top: 24px; }
          .footer { background-color: #0d0d0d; border: 1px solid #1a1a1a; border-top: none; border-radius: 0 0 10px 10px; padding: 20px 36px; text-align: center; }
          .footer p { color: #555555; font-size: 12px; line-height: 1.8; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <h1>${details.shopName}</h1>
              <p>Painel Administrativo</p>
            </div>
            <div class="content">
              <p class="greeting">Bem-vindo(a), <strong style="color:${c.primary}">${details.name}</strong>!</p>
              <p class="subtitle">Sua conta foi criada com sucesso. O <strong>${details.shopName}</strong> já está pronto para receber agendamentos.</p>

              <div class="highlight">
                <p>A partir de agora você pode:</p>
                <ul style="margin-top: 10px; padding-left: 18px; color: #aaaaaa; font-size: 13px; line-height: 2;">
                  <li>Cadastrar profissionais e serviços</li>
                  <li>Gerenciar agendamentos e clientes</li>
                  <li>Configurar horários de funcionamento</li>
                  <li>Acompanhar relatórios de receita</li>
                </ul>
              </div>

              <div class="btn-wrap">
                <a href="${loginUrl}" class="btn">Acessar o painel →</a>
              </div>

              <div class="warning">
                💡 Dica: comece cadastrando seus serviços e profissionais para liberar o link de agendamento para seus clientes.
              </div>
            </div>
            <div class="footer">
              <p>Este é um email automático, por favor não responda.</p>
              <p>&copy; ${new Date().getFullYear()} ${details.shopName}. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Bem-vindo(a) ao ${details.shopName}!

Olá, ${details.name}!

Sua conta foi criada com sucesso. O ${details.shopName} já está pronto para receber agendamentos.

Acesse o painel: ${loginUrl}

Dica: comece cadastrando seus serviços e profissionais para liberar o link de agendamento para seus clientes.

---
Este é um email automático, por favor não responda.
© ${new Date().getFullYear()} ${details.shopName}. Todos os direitos reservados.
  `;

  await sendEmail({
    to: email,
    subject: `Bem-vindo(a) ao ${details.shopName}! Sua conta está pronta`,
    html,
    text,
  });
}
