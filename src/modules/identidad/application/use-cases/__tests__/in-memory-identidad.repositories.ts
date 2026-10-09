import { AppSettingsRepository } from '../../../domain/app-settings.repository';
import { CAMPOS_IDENTIDAD, CampoIdentidad, IdentidadCampo, IdentidadRepository } from '../../../domain/identidad';

export class InMemoryIdentidadRepository extends IdentidadRepository {
  items: IdentidadCampo[] = CAMPOS_IDENTIDAD.map((campo, i) => ({
    campo,
    contenido: campo === 'himno_url' ? '' : `${campo} de Comfasucre`,
    tipo: campo === 'himno_url' ? 'video' : 'texto',
    orden: i + 1,
    updatedAt: null,
  }));
  findAll(): Promise<IdentidadCampo[]> {
    return Promise.resolve([...this.items]);
  }
  save(campo: CampoIdentidad, contenido: string): Promise<void> {
    this.items = this.items.map((i) =>
      i.campo === campo ? { ...i, contenido, updatedAt: new Date('2026-10-08T10:00:00Z') } : i,
    );
    return Promise.resolve();
  }
}

export class InMemoryAppSettingsRepository extends AppSettingsRepository {
  readonly values = new Map<string, string>();
  get(key: string, defaultValue: string): Promise<string> {
    const v = this.values.get(key);
    return Promise.resolve(v === undefined || v === '' ? defaultValue : v);
  }
  set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }
  getMany(keys: string[]): Promise<Record<string, string | null>> {
    return Promise.resolve(Object.fromEntries(keys.map((k) => [k, this.values.get(k) || null])));
  }
}
