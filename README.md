# Sistema de Registro de Marcación GPS

## Estructura
- db/schema.sql          -> Script de creación de la base de datos MySQL
- api/                   -> API REST en Node.js/Express
- public/                -> UI web (login, marcación móvil, panel admin)

## Requisitos
- Node.js 18+ y MySQL 8+

## Instalación
1. mysql -u root -p < db/schema.sql
2. cd api && cp .env.example .env   (edita DB_PASSWORD y JWT_SECRET)
3. npm install
4. npm run seed        -> crea usuario admin / Admin123*
5. npm start           -> http://localhost:3000

## Notas
- La geolocalización del navegador requiere HTTPS (en producción) o localhost.
- Roles: EMPLEADO (marca), REVISOR_RH (reportes + asigna puntos),
  OPERACIONES/ADMIN (CRUD completo).

## Migración v1.1 (nuevas reglas de negocio)
Si ya creaste la base de datos con la versión anterior, ejecuta:
```sql
USE marcacion_db;
ALTER TABLE marcaciones ADD COLUMN es_retraso TINYINT(1) NOT NULL DEFAULT 0 AFTER estado;
```
Nuevas reglas implementadas:
- Una sola marcación VALIDA por empleado/punto/tipo/día; las demás -> DUPLICADA.
- ENTRADA después de hora_entrada + tolerancia del turno -> marcada con RETRASO.
- Turnos de empleado sin solapamiento: las asignaciones que se solapan se crean INACTIVAS.
- REVISOR_RH tiene acceso al módulo de Asignaciones.
- Reporte agrupado por fecha/empleado/punto, con log desplegable de intentos y CSV expandido.
- Edición y activación/inactivación de empleados y usuarios (OPERACIONES/ADMIN).

## Versión v1.2
- Edición y activación/desactivación de turnos y puntos de marcación.
- Restricción: no se puede desactivar un turno o punto con empleados asignados (error 409 con mensaje).
- Columna Estado (badges Activo/Inactivo) en puntos, turnos y asignaciones.
- Nuevo endpoint GET /api/marcaciones/mi-config -> {tienePunto, tieneTurno}.
- Menú: roles distintos a EMPLEADO ven botón "Marcación" solo si tienen punto y turno asignados,
  y botón "Administración" para volver al panel desde la vista de marcación.

## Versión v1.3
- Desactivación de turnos/puntos: solo se bloquea si existen asignaciones ACTIVAS
  (las inactivas ya no impiden desactivar).
- Mapa interactivo (Leaflet + OpenStreetMap) en creación y edición de puntos de
  marcación: clic para colocar pin, pin arrastrable, botón "GPS" para usar la
  ubicación actual. Requiere internet para cargar los tiles del mapa.
