// CRUD de catálogos: empleados, usuarios, puntos, turnos y parametrizaciones
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { autenticar, autorizar } = require('../middleware/auth');

const router = express.Router();
const ADMIN_OPS = autorizar('OPERACIONES', 'ADMIN');
const ASIGNACIONES = autorizar('REVISOR_RH', 'OPERACIONES', 'ADMIN'); // RH también asigna
const LECTURA = autorizar('REVISOR_RH', 'OPERACIONES', 'ADMIN');
router.use(autenticar);

// ---------- EMPLEADOS ----------
router.get('/empleados', LECTURA, async (req, res) => {
  const [rows] = await db.query(
    `SELECT e.*, u.id AS usuario_id, u.username, u.rol_id, u.activo AS usuario_activo, r.nombre AS rol
     FROM empleados e
     LEFT JOIN usuarios u ON u.empleado_id = e.id
     LEFT JOIN roles r ON r.id = u.rol_id
     ORDER BY e.apellidos`);
  res.json(rows);
});

router.post('/empleados', ADMIN_OPS, async (req, res) => {
  const { codigo, nombres, apellidos, correo, telefono } = req.body;
  try {
    const [r] = await db.query(
      `INSERT INTO empleados (codigo, nombres, apellidos, correo, telefono)
       VALUES (:codigo, :nombres, :apellidos, :correo, :telefono)`,
      { codigo, nombres, apellidos, correo: correo || null, telefono: telefono || null });
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    res.status(400).json({ error: err.code === 'ER_DUP_ENTRY' ? 'Código de empleado duplicado' : 'Error al crear empleado' });
  }
});

router.put('/empleados/:id', ADMIN_OPS, async (req, res) => {
  const { nombres, apellidos, correo, telefono, activo } = req.body;
  await db.query(
    `UPDATE empleados SET nombres=:nombres, apellidos=:apellidos, correo=:correo,
     telefono=:telefono, activo=:activo WHERE id=:id`,
    { id: req.params.id, nombres, apellidos, correo, telefono, activo: activo ? 1 : 0 });
  res.json({ ok: true });
});

// ---------- USUARIOS ----------
router.get('/roles', LECTURA, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM roles ORDER BY id');
  res.json(rows);
});

router.post('/usuarios', ADMIN_OPS, async (req, res) => {
  const { empleado_id, username, password, rol_id } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  const hash = await bcrypt.hash(password, 10);
  try {
    const [r] = await db.query(
      `INSERT INTO usuarios (empleado_id, username, password_hash, rol_id)
       VALUES (:empleado_id, :username, :hash, :rol_id)`,
      { empleado_id, username, hash, rol_id });
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    res.status(400).json({ error: err.code === 'ER_DUP_ENTRY' ? 'Nombre de usuario duplicado' : 'Error al crear usuario' });
  }
});

router.put('/usuarios/:id', ADMIN_OPS, async (req, res) => {
  const { rol_id, activo, password } = req.body;
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'UPDATE usuarios SET rol_id=:rol_id, activo=:activo, password_hash=:hash WHERE id=:id',
      { id: req.params.id, rol_id, activo: activo ? 1 : 0, hash });
  } else {
    await db.query(
      'UPDATE usuarios SET rol_id=:rol_id, activo=:activo WHERE id=:id',
      { id: req.params.id, rol_id, activo: activo ? 1 : 0 });
  }
  res.json({ ok: true });
});

// ---------- PUNTOS DE MARCACIÓN ----------
router.get('/puntos', LECTURA, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM puntos_marcacion ORDER BY nombre');
  res.json(rows);
});

router.post('/puntos', ADMIN_OPS, async (req, res) => {
  const { nombre, direccion, latitud, longitud, radio_mt } = req.body;
  try {
    const [r] = await db.query(
      `INSERT INTO puntos_marcacion (nombre, direccion, latitud, longitud, radio_mt)
       VALUES (:nombre, :direccion, :latitud, :longitud, :radio_mt)`,
      { nombre, direccion: direccion || null, latitud, longitud, radio_mt: radio_mt || 100 });
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    res.status(400).json({ error: 'Error al crear punto de marcación' });
  }
});

router.put('/puntos/:id', ADMIN_OPS, async (req, res) => {
  const { nombre, direccion, latitud, longitud, radio_mt, activo } = req.body;
  await db.query(
    `UPDATE puntos_marcacion SET nombre=:nombre, direccion=:direccion, latitud=:latitud,
     longitud=:longitud, radio_mt=:radio_mt, activo=:activo WHERE id=:id`,
    { id: req.params.id, nombre, direccion, latitud, longitud, radio_mt, activo: activo ? 1 : 0 });
  res.json({ ok: true });
});

// ---------- TURNOS ----------
router.get('/turnos', LECTURA, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM turnos ORDER BY hora_entrada');
  res.json(rows);
});

router.post('/turnos', ADMIN_OPS, async (req, res) => {
  const { nombre, hora_entrada, hora_salida, tolerancia_min } = req.body;
  const [r] = await db.query(
    `INSERT INTO turnos (nombre, hora_entrada, hora_salida, tolerancia_min)
     VALUES (:nombre, :hora_entrada, :hora_salida, :tolerancia_min)`,
    { nombre, hora_entrada, hora_salida, tolerancia_min: tolerancia_min || 10 });
  res.status(201).json({ id: r.insertId });
});

router.put('/turnos/:id', ADMIN_OPS, async (req, res) => {
  const { nombre, hora_entrada, hora_salida, tolerancia_min, activo } = req.body;
  await db.query(
    `UPDATE turnos SET nombre=:nombre, hora_entrada=:hora_entrada, hora_salida=:hora_salida,
     tolerancia_min=:tolerancia_min, activo=:activo WHERE id=:id`,
    { id: req.params.id, nombre, hora_entrada, hora_salida, tolerancia_min, activo: activo ? 1 : 0 });
  res.json({ ok: true });
});

// ---------- PARAMETRIZACIÓN EMPLEADO x PUNTO (RH también) ----------
router.get('/empleado-punto', LECTURA, async (req, res) => {
  const [rows] = await db.query(
    `SELECT ep.id, ep.empleado_id, ep.punto_id, ep.activo,
            e.nombres, e.apellidos, p.nombre AS punto
     FROM empleado_punto ep
     JOIN empleados e ON e.id = ep.empleado_id
     JOIN puntos_marcacion p ON p.id = ep.punto_id`);
  res.json(rows);
});

router.post('/empleado-punto', ASIGNACIONES, async (req, res) => {
  const { empleado_id, punto_id } = req.body;
  try {
    const [r] = await db.query(
      `INSERT INTO empleado_punto (empleado_id, punto_id) VALUES (:empleado_id, :punto_id)`,
      { empleado_id, punto_id });
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    res.status(400).json({ error: err.code === 'ER_DUP_ENTRY' ? 'La asignación ya existe' : 'Error al asignar' });
  }
});

router.put('/empleado-punto/:id', ASIGNACIONES, async (req, res) => {
  await db.query('UPDATE empleado_punto SET activo=:activo WHERE id=:id',
    { id: req.params.id, activo: req.body.activo ? 1 : 0 });
  res.json({ ok: true });
});

// ---------- PARAMETRIZACIÓN EMPLEADO x TURNO ----------
// Regla: un empleado solo puede tener UN turno activo en un periodo.
// Si la nueva asignación se solapa con una activa existente, se inserta INACTIVA
// y queda a criterio del operador activarla.
router.get('/empleado-turno', LECTURA, async (req, res) => {
  const [rows] = await db.query(
    `SELECT et.id, et.empleado_id, et.turno_id, et.fecha_inicio, et.fecha_fin, et.activo,
            e.nombres, e.apellidos, t.nombre AS turno
     FROM empleado_turno et
     JOIN empleados e ON e.id = et.empleado_id
     JOIN turnos t ON t.id = et.turno_id
     ORDER BY et.fecha_inicio DESC`);
  res.json(rows);
});

router.post('/empleado-turno', ASIGNACIONES, async (req, res) => {
  const { empleado_id, turno_id, fecha_inicio, fecha_fin } = req.body;
  if (!fecha_inicio) return res.status(400).json({ error: 'fecha_inicio es requerida' });

  // ¿Se solapa con algún turno activo vigente del empleado?
  const [solapados] = await db.query(
    `SELECT et.id, t.nombre FROM empleado_turno et
     JOIN turnos t ON t.id = et.turno_id
     WHERE et.empleado_id = :empleado_id AND et.activo = 1
       AND et.fecha_inicio <= COALESCE(:fecha_fin, '9999-12-31')
       AND (et.fecha_fin IS NULL OR et.fecha_fin >= :fecha_inicio)
     LIMIT 1`,
    { empleado_id, fecha_inicio, fecha_fin: fecha_fin || null });

  const haySolape = solapados.length > 0;
  const [r] = await db.query(
    `INSERT INTO empleado_turno (empleado_id, turno_id, fecha_inicio, fecha_fin, activo)
     VALUES (:empleado_id, :turno_id, :fecha_inicio, :fecha_fin, :activo)`,
    { empleado_id, turno_id, fecha_inicio, fecha_fin: fecha_fin || null, activo: haySolape ? 0 : 1 });

  res.status(201).json({
    id: r.insertId,
    activo: !haySolape,
    advertencia: haySolape
      ? `El turno se solapa con "${solapados[0].nombre}" (activo). Se registró INACTIVO; actívelo manualmente si corresponde.`
      : null
  });
});

router.put('/empleado-turno/:id', ASIGNACIONES, async (req, res) => {
  // Activar manualmente: validar que no se solape con otro turno activo
  if (req.body.activo) {
    const [asig] = await db.query('SELECT * FROM empleado_turno WHERE id=:id', { id: req.params.id });
    if (asig.length) {
      const a = asig[0];
      const [solapados] = await db.query(
        `SELECT id FROM empleado_turno
         WHERE empleado_id = :emp AND activo = 1 AND id <> :id
           AND fecha_inicio <= COALESCE(:fin, '9999-12-31')
           AND (fecha_fin IS NULL OR fecha_fin >= :inicio)
         LIMIT 1`,
        { emp: a.empleado_id, id: a.id, inicio: a.fecha_inicio, fin: a.fecha_fin });
      if (solapados.length) {
        return res.status(409).json({
          error: 'No se puede activar: se solapa con otro turno activo del empleado. Inactive el otro primero.'
        });
      }
    }
  }
  await db.query('UPDATE empleado_turno SET activo=:activo WHERE id=:id',
    { id: req.params.id, activo: req.body.activo ? 1 : 0 });
  res.json({ ok: true });
});

module.exports = router;
