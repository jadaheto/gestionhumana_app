import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { diferenciaDias } from '../../domain/fechas';
import { NotificacionesPort, UsuariosPort } from '../../domain/ports';
import { ContratoAlertaRepository, ContratoRepository } from '../../domain/repositories';
import { nombreCompleto } from './mappers';

/** Ventana de aviso en días (el legado consulta `get_por_vencer(30)`). */
export const DIAS_AVISO_VENCIMIENTO = 30;
/** Enlace de la notificación en la SPA. */
export const LINK_CONTRATOS = '/contratos';

/**
 * `notificar_contratos_por_vencer`: por cada contrato activo que vence en los
 * próximos 30 días crea una notificación a cada administrador activo, una sola
 * vez por (contrato, admin, fecha fin) gracias a `contrato_alertas`. Si la
 * fecha fin cambia (prórroga), se vuelve a avisar para la nueva fecha.
 * Devuelve cuántas notificaciones creó.
 */
@Injectable()
export class NotificarContratosPorVencerUseCase implements UseCase<void, number> {
  constructor(
    private readonly contratos: ContratoRepository,
    private readonly alertas: ContratoAlertaRepository,
    private readonly usuarios: UsuariosPort,
    private readonly notificaciones: NotificacionesPort,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<number> {
    const hoy = this.clock.today();
    const porVencer = await this.contratos.findPorVencer(hoy, DIAS_AVISO_VENCIMIENTO);
    if (porVencer.length === 0) return 0;
    const admins = await this.usuarios.listarAdminsActivos();
    if (admins.length === 0) return 0;

    let creadas = 0;
    for (const { contrato, colaborador } of porVencer) {
      const fechaFin = contrato.props.fechaFin;
      const contratoId = contrato.props.id;
      if (!fechaFin || !contratoId) continue;
      const dias = diferenciaDias(hoy, fechaFin);
      if (dias < 0) continue;
      const nombre = nombreCompleto(colaborador);
      for (const adminId of admins) {
        const alerta = {
          contratoId,
          destinatarioId: adminId,
          alertaTipo: 'vencimiento' as const,
          alertaFecha: fechaFin,
        };
        if (await this.alertas.exists(alerta)) continue;
        await this.notificaciones.crear({
          userId: adminId,
          titulo: 'Contrato por vencer',
          mensaje: `${nombre} vence en ${dias} día(s). Define si deseas prorrogarlo.`,
          tipo: 'contrato',
          link: LINK_CONTRATOS,
        });
        await this.alertas.save(alerta);
        creadas++;
      }
    }
    return creadas;
  }
}
