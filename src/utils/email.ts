import nodemailer from 'nodemailer';
import { env } from '../config/env';

const KRONUZ_LOGO_SVG = `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 394.88 431.71"
  width="130"
  style="display:block;margin:0 auto 20px;"
>
  <defs>
    <style>
      .cls-1 { fill: #244d6d; }
      .cls-2 { fill: #1e5784; }
      .cls-3 { fill: #f97a19; }
    </style>
  </defs>
  <path class="cls-2" d="M314.2,54.09l-17.61,20.1c17.24,21.64,27.54,49.05,27.54,78.87,0,33.7-13.16,64.33-34.63,87.02l-66.61-75.11-16.48,19.31,63.98,72.36c-20.62,14.55-45.79,23.1-72.95,23.1-69.96,0-126.68-56.72-126.68-126.68S127.48,26.37,197.44,26.37c28.57,0,54.93,9.46,76.12,25.42l18.48-19.07C266.01,12.23,233.15,0,197.44,0,112.91,0,44.38,68.52,44.38,153.06s68.53,153.06,153.06,153.06c33.87,0,65.17-11,90.51-29.62,6.82-5.01,13.22-10.57,19.11-16.62,26.88-27.58,43.44-65.26,43.44-106.82,0-37.74-13.66-72.29-36.3-98.97Z"/>
  <g>
    <polygon class="cls-2" points="157.69 77.66 157.69 110.33 184.36 137 184.36 77.66 157.69 77.66"/>
    <polygon class="cls-2" points="157.69 227.33 184.36 227.33 184.36 197.99 157.69 171.32 157.69 227.33"/>
  </g>
  <polygon class="cls-3" points="129.78 131.83 146.94 114.33 187.44 154.66 330.57 6.04 337.19 12.16 188.69 189.91 129.78 131.83"/>
  <path class="cls-1" d="M52.01,431.48l9.1-20.1h2.84l9.13,20.1h-3.01l-8.12-18.49h1.15l-8.12,18.49h-2.96ZM55.88,426.46l.78-2.3h11.31l.83,2.3h-12.92Z"/>
  <path class="cls-1" d="M90.02,431.71c-1.55,0-2.98-.25-4.28-.76-1.3-.51-2.43-1.22-3.39-2.15-.96-.93-1.7-2.01-2.24-3.26-.54-1.24-.8-2.61-.8-4.11s.27-2.86.8-4.11c.54-1.24,1.29-2.33,2.25-3.26.97-.93,2.1-1.65,3.4-2.15,1.3-.51,2.74-.76,4.31-.76s3.04.26,4.36.78,2.44,1.29,3.36,2.33l-1.78,1.78c-.82-.8-1.72-1.39-2.68-1.77s-2.01-.56-3.14-.56-2.22.19-3.2.57c-.99.38-1.84.92-2.56,1.61-.72.69-1.27,1.51-1.67,2.46-.39.95-.59,1.98-.59,3.09s.2,2.11.59,3.06c.39.95.95,1.77,1.67,2.47.72.7,1.56,1.24,2.54,1.62.98.38,2.04.57,3.19.57,1.07,0,2.1-.17,3.09-.5.99-.33,1.9-.89,2.74-1.68l1.64,2.18c-1,.84-2.16,1.48-3.49,1.91-1.33.43-2.7.65-4.12.65ZM97.63,429.16l-2.76-.37v-7.46h2.76v7.84Z"/>
  <path class="cls-1" d="M108.28,431.48v-20.1h14.18v2.5h-11.31v15.1h11.71v2.5h-14.58ZM110.89,422.49v-2.44h10.34v2.44h-10.34Z"/>
  <path class="cls-1" d="M132.68,431.48v-20.1h2.35l13.29,16.51h-1.23v-16.51h2.87v20.1h-2.35l-13.29-16.51h1.23v16.51h-2.87Z"/>
  <path class="cls-1" d="M161.16,431.48v-20.1h8.47c2.14,0,4.03.42,5.67,1.26,1.64.84,2.91,2.02,3.82,3.53.91,1.51,1.36,3.26,1.36,5.25s-.45,3.74-1.36,5.25c-.91,1.51-2.18,2.69-3.82,3.53-1.64.84-3.53,1.26-5.67,1.26h-8.47ZM164.03,428.98h5.43c1.67,0,3.1-.32,4.32-.95,1.22-.63,2.16-1.52,2.83-2.66s1-2.46,1-3.95-.33-2.83-1-3.96c-.67-1.13-1.61-2.01-2.83-2.64-1.22-.63-2.66-.95-4.32-.95h-5.43v15.1Z"/>
  <path class="cls-1" d="M186.72,431.48l9.1-20.1h2.84l9.13,20.1h-3.01l-8.12-18.49h1.15l-8.12,18.49h-2.96ZM190.59,426.46l.78-2.3h11.31l.83,2.3h-12.92Z"/>
  <path class="cls-1" d="M215.94,431.48v-20.1h2.35l9.02,15.19h-1.26l8.9-15.19h2.35l.03,20.1h-2.76l-.03-15.76h.66l-7.92,13.32h-1.32l-7.98-13.32h.72v15.76h-2.76Z"/>
  <path class="cls-1" d="M248.53,431.48v-20.1h14.18v2.5h-11.31v15.1h11.71v2.5h-14.58ZM251.14,422.49v-2.44h10.34v2.44h-10.34Z"/>
  <path class="cls-1" d="M272.93,431.48v-20.1h2.35l13.29,16.51h-1.23v-16.51h2.87v20.1h-2.35l-13.29-16.51h1.23v16.51h-2.87Z"/>
  <path class="cls-1" d="M305.4,431.48v-17.6h-6.89v-2.5h16.62v2.5h-6.89v17.6h-2.84Z"/>
  <path class="cls-1" d="M332.22,431.71c-1.53,0-2.95-.26-4.26-.78-1.31-.52-2.45-1.24-3.4-2.17-.96-.93-1.7-2.01-2.24-3.26-.54-1.24-.8-2.6-.8-4.08s.27-2.83.8-4.08c.54-1.24,1.28-2.33,2.24-3.26.96-.93,2.09-1.65,3.39-2.17,1.3-.52,2.73-.78,4.28-.78s2.95.25,4.25.76c1.3.51,2.43,1.23,3.39,2.15.96.93,1.7,2.02,2.23,3.27.53,1.25.79,2.62.79,4.09s-.26,2.86-.79,4.11c-.53,1.25-1.27,2.33-2.23,3.26-.96.93-2.09,1.65-3.39,2.15-1.3.51-2.72.76-4.25.76ZM332.19,429.16c1.13,0,2.17-.19,3.12-.57s1.77-.92,2.47-1.62c.7-.7,1.24-1.52,1.64-2.46.39-.94.59-1.96.59-3.07s-.2-2.13-.59-3.06c-.39-.93-.94-1.75-1.64-2.45-.7-.71-1.52-1.25-2.47-1.64s-1.99-.57-3.12-.57-2.14.19-3.09.57c-.95.38-1.78.93-2.48,1.64s-1.26,1.53-1.65,2.45c-.39.93-.59,1.95-.59,3.06s.2,2.13.59,3.07c.39.94.94,1.76,1.65,2.46.71.7,1.54,1.24,2.48,1.62.95.38,1.98.57,3.09.57Z"/>
  <polygon class="cls-1" points="258.29 393.69 247.66 393.78 216.15 357.38 216.11 393.7 202.01 393.77 202.01 333.36 212.7 333.35 244.16 369.56 244.35 333.34 258.29 333.34 258.29 393.69"/>
  <path class="cls-1" d="M58.75,393.62l-17.66.15-20.49-23.07c-2.15,2.11-4.26,4.22-6.41,6.65l-.04,16.35-14.14.06v-60.43s14.11-.01,14.11-.01l.04,25.32,24.25-25.29h17.45s-26.13,27.65-26.13,27.65l29.03,32.61Z"/>
  <polygon class="cls-1" points="394.84 393.76 342.89 393.76 342.96 383.91 375.01 346.31 342.88 346.18 342.87 333.36 394.86 333.32 394.87 343.23 362.95 380.78 394.88 380.86 394.84 393.76"/>
  <path class="cls-1" d="M331.11,333.17l-.07,34.35c-.02,8.36-3.52,16.18-9.83,21.46-10.67,8.94-30.33,8.61-40.43-1.63-4.94-5-7.91-11.67-7.97-18.86l-.27-35.27,14.19-.07.35,35.32c.06,6.32,4.66,11.7,10.47,13.17,4.81,1.22,9.56.62,13.48-2.35,3.2-2.43,5.81-6.78,5.83-11.49l.18-34.62,14.08-.02Z"/>
  <path class="cls-1" d="M106.39,373.1c9.15-4.21,13.65-13.44,11.63-23.3-1.81-8.84-9.74-16.17-19.6-16.25l-34.13-.26v60.48s14.25,0,14.25,0l.02-18.71h12.71s14.04,18.75,14.04,18.75l16.43-.16-15.35-20.56ZM96.5,361.92l-17.96.14.04-15.65,18.41.21c4.36.05,7.22,3.7,7.28,7.48.07,4.3-2.94,7.79-7.76,7.82Z"/>
  <path class="cls-1" d="M191.04,357.54c-2.62-14.51-14.49-24.91-29.21-26.03-9.9-.75-19.35,2.75-25.94,9.55-6.72,6.94-9.96,16.5-8.77,26.12,1.99,16.02,14.94,27.76,31.36,28.13,10.04.23,19.09-3.9,25.15-10.79,6.55-7.46,9.17-17.25,7.41-26.99ZM170.82,377.83c-8.75,7.48-21.67,4.87-27.2-4.82-3.58-6.27-3.5-13.51.2-19.7,5.21-8.69,16.42-11.47,25.05-5.95,5.11,3.27,8.1,8.79,8.53,14.53.45,5.87-1.77,11.82-6.58,15.93Z"/>
</svg>`;

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});



const NICHE_COLORS: Record<string, { primary: string; accent: string; warningBg: string; warningBorder: string; warningText: string }> = {
  barbearia:        { primary: '#EAB308', accent: '#000000', warningBg: '#1a1500', warningBorder: '#3a2e00', warningText: '#a89030' },
  'salao-beleza':   { primary: '#EC4899', accent: '#ffffff', warningBg: '#1a0010', warningBorder: '#3a0025', warningText: '#c0507a' },
  'esmalteria':     { primary: '#EC4899', accent: '#ffffff', warningBg: '#1a0010', warningBorder: '#3a0025', warningText: '#c0507a' },
  'clinica-estetica':{ primary: '#EC4899', accent: '#ffffff', warningBg: '#1a0010', warningBorder: '#3a0025', warningText: '#c0507a' },
  'manicure':       { primary: '#EC4899', accent: '#ffffff', warningBg: '#1a0010', warningBorder: '#3a0025', warningText: '#c0507a' },
  'pedicure':       { primary: '#EC4899', accent: '#ffffff', warningBg: '#1a0010', warningBorder: '#3a0025', warningText: '#c0507a' },
  'cabeleireiro':   { primary: '#EC4899', accent: '#ffffff', warningBg: '#1a0010', warningBorder: '#3a0025', warningText: '#c0507a' },
};

const FEMININE_NICHES = ['salao-beleza', 'esmalteria', 'clinica-estetica', 'manicure', 'pedicure', 'cabeleireiro'];
const MASCULINE_NICHES = ['barbearia'];

function getNicheColors(niche: string) {
  const lower = niche?.toLowerCase();
  if (FEMININE_NICHES.includes(lower)) return NICHE_COLORS['salao-beleza'];
  if (MASCULINE_NICHES.includes(lower)) return NICHE_COLORS['barbearia'];
  return NICHE_COLORS['barbearia'];
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
              ${KRONUZ_LOGO_SVG}
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
              ${KRONUZ_LOGO_SVG}
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

/**
 * Envia email de redefinição de senha com link e aviso de expiração
 */
export async function sendPasswordResetEmail(
  email: string,
  details: {
    name: string;
    resetUrl: string;
    shopName?: string;
  }
): Promise<void> {
  const c = getNicheColors('barbearia');
  const shopName = details.shopName || 'Trinity Scheduler';

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
          .btn-wrap { text-align: center; margin: 28px 0 8px; }
          .btn { display: inline-block; padding: 13px 32px; background-color: ${c.primary}; color: ${c.accent}; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 14px; letter-spacing: 0.3px; }
          .warning { background-color: ${c.warningBg}; border: 1px solid ${c.warningBorder}; border-left: 3px solid ${c.primary}; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: ${c.warningText}; margin-top: 24px; }
          .security { background-color: #111111; border: 1px solid #2a2a2a; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #666666; margin-top: 16px; }
          .footer { background-color: #0d0d0d; border: 1px solid #1a1a1a; border-top: none; border-radius: 0 0 10px 10px; padding: 20px 36px; text-align: center; }
          .footer p { color: #555555; font-size: 12px; line-height: 1.8; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              ${KRONUZ_LOGO_SVG}
              <h1>${shopName}</h1>
              <p>Redefinição de Senha</p>
            </div>
            <div class="content">
              <p class="greeting">Olá, <strong style="color:${c.primary}">${details.name}</strong>!</p>
              <p class="subtitle">Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha:</p>

              <div class="btn-wrap">
                <a href="${details.resetUrl}" class="btn">Redefinir senha →</a>
              </div>

              <div class="warning">
                ⏱️ Este link expira em <strong>1 hora</strong>. Após esse prazo, será necessário solicitar um novo link.
              </div>

              <div class="security">
                🔒 Se você não solicitou, ignore este email. Sua senha permanecerá a mesma.
              </div>
            </div>
            <div class="footer">
              <p>Este é um email automático, por favor não responda.</p>
              <p>&copy; ${new Date().getFullYear()} ${shopName}. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Redefinição de Senha — ${shopName}

Olá, ${details.name}!

Recebemos uma solicitação para redefinir a senha da sua conta.

Acesse o link abaixo para criar uma nova senha:
${details.resetUrl}

Este link expira em 1 hora.

Se você não solicitou, ignore este email. Sua senha permanecerá a mesma.

---
Este é um email automático, por favor não responda.
© ${new Date().getFullYear()} ${shopName}. Todos os direitos reservados.
  `;

  await sendEmail({
    to: email,
    subject: `Redefinição de senha — ${shopName}`,
    html,
    text,
  });
}
