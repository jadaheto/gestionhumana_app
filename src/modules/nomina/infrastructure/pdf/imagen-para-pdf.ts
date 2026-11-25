import { Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const logger = new Logger('ImagenParaPdf');
/** Lado máximo de la copia: de sobra para imprimir una firma o un logo. */
const LADO_MAXIMO = 1600;

/**
 * Devuelve la ruta de una copia PNG estándar de la imagen, apta para pdfkit.
 * pdfkit sólo entiende PNG y JPEG "de verdad": una firma en WebP, AVIF, GIF o
 * SVG (aunque el archivo se llame `.png`) lanzaba error y quedaba en blanco.
 * La copia se guarda en el directorio temporal y se reutiliza mientras el
 * original no cambie. Si no se puede convertir se devuelve null.
 */
export async function imagenParaPdf(ruta: string | null): Promise<string | null> {
  if (!ruta) return null;
  try {
    const info = await fs.stat(ruta);
    const huella = createHash('sha1').update(`${ruta}|${info.size}|${info.mtimeMs}`).digest('hex');
    const destino = join(tmpdir(), `gh-pdf-${huella}.png`);
    try {
      await fs.access(destino);
      return destino;
    } catch {
      /* aún no existe la copia: se genera */
    }
    const png = await sharp(ruta, { density: 300 })
      .rotate()
      .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    // Escritura atómica: dos certificados simultáneos no deben leer un archivo a medias.
    const parcial = `${destino}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(parcial, png);
    await fs.rename(parcial, destino);
    return destino;
  } catch (e) {
    logger.warn(`No se pudo preparar la imagen ${ruta} para el PDF: ${(e as Error).message}`);
    return null;
  }
}
