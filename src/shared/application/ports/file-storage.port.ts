export interface StoredFile {
  /** Ruta relativa al directorio de uploads, p. ej. `profile/abc.png`. */
  relativePath: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface SaveFileOptions {
  folder: string;
  originalName: string;
  mimeType: string;
  /** Extensiones permitidas sin punto, en minúsculas. */
  allowedExtensions?: string[];
  maxBytes?: number;
}

export abstract class FileStorage {
  abstract save(content: Buffer, options: SaveFileOptions): Promise<StoredFile>;
  abstract delete(relativePath: string): Promise<void>;
  abstract read(relativePath: string): Promise<Buffer>;
  abstract exists(relativePath: string): Promise<boolean>;
  abstract absolutePath(relativePath: string): string;
}
