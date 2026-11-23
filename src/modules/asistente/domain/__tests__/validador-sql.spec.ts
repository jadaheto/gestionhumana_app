import { TABLAS_PERMITIDAS, ValidadorSqlSoloLectura } from '../validador-sql';

describe('ValidadorSqlSoloLectura (sandbox de consulta_sql, capa 1)', () => {
  const v = new ValidadorSqlSoloLectura();

  it('acepta SELECT y WITH sobre tablas permitidas (public., comillas, joins, subconsultas, CTE)', () => {
    expect(v.validar('SELECT id FROM colaboradores;').ok).toBe(true);
    expect(v.validar('select * from public.contratos ct join "colaboradores" c on c.id = ct.user_id').ok).toBe(true);
    expect(
      v.validar('SELECT area, COUNT(*) FROM colaboradores WHERE id IN (SELECT user_id FROM contratos) GROUP BY area')
        .ok,
    ).toBe(true);
    expect(
      v.validar('WITH t AS (SELECT user_id, SUM(dias) d FROM incapacidades GROUP BY 1) SELECT * FROM t ORDER BY d DESC')
        .ok,
    ).toBe(true);
    expect(
      v.validar('WITH RECURSIVE r(n) AS (SELECT 1), base AS (SELECT id FROM colaboradores) SELECT * FROM r, base').ok,
    ).toBe(true);
    // Columnas con subcadenas de palabras prohibidas no se rechazan.
    expect(v.validar('SELECT created_at, updated_at FROM permisos').ok).toBe(true);
  });

  it('normaliza el punto y coma final y conserva la consulta limpia', () => {
    expect(v.validar('  SELECT 1 FROM colaboradores ;  ')).toEqual({ ok: true, sql: 'SELECT 1 FROM colaboradores' });
  });

  it('rechaza vacío, varias sentencias y sentencias que no son SELECT', () => {
    expect(v.validar('')).toEqual({ ok: false, error: 'Consulta vacía.' });
    expect(v.validar('SELECT 1 FROM colaboradores; SELECT 2')).toEqual({
      ok: false,
      error: 'Solo se permite una sentencia.',
    });
    expect(v.validar('DELETE FROM contratos')).toEqual({ ok: false, error: 'Solo se permiten consultas SELECT.' });
  });

  it('rechaza palabras de escritura o del motor aunque vayan dentro de un SELECT', () => {
    for (const w of [
      'insert',
      'update',
      'delete',
      'drop',
      'alter',
      'truncate',
      'into',
      'pg_sleep',
      'set',
      'copy',
      'explain',
    ]) {
      const r = v.validar(`SELECT 1 FROM colaboradores WHERE ${w} = 1`);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe(`Palabra no permitida en la consulta: ${w}.`);
    }
  });

  it('rechaza tablas prohibidas, fuera de lista y esquemas distintos de public', () => {
    expect(v.validar('SELECT * FROM users')).toEqual({ ok: false, error: 'Tabla no permitida: users.' });
    expect(v.validar('SELECT password FROM colaboradores c JOIN users u ON u.id = c.id')).toEqual({
      ok: false,
      error: 'Tabla no permitida: users.',
    });
    expect(v.validar('SELECT * FROM api_keys')).toEqual({ ok: false, error: 'Tabla no permitida: api_keys.' });
    expect(v.validar('SELECT * FROM cuentas_bancarias')).toEqual({
      ok: false,
      error: 'Tabla no permitida: cuentas_bancarias.',
    });
    expect(v.validar('SELECT * FROM assistant_messages')).toEqual({
      ok: false,
      error: 'Tabla no permitida: assistant_messages.',
    });
    expect(v.validar('SELECT * FROM pg_tables')).toEqual({ ok: false, error: 'Tabla no permitida: pg_tables.' });
    expect(v.validar('SELECT * FROM desprendibles_nomina')).toEqual({
      ok: false,
      error: 'Tabla fuera de la lista permitida: desprendibles_nomina.',
    });
    expect(v.validar('SELECT * FROM otro.colaboradores')).toEqual({ ok: false, error: 'Esquema no permitido: otro.' });
  });

  it('con la lista de tablas reales rechaza las no permitidas aunque no vayan tras FROM/JOIN', () => {
    const reales = ['colaboradores', 'contratos', 'desprendibles_nomina', 'familiares'];
    expect(v.validar('SELECT * FROM colaboradores, desprendibles_nomina').ok).toBe(true); // sin la lista, el regex no lo ve
    expect(v.validar('SELECT * FROM colaboradores, desprendibles_nomina', reales)).toEqual({
      ok: false,
      error: 'Tabla fuera de la lista permitida: desprendibles_nomina.',
    });
    expect(v.validar('SELECT c.* FROM colaboradores c, contratos ct WHERE ct.user_id = c.id', reales).ok).toBe(true);
  });

  it('envolver fuerza LIMIT máximo + 1 y la lista blanca no expone tablas sensibles', () => {
    expect(v.envolver('SELECT 1 FROM colaboradores')).toBe(
      'SELECT * FROM (SELECT 1 FROM colaboradores) AS asistente_q LIMIT 201',
    );
    expect(v.tablas).toBe(TABLAS_PERMITIDAS);
    for (const t of [
      'users',
      'cuentas_bancarias',
      'desprendibles_nomina',
      'endeudamiento_solicitudes',
      'familiares',
      'chat_messages',
      'emails',
    ]) {
      expect(TABLAS_PERMITIDAS).not.toContain(t);
    }
    expect(new ValidadorSqlSoloLectura(['x']).validar('SELECT * FROM x').ok).toBe(true);
  });
});
