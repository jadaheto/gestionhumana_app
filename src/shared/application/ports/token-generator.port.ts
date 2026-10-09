export abstract class TokenGenerator {
  /** Token hexadecimal aleatorio de `bytes` bytes. */
  abstract random(bytes?: number): string;
  /** Contraseña temporal legible (sin caracteres ambiguos). */
  abstract temporaryPassword(length?: number): string;
}
