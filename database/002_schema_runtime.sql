-- ============================================================
-- DDL que el sistema legado creaba en tiempo de ejecución
-- (métodos ensure_* de controladores y modelos). Consolidado aquí.
-- ============================================================

-- Importación de nómina (columnas adicionales)
ALTER TABLE nomina_import_lotes ADD COLUMN IF NOT EXISTS contratos_actualizados INT DEFAULT 0;
ALTER TABLE nomina_import_lotes ADD COLUMN IF NOT EXISTS archivo_original VARCHAR(255);
ALTER TABLE desprendibles_nomina ALTER COLUMN periodo TYPE VARCHAR(80);

-- Salarios por cargo (importador de cargos/áreas)
CREATE TABLE IF NOT EXISTS cargo_salarios (
    id SERIAL PRIMARY KEY,
    cargo_id INT NOT NULL REFERENCES cargos(id) ON DELETE CASCADE,
    salario_2024 NUMERIC(14,2) NULL,
    aumento_2025 NUMERIC(14,2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cargo_id)
);

-- Suspensión de vacaciones aprobadas
CREATE TABLE IF NOT EXISTS vacaciones_suspensiones (
    id SERIAL PRIMARY KEY,
    permiso_id INT NOT NULL UNIQUE,
    user_id INT NOT NULL,
    dias_totales INT NOT NULL,
    dias_disfrutados INT NOT NULL,
    dias_reintegrados INT NOT NULL,
    motivo TEXT,
    suspendido_por INT NOT NULL,
    fecha_suspension TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
