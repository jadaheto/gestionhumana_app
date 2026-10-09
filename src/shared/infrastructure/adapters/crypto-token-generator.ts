import { Injectable } from '@nestjs/common';
import { randomBytes, randomInt } from 'node:crypto';
import { TokenGenerator } from '../../application/ports/token-generator.port';

@Injectable()
export class CryptoTokenGenerator extends TokenGenerator {
  random(bytes = 32): string {
    return randomBytes(bytes).toString('hex');
  }

  /**
   * Replica `generate_temp_password` del sistema legado: evita caracteres
   * ambiguos (0/O, 1/l/I) y garantiza al menos un dígito y un símbolo.
   */
  temporaryPassword(length = 12): string {
    const len = Math.max(8, length);
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const symbols = '!@#$%*?';
    const chars: string[] = [];
    for (let i = 0; i < len - 2; i++) chars.push(alphabet[randomInt(0, alphabet.length)]);
    chars.push(String(randomInt(2, 10)));
    chars.push(symbols[randomInt(0, symbols.length)]);
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(0, i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }
}
