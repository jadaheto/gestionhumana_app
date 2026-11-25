import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor, actorFullName } from '../../../../shared/domain/actor';
import { InvalidOperationError, NotFoundError, ValidationError } from '../../../../shared/domain/domain-error';
import { Certificado, MODOS_CERTIFICADO_LABORAL } from '../../domain/certificado';
import { anioDesprendible, ConceptosNomina } from '../../domain/desprendible';
import {
  CertificadoConfigReader,
  ContratoReader,
  ContratoResumen,
  PerfilColaboradorReader,
  ProrrogaResumen,
} from '../../domain/ports';
import { CertificadoRepository, DesprendibleRepository, FiltroTipoCertificado } from '../../domain/repositories';
import {
  ArchivoPdfDto,
  CertificadoDto,
  ContratosCertificablesDto,
  GenerarCertificadoIngresosInput,
  GenerarCertificadoLaboralInput,
} from '../dto/nomina.dto';
import {
  cedulaConPuntos,
  fechaDesdeDate,
  fechaExpedicionEnLetras,
  fechaLarga,
  marcaTiempoArchivo,
  pesos,
  pesosConSimbolo,
  pesosEnLetras,
  tipoContratoLegible,
} from '../formato';
import { PdfBlock, PdfDocumentSpec, PdfRenderer, PdfSegment } from '../ports/pdf-renderer.port';

/** Datos institucionales del membrete y el pie del certificado laboral. */
const ENTIDAD = {
  razonSocial: 'CAJA DE COMPENSACIÓN FAMILIAR DE SUCRE “COMFASUCRE”',
  nit: '892200015-5',
  ciudad: 'Sincelejo',
  vigilancia: 'Vigilado Supersubsidio  ·  Asocajas  ·  Fedecajas',
  pie: [
    ['Calle 28 # 25B - 50', 'Sincelejo, Sucre'],
    ['300 910 9720', '01 8000 938 810'],
    ['www.comfasucre.com.co', 'seccion.archivo@comfasucre.com.co'],
  ],
};

/** Tratamiento según el género registrado; sin dato se usa la forma neutra. */
function tratamiento(genero: string | null | undefined): { senor: string; identificado: string } {
  const g = (genero ?? '').trim().toLowerCase();
  if (g === 'masculino') return { senor: 'el señor', identificado: 'identificado' };
  if (g === 'femenino') return { senor: 'la señora', identificado: 'identificada' };
  return { senor: 'el(la) señor(a)', identificado: 'identificado(a)' };
}

interface ModalidadContrato {
  nombre: string;
  verboPresente: string;
  verboPasado: string;
  pagoVigente: string;
  pagoVencido: string;
}

/** Redacción según el tipo de contrato (un contratista no "labora" ni recibe "salario"). */
function modalidadContrato(tipo: string): ModalidadContrato {
  const laboral = (nombre: string): ModalidadContrato => ({
    nombre,
    verboPresente: 'labora en esta empresa',
    verboPasado: 'laboró en esta empresa',
    pagoVigente: 'una asignación salarial mensual',
    pagoVencido: 'una última asignación salarial mensual',
  });
  switch (tipo) {
    case 'indefinido':
      return laboral('Contrato Individual de Trabajo a término indefinido');
    case 'fijo':
    case 'termino_fijo':
      return laboral('Contrato Individual de Trabajo a término fijo');
    case 'obra_labor':
      return laboral('Contrato Individual de Trabajo por obra o labor');
    case 'aprendizaje':
      return {
        nombre: 'Contrato de Aprendizaje',
        verboPresente: 'se encuentra vinculado(a) a esta empresa',
        verboPasado: 'estuvo vinculado(a) a esta empresa',
        pagoVigente: 'un apoyo de sostenimiento mensual',
        pagoVencido: 'un último apoyo de sostenimiento mensual',
      };
    case 'prestacion_servicios':
      return {
        nombre: 'Contrato de Prestación de Servicios',
        verboPresente: 'presta sus servicios a esta empresa',
        verboPasado: 'prestó sus servicios a esta empresa',
        pagoVigente: 'unos honorarios mensuales',
        pagoVencido: 'unos últimos honorarios mensuales',
      };
    default:
      return laboral(`Contrato ${tipoContratoLegible(tipo)}`);
  }
}

function fraseProrroga(p: ProrrogaResumen): string {
  return `Prórroga por ${p.mesesProrroga} mes(es), desde el ${fechaLarga(p.fechaInicioProrroga)} hasta el ${fechaLarga(p.fechaFinNueva)}.`;
}

/** Párrafo justificado del cuerpo, con negritas puntuales (nombre y cargo). */
function parrafo(segments: PdfSegment[]): PdfBlock {
  return { type: 'paragraph', text: segments.map((s) => s.text).join(''), segments, align: 'justify', lineGap: 7 };
}

export function toCertificadoDto(c: Certificado): CertificadoDto {
  return { id: c.id, tipo: c.tipo, fechaGeneracion: c.fechaGeneracion, datos: c.datos, createdAt: c.createdAt };
}

@Injectable()
export class ListCertificadosUseCase implements UseCase<
  { actor: Actor; tipo?: FiltroTipoCertificado },
  CertificadoDto[]
> {
  constructor(private readonly certificados: CertificadoRepository) {}
  async execute({ actor, tipo }: { actor: Actor; tipo?: FiltroTipoCertificado }): Promise<CertificadoDto[]> {
    return (await this.certificados.findByUser(actor.id, tipo)).map(toCertificadoDto);
  }
}

/** Contrato actual y vencidos del actor (resumen contractual de la pantalla de certificado laboral). */
@Injectable()
export class GetContratosCertificablesUseCase implements UseCase<Actor, ContratosCertificablesDto> {
  constructor(private readonly contratos: ContratoReader) {}
  async execute(actor: Actor): Promise<ContratosCertificablesDto> {
    const [contratoActual, contratosVencidos] = await Promise.all([
      this.contratos.contratoActual(actor.id),
      this.contratos.contratosVencidos(actor.id),
    ]);
    return { contratoActual, contratosVencidos };
  }
}

/**
 * Certificación laboral en PDF (port de `MiPuesto::generar_certificado_laboral_pdf`).
 * Modos: `actual` (contrato vigente), `historico` (vigente + vencidos) y
 * `vencido` (un contrato vencido concreto). Con `incluirFunciones` se añaden
 * las funciones del cargo y el registro queda como `laboral_con_funciones`.
 */
@Injectable()
export class GenerarCertificadoLaboralUseCase implements UseCase<
  { actor: Actor; input: GenerarCertificadoLaboralInput },
  ArchivoPdfDto
> {
  constructor(
    private readonly perfiles: PerfilColaboradorReader,
    private readonly contratos: ContratoReader,
    private readonly certificados: CertificadoRepository,
    private readonly config: CertificadoConfigReader,
    private readonly pdf: PdfRenderer,
    private readonly clock: Clock,
  ) {}

  async execute({ actor, input }: { actor: Actor; input: GenerarCertificadoLaboralInput }): Promise<ArchivoPdfDto> {
    const modo = (MODOS_CERTIFICADO_LABORAL as readonly string[]).includes(input.modo) ? input.modo : 'actual';
    const perfil = await this.perfiles.getPerfil(actor.id);
    if (!perfil) throw new NotFoundError('Colaborador', actor.id);

    const hoy = this.clock.today();
    const contratos: ContratoResumen[] = [];
    if (modo === 'actual') {
      const c = await this.contratos.contratoActual(actor.id);
      if (c) contratos.push(c);
    } else if (modo === 'vencido') {
      if (!input.contratoId) throw new ValidationError('Debes seleccionar el contrato vencido a certificar.');
      const c = await this.contratos.contratoDeUsuario(input.contratoId, actor.id);
      if (c && c.fechaFin && c.fechaFin < hoy) contratos.push(c);
    } else {
      const actual = await this.contratos.contratoActual(actor.id);
      if (actual) contratos.push(actual);
      contratos.push(...(await this.contratos.contratosVencidos(actor.id)));
    }
    if (contratos.length === 0) {
      throw new InvalidOperationError('No se encontraron contratos para generar la certificación.');
    }

    const cfg = await this.config.get();
    const nombre = (`${perfil.firstName} ${perfil.lastName}`.trim() || actorFullName(actor)).toUpperCase();
    const cargo = (perfil.cargoNombre || 'Sin cargo').toUpperCase();
    const area = (perfil.areaNombre ?? '').trim();
    const trato = tratamiento(perfil.genero);
    const cedula = cedulaConPuntos(perfil.cedula);
    // Sin cédula registrada se omite la frase en lugar de dejar "No. ," en blanco.
    const identificacion = cedula ? `, ${trato.identificado} con cédula de ciudadanía No. ${cedula}, ` : ', ';

    const cuerpo: PdfBlock[] = [];
    if (contratos.length === 1) {
      // Un solo contrato: párrafo corrido, como el certificado que expide Gestión Humana.
      const c = contratos[0];
      const m = modalidadContrato(c.tipoContrato);
      const vigente = !c.fechaFin || c.fechaFin >= hoy;
      const periodo = `desde el día ${fechaLarga(c.fechaInicio)}${c.fechaFin ? ` hasta el día ${fechaLarga(c.fechaFin)}` : ''}`;
      const enArea = area ? `, en el área de ${area}` : '';
      cuerpo.push(
        parrafo([
          { text: `Que ${trato.senor} ` },
          { text: nombre, bold: true },
          { text: identificacion },
          {
            text: vigente
              ? `${m.verboPresente} mediante ${m.nombre} ${periodo}, actualmente desempeña el cargo de `
              : `${m.verboPasado} mediante ${m.nombre} ${periodo}, desempeñando el cargo de `,
          },
          { text: cargo, bold: true },
          {
            text: `${enArea}, con ${vigente ? m.pagoVigente : m.pagoVencido} de ${pesosEnLetras(c.salarioBase)}.`,
          },
        ]),
      );
      const prorrogas = await this.contratos.prorrogas(c.id);
      if (prorrogas.length > 0) {
        cuerpo.push(
          { type: 'paragraph', text: 'El contrato registra las siguientes prórrogas:', lineGap: 5 },
          { type: 'list', items: prorrogas.map(fraseProrroga) },
        );
      }
    } else {
      cuerpo.push(
        parrafo([
          { text: `Que ${trato.senor} ` },
          { text: nombre, bold: true },
          { text: `${identificacion}registra en esta empresa las siguientes vinculaciones, en el cargo de ` },
          { text: cargo, bold: true },
          { text: `${area ? `, en el área de ${area}` : ''}:` },
        ]),
      );
      const items: string[] = [];
      for (const c of contratos) {
        const m = modalidadContrato(c.tipoContrato);
        const vigente = !c.fechaFin || c.fechaFin >= hoy;
        const fin = c.fechaFin ? `hasta el ${fechaLarga(c.fechaFin)}` : 'a la fecha';
        items.push(
          `${m.nombre} desde el ${fechaLarga(c.fechaInicio)} ${fin}${vigente ? ' (vigente)' : ''}, con ${m.pagoVigente} de $${pesos(c.salarioBase)}.`,
        );
        // La sangría inicial indica al renderizador que es un subítem.
        for (const p of await this.contratos.prorrogas(c.id)) items.push(`    ${fraseProrroga(p)}`);
      }
      cuerpo.push({ type: 'list', items });
    }

    if (input.incluirFunciones) {
      const funciones = (perfil.cargoFunciones ?? '').trim();
      cuerpo.push({ type: 'paragraph', text: `Funciones del cargo de ${cargo}:`, bold: true });
      cuerpo.push(
        funciones !== ''
          ? {
              type: 'list',
              items: funciones
                .split(/\r?\n/)
                .map((f) => f.trim())
                .filter((f) => f !== ''),
            }
          : { type: 'paragraph', text: 'El cargo no tiene funciones registradas en el sistema.', muted: true },
      );
    }

    const ahora = this.clock.now();
    const blocks: PdfBlock[] = [
      { type: 'letterhead', logoPath: cfg.logoPath, text: ENTIDAD.vigilancia },
      { type: 'spacer', height: 26 },
      {
        type: 'paragraph',
        text: `LA ${cfg.jefeCargo.toUpperCase()} DE LA ${ENTIDAD.razonSocial}`,
        align: 'center',
        bold: true,
        size: 13,
        lineGap: 7,
      },
      { type: 'spacer', height: 12 },
      { type: 'paragraph', text: `NIT: ${ENTIDAD.nit}`, align: 'center', bold: true, size: 13 },
      { type: 'spacer', height: 22 },
      { type: 'paragraph', text: 'CERTIFICA', align: 'center', bold: true, size: 14 },
      { type: 'spacer', height: 22 },
      ...cuerpo,
      { type: 'spacer', height: 14 },
      {
        type: 'paragraph',
        text: `Se expide esta certificación a solicitud de la parte interesada en ${ENTIDAD.ciudad}, ${fechaExpedicionEnLetras(ahora)}.`,
        align: 'justify',
        lineGap: 5,
      },
      { type: 'spacer', height: 30 },
      {
        type: 'signature',
        imagePath: cfg.firmaPath,
        name: cfg.jefeNombre.toUpperCase(),
        lines: [cfg.jefeCargo, 'Comfasucre'],
      },
      { type: 'spacer', height: 16 },
      {
        type: 'paragraph',
        text: `Generado por el sistema de Gestión Humana el ${fechaDesdeDate(ahora)}.`,
        italic: true,
        muted: true,
        size: 8,
      },
    ];

    const spec: PdfDocumentSpec = {
      title: 'Certificado Laboral',
      author: 'Gestión Humana',
      margin: 62,
      blocks,
      footer: { columns: ENTIDAD.pie },
    };
    const content = await this.pdf.render(spec);

    await this.certificados.save({
      userId: actor.id,
      tipo: input.incluirFunciones ? 'laboral_con_funciones' : 'laboral_sin_funciones',
      fechaGeneracion: hoy,
      archivoPdf: null,
      generadoPor: actor.id,
      datos: { modo, contratos: contratos.map((c) => c.id), incluirFunciones: input.incluirFunciones },
    });

    return { filename: `Certificado_Laboral_${actor.id}_${marcaTiempoArchivo(this.clock.now())}.pdf`, content };
  }
}

/**
 * Certificado de ingresos y retenciones de un año gravable, construido a
 * partir de los desprendibles del colaborador (el legado sólo mostraba un
 * marcador de posición; esta es la implementación funcional).
 */
@Injectable()
export class GenerarCertificadoIngresosUseCase implements UseCase<
  { actor: Actor; input: GenerarCertificadoIngresosInput },
  ArchivoPdfDto
> {
  constructor(
    private readonly perfiles: PerfilColaboradorReader,
    private readonly desprendibles: DesprendibleRepository,
    private readonly certificados: CertificadoRepository,
    private readonly config: CertificadoConfigReader,
    private readonly pdf: PdfRenderer,
    private readonly clock: Clock,
  ) {}

  async execute({ actor, input }: { actor: Actor; input: GenerarCertificadoIngresosInput }): Promise<ArchivoPdfDto> {
    const anioActual = this.clock.now().getFullYear();
    if (!Number.isInteger(input.anio) || input.anio < 2000 || input.anio > anioActual) {
      throw new ValidationError(`El año gravable debe estar entre 2000 y ${anioActual}.`);
    }
    const perfil = await this.perfiles.getPerfil(actor.id);
    if (!perfil) throw new NotFoundError('Colaborador', actor.id);

    const del = (await this.desprendibles.findByUser(actor.id)).filter((d) => anioDesprendible(d) === input.anio);
    if (del.length === 0) {
      throw new InvalidOperationError(`No hay desprendibles de nómina registrados para el año ${input.anio}.`);
    }

    const devengados: ConceptosNomina = {};
    const deducciones: ConceptosNomina = {};
    let totalDevengado = 0;
    let totalDeducido = 0;
    for (const d of del) {
      for (const [k, v] of Object.entries(d.devengados)) devengados[k] = (devengados[k] ?? 0) + v;
      for (const [k, v] of Object.entries(d.deducciones)) deducciones[k] = (deducciones[k] ?? 0) + v;
      totalDevengado += d.totalDevengado;
      totalDeducido += d.totalDeducido;
    }
    const esRetencion = (k: string) => /retenci/i.test(k);
    const esSalud = (k: string) => /salud|eps/i.test(k);
    const esPension = (k: string) => /pensi|colpensiones|porvenir|proteccion|protección/i.test(k);
    const sumaSi = (m: ConceptosNomina, pred: (k: string) => boolean) =>
      Object.entries(m)
        .filter(([k]) => pred(k))
        .reduce((acc, [, v]) => acc + v, 0);
    const retencion = sumaSi(deducciones, esRetencion);
    const aportesSalud = sumaSi(deducciones, esSalud);
    const aportesPension = sumaSi(deducciones, (k) => esPension(k) && !esSalud(k));

    const cfg = await this.config.get();
    const nombre = `${perfil.firstName} ${perfil.lastName}`.trim() || actorFullName(actor);
    const blocks: PdfBlock[] = [];
    if (cfg.logoPath) blocks.push({ type: 'image', path: cfg.logoPath, height: 42, align: 'left' });
    blocks.push(
      { type: 'heading', text: 'CERTIFICADO DE INGRESOS Y RETENCIONES', level: 2, align: 'center' },
      { type: 'paragraph', text: `Año gravable ${input.anio}`, align: 'center', bold: true },
      { type: 'paragraph', text: 'CAJA DE COMPENSACIÓN FAMILIAR DE SUCRE "COMFASUCRE"', align: 'center' },
      { type: 'rule' },
      {
        type: 'keyValue',
        columns: 2,
        rows: [
          ['Nombre del empleado', nombre],
          ['Cédula', perfil.cedula ?? '-'],
          ['Cargo', perfil.cargoNombre ?? '-'],
          ['Área', perfil.areaNombre ?? '-'],
          ['Períodos certificados', String(del.length)],
          ['Fecha de expedición', fechaDesdeDate(this.clock.now())],
        ],
      },
      { type: 'spacer' },
      { type: 'heading', text: 'Ingresos', level: 3 },
      {
        type: 'table',
        columns: [
          { header: 'Concepto', width: 70 },
          { header: 'Valor', width: 30, align: 'right' },
        ],
        rows: [
          ...Object.entries(devengados).map(([k, v]) => [k, pesosConSimbolo(v)]),
          ['TOTAL INGRESOS', pesosConSimbolo(totalDevengado)],
        ],
        boldLastRow: true,
      },
      { type: 'spacer' },
      { type: 'heading', text: 'Deducciones y retenciones', level: 3 },
      {
        type: 'table',
        columns: [
          { header: 'Concepto', width: 70 },
          { header: 'Valor', width: 30, align: 'right' },
        ],
        rows: [
          ...Object.entries(deducciones).map(([k, v]) => [k, pesosConSimbolo(v)]),
          ['TOTAL DEDUCCIONES', pesosConSimbolo(totalDeducido)],
        ],
        boldLastRow: true,
      },
      { type: 'spacer' },
      {
        type: 'keyValue',
        columns: 1,
        rows: [
          ['Aportes obligatorios a salud', pesosConSimbolo(aportesSalud)],
          ['Aportes obligatorios a pensión', pesosConSimbolo(aportesPension)],
          ['Retención en la fuente practicada', pesosConSimbolo(retencion)],
          ['Neto pagado en el año', pesosConSimbolo(totalDevengado - totalDeducido)],
        ],
      },
      { type: 'spacer', height: 20 },
      {
        type: 'paragraph',
        text: 'Certificado generado a partir de los desprendibles de nómina registrados en el sistema de Gestión Humana.',
        muted: true,
        size: 9,
      },
    );
    if (cfg.firmaPath) blocks.push({ type: 'image', path: cfg.firmaPath, height: 60, align: 'left' });
    blocks.push(
      { type: 'paragraph', text: cfg.jefeNombre, bold: true },
      { type: 'paragraph', text: `${cfg.jefeCargo}\nComfasucre` },
    );

    const spec: PdfDocumentSpec = {
      title: 'Certificado de Ingresos y Retenciones',
      author: 'Gestión Humana',
      margin: 45,
      blocks,
    };
    const content = await this.pdf.render(spec);

    await this.certificados.save({
      userId: actor.id,
      tipo: 'ingresos_retenciones',
      fechaGeneracion: this.clock.today(),
      archivoPdf: null,
      generadoPor: actor.id,
      datos: {
        anio: input.anio,
        desprendibles: del.map((d) => d.id),
        totalDevengado,
        totalDeducido,
        retencion,
        aportesSalud,
        aportesPension,
      },
    });

    return {
      filename: `Certificado_Ingresos_${input.anio}_${actor.id}_${marcaTiempoArchivo(this.clock.now())}.pdf`,
      content,
    };
  }
}
