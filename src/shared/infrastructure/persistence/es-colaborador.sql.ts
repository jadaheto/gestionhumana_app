/**
 * Condición SQL "cuenta como colaborador" sobre la tabla `users`: todos los funcionarios
 * y los administradores marcados como colaboradores (`es_colaborador`). Los administradores
 * sin esa marca son cuentas de acceso y no aparecen en listados, conteos ni organigrama.
 *
 * @param alias alias de `users` en la consulta (vacío si la tabla no tiene alias).
 */
export function esColaboradorSql(alias = ''): string {
  const t = alias ? `${alias}.` : '';
  return `(${t}role <> 'admin' OR ${t}es_colaborador)`;
}
