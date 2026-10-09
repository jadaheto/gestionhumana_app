import { Notificacion } from '../../../domain/notificacion';
import { NotificacionRepository } from '../../../domain/notificacion.repository';

export class InMemoryNotificacionRepository extends NotificacionRepository {
  items: Notificacion[] = [];
  private seq = 1;

  findRecientes(userId: number, limit: number, soloNoLeidas = false): Promise<Notificacion[]> {
    const list = this.items
      .filter((n) => n.props.userId === userId && (!soloNoLeidas || !n.leida))
      .sort((a, b) => b.props.createdAt.getTime() - a.props.createdAt.getTime() || (b.id ?? 0) - (a.id ?? 0));
    return Promise.resolve(list.slice(0, limit));
  }
  countNoLeidas(userId: number): Promise<number> {
    return Promise.resolve(this.items.filter((n) => n.props.userId === userId && !n.leida).length);
  }
  marcarLeida(id: number, userId: number): Promise<boolean> {
    const idx = this.items.findIndex((n) => n.id === id && n.props.userId === userId);
    if (idx < 0) return Promise.resolve(false);
    this.items[idx] = Notificacion.create({ ...this.items[idx].props, leida: true });
    return Promise.resolve(true);
  }
  marcarTodasLeidas(userId: number): Promise<number> {
    let marcadas = 0;
    this.items = this.items.map((n) => {
      if (n.props.userId === userId && !n.leida) {
        marcadas++;
        return Notificacion.create({ ...n.props, leida: true });
      }
      return n;
    });
    return Promise.resolve(marcadas);
  }
  eliminar(id: number, userId: number): Promise<boolean> {
    const before = this.items.length;
    this.items = this.items.filter((n) => !(n.id === id && n.props.userId === userId));
    return Promise.resolve(this.items.length < before);
  }
  save(n: Notificacion): Promise<Notificacion> {
    const saved = n.withId(this.seq++);
    this.items.push(saved);
    return Promise.resolve(saved);
  }
}
