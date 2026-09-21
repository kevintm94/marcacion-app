// Reportes de asistencia (REVISOR_RH, OPERACIONES, ADMIN)
// - Agrupado por fecha, empleado y punto de marcación
// - Entrada/Salida = única marcación VALIDA de ese día/punto (vacío si no hay)
// - Incluye el log completo de intentos por grupo
const express = require('express');
const db = require('../db');
const { autenticar, autorizar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar, autorizar('REVISOR_RH', 'OPERACIONES', 'ADMIN'));

// GET /api/reportes/asistencia?desde&hasta&empleado_id
router.get('/asistencia', async (req, res) => {
  const { desde, hasta, empleado_id } = req.query;
  const params = { desde: desde || null, hasta: hasta || null, empId: empleado_id || null };
  try {
    // Grupo: fecha + empleado + punto
    const [grupos] = await db.query(
      `SELECT m.empleado_id, m.punto_id, p.nombre AS punto,
              e.codigo, e.nombres, e.apellidos,
              DATE(m.fecha_hora) AS fecha,
              MAX(CASE WHEN m.tipo='ENTRADA' AND m.estado='VALIDA' THEN TIME(m.fecha_hora) END) AS entrada,
              MAX(CASE WHEN m.tipo='SALIDA'  AND m.estado='VALIDA' THEN TIME(m.fecha_hora) END) AS salida,
              SUM(m.estado='FUERA_DE_RANGO') AS fuera_de_rango,
              SUM(m.estado='DUPLICADA') AS duplicadas,
              SUM(m.es_retraso) AS retrasos,
              COUNT(*) AS intentos
       FROM marcaciones m
       JOIN empleados e ON e.id = m.empleado_id
       JOIN puntos_marcacion p ON p.id = m.punto_id
       WHERE (:desde IS NULL OR DATE(m.fecha_hora) >= :desde)
         AND (:hasta IS NULL OR DATE(m.fecha_hora) <= :hasta)
         AND (:empId IS NULL OR m.empleado_id = :empId)
       GROUP BY DATE(m.fecha_hora), m.empleado_id, m.punto_id,
                e.codigo, e.nombres, e.apellidos, p.nombre
       ORDER BY fecha DESC, e.apellidos, p.nombre`,
      params);

    // Log completo de intentos (mismo filtro)
    const [logs] = await db.query(
      `SELECT m.id, m.empleado_id, m.punto_id,
              DATE(m.fecha_hora) AS fecha,
              m.tipo, TIME(m.fecha_hora) AS hora,
              m.estado, m.es_retraso, m.distancia_mt, m.precision_mt
       FROM marcaciones m
       WHERE (:desde IS NULL OR DATE(m.fecha_hora) >= :desde)
         AND (:hasta IS NULL OR DATE(m.fecha_hora) <= :hasta)
         AND (:empId IS NULL OR m.empleado_id = :empId)
       ORDER BY m.fecha_hora`,
      params);

    // Anexar log a cada grupo
    const porGrupo = {};
    for (const l of logs) {
      const k = `${l.fecha.toISOString().slice(0, 10)}|${l.empleado_id}|${l.punto_id}`;
      (porGrupo[k] = porGrupo[k] || []).push({
        tipo: l.tipo, hora: l.hora, estado: l.estado,
        es_retraso: !!l.es_retraso,
        distancia_mt: l.distancia_mt, precision_mt: l.precision_mt
      });
    }
    for (const g of grupos) {
      const k = `${g.fecha.toISOString().slice(0, 10)}|${g.empleado_id}|${g.punto_id}`;
      g.log = porGrupo[k] || [];
    }
    res.json(grupos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/reportes/marcaciones-detalle?desde&hasta&empleado_id
router.get('/marcaciones-detalle', async (req, res) => {
  const { desde, hasta, empleado_id } = req.query;
  try {
    const [rows] = await db.query(
      `SELECT m.id, e.codigo, e.nombres, e.apellidos, m.tipo, m.fecha_hora,
              m.latitud, m.longitud, m.distancia_mt, m.estado, m.es_retraso,
              p.nombre AS punto
       FROM marcaciones m
       JOIN empleados e ON e.id = m.empleado_id
       JOIN puntos_marcacion p ON p.id = m.punto_id
       WHERE (:desde IS NULL OR DATE(m.fecha_hora) >= :desde)
         AND (:hasta IS NULL OR DATE(m.fecha_hora) <= :hasta)
         AND (:empId IS NULL OR m.empleado_id = :empId)
       ORDER BY m.fecha_hora DESC LIMIT 1000`,
      { desde: desde || null, hasta: hasta || null, empId: empleado_id || null });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
