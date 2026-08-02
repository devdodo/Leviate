import { Global, Module } from '@nestjs/common';
import { EmailService } from './services/email.service';

/**
 * Provides `EmailService` exactly once for the whole app.
 *
 * It was previously listed in the `providers` array of every feature module
 * that used it, which made Nest instantiate one copy per module — so the
 * boot-time SMTP check ran once per instance, producing duplicate logs and
 * repeated failed logins against the mail host.
 */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
