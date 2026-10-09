import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PasswordHasher } from '../../application/ports/password-hasher.port';

/**
 * Adaptador bcrypt. Compatible con los hashes `$2y$` generados por PHP
 * (`password_hash`) en el sistema legado, por lo que los usuarios existentes
 * pueden autenticarse sin restablecer contraseña.
 */
@Injectable()
export class BcryptPasswordHasher extends PasswordHasher {
  private readonly rounds = 10;

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    if (!hash) return Promise.resolve(false);
    return bcrypt.compare(plain, hash);
  }
}
