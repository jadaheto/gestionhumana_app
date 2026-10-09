import { Clock } from '../application/ports/clock.port';
import { FileStorage, SaveFileOptions, StoredFile } from '../application/ports/file-storage.port';
import { Mailer, MailMessage } from '../application/ports/mailer.port';
import { PasswordHasher } from '../application/ports/password-hasher.port';
import { TokenGenerator } from '../application/ports/token-generator.port';
import { Actor } from '../domain/actor';

/** Reloj controlable para tests. */
export class FakeClock extends Clock {
  constructor(private current: Date = new Date('2026-10-08T10:00:00.000Z')) {
    super();
  }
  now(): Date {
    return new Date(this.current);
  }
  set(date: Date | string): void {
    this.current = new Date(date);
  }
  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}

/** Hasher determinista: `hash(x) = "hashed:" + x`. */
export class FakePasswordHasher extends PasswordHasher {
  hash(plain: string): Promise<string> {
    return Promise.resolve(`hashed:${plain}`);
  }
  compare(plain: string, hash: string): Promise<boolean> {
    return Promise.resolve(hash === `hashed:${plain}`);
  }
}

/** Buzón en memoria. */
export class FakeMailer extends Mailer {
  readonly sent: MailMessage[] = [];
  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
}

/** Tokens predecibles. */
export class FakeTokenGenerator extends TokenGenerator {
  constructor(private readonly value = 'token-fijo') {
    super();
  }
  random(): string {
    return this.value;
  }
  temporaryPassword(): string {
    return 'Temp1234!';
  }
}

/** Almacenamiento de archivos en memoria. */
export class InMemoryFileStorage extends FileStorage {
  readonly files = new Map<string, Buffer>();
  private counter = 0;

  save(content: Buffer, options: SaveFileOptions): Promise<StoredFile> {
    const ext = options.originalName.split('.').pop()?.toLowerCase() ?? '';
    if (options.allowedExtensions && !options.allowedExtensions.includes(ext)) {
      return Promise.reject(new Error(`Extensión no permitida: ${ext}`));
    }
    const filename = `file-${++this.counter}.${ext}`;
    const relativePath = `${options.folder}/${filename}`;
    this.files.set(relativePath, content);
    return Promise.resolve({ relativePath, filename, size: content.length, mimeType: options.mimeType });
  }
  delete(relativePath: string): Promise<void> {
    this.files.delete(relativePath);
    return Promise.resolve();
  }
  read(relativePath: string): Promise<Buffer> {
    const f = this.files.get(relativePath);
    return f ? Promise.resolve(f) : Promise.reject(new Error('not found'));
  }
  exists(relativePath: string): Promise<boolean> {
    return Promise.resolve(this.files.has(relativePath));
  }
  absolutePath(relativePath: string): string {
    return `/memory/${relativePath}`;
  }
}

export const adminActor: Actor = {
  id: 1,
  username: 'admin',
  role: 'admin',
  firstName: 'Administrador',
  lastName: 'Sistema',
  email: 'admin@comfasucre.com.co',
};

export const funcionarioActor: Actor = {
  id: 2,
  username: 'jperez',
  role: 'funcionario',
  firstName: 'Juan',
  lastName: 'Pérez',
  email: 'jperez@comfasucre.com.co',
};
