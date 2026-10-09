import { UserRole } from './user-role';

/**
 * Identidad del usuario que ejecuta un caso de uso.
 * Se construye en la capa HTTP a partir del JWT y se pasa a la aplicación,
 * de modo que los casos de uso no dependan de Nest ni de Express.
 */
export interface Actor {
  id: number;
  username: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  email: string;
}

export function isAdmin(actor: Actor): boolean {
  return actor.role === 'admin';
}

export function actorFullName(actor: Actor): string {
  const name = `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim();
  return name === '' ? 'Funcionario' : name;
}
