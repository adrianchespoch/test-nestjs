import { Injectable, Logger } from '@nestjs/common';
import type { IEmailSender, SendEmailInput } from '../../domain/ports/email-sender.port';

/**
 * Mailer no-op para dev: solo loggea. En prod sustituir por NodemailerAdapter o SES.
 */
@Injectable()
export class ConsoleMailer implements IEmailSender {
  private readonly logger = new Logger(ConsoleMailer.name);

  send(input: SendEmailInput): Promise<void> {
    this.logger.log(
      {
        to: input.to,
        subject: input.subject,
        template: input.template,
        variables: input.variables,
      },
      `[mailer] (dev) ${input.subject} → ${input.to}`,
    );
    return Promise.resolve();
  }
}
