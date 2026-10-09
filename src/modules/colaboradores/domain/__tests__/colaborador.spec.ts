import { ValidationError } from '../../../../shared/domain/domain-error';
import { Colaborador, generateUsername } from '../colaborador';
import { Perfil } from '../perfil';

const base = {
  firstName: 'Ana',
  lastName: 'Gómez',
  email: 'ana@x.com',
  cedula: '1',
  codigoEmpresa: '',
  phoneNumber: null,
  telefono: null,
  celular: null,
  sedeId: null,
  areaId: null,
  cargoId: null,
  fechaNacimiento: null,
  fechaIngreso: null,
  genero: null,
  estadoCivil: null,
  direccion: null,
  eps: null,
  arl: null,
  fondoPension: null,
  cajaCompensacion: null,
  tipoSangre: null,
  designation: null,
};

describe('Colaborador (dominio)', () => {
  it('normaliza textos vacíos a null y usa estado activo por defecto', () => {
    const c = Colaborador.create({ ...base, designation: '  ' });
    expect(c.props.codigoEmpresa).toBeNull();
    expect(c.props.designation).toBeNull();
    expect(c.props.estadoColaborador).toBe('activo');
    expect(c.props.role).toBe('funcionario');
    expect(c.fullName).toBe('Ana Gómez');
  });

  it('valida obligatorios, correo y fechas', () => {
    expect(() => Colaborador.create({ ...base, firstName: '' })).toThrow(ValidationError);
    expect(() => Colaborador.create({ ...base, email: 'no-es-correo' })).toThrow(ValidationError);
    expect(() => Colaborador.create({ ...base, fechaNacimiento: '2020/01/01' })).toThrow(ValidationError);
    expect(() => Colaborador.create({ ...base, numeroHijos: 1.5 })).toThrow(ValidationError);
  });

  it('genera el usuario como el legado (inicial + apellido, sin tildes ni espacios)', () => {
    expect(generateUsername('Ana María', 'Gómez Díaz')).toBe('agomezdiaz');
    expect(generateUsername('José', "O'Neil")).toBe('joneil');
    expect(generateUsername('', '')).toBe('usuario');
  });
});

describe('Perfil (dominio)', () => {
  it('calcula el avance del perfil con los 11 campos del legado', () => {
    const p = Perfil.create({
      id: 1,
      username: 'u',
      email: 'u@x.com',
      role: 'funcionario',
      firstName: 'U',
      lastName: 'X',
      phoneNumber: '1',
      designation: 'D',
      description: null,
      profileImage: null,
      coverImage: null,
      city: null,
      country: null,
      zipCode: null,
      website: null,
      skills: ['a'],
      joiningDate: null,
      githubUsername: null,
      dribbbleUsername: null,
      pinterestUsername: null,
      privacySettings: {
        direct_messages: true,
        desktop_notifications: false,
        email_notifications: false,
        chat_notifications: false,
        comunicados_notifications: false,
      },
      experience: [],
    });
    // firstName, lastName, email, phoneNumber, designation, skills → 6/11
    expect(p.completionPct).toBe(55);
    expect(p.props.privacySettings.direct_messages).toBe(true);
  });
});
