-- =============================================================
-- Sistema de Registro de Marcación (Asistencia GPS)
-- Script de creación de base de datos MySQL
-- =============================================================

CREATE DATABASE IF NOT EXISTS marcacion_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE marcacion_db;


-- -------------------------------------------------------------
-- ROLES
-- -------------------------------------------------------------
CREATE TABLE roles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(50) NOT NULL UNIQUE,          -- EMPLEADO | REVISOR_RH | OPERACIONES | ADMIN
  descripcion VARCHAR(150),
  creado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------
-- EMPLEADOS
-- -------------------------------------------------------------
CREATE TABLE empleados (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  codigo     VARCHAR(20) NOT NULL UNIQUE,
  nombres    VARCHAR(100) NOT NULL,
  apellidos  VARCHAR(100) NOT NULL,
  correo     VARCHAR(120),
  telefono   VARCHAR(20),
  activo     TINYINT(1) NOT NULL DEFAULT 1,
  creado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE usuarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  empleado_id   INT NOT NULL,
  username      VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,              -- bcrypt
  rol_id        INT NOT NULL,
  activo        TINYINT(1) NOT NULL DEFAULT 1,
  creado_en     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (rol_id) REFERENCES roles(id),
  FOREIGN KEY (empleado_id) REFERENCES empleados(id)
);

-- -------------------------------------------------------------
-- TURNOS
-- -------------------------------------------------------------
CREATE TABLE turnos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(60) NOT NULL,
  hora_entrada  TIME NOT NULL,
  hora_salida   TIME NOT NULL,
  tolerancia_min INT NOT NULL DEFAULT 10,           -- tolerancia de retardo en minutos
  activo        TINYINT(1) NOT NULL DEFAULT 1,
  creado_en     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE puntos_marcacion (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  direccion   VARCHAR(200),
  latitud     DECIMAL(10, 7) NOT NULL,
  longitud    DECIMAL(10, 7) NOT NULL,
  radio_mt    INT NOT NULL DEFAULT 100,             -- radio de tolerancia en metros
  activo      TINYINT(1) NOT NULL DEFAULT 1,
  creado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------
-- PARAMETRIZACIÓN EMPLEADO x PUNTO DE MARCACIÓN
-- -------------------------------------------------------------
CREATE TABLE empleado_punto (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  empleado_id INT NOT NULL,
  punto_id  INT NOT NULL,
  activo    TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_emp_punto (empleado_id, punto_id),
  FOREIGN KEY (empleado_id) REFERENCES empleados(id),
  FOREIGN KEY (punto_id) REFERENCES puntos_marcacion(id)
);

-- -------------------------------------------------------------
-- PARAMETRIZACIÓN EMPLEADO x TURNO
-- -------------------------------------------------------------
CREATE TABLE empleado_turno (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  empleado_id INT NOT NULL,
  turno_id    INT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE,                                -- NULL = vigente indefinidamente
  activo      TINYINT(1) NOT NULL DEFAULT 1,
  creado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empleado_id) REFERENCES empleados(id),
  FOREIGN KEY (turno_id) REFERENCES turnos(id)
);

CREATE TABLE marcaciones (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  empleado_id  INT NOT NULL,
  punto_id     INT NOT NULL,
  turno_id     INT,
  tipo         ENUM('ENTRADA','SALIDA') NOT NULL,
  latitud      DECIMAL(10, 7) NOT NULL,
  longitud     DECIMAL(10, 7) NOT NULL,
  precision_mt DECIMAL(8, 2),                       -- precisión reportada por el GPS
  distancia_mt DECIMAL(10, 2),                      -- distancia al punto autorizado
  estado       ENUM('VALIDA','FUERA_DE_RANGO','DUPLICADA') NOT NULL DEFAULT 'VALIDA',
  es_retraso   TINYINT(1) NOT NULL DEFAULT 0,           -- 1 = entrada marcada después de la tolerancia
  fecha_hora   DATETIME NOT NULL,
  dispositivo  VARCHAR(150),
  creado_en    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_marc_emp_fecha (empleado_id, fecha_hora),
  FOREIGN KEY (empleado_id) REFERENCES empleados(id),
  FOREIGN KEY (punto_id) REFERENCES puntos_marcacion(id),
  FOREIGN KEY (turno_id) REFERENCES turnos(id)
);

------------------------------------
-- DATOS INICIALES
-- -------------------------------------------------------------
INSERT INTO roles (nombre, descripcion) VALUES
  ('EMPLEADO', 'Marca su asistencia desde el móvil'),
  ('REVISOR_RH', 'Revisa reportes y asigna puntos de marcación'),
  ('OPERACIONES', 'Administra usuarios, puntos de marcación y turnos'),
  ('ADMIN', 'Acceso total al sistema');

-- Usuario admin por defecto (password: Admin123*)
-- El empleado se crea primero para satisfacer la FK
INSERT INTO empleados (codigo, nombres, apellidos, correo) VALUES
  ('ADMIN001', 'Administrador', 'Sistema', 'admin@marcacion.local');

-- El usuario admin se crea desde api/seed.js con bcrypt

INSERT INTO turnos (nombre, hora_entrada, hora_salida, tolerancia_min) VALUES
  ('Turno Matutino',  '08:00:00', '17:00:00', 10),
  ('Turno Vespertino','14:00:00', '22:00:00', 10),
  ('Turno Nocturno',  '22:00:00', '06:00:00', 15);

INSERT INTO puntos_marcacion (nombre, direccion, latitud, longitud, radio_mt) VALUES
  ('Oficina Central', 'Av. Principal 123', 19.4326080, -99.1332080, 150);
