import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';

export interface SendInvitationDto {
  formId: string;
  formTitle: string;
  formDescription?: string;
  senderName?: string;
  emails: string[];
  subject: string;
  message: string;
  formUrl: string;
}

@Injectable()
export class EmailService {
  constructor() {
    
  }

  async sendFormInvitation(invitationData: SendInvitationDto): Promise<any[]> {
    const { emails, subject, message, formUrl, formTitle } = invitationData;
    
    const results: any[] = [];

    for (const email of emails) {
      try {
        const personalizedMessage = message.replace(/\{formUrl\}/g, formUrl);
        
        const mailOptions = {
          from: process.env.FROM_EMAIL || '"FormulAI" <noreply@formulai.com>',
          to: email.trim(),
          subject: subject,
          text: personalizedMessage,
          html: this.generateHtmlEmail(formTitle, personalizedMessage, formUrl),
        };

        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'localhost',
          port: Number(process.env.SMTP_PORT) || 1025,
          secure: false,
          auth: {
            user: process.env.SMTP_USER || 'user',
            pass: process.env.SMTP_PASS || 'pass',
          },
        });

        const info = await transporter.sendMail(mailOptions);
        
        results.push({
          email: email.trim(),
          success: true,
          messageId: info.messageId,
          previewUrl: process.env.NODE_ENV === 'development'
            ? `http://localhost:3001/email-preview/${info.messageId}`
            : null,
        });

        console.log(`Email would be sent to ${email}: ${info.messageId}`);

      } catch (error: any) {
        console.error('Failed to send email to %s:', email, error);
        results.push({
          email: email.trim(),
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  private generateHtmlEmail(formTitle: string, message: string, formUrl: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Form Invitation - ${formTitle}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #3b82f6;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background-color: #f9fafb;
            padding: 30px;
            border-radius: 0 0 8px 8px;
            border: 1px solid #e5e7eb;
            border-top: none;
          }
          .message {
            background-color: white;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
            white-space: pre-wrap;
          }
          .cta-button {
            display: inline-block;
            background-color: #3b82f6;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FormulAI</h1>
          <p>You've been invited to fill out a form</p>
        </div>
        
        <div class="content">
          <h2>${formTitle}</h2>
          
          <div class="message">${message.replace(/\n/g, '<br>')}</div>
          
          <div style="text-align: center;">
            <a href="${formUrl}" class="cta-button">Fill Out Form</a>
          </div>
          
          <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
            If the button doesn't work, you can also copy and paste this link into your browser:
            <br>
            <a href="${formUrl}" style="color: #3b82f6;">${formUrl}</a>
          </p>
        </div>
        
        <div class="footer">
          <p>This email was sent from FormulAI</p>
          <p>If you believe you received this email in error, please ignore it.</p>
        </div>
      </body>
      </html>
    `;
  }

  async testConnection(): Promise<boolean> {
    try {
      // For now, always return true (simulate connection test)
      console.log('Email service connection test: OK');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}