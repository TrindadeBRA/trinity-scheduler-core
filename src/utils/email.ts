import nodemailer from 'nodemailer';
import { env } from '../config/env';

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

// Verify connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP connection error:', error);
  } else {
    console.log('SMTP server is ready to send emails');
  }
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email using configured SMTP transport
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    console.log(`Email sent successfully to ${options.to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

/**
 * Send appointment confirmation email
 */
export async function sendAppointmentConfirmation(
  clientEmail: string,
  appointmentDetails: {
    clientName: string;
    serviceName: string;
    professionalName: string;
    date: string;
    time: string;
    shopName: string;
    unitAddress?: string;
  }
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 30px; }
          .details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { margin: 10px 0; }
          .label { font-weight: bold; color: #4F46E5; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Agendamento Confirmado!</h1>
          </div>
          <div class="content">
            <p>Olá, ${appointmentDetails.clientName}!</p>
            <p>Seu agendamento foi confirmado com sucesso. Confira os detalhes abaixo:</p>
            
            <div class="details">
              <div class="detail-row">
                <span class="label">Serviço:</span> ${appointmentDetails.serviceName}
              </div>
              <div class="detail-row">
                <span class="label">Profissional:</span> ${appointmentDetails.professionalName}
              </div>
              <div class="detail-row">
                <span class="label">Data:</span> ${appointmentDetails.date}
              </div>
              <div class="detail-row">
                <span class="label">Horário:</span> ${appointmentDetails.time}
              </div>
              <div class="detail-row">
                <span class="label">Local:</span> ${appointmentDetails.shopName}
              </div>
              ${appointmentDetails.unitAddress ? `
              <div class="detail-row">
                <span class="label">Endereço:</span> ${appointmentDetails.unitAddress}
              </div>
              ` : ''}
            </div>
            
            <p>Aguardamos você!</p>
          </div>
          <div class="footer">
            <p>Este é um email automático, por favor não responda.</p>
            <p>&copy; ${new Date().getFullYear()} ${appointmentDetails.shopName}. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Agendamento Confirmado!

Olá, ${appointmentDetails.clientName}!

Seu agendamento foi confirmado com sucesso. Confira os detalhes abaixo:

Serviço: ${appointmentDetails.serviceName}
Profissional: ${appointmentDetails.professionalName}
Data: ${appointmentDetails.date}
Horário: ${appointmentDetails.time}
Local: ${appointmentDetails.shopName}
${appointmentDetails.unitAddress ? `Endereço: ${appointmentDetails.unitAddress}` : ''}

Aguardamos você!

---
Este é um email automático, por favor não responda.
© ${new Date().getFullYear()} ${appointmentDetails.shopName}. Todos os direitos reservados.
  `;

  await sendEmail({
    to: clientEmail,
    subject: `Agendamento Confirmado - ${appointmentDetails.shopName}`,
    html,
    text,
  });
}

/**
 * Send appointment cancellation email
 */
export async function sendAppointmentCancellation(
  clientEmail: string,
  appointmentDetails: {
    clientName: string;
    serviceName: string;
    date: string;
    time: string;
    shopName: string;
    reason?: string;
  }
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #EF4444; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 30px; }
          .details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { margin: 10px 0; }
          .label { font-weight: bold; color: #EF4444; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Agendamento Cancelado</h1>
          </div>
          <div class="content">
            <p>Olá, ${appointmentDetails.clientName}!</p>
            <p>Seu agendamento foi cancelado. Confira os detalhes abaixo:</p>
            
            <div class="details">
              <div class="detail-row">
                <span class="label">Serviço:</span> ${appointmentDetails.serviceName}
              </div>
              <div class="detail-row">
                <span class="label">Data:</span> ${appointmentDetails.date}
              </div>
              <div class="detail-row">
                <span class="label">Horário:</span> ${appointmentDetails.time}
              </div>
              ${appointmentDetails.reason ? `
              <div class="detail-row">
                <span class="label">Motivo:</span> ${appointmentDetails.reason}
              </div>
              ` : ''}
            </div>
            
            <p>Esperamos vê-lo em breve! Você pode fazer um novo agendamento a qualquer momento.</p>
          </div>
          <div class="footer">
            <p>Este é um email automático, por favor não responda.</p>
            <p>&copy; ${new Date().getFullYear()} ${appointmentDetails.shopName}. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Agendamento Cancelado

Olá, ${appointmentDetails.clientName}!

Seu agendamento foi cancelado. Confira os detalhes abaixo:

Serviço: ${appointmentDetails.serviceName}
Data: ${appointmentDetails.date}
Horário: ${appointmentDetails.time}
${appointmentDetails.reason ? `Motivo: ${appointmentDetails.reason}` : ''}

Esperamos vê-lo em breve! Você pode fazer um novo agendamento a qualquer momento.

---
Este é um email automático, por favor não responda.
© ${new Date().getFullYear()} ${appointmentDetails.shopName}. Todos os direitos reservados.
  `;

  await sendEmail({
    to: clientEmail,
    subject: `Agendamento Cancelado - ${appointmentDetails.shopName}`,
    html,
    text,
  });
}

/**
 * Send appointment reminder email
 */
export async function sendAppointmentReminder(
  clientEmail: string,
  appointmentDetails: {
    clientName: string;
    serviceName: string;
    professionalName: string;
    date: string;
    time: string;
    shopName: string;
    unitAddress?: string;
  }
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #F59E0B; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 30px; }
          .details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { margin: 10px 0; }
          .label { font-weight: bold; color: #F59E0B; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Lembrete de Agendamento</h1>
          </div>
          <div class="content">
            <p>Olá, ${appointmentDetails.clientName}!</p>
            <p>Este é um lembrete do seu agendamento:</p>
            
            <div class="details">
              <div class="detail-row">
                <span class="label">Serviço:</span> ${appointmentDetails.serviceName}
              </div>
              <div class="detail-row">
                <span class="label">Profissional:</span> ${appointmentDetails.professionalName}
              </div>
              <div class="detail-row">
                <span class="label">Data:</span> ${appointmentDetails.date}
              </div>
              <div class="detail-row">
                <span class="label">Horário:</span> ${appointmentDetails.time}
              </div>
              <div class="detail-row">
                <span class="label">Local:</span> ${appointmentDetails.shopName}
              </div>
              ${appointmentDetails.unitAddress ? `
              <div class="detail-row">
                <span class="label">Endereço:</span> ${appointmentDetails.unitAddress}
              </div>
              ` : ''}
            </div>
            
            <p>Aguardamos você!</p>
          </div>
          <div class="footer">
            <p>Este é um email automático, por favor não responda.</p>
            <p>&copy; ${new Date().getFullYear()} ${appointmentDetails.shopName}. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Lembrete de Agendamento

Olá, ${appointmentDetails.clientName}!

Este é um lembrete do seu agendamento:

Serviço: ${appointmentDetails.serviceName}
Profissional: ${appointmentDetails.professionalName}
Data: ${appointmentDetails.date}
Horário: ${appointmentDetails.time}
Local: ${appointmentDetails.shopName}
${appointmentDetails.unitAddress ? `Endereço: ${appointmentDetails.unitAddress}` : ''}

Aguardamos você!

---
Este é um email automático, por favor não responda.
© ${new Date().getFullYear()} ${appointmentDetails.shopName}. Todos os direitos reservados.
  `;

  await sendEmail({
    to: clientEmail,
    subject: `Lembrete: Agendamento em ${appointmentDetails.shopName}`,
    html,
    text,
  });
}

export default transporter;
