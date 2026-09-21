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
