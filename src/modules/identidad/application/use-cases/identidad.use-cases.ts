import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { CAMPOS_IDENTIDAD, IdentidadRepository, validarHimnoUrl } from '../../domain/identidad';
import { IdentidadDto, SaveIdentidadInput } from '../dto/identidad.dto';

@Injectable()
export class GetIdentidadUseCase implements UseCase<void, IdentidadDto> {
  constructor(private readonly identidad: IdentidadRepository) {}

  async execute(): Promise<IdentidadDto> {
    const rows = await this.identidad.findAll();
    const dto = {
      mision: '',
      vision: '',
      historia: '',
      trayectoria: '',
      himno_url: '',
      updatedAt: null,
    } as IdentidadDto;
    let ultima: Date | null = null;
    for (const r of rows) {
      dto[r.campo] = r.contenido;
      if (r.updatedAt && (!ultima || r.updatedAt > ultima)) ultima = r.updatedAt;
    }
    dto.updatedAt = ultima ? ultima.toISOString() : null;
    return dto;
  }
}

/** Guarda sólo los campos enviados (como `Identidad::guardar`, que ignora los ausentes). */
@Injectable()
export class SaveIdentidadUseCase implements UseCase<SaveIdentidadInput, IdentidadDto> {
  constructor(
    private readonly identidad: IdentidadRepository,
    private readonly getIdentidad: GetIdentidadUseCase,
  ) {}

  async execute(input: SaveIdentidadInput): Promise<IdentidadDto> {
    for (const campo of CAMPOS_IDENTIDAD) {
      const valor = input[campo];
      if (valor === undefined || valor === null) continue;
      const contenido = campo === 'himno_url' ? validarHimnoUrl(valor) : valor.trim();
      await this.identidad.save(campo, contenido);
    }
    return this.getIdentidad.execute();
  }
}
