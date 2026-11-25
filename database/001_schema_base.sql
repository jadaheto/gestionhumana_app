-- ============================================================
-- GESTIÓN HUMANA COMFASUCRE — SCHEMA COMPLETO
-- Base de datos: gestion_humana (PostgreSQL)
-- ============================================================

-- ============================================================
-- TABLAS EXISTENTES (del proyecto escenarios)
-- ============================================================

-- Tabla de usuarios del sistema
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone_number VARCHAR(20),
    designation VARCHAR(100),
    description TEXT,
    profile_image VARCHAR(255),
    cover_image VARCHAR(255),
    city VARCHAR(100),
    country VARCHAR(100),
    zip_code VARCHAR(20),
    website VARCHAR(255),
    skills TEXT,
    joining_date DATE,
    role VARCHAR(20) DEFAULT 'funcionario',
    ui_preferences JSONB DEFAULT '{"language":"es","theme":"light"}',
    privacy_settings JSONB DEFAULT '{}',
    experience JSONB DEFAULT '[]',
    github_username VARCHAR(100),
    dribbble_username VARCHAR(100),
    pinterest_username VARCHAR(100),
    -- Campos nuevos para Gestión Humana
    cedula VARCHAR(20),
    codigo_empresa VARCHAR(20),
    lugar_expedicion_cedula VARCHAR(120),
    sede_id INT,
    area_id INT,
    cargo_id INT,
    estado_colaborador VARCHAR(20) DEFAULT 'activo',
    fecha_nacimiento DATE,
    fecha_ingreso DATE,
    genero VARCHAR(20),
    estado_civil VARCHAR(30),
    direccion VARCHAR(255),
    telefono VARCHAR(20),
    celular VARCHAR(20),
    eps VARCHAR(100),
    arl VARCHAR(100),
    fondo_pension VARCHAR(100),
    caja_compensacion VARCHAR(100),
    tipo_sangre VARCHAR(10),
    numero_hijos INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historial de login
CREATE TABLE IF NOT EXISTS login_history (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    device VARCHAR(255),
    location VARCHAR(255),
    ip_address VARCHAR(45),
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    key_name VARCHAR(255) NOT NULL,
    generated_key VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);

-- Eventos de calendario
CREATE TABLE IF NOT EXISTS calendar_events (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    all_day BOOLEAN DEFAULT FALSE,
    class_name VARCHAR(50) DEFAULT 'bg-primary',
    location VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat entre funcionarios
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    sender_id INT REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INT REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_receiver ON chat_messages(receiver_id);

-- Tareas (sistema de asignaciones jerárquicas)
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    project_name VARCHAR(255),
    client_name VARCHAR(255),
    assigned_to VARCHAR(255),
    creator_id INT REFERENCES users(id) ON DELETE SET NULL,
    due_date DATE,
    status VARCHAR(30) DEFAULT 'To Do',
    priority VARCHAR(20) DEFAULT 'Media',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Asignaciones de tareas
CREATE TABLE IF NOT EXISTS task_assignees (
    id SERIAL PRIMARY KEY,
    task_id INT REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emails internos
CREATE TABLE IF NOT EXISTS emails (
    id SERIAL PRIMARY KEY,
    sender_id INT REFERENCES users(id) ON DELETE SET NULL,
    receiver_id INT REFERENCES users(id) ON DELETE SET NULL,
    to_email VARCHAR(255),
    subject VARCHAR(255),
    body TEXT,
    folder VARCHAR(20) DEFAULT 'inbox',
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- TABLAS NUEVAS — GESTIÓN HUMANA
-- ============================================================

-- 1. Sedes de la empresa
CREATE TABLE IF NOT EXISTS sedes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    direccion VARCHAR(255),
    ciudad VARCHAR(100),
    telefono VARCHAR(20),
    estado VARCHAR(20) DEFAULT 'activo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Áreas organizacionales
CREATE TABLE IF NOT EXISTS areas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    sede_id INT REFERENCES sedes(id) ON DELETE SET NULL,
    responsable_id INT REFERENCES users(id) ON DELETE SET NULL,
    estado VARCHAR(20) DEFAULT 'activo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Cargos / Posiciones
CREATE TABLE IF NOT EXISTS cargos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    area_id INT REFERENCES areas(id) ON DELETE SET NULL,
    nivel_jerarquico INT DEFAULT 5, -- 1=Director, 2=Jefe, 3=Coordinador, 4=Analista, 5=Auxiliar
    funciones TEXT,
    estado VARCHAR(20) DEFAULT 'activo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Foreign keys para users → sedes, areas, cargos
ALTER TABLE users ADD CONSTRAINT fk_users_sede FOREIGN KEY (sede_id) REFERENCES sedes(id) ON DELETE SET NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_cargo FOREIGN KEY (cargo_id) REFERENCES cargos(id) ON DELETE SET NULL;

-- 4. Contratos
CREATE TABLE IF NOT EXISTS contratos (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipo_contrato VARCHAR(50) NOT NULL, -- fijo, indefinido, prestacion_servicios, obra_labor, aprendizaje
    numero_contrato VARCHAR(50) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    salario_base NUMERIC(12,2) NOT NULL,
    estado VARCHAR(20) DEFAULT 'activo', -- activo, finalizado, renovado
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contratos_user ON contratos(user_id);

-- 4.1 Prórrogas de contratos
CREATE TABLE IF NOT EXISTS contrato_prorrogas (
    id SERIAL PRIMARY KEY,
    contrato_id INT NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fecha_fin_anterior DATE NOT NULL,
    meses_prorroga INT NOT NULL,
    fecha_inicio_prorroga DATE NOT NULL,
    fecha_fin_nueva DATE NOT NULL,
    observacion TEXT,
    creado_por INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4.2 Alertas de vencimiento de contratos
CREATE TABLE IF NOT EXISTS contrato_alertas (
    id SERIAL PRIMARY KEY,
    contrato_id INT NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
    destinatario_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alerta_tipo VARCHAR(30) NOT NULL,
    alerta_fecha DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contrato_alertas_unique
ON contrato_alertas(contrato_id, destinatario_id, alerta_tipo, alerta_fecha);

-- 5. Educación Formal
CREATE TABLE IF NOT EXISTS educacion_formal (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nivel VARCHAR(50) NOT NULL, -- bachiller, tecnico, tecnologo, profesional, especializacion, maestria, doctorado
    institucion VARCHAR(200) NOT NULL,
    titulo_obtenido VARCHAR(200),
    fecha_inicio DATE,
    fecha_fin DATE,
    estado_estudio VARCHAR(30) DEFAULT 'finalizado', -- cursando, finalizado, abandonado
    tarjeta_profesional VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Educación No Formal
CREATE TABLE IF NOT EXISTS educacion_no_formal (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- curso, diplomado, seminario, taller, certificacion, congreso
    institucion VARCHAR(200),
    nombre_programa VARCHAR(200) NOT NULL,
    horas INT,
    fecha DATE,
    certificado VARCHAR(255), -- archivo
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Familiares
CREATE TABLE IF NOT EXISTS familiares (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre_completo VARCHAR(200) NOT NULL,
    parentesco VARCHAR(50) NOT NULL, -- padre, madre, conyuge, hijo/a, hermano/a, otro
    fecha_nacimiento DATE,
    cedula VARCHAR(20),
    ocupacion VARCHAR(100),
    telefono VARCHAR(20),
    dependiente BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Experiencia Laboral Previa
CREATE TABLE IF NOT EXISTS experiencia_laboral (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    empresa VARCHAR(200) NOT NULL,
    cargo VARCHAR(150) NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE,
    funciones TEXT,
    motivo_retiro VARCHAR(200),
    telefono_contacto VARCHAR(20),
    jefe_inmediato VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Vacaciones
CREATE TABLE IF NOT EXISTS vacaciones (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    periodo VARCHAR(20) NOT NULL, -- ej: "2025-2026"
    dias_totales INT DEFAULT 15,
    dias_tomados INT DEFAULT 0,
    dias_pendientes INT DEFAULT 15,
    estado VARCHAR(20) DEFAULT 'activo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Detalle de Vacaciones Tomadas
CREATE TABLE IF NOT EXISTS vacaciones_detalle (
    id SERIAL PRIMARY KEY,
    vacacion_id INT NOT NULL REFERENCES vacaciones(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    dias INT NOT NULL,
    estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, aprobada, rechazada
    aprobado_por INT REFERENCES users(id) ON DELETE SET NULL,
    observacion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Permisos
CREATE TABLE IF NOT EXISTS permisos (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipo_permiso VARCHAR(50) NOT NULL, -- personal, medico, calamidad, diligencia, estudio, otro
    fecha_solicitud DATE DEFAULT CURRENT_DATE,
    fecha_inicio TIMESTAMP NOT NULL,
    fecha_fin TIMESTAMP NOT NULL,
    horas NUMERIC(4,1),
    justificacion TEXT NOT NULL,
    archivo_soporte VARCHAR(255),
    estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, aprobado, rechazado
    aprobado_por INT REFERENCES users(id) ON DELETE SET NULL,
    observacion_respuesta TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_permisos_user ON permisos(user_id);
CREATE INDEX IF NOT EXISTS idx_permisos_estado ON permisos(estado);

-- 12. Incapacidades
CREATE TABLE IF NOT EXISTS incapacidades (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- enfermedad_general, accidente_laboral, maternidad, paternidad
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    dias INT NOT NULL,
    entidad_emisora VARCHAR(200),
    numero_incapacidad VARCHAR(50),
    archivo_soporte VARCHAR(255),
    estado VARCHAR(20) DEFAULT 'activo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Organigrama (jerarquía de cargos)
CREATE TABLE IF NOT EXISTS organigrama (
    id SERIAL PRIMARY KEY,
    cargo_id INT NOT NULL REFERENCES cargos(id) ON DELETE CASCADE,
    cargo_padre_id INT REFERENCES cargos(id) ON DELETE SET NULL,
    orden INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. Identidad Empresarial
CREATE TABLE IF NOT EXISTS identidad_empresa (
    id SERIAL PRIMARY KEY,
    campo VARCHAR(50) NOT NULL UNIQUE, -- mision, vision, valores, principios, himno_url
    contenido TEXT,
    tipo VARCHAR(20) DEFAULT 'texto', -- texto, video, imagen
    orden INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Datos iniciales de identidad
INSERT INTO identidad_empresa (campo, contenido, tipo, orden) VALUES
('mision', 'Misión de Comfasucre', 'texto', 1),
('vision', 'Visión de Comfasucre', 'texto', 2),
('valores', 'Valores de Comfasucre', 'texto', 3),
('principios', 'Principios de Comfasucre', 'texto', 4),
('himno_url', '', 'video', 5)
ON CONFLICT (campo) DO NOTHING;

-- 19. Cuentas bancarias
CREATE TABLE IF NOT EXISTS cuentas_bancarias (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    banco VARCHAR(100) NOT NULL,
    tipo_cuenta VARCHAR(30) NOT NULL, -- ahorros, corriente
    numero_cuenta VARCHAR(30) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 20. Desprendibles de nómina
CREATE TABLE IF NOT EXISTS desprendibles_nomina (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    periodo VARCHAR(80) NOT NULL, -- ej: "2026-04-Q1"
    salario_basico NUMERIC(12,2),
    devengados JSONB DEFAULT '{}',
    deducciones JSONB DEFAULT '{}',
    total_devengado NUMERIC(12,2) DEFAULT 0,
    total_deducido NUMERIC(12,2) DEFAULT 0,
    neto_pagar NUMERIC(12,2) DEFAULT 0,
    fecha_inicio DATE NULL,
    fecha_fin DATE NULL,
    fecha_liquidacion DATE NULL,
    nro_comprobante VARCHAR(30) NULL,
    banco VARCHAR(100) NULL,
    numero_cuenta VARCHAR(40) NULL,
    archivo_pdf VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 20.1 Lotes de importacion de nomina PDF
CREATE TABLE IF NOT EXISTS nomina_import_lotes (
    id SERIAL PRIMARY KEY,
    archivo VARCHAR(255) NOT NULL,
    fuente VARCHAR(100),
    tipo_nomina VARCHAR(30),
    fecha_liquidacion DATE NULL,
    fecha_inicio DATE NULL,
    fecha_fin DATE NULL,
    total_empleados_pdf INT DEFAULT 0,
    empleados_creados INT DEFAULT 0,
    empleados_actualizados INT DEFAULT 0,
    desprendibles_creados INT DEFAULT 0,
    desprendibles_actualizados INT DEFAULT 0,
    errores INT DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'pendiente',
    detalle TEXT,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nomina_import_errores (
    id SERIAL PRIMARY KEY,
    lote_id INT NOT NULL REFERENCES nomina_import_lotes(id) ON DELETE CASCADE,
    empleado_ref VARCHAR(120),
    mensaje TEXT,
    raw_block TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 21. Certificados generados
CREATE TABLE IF NOT EXISTS certificados (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- laboral_con_funciones, laboral_sin_funciones, ingresos_retenciones
    fecha_generacion DATE DEFAULT CURRENT_DATE,
    archivo_pdf VARCHAR(255),
    generado_por INT REFERENCES users(id) ON DELETE SET NULL,
    datos JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 22. Documentos del colaborador
CREATE TABLE IF NOT EXISTS documentos_colaborador (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre_documento VARCHAR(200) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- hoja_vida, cedula, certificado, contrato, otro
    archivo VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 23. Notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT,
    tipo VARCHAR(50) DEFAULT 'info', -- info, permiso, tarea, cumpleanos, contrato
    leida BOOLEAN DEFAULT FALSE,
    link VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_user ON notificaciones(user_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON notificaciones(user_id, leida);

-- 23.1 Configuración global de aplicación
CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 24. Comunicados internos
CREATE TABLE IF NOT EXISTS comunicados (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    resumen TEXT,
    contenido TEXT,
    estado VARCHAR(20) DEFAULT 'borrador', -- borrador, publicado
    publicado_at TIMESTAMP NULL,
    email_enviado_at TIMESTAMP NULL,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comunicados_estado ON comunicados(estado);
CREATE INDEX IF NOT EXISTS idx_comunicados_publicado_at ON comunicados(publicado_at);

-- 25. Multimedia de comunicados
CREATE TABLE IF NOT EXISTS comunicado_medios (
    id SERIAL PRIMARY KEY,
    comunicado_id INT NOT NULL REFERENCES comunicados(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL, -- imagen, video, pdf
    archivo VARCHAR(255),
    url VARCHAR(500),
    orden INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comunicado_medios_comunicado ON comunicado_medios(comunicado_id);

-- Tabla local de asistencia (placeholder para BD externa)
CREATE TABLE IF NOT EXISTS asistencia (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora_entrada TIME,
    hora_salida TIME,
    tipo VARCHAR(20) DEFAULT 'presencial', -- presencial, virtual
    observacion VARCHAR(255),
    fuente VARCHAR(20) DEFAULT 'local', -- local, externo
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asistencia_user ON asistencia(user_id);
CREATE INDEX IF NOT EXISTS idx_asistencia_fecha ON asistencia(fecha);

-- 24.1 Importaciones de asistencia por sede
CREATE TABLE IF NOT EXISTS asistencia_importaciones (
    id SERIAL PRIMARY KEY,
    sede_id INT NOT NULL REFERENCES sedes(id) ON DELETE RESTRICT,
    archivo VARCHAR(255) NOT NULL,
    total_filas INT DEFAULT 0,
    importado_por INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 24.2 Marcaciones crudas importadas
CREATE TABLE IF NOT EXISTS asistencia_marcaciones (
    id SERIAL PRIMARY KEY,
    importacion_id INT REFERENCES asistencia_importaciones(id) ON DELETE SET NULL,
    sede_id INT NOT NULL REFERENCES sedes(id) ON DELETE RESTRICT,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    identificacion VARCHAR(40),
    nombre VARCHAR(200),
    fecha_hora TIMESTAMP NOT NULL,
    tipo_registro VARCHAR(20),
    departamento VARCHAR(120),
    dispositivo_no VARCHAR(40),
    raw_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asistencia_marcaciones_fecha ON asistencia_marcaciones(sede_id, fecha_hora);

-- 24.3 Políticas de asistencia por sede
CREATE TABLE IF NOT EXISTS asistencia_politicas (
    id SERIAL PRIMARY KEY,
    sede_id INT NOT NULL UNIQUE REFERENCES sedes(id) ON DELETE CASCADE,
    hora_entrada_limite TIME NOT NULL DEFAULT '08:10:00',
    hora_salida_temprana TIME NOT NULL DEFAULT '11:59:00',
    tolerancia_minutos INT NOT NULL DEFAULT 0,
    enviar_memorando_tardanza BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 24.4 Resumen diario consolidado
CREATE TABLE IF NOT EXISTS asistencia_resumen_diario (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sede_id INT NOT NULL REFERENCES sedes(id) ON DELETE RESTRICT,
    fecha DATE NOT NULL,
    hora_entrada TIME,
    hora_salida TIME,
    minutos_tarde INT DEFAULT 0,
    minutos_salida_temprana INT DEFAULT 0,
    estado VARCHAR(40) DEFAULT 'normal', -- normal, tarde, salida_temprana, tarde_salida_temprana, falla, justificado
    justificacion VARCHAR(255),
    detalle VARCHAR(255),
    memo_enviado BOOLEAN DEFAULT FALSE,
    memo_enviado_at TIMESTAMP NULL,
    memo_error VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_asistencia_resumen_unique ON asistencia_resumen_diario(user_id, sede_id, fecha);

-- 25. Evaluaciones de nivel de endeudamiento
CREATE TABLE IF NOT EXISTS endeudamiento_solicitudes (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    solicitud_no VARCHAR(50) NOT NULL,
    fecha DATE NOT NULL,
    anio INT NULL,
    libranza VARCHAR(100),
    salario_mensual NUMERIC(14,2) DEFAULT 0,
    otros_devengados NUMERIC(14,2) DEFAULT 0,
    total_devengado NUMERIC(14,2) DEFAULT 0,
    total_deducido NUMERIC(14,2) DEFAULT 0,
    neto_actual NUMERIC(14,2) DEFAULT 0,
    deducciones_ley NUMERIC(14,2) DEFAULT 0,
    deducciones_endeudamiento NUMERIC(14,2) DEFAULT 0,
    porcentaje_actual NUMERIC(8,2) DEFAULT 0,
    valor_solicitado NUMERIC(14,2) DEFAULT 0,
    plazo_meses INT DEFAULT 0,
    cuota_mensual NUMERIC(14,2) DEFAULT 0,
    valor_quincenal NUMERIC(14,2) DEFAULT 0,
    porcentaje_nuevo_credito NUMERIC(8,2) DEFAULT 0,
    neto_recibir NUMERIC(14,2) DEFAULT 0,
    umbral_aprobacion NUMERIC(8,2) DEFAULT 50,
    opcion_credito VARCHAR(10),
    conclusion TEXT,
    estado VARCHAR(20) DEFAULT 'borrador',
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS endeudamiento_conceptos (
    id SERIAL PRIMARY KEY,
    solicitud_id INT NOT NULL REFERENCES endeudamiento_solicitudes(id) ON DELETE CASCADE,
    concepto VARCHAR(150) NOT NULL,
    devengado NUMERIC(14,2) DEFAULT 0,
    deducido NUMERIC(14,2) DEFAULT 0,
    porcentaje NUMERIC(8,2) DEFAULT 0,
    orden INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_endeudamiento_user ON endeudamiento_solicitudes(user_id);
CREATE INDEX IF NOT EXISTS idx_endeudamiento_fecha ON endeudamiento_solicitudes(fecha);
CREATE INDEX IF NOT EXISTS idx_endeudamiento_conceptos_solicitud ON endeudamiento_conceptos(solicitud_id);

-- ============================================================
-- ÍNDICES GENERALES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_estado ON users(estado_colaborador);
CREATE INDEX IF NOT EXISTS idx_users_sede ON users(sede_id);
CREATE INDEX IF NOT EXISTS idx_users_area ON users(area_id);
CREATE INDEX IF NOT EXISTS idx_users_cargo ON users(cargo_id);
CREATE INDEX IF NOT EXISTS idx_users_nacimiento ON users(fecha_nacimiento);
CREATE INDEX IF NOT EXISTS idx_users_ingreso ON users(fecha_ingreso);
CREATE INDEX IF NOT EXISTS idx_calendar_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(creator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- ============================================================
-- USUARIO ADMINISTRADOR INICIAL
-- ============================================================
-- Password: admin123 (bcrypt hash)
INSERT INTO users (username, email, password, first_name, last_name, role, estado_colaborador, fecha_ingreso)
VALUES ('admin', 'admin@comfasucre.com.co', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrador', 'Sistema', 'admin', 'activo', CURRENT_DATE)
ON CONFLICT (username) DO NOTHING;

