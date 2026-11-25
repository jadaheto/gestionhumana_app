import { Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const logger = new Logger('ImagenParaPdf');
/** Lado máximo de la copia: de sobra para imprimir una firma o un logo. */
const LADO_MAXIMO = 1600;

/** Cambiar al modificar el tratamiento, para no reutilizar copias antiguas. */
const VERSION = 'v4';
/** Cuánto se oscurecen los grises de la firma (2 = el doble de tinta). */
const REFUERZO_TINTA = 2;

/** Firma como trazo oscuro sobre blanco opaco, recortada a su contenido. */
async function comoTinta(imagen: sharp.Sharp): Promise<Buffer> {
  // `raw` siempre entrega 8 bits por canal: evita PNG de 16 bits o con alfa que pdfkit pinta mal.
  const { data, info } = await imagen
    .flatten({ background: '#ffffff' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // Contraste a mano: `normalise` usa percentiles y una firma ocupa tan pocos
  // píxeles que no la detecta. El tono más oscuro pasa a negro y los grises
  // intermedios se oscurecen el doble, para que los trazos finos no queden pálidos.
  let minimo = 255;
  for (const v of data) if (v < minimo) minimo = v;
  const rango = 255 - minimo;
  if (rango > 0) {
    for (let i = 0; i < data.length; i++) {
      const tinta = ((255 - data[i]) * 255 * REFUERZO_TINTA) / rango;
      const valor = Math.max(0, Math.round(255 - tinta));
      // El casi blanco se lleva a blanco puro para que no se note el recuadro de la imagen al imprimir.
      data[i] = valor > 244 ? 255 : valor;
    }
  }
  const gris = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  try {
    return await gris.clone().trim({ background: '#ffffff', threshold: 40 }).png().toBuffer();
  } catch {
    // Imagen en blanco o imposible de recortar: se usa completa.
    return gris.png().toBuffer();
  }
}

/**
 * Devuelve la ruta de una copia PNG estándar de la imagen, apta para pdfkit.
 * pdfkit sólo entiende PNG y JPEG "de verdad": una firma en WebP, AVIF, GIF o
 * SVG (aunque el archivo se llame `.png`) lanzaba error y quedaba en blanco.
 * La copia se guarda en el directorio temporal y se reutiliza mientras el
 * original no cambie. Si no se puede convertir se devuelve null.
 *
 * El modo `tinta` es para firmas: las deja como trazo oscuro sobre blanco
 * opaco (sin canal alfa, 8 bits), con el contraste al máximo y sin márgenes
 * vacíos. Las firmas con transparencia salían pálidas o sólo con el contorno.
 */
export async function imagenParaPdf(ruta: string | null, modo: 'color' | 'tinta' = 'color'): Promise<string | null> {
  if (!ruta) return null;
  try {
    const info = await fs.stat(ruta);
    const huella = createHash('sha1').update(`${VERSION}|${modo}|${ruta}|${info.size}|${info.mtimeMs}`).digest('hex');
    const destino = join(tmpdir(), `gh-pdf-${huella}.png`);
    try {
      await fs.access(destino);
      return destino;
    } catch {
      /* aún no existe la copia: se genera */
    }
    const base = sharp(ruta, { density: 300 })
      .rotate()
      .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside', withoutEnlargement: true });
    const png = modo === 'tinta' ? await comoTinta(base) : await base.png().toBuffer();
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
