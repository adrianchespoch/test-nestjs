export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  template?: 'verify-email' | 'password-reset';
  variables?: Record<string, string>;
}

export interface IEmailSender {
  send(input: SendEmailInput): Promise<void>;
}

export const EMAIL_SENDER = Symbol('IEmailSender');
