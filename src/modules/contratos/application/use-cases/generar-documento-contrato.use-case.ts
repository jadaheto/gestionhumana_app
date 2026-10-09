import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { FileStorage } from '../../../../shared/application/ports/file-storage.port';
import { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError, ValidationError } from '../../../../shared/domain/domain-error';
import { fechaLargaEs, ordinalTexto, sumar } from '../../domain/fechas';
import { BrandingPort } from '../../domain/ports';
import { ContratoConColaborador, ContratoRepository } from '../../domain/repositories';
import { ContratoDocumentRenderer, DocumentoContrato } from '../contrato-document-renderer.port';
import { DocumentoGeneradoDto, GenerarDocumentoInput, TIPOS_DOCUMENTO, TipoDocumento } from '../dto/contratos.dto';
import { nombreCompleto } from './mappers';

/** Carpeta de uploads donde el legado guardaba las firmas (`uploads/documentos/`). */
export const CARPETA_FIRMAS = 'documentos';
export const FIRMA_MAX_BYTES = 5 * 1024 * 1024;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CABECERA_DERECHA = 'Vigilado Supersubsidio | Asocajas | Fedecajas';

interface OpcionesNormalizadas {
  tipo: TipoDocumento;
  meses: number;
  numero: number;
  anios: number;
  codigo: string;
  firmanteNombre: string;
  firmanteCargo: string;
  revisoUno: string;
  revisoDos: string;
  proyecto: string;
}

/** Valores por defecto de los pasos 1 y 2 del legado. */
export function normalizarOpciones(input: GenerarDocumentoInput): OpcionesNormalizadas {
  const tipo = (TIPOS_DOCUMENTO as readonly string[]).includes(input.tipo) ? (input.tipo as TipoDocumento) : 'preaviso';
  const positivo = (v: number | null | undefined, def: number) =>
    Number.isInteger(v) && (v as number) > 0 ? (v as number) : def;
  const texto = (v: string | null | undefined, def: string) => ((v ?? '').trim() === '' ? def : (v as string).trim());
  return {
    tipo,
    meses: positivo(input.meses, 3),
    numero: positivo(input.numero, 1),
    anios: positivo(input.anios, 1),
    codigo: texto(input.codigo, tipo === 'preaviso' ? 'G.H.3.1.' : 'D.A.3'),
    firmanteNombre: texto(input.firmanteNombre, 'DIRECTORA ADMINISTRATIVA'),
    firmanteCargo: texto(input.firmanteCargo, 'Comfasucre'),
    revisoUno: texto(input.revisoUno, 'Jefe Departamento'),
    revisoDos: texto(input.revisoDos, 'Revisó Jurídica'),
    proyecto: texto(input.proyecto, 'Talento Humano'),
  };
}

export function esPng(buffer: Buffer): boolean {
  return buffer.length > PNG_MAGIC.length && buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC);
}

/**
 * `documento_generar` / `documento_preaviso` / `documento_prorroga` /
 * `documento_renovacion`: construye el contenido de la carta (mismo texto que
 * `build_*_html`) y lo renderiza como PDF. La firma PNG se valida
 * (`procesar_firma_png`), se guarda en `uploads/documentos` y se incrusta.
 */
@Injectable()
export class GenerarDocumentoContratoUseCase implements UseCase<GenerarDocumentoInput, DocumentoGeneradoDto> {
  constructor(
    private readonly contratos: ContratoRepository,
    private readonly renderer: ContratoDocumentRenderer,
    private readonly branding: BrandingPort,
    private readonly files: FileStorage,
    private readonly clock: Clock,
  ) {}

  async execute(input: GenerarDocumentoInput): Promise<DocumentoGeneradoDto> {
    const row = await this.contratos.findByIdConColaborador(input.contratoId);
    if (!row) throw new NotFoundError('Contrato', input.contratoId);
    const opts = normalizarOpciones(input);
    const firma = await this.procesarFirmaPng(input.firmaPng ?? null, input.firmaPngNombre ?? null);
    const logo = await this.branding.logoOscuro();

    const documento =
      opts.tipo === 'preaviso'
        ? this.buildPreaviso(row, opts, firma, logo)
        : opts.tipo === 'prorroga'
          ? this.buildProrroga(row, opts, firma, logo)
          : this.buildRenovacion(row, opts, firma, logo);

    const prefijo = {
      preaviso: 'Preaviso_Terminacion',
      prorroga: 'Prorroga_Contrato',
      renovacion: 'Renovacion_Contrato',
    }[opts.tipo];
    return {
      filename: `${prefijo}_${input.contratoId}.pdf`,
      mimeType: 'application/pdf',
      contenido: await this.renderer.render(documento),
    };
  }

  /** `procesar_firma_png`: solo PNG, máximo 5 MB; se conserva una copia en uploads. */
  private async procesarFirmaPng(buffer: Buffer | null, nombre: string | null): Promise<Buffer | null> {
    if (!buffer || buffer.length === 0) return null;
    if (buffer.length > FIRMA_MAX_BYTES) throw new ValidationError('La imagen de firma supera el máximo de 5 MB.');
    if (!esPng(buffer)) throw new ValidationError('La imagen de firma debe ser un archivo PNG.');
    await this.files.save(buffer, {
      folder: CARPETA_FIRMAS,
      originalName: nombre && nombre.toLowerCase().endsWith('.png') ? nombre : 'firma.png',
      mimeType: 'image/png',
      allowedExtensions: ['png'],
      maxBytes: FIRMA_MAX_BYTES,
    });
    return buffer;
  }

  private base(row: ContratoConColaborador, opts: OpcionesNormalizadas, firma: Buffer | null, logo: Buffer | null) {
    const { colaborador } = row;
    return {
      codigo: opts.codigo,
      cabeceraDerecha: CABECERA_DERECHA,
      logo,
      lugarYFecha: `Sincelejo, ${fechaLargaEs(this.clock.today())}`,
      destinatario: {
        nombre: nombreCompleto(colaborador).toUpperCase(),
        cargoArea: `${colaborador.cargoNombre ?? 'Cargo no definido'} - ${colaborador.areaNombre ?? 'Área no definida'}`,
        empresa: 'Comfasucre',
      },
      saludo: 'Cordial saludo:',
      despedida: 'Atentamente,',
      firma: { imagenPng: firma, nombre: opts.firmanteNombre, cargo: opts.firmanteCargo },
    };
  }

  private buildPreaviso(
    row: ContratoConColaborador,
    opts: OpcionesNormalizadas,
    firma: Buffer | null,
    logo: Buffer | null,
  ): DocumentoContrato {
    const fin = row.contrato.props.fechaFin;
    const fechaFin = (fin ? fechaLargaEs(fin) : 'SIN FECHA DEFINIDA').toUpperCase();
    return {
      ...this.base(row, opts, firma, logo),
      asunto: `ASUNTO: PREAVISO DE TERMINACIÓN DEL CONTRATO INDIVIDUAL DE TRABAJO A TÉRMINO FIJO, CON FECHA DE VENCIMIENTO EL ${fechaFin}.`,
      parrafos: [
        {
          texto:
            `Con el presente nos permitimos comunicarle que el contrato individual de trabajo a término fijo, cuya fecha de vencimiento es el día **${fechaFin}**, ` +
            'no será renovado; es decir, la empresa lo da por terminado por expiración del plazo fijo pactado (literal C, artículo 61 del Código Sustantivo de Trabajo).',
        },
        {
          texto:
            'Agradecemos a usted los servicios prestados a la empresa; si se requiere nuevamente de sus servicios, se le informará oportunamente para que se presente a laborar en la fecha que se estipule.',
        },
        {
          texto:
            'Favor entregar en el área de Gestión Humana el carnet que lo acredita como trabajador de la empresa y acercarse al área de Tesorería para el pago de la liquidación de sus prestaciones sociales.',
        },
      ],
      revisores: [],
      pie: ['Copia: hoja de vida, jefe inmediato.', `Proyectó: ${opts.proyecto}.`],
    };
  }

  private buildProrroga(
    row: ContratoConColaborador,
    opts: OpcionesNormalizadas,
    firma: Buffer | null,
    logo: Buffer | null,
  ): DocumentoContrato {
    const baseFin = row.contrato.props.fechaFin ?? this.clock.today();
    const inicio = sumar(baseFin, { dias: 1 });
    const fin = sumar(inicio, { meses: opts.meses, dias: -1 });
    const area = (row.colaborador.areaNombre ?? 'EL ÁREA ASIGNADA').toUpperCase();
    const numero = String(opts.numero).padStart(2, '0');
    return {
      ...this.base(row, opts, firma, logo),
      asunto: 'Ref. PRÓRROGA DE CONTRATO',
      parrafos: [
        {
          texto:
            `Con el presente le informamos que la empresa ha decidido, por necesidad de sus servicios en el área de **${area}**, ` +
            `prorrogar su contrato individual de trabajo a término fijo suscrito con usted y que tiene fecha de terminación el **${fechaLargaEs(baseFin).toUpperCase()}**.`,
        },
        {
          texto:
            `Por consiguiente, esta prórroga tendrá una duración de **${opts.meses} MES${opts.meses > 1 ? 'ES' : ''}**, contados a partir del **${fechaLargaEs(inicio).toUpperCase()}** ` +
            `hasta el **${fechaLargaEs(fin).toUpperCase()}**, en las mismas condiciones y con la misma asignación salarial mensual que viene devengando.`,
        },
        {
          texto: `Por ser esta la **${ordinalTexto(opts.numero)} (${numero}) prórroga** que tiene el presente contrato de trabajo, se da cumplimiento a lo previsto en el artículo 46 del C. S. del T.`,
        },
      ],
      revisores: [opts.revisoUno, opts.revisoDos],
      pie: [`Proyectó: ${opts.proyecto}.`],
    };
  }

  private buildRenovacion(
    row: ContratoConColaborador,
    opts: OpcionesNormalizadas,
    firma: Buffer | null,
    logo: Buffer | null,
  ): DocumentoContrato {
    const baseFin = row.contrato.props.fechaFin ?? this.clock.today();
    const inicio = sumar(baseFin, { dias: 1 });
    const fin = sumar(inicio, { anios: opts.anios, dias: -1 });
    const area = (row.colaborador.areaNombre ?? 'EL ÁREA ASIGNADA').toUpperCase();
    return {
      ...this.base(row, opts, firma, logo),
      asunto: 'Ref. RENOVACIÓN DE CONTRATO',
      parrafos: [
        {
          texto:
            `Con el presente le informamos que la empresa ha decidido, por necesidad de sus servicios en el área de **${area}**, ` +
            `renovar su contrato individual de trabajo a término fijo y que tiene fecha de terminación el **${fechaLargaEs(baseFin).toUpperCase()}**.`,
        },
        {
          texto:
            `Por consiguiente, esta renovación tendrá una duración de **${opts.anios} AÑO${opts.anios > 1 ? 'S' : ''}**, contados a partir del **${fechaLargaEs(inicio).toUpperCase()}** ` +
            `hasta el **${fechaLargaEs(fin).toUpperCase()}**, en las mismas condiciones y con la misma asignación salarial mensual que viene devengando.`,
        },
        {
          texto:
            'De conformidad con el artículo 46 del Código Sustantivo del Trabajo y normas concordantes, la presente renovación se realiza por el término indicado.',
        },
      ],
      revisores: [opts.revisoUno, opts.revisoDos],
      pie: [`Proyectó: ${opts.proyecto}.`],
    };
  }
}
