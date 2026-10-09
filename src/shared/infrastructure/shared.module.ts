import { Global, Module } from '@nestjs/common';
import { Clock } from '../application/ports/clock.port';
import { FileStorage } from '../application/ports/file-storage.port';
import { Mailer } from '../application/ports/mailer.port';
import { PasswordHasher } from '../application/ports/password-hasher.port';
import { TokenGenerator } from '../application/ports/token-generator.port';
import { BcryptPasswordHasher } from './adapters/bcrypt-password-hasher';
import { CryptoTokenGenerator } from './adapters/crypto-token-generator';
import { LocalFileStorage } from './adapters/local-file-storage';
import { NodemailerMailer } from './adapters/nodemailer-mailer';
import { SystemClock } from './adapters/system-clock';

/**
 * Módulo global con los adaptadores de los puertos transversales.
 * Los módulos de negocio inyectan los puertos abstractos (Clock, Mailer...)
 * y nunca los adaptadores concretos.
 */
@Global()
@Module({
  providers: [
    { provide: Clock, useClass: SystemClock },
    { provide: PasswordHasher, useClass: BcryptPasswordHasher },
    { provide: Mailer, useClass: NodemailerMailer },
    { provide: FileStorage, useClass: LocalFileStorage },
    { provide: TokenGenerator, useClass: CryptoTokenGenerator },
  ],
  exports: [Clock, PasswordHasher, Mailer, FileStorage, TokenGenerator],
})
export class SharedModule {}
