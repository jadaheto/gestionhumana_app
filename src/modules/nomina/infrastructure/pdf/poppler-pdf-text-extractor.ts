import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PdfTextExtractor } from '../../application/ports/pdf-text-extractor.port';

const PDFTOTEXT = process.env.PDFTOTEXT_BIN ?? '/usr/bin/pdftotext';

/**
 * Extrae texto con `pdftotext` (poppler). Igual que el legado: primero con
 * `-layout`; si no produce texto, sin flags. Si el binario no existe devuelve
 * cadena vacía (el caso de uso traduce eso a un error legible).
 */
@Injectable()
export class PopplerPdfTextExtractor extends PdfTextExtractor {
  private readonly logger = new Logger(PopplerPdfTextExtractor.name);

  async extract(pdf: Buffer): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nomina-'));
    const file = path.join(dir, 'nomina.pdf');
    try {
      await fs.writeFile(file, pdf);
      const layout = await this.run(['-layout', file, '-']);
      if (layout.trim() !== '') return layout;
      return await this.run([file, '-']);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }

  private run(args: string[]): Promise<string> {
    return new Promise((resolve) => {
      execFile(PDFTOTEXT, args, { maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' }, (error, stdout) => {
        if (error) {
          this.logger.warn(`pdftotext falló: ${error.message}`);
          resolve('');
          return;
        }
        resolve(stdout ?? '');
      });
    });
  }
}
