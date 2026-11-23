import { Colaborador } from '../../../domain/colaborador';
import {
  ColaboradorConNombres,
  ColaboradorFilters,
  ColaboradorRepository,
} from '../../../domain/colaborador.repository';
import {
  DatosBasicos,
  DatosBasicosProps,
  DatosBasicosRepository,
  EducacionFormal,
  EducacionFormalRepository,
  EducacionNoFormal,
  EducacionNoFormalRepository,
  ExperienciaLaboral,
  ExperienciaLaboralRepository,
  Familiar,
  FamiliarRepository,
  OwnedRecord,
  OwnedRecordRepository,
} from '../../../domain/info-personal';
import {
  ExperienceItem,
  Perfil,
  PerfilDatos,
  PerfilPortafolio,
  PerfilRepository,
  PrivacySettings,
} from '../../../domain/perfil';
import {
  BrandingReader,
  ContratoActivo,
  ContratoActivoReader,
  LoginHistoryItem,
  LoginHistoryReader,
} from '../../../domain/ports';

export class InMemoryColaboradorRepository extends ColaboradorRepository {
  items: Colaborador[] = [];
  passwords = new Map<number, string>();
  nombres: Record<number, Partial<Omit<ColaboradorConNombres, 'colaborador'>>> = {};
  private seq = 1;

  seed(c: Colaborador, passwordHash = 'hashed:secreta1'): Colaborador {
    const saved = c.withId(c.id ?? this.seq++);
    this.items.push(saved);
    this.passwords.set(saved.id as number, passwordHash);
    return saved;
  }

  private withNames(c: Colaborador): ColaboradorConNombres {
    const n = this.nombres[c.id as number] ?? {};
    return {
      colaborador: c,
      sedeNombre: n.sedeNombre ?? null,
      areaNombre: n.areaNombre ?? null,
      cargoNombre: n.cargoNombre ?? null,
      cargoFunciones: n.cargoFunciones ?? null,
    };
  }
  findAll(filters: ColaboradorFilters): Promise<ColaboradorConNombres[]> {
    return Promise.resolve(
      this.items
        .filter((c) => !c.isAdmin)
        .filter((c) => !filters.estado || c.props.estadoColaborador === filters.estado)
        .filter((c) => !filters.areaId || c.props.areaId === filters.areaId)
        .filter((c) => !filters.sedeId || c.props.sedeId === filters.sedeId)
        .sort((a, b) => a.props.firstName.localeCompare(b.props.firstName))
        .map((c) => this.withNames(c)),
    );
  }
  findById(id: number): Promise<Colaborador | null> {
    return Promise.resolve(this.items.find((c) => c.id === id) ?? null);
  }
  findDetalle(id: number): Promise<ColaboradorConNombres | null> {
    const c = this.items.find((x) => x.id === id);
    return Promise.resolve(c ? this.withNames(c) : null);
  }
  existsUsername(username: string): Promise<boolean> {
    return Promise.resolve(this.items.some((c) => c.props.username === username));
  }
  existsEmail(email: string, excludeId?: number): Promise<boolean> {
    return Promise.resolve(
      this.items.some((c) => c.id !== excludeId && c.props.email.toLowerCase() === email.toLowerCase()),
    );
  }
  existsCedula(cedula: string, excludeId?: number): Promise<boolean> {
    return Promise.resolve(this.items.some((c) => c.id !== excludeId && c.props.cedula === cedula.trim()));
  }
  existsCodigoEmpresa(codigo: string, excludeId?: number): Promise<boolean> {
    return Promise.resolve(this.items.some((c) => c.id !== excludeId && c.props.codigoEmpresa === codigo.trim()));
  }
  create(colaborador: Colaborador, passwordHash: string): Promise<Colaborador> {
    return Promise.resolve(this.seed(colaborador, passwordHash));
  }
  update(colaborador: Colaborador): Promise<void> {
    this.items = this.items.map((c) => (c.id === colaborador.id ? colaborador : c));
    return Promise.resolve();
  }
  updateProfileImage(id: number, relativePath: string): Promise<void> {
    this.items = this.items.map((c) =>
      c.id === id ? Colaborador.create({ ...c.props, profileImage: relativePath }) : c,
    );
    return Promise.resolve();
  }
  delete(id: number): Promise<void> {
    this.items = this.items.filter((c) => c.id !== id);
    return Promise.resolve();
  }
}

export class InMemoryOwnedRepository<
  T extends OwnedRecord & { withId(id: number): T },
> extends OwnedRecordRepository<T> {
  items: T[] = [];
  private seq = 1;
  findByUser(userId: number): Promise<T[]> {
    return Promise.resolve(this.items.filter((i) => i.userId === userId));
  }
  findOne(id: number, userId: number): Promise<T | null> {
    return Promise.resolve(this.items.find((i) => i.id === id && i.userId === userId) ?? null);
  }
  insert(record: T): Promise<T> {
    const saved = record.withId(this.seq++);
    this.items.push(saved);
    return Promise.resolve(saved);
  }
  update(record: T): Promise<T> {
    this.items = this.items.map((i) => (i.id === record.id ? record : i));
    return Promise.resolve(record);
  }
  delete(id: number, userId: number): Promise<void> {
    this.items = this.items.filter((i) => !(i.id === id && i.userId === userId));
    return Promise.resolve();
  }
}

export class InMemoryEducacionFormalRepository
  extends InMemoryOwnedRepository<EducacionFormal>
  implements EducacionFormalRepository {}
export class InMemoryEducacionNoFormalRepository
  extends InMemoryOwnedRepository<EducacionNoFormal>
  implements EducacionNoFormalRepository {}
export class InMemoryFamiliarRepository extends InMemoryOwnedRepository<Familiar> implements FamiliarRepository {}
export class InMemoryExperienciaLaboralRepository
  extends InMemoryOwnedRepository<ExperienciaLaboral>
  implements ExperienciaLaboralRepository {}

export class InMemoryDatosBasicosRepository extends DatosBasicosRepository {
  items = new Map<number, DatosBasicos>();
  seed(userId: number, overrides: Partial<DatosBasicos> = {}): void {
    this.items.set(userId, {
      userId,
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'jperez@comfasucre.com.co',
      cedula: '123',
      codigoEmpresa: null,
      fechaNacimiento: null,
      fechaIngreso: null,
      direccion: null,
      telefono: null,
      celular: null,
      genero: null,
      estadoCivil: null,
      tipoSangre: null,
      eps: null,
      arl: null,
      fondoPension: null,
      cajaCompensacion: null,
      numeroHijos: 0,
      ...overrides,
    });
  }
  find(userId: number): Promise<DatosBasicos | null> {
    return Promise.resolve(this.items.get(userId) ?? null);
  }
  update(userId: number, datos: DatosBasicosProps): Promise<void> {
    const current = this.items.get(userId);
    if (current) this.items.set(userId, { ...current, ...datos });
    return Promise.resolve();
  }
}

export class InMemoryPerfilRepository extends PerfilRepository {
  items = new Map<number, Perfil>();
  hashes = new Map<number, string>();

  seed(perfil: Perfil, hash = 'hashed:actual123'): void {
    this.items.set(perfil.id, perfil);
    this.hashes.set(perfil.id, hash);
  }
  private patch(userId: number, patch: Partial<Perfil['props']>): void {
    const current = this.items.get(userId);
    if (current) this.items.set(userId, Perfil.create({ ...current.props, ...patch }));
  }
  findById(userId: number): Promise<Perfil | null> {
    return Promise.resolve(this.items.get(userId) ?? null);
  }
  findPasswordHash(userId: number): Promise<string | null> {
    return Promise.resolve(this.hashes.get(userId) ?? null);
  }
  updateDatos(userId: number, datos: PerfilDatos): Promise<void> {
    this.patch(userId, datos);
    return Promise.resolve();
  }
  updatePortafolio(userId: number, portafolio: PerfilPortafolio): Promise<void> {
    this.patch(userId, portafolio);
    return Promise.resolve();
  }
  updateImage(userId: number, kind: 'profile' | 'cover', relativePath: string): Promise<void> {
    this.patch(userId, kind === 'profile' ? { profileImage: relativePath } : { coverImage: relativePath });
    return Promise.resolve();
  }
  updatePassword(userId: number, hash: string): Promise<void> {
    this.hashes.set(userId, hash);
    return Promise.resolve();
  }
  updatePrivacySettings(userId: number, settings: PrivacySettings): Promise<void> {
    this.patch(userId, { privacySettings: settings });
    return Promise.resolve();
  }
  updateExperience(userId: number, experience: ExperienceItem[]): Promise<void> {
    this.patch(userId, { experience });
    return Promise.resolve();
  }
}

export class FakeContratoActivoReader extends ContratoActivoReader {
  contratos = new Map<number, ContratoActivo>();
  findActivo(userId: number): Promise<ContratoActivo | null> {
    return Promise.resolve(this.contratos.get(userId) ?? null);
  }
}

export class FakeLoginHistoryReader extends LoginHistoryReader {
  items: LoginHistoryItem[] = [];
  findRecent(_userId: number, limit: number): Promise<LoginHistoryItem[]> {
    return Promise.resolve(this.items.slice(0, limit));
  }
}

export class FakeBrandingReader extends BrandingReader {
  constructor(private readonly path: string | null = null) {
    super();
  }
  logoPath(): Promise<string | null> {
    return Promise.resolve(this.path);
  }
}

export function colaboradorBase(overrides: Partial<Parameters<typeof Colaborador.create>[0]> = {}): Colaborador {
  return Colaborador.create({
    firstName: 'Juan',
    lastName: 'Pérez',
    email: 'jperez@comfasucre.com.co',
    cedula: '1001',
    codigoEmpresa: 'COMF-001',
    phoneNumber: null,
    telefono: null,
    celular: '3001112233',
    sedeId: 1,
    areaId: 2,
    cargoId: 3,
    estadoColaborador: 'activo',
    fechaNacimiento: '1990-05-20',
    fechaIngreso: '2024-01-15',
    genero: 'masculino',
    estadoCivil: 'soltero',
    direccion: null,
    eps: null,
    arl: null,
    fondoPension: null,
    cajaCompensacion: null,
    tipoSangre: 'O+',
    designation: null,
    username: 'jperez',
    ...overrides,
  });
}

export function perfilBase(overrides: Partial<Perfil['props']> = {}): Perfil {
  return Perfil.create({
    id: 2,
    username: 'jperez',
    email: 'jperez@comfasucre.com.co',
    role: 'funcionario',
    firstName: 'Juan',
    lastName: 'Pérez',
    phoneNumber: null,
    designation: null,
    description: null,
    profileImage: null,
    coverImage: null,
    city: null,
    country: null,
    zipCode: null,
    website: null,
    skills: [],
    joiningDate: null,
    githubUsername: null,
    dribbbleUsername: null,
    pinterestUsername: null,
    privacySettings: {
      direct_messages: false,
      desktop_notifications: false,
      email_notifications: false,
      chat_notifications: false,
      comunicados_notifications: false,
    },
    experience: [],
    ...overrides,
  });
}
