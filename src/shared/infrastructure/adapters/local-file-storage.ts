import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { AppConfig } from '../../../config/configuration';
import { ValidationError } from '../../domain/domain-error';
import { FileStorage, SaveFileOptions, StoredFile } from '../../application/ports/file-storage.port';

/** Almacena archivos en el sistema de archivos local bajo `UPLOADS_DIR`. */
@Injectable()
export class LocalFileStorage extends FileStorage {
  private readonly root: string;

  constructor(config: ConfigService<AppConfig, true>) {
    super();
    this.root = path.resolve(config.get('uploadsDir', { infer: true }));
  }

  async save(content: Buffer, options: SaveFileOptions): Promise<StoredFile> {
    const ext = path.extname(options.originalName).replace('.', '').toLowerCase();
    if (options.allowedExtensions && !options.allowedExtensions.includes(ext)) {
      throw new ValidationError(
        `Tipo de archivo no permitido (.${ext}). Permitidos: ${options.allowedExtensions.join(', ')}.`,
      );
    }
    if (options.maxBytes && content.length > options.maxBytes) {
      throw new ValidationError(
        `El archivo supera el tamaño máximo permitido (${Math.round(options.maxBytes / 1024)} KB).`,
      );
    }
    const safeFolder = options.folder.replace(/[^a-zA-Z0-9_\-/]/g, '');
    const filename = `${randomBytes(16).toString('hex')}${ext ? '.' + ext : ''}`;
    const dir = path.join(this.root, safeFolder);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), content);
    return {
      relativePath: path.posix.join(safeFolder, filename),
      filename,
      size: content.length,
      mimeType: options.mimeType,
    };
  }

  async delete(relativePath: string): Promise<void> {
    try {
      await fs.unlink(this.absolutePath(relativePath));
    } catch {
      /* ignorar archivos inexistentes */
    }
  }

  read(relativePath: string): Promise<Buffer> {
    return fs.readFile(this.absolutePath(relativePath));
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(this.absolutePath(relativePath));
      return true;
    } catch {
      return false;
    }
  }

  absolutePath(relativePath: string): string {
    const resolved = path.resolve(this.root, relativePath);
    if (!resolved.startsWith(this.root)) {
      throw new ValidationError('Ruta de archivo inválida.');
    }
    return resolved;
  }
}
