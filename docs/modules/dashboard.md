# Módulo `dashboard`

## Propósito
Dashboard de Gestión Humana (sustituye a `Rrhh::dashboard` + `Rrhh_model` y la parte de `Vacaciones_model::get_saldo_resumen` que usa el dashboard). Un solo endpoint devuelve el payload según el rol del actor.

## Reglas de negocio migradas
- **Admin**: total de colaboradores (sin admins) y por estado (`activo`/`inactivo`), permisos pendientes, contratos activos con `fecha_fin` entre hoy y hoy+30 días (máx. 10, con `diasRestantes` calculado), top 5 de `puntos.puntos_actuales` de colaboradores activos, distribución de colaboradores activos por área y por sede (áreas/sedes activas, incluidas las de 0).
- **Funcionario**: resumen de perfil (nombre, cargo, área, fecha de ingreso de referencia), total de permisos y pendientes, saldo de vacaciones, días en la empresa.
- **Comunes**: cumpleañeros del día (colaboradores activos) y aniversarios laborales del día con ≥ 1 año (fecha de referencia = `MIN(contratos.fecha_inicio)` o `users.fecha_ingreso`, excluye admins).
- **Fecha de ingreso de referencia** (`Rrhh_model::get_fecha_referencia_ingreso`): contrato activo más reciente → último contrato → `users.fecha_ingreso`.
- **Saldo de vacaciones**: `periodos = años completos desde la fecha de referencia`, `diasAcumulados = periodos × 15`, `diasConsumidos = Σ días hábiles de cada permiso tipo `vacaciones` aprobado` (si tiene fila en `vacaciones_suspensiones`, se acota a `dias_disfrutados`), `diasPendientes = max(0, acumulados − consumidos)`.
  - **Aproximación documentada**: los días hábiles se calculan de lunes a viernes **sin descontar festivos colombianos** (`domain/calculos-fecha.ts::diasHabilesAproximados`). El calendario de festivos lo implementa el módulo de vacaciones; el saldo del dashboard puede diferir en los festivos que caigan dentro de una vacación aprobada.
- Todas las consultas reciben la fecha "hoy" del puerto `Clock` (no usan `CURRENT_DATE`) para ser deterministas y testeables.

## Endpoints
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/v1/dashboard` | autenticado | Payload `DashboardAdminDto` (`rol: 'admin'`) o `DashboardFuncionarioDto` (`rol: 'funcionario'`) |

## Puertos / adaptadores
- `DashboardQueries` (domain) → `SqlDashboardQueries` (SQL parametrizado con `dataSource.query`).
- `Clock` (shared).

## Tablas consultadas (sólo lectura)
`users`, `cargos`, `areas`, `sedes`, `contratos`, `permisos`, `puntos`, `vacaciones_suspensiones`.

## Tests
- `application/use-cases/__tests__/get-dashboard.use-case.spec.ts`: cálculos de fechas y payload por rol con `FakeDashboardQueries`.
- `infrastructure/http/__tests__/dashboard.controller.spec.ts`: ruta, actor y acceso anónimo.
