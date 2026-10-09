import { ValidationError } from '../../../../shared/domain/domain-error';
import { Comunicado } from '../comunicado';
import { ComunicadoMedio, normalizarRutaArchivo, tipoMedioPorExtension } from '../comunicado-medio';
import { parsearUrlsVideo } from '../video-url';

describe('Dominio de Comunicados', () => {
  it('deduce el tipo de medio por extensión como el legado', () => {
    expect(tipoMedioPorExtension('a.MP4')).toBe('video');
    expect(tipoMedioPorExtension('a.webm')).toBe('video');
    expect(tipoMedioPorExtension('a.pdf')).toBe('pdf');
    expect(tipoMedioPorExtension('a.png')).toBe('imagen');
    expect(tipoMedioPorExtension('sin-extension')).toBe('imagen');
  });

  it('normaliza rutas heredadas `uploads/comunicados/x` a `comunicados/x`', () => {
    expect(normalizarRutaArchivo('uploads/comunicados/x.png')).toBe('comunicados/x.png');
    expect(normalizarRutaArchivo('/comunicados/x.png')).toBe('comunicados/x.png');
    expect(normalizarRutaArchivo('')).toBeNull();
  });

  it('parsea URLs de vídeo una por línea descartando inválidas', () => {
    expect(parsearUrlsVideo('https://a.co/1\r\n  \nhttp://b.co/2\nmailto:x@y.z\nabc')).toEqual([
      'https://a.co/1',
      'http://b.co/2',
    ]);
    expect(parsearUrlsVideo(null)).toEqual([]);
  });

  it('un medio exige archivo o URL', () => {
    expect(() => ComunicadoMedio.create({ tipo: 'imagen', archivo: null, url: null })).toThrow(ValidationError);
  });

  it('publicar fija publicado_at y el estado; quitar/agregar medios renumera el orden', () => {
    const now = new Date('2026-10-08T10:00:00Z');
    const c = Comunicado.create({
      titulo: 'T',
      contenido: 'C',
      createdAt: now,
      medios: [ComunicadoMedio.video('https://a.co/1').withIds(5, 1)],
    });
    expect(c.estaPublicado).toBe(false);
    const later = new Date('2026-10-08T11:00:00Z');
    const p = c.publicar(later);
    expect(p.props.publicadoAt).toEqual(later);
    expect(p.estaPublicado).toBe(true);
    const sinMedios = p.quitarMedios([5], later);
    expect(sinMedios.medios).toHaveLength(0);
    const con = sinMedios.agregarMedios(
      [ComunicadoMedio.video('https://a.co/2'), ComunicadoMedio.video('https://a.co/3')],
      later,
    );
    expect(con.medios.map((m) => m.props.orden)).toEqual([1, 2]);
  });

  it('rechaza títulos de más de 200 caracteres', () => {
    expect(() => Comunicado.create({ titulo: 'x'.repeat(201), contenido: 'C', createdAt: new Date() })).toThrow(
      ValidationError,
    );
  });
});
