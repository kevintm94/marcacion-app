// Marcación de asistencia (ENTRADA / SALIDA) con validación GPS
// Reglas de negocio:
//  - Una sola marcación VALIDA por (empleado, punto, tipo, fecha). Las posteriores
//    quedan como DUPLICADA aunque estén dentro del rango/turno.
//  - ENTRADA marcada después de hora_entrada + tolerancia del turno => es_retraso = 1
const express = require('express');
const db = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// Fórmula de Haversine: distancia en metros entre dos coordenadas
function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

// Suma minutos de tolerancia a una hora 'HH:MM:SS' -> Date de hoy
function horaConTolerancia(horaStr, toleranciaMin) {
  const [h, m, s] = horaStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, s || 0, 0);
  d.setMinutes(d.getMinutes() + toleranciaMin);
  return d;
}

// GET /api/marcaciones/mi-config -> ¿tiene al menos un punto y un turno asignados?
router.get('/mi-config', autenticar, async (req, res) => {
  try {
    const [p] = await db.query(
      `SELECT COUNT(*) AS n FROM empleado_punto
       WHERE empleado_id = :empId AND activo = 1`, { empId: req.usuario.empleado_id });
    const [t] = await db.query(
      `SELECT COUNT(*) AS n FROM empleado_turno et
       JOIN turnos tr ON tr.id = et.turno_id
       WHERE et.empleado_id = :empId AND et.activo = 1 AND tr.activo = 1
         AND et.fecha_inicio <= CURDATE()
         AND (et.fecha_fin IS NULL OR et.fecha_fin >= CURDATE())`,
      { empId: req.usuario.empleado_id });
    res.json({ tienePunto: p[0].n > 0, tieneTurno: t[0].n > 0 });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/marcaciones/mis-puntos -> puntos autorizados del empleado logueado
router.get('/mis-puntos', autenticar, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.id, p.nombre, p.direccion, p.latitud, p.longitud, p.radio_mt
       FROM empleado_punto ep
       JOIN puntos_marcacion p ON p.id = ep.punto_id
       WHERE ep.empleado_id = :empId AND ep.activo = 1 AND p.activo = 1`,
      { empId: req.usuario.empleado_id });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/marcaciones  { tipo: 'ENTRADA'|'SALIDA', latitud, longitud, precision_mt }
router.post('/', autenticar, async (req, res) => {
  const { tipo, latitud, longitud, precision_mt } = req.body;
  const empId = req.usuario.empleado_id;

  if (!['ENTRADA', 'SALIDA'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo de marcación inválido' });
  }
  if (latitud == null || longitud == null ||
      Math.abs(latitud) > 90 || Math.abs(longitud) > 180) {
    return res.status(400).json({ error: 'Coordenadas GPS inválidas' });
  }

  try {
    // 1) Buscar el punto autorizado más cercano
    const [puntos] = await db.query(
      `SELECT p.id, p.nombre, p.latitud, p.longitud, p.radio_mt
       FROM empleado_punto ep
       JOIN puntos_marcacion p ON p.id = ep.punto_id
       WHERE ep.empleado_id = :empId AND ep.activo = 1 AND p.activo = 1`,
      { empId });

    if (puntos.length === 0) {
      return res.status(403).json({ error: 'No tiene puntos de marcación autorizados' });
    }

    let puntoElegido = null, distMin = Infinity;
    for (const p of puntos) {
      const d = distanciaMetros(latitud, longitud, Number(p.latitud), Number(p.longitud));
      if (d < distMin) { distMin = d; puntoElegido = { ...p, distancia: d }; }
    }

    // 2) ¿Ya existe una marcación VALIDA de este tipo hoy, en este punto?
    const [prevValida] = await db.query(
      `SELECT id, fecha_hora FROM marcaciones
       WHERE empleado_id = :empId AND punto_id = :puntoId AND tipo = :tipo
         AND estado = 'VALIDA' AND DATE(fecha_hora) = CURDATE()
       LIMIT 1`,
      { empId, puntoId: puntoElegido.id, tipo });

    const esDuplicada = prevValida.length > 0;

    // 3) Turno vigente del empleado
    const [turnos] = await db.query(
      `SELECT t.id, t.hora_entrada, t.hora_salida, t.tolerancia_min
       FROM empleado_turno et
       JOIN turnos t ON t.id = et.turno_id
       WHERE et.empleado_id = :empId AND et.activo = 1 AND t.activo = 1
         AND et.fecha_inicio <= CURDATE()
         AND (et.fecha_fin IS NULL OR et.fecha_fin >= CURDATE())
       ORDER BY et.fecha_inicio DESC LIMIT 1`,
      { empId });
    const turno = turnos[0] || null;

    // 4) Retraso: solo aplica a ENTRADA y solo si hay turno vigente
    let esRetraso = 0;
    if (tipo === 'ENTRADA' && turno && !esDuplicada) {
      const limite = horaConTolerancia(String(turno.hora_entrada), turno.tolerancia_min);
      if (new Date() > limite) esRetraso = 1;
    }

    // 5) Insertar marcación
    const estado = esDuplicada ? 'DUPLICADA'
                 : (distMin <= puntoElegido.radio_mt ? 'VALIDA' : 'FUERA_DE_RANGO');

    const [result] = await db.query(
      `INSERT INTO marcaciones
        (empleado_id, punto_id, turno_id, tipo, latitud, longitud, precision_mt,
         distancia_mt, estado, es_retraso, fecha_hora, dispositivo)
       VALUES (:empId, :puntoId, :turnoId, :tipo, :lat, :lon, :prec, :dist, :estado, :retraso, NOW(), :disp)`,
      {
        empId, puntoId: puntoElegido.id,
        turnoId: turno ? turno.id : null,
        tipo, lat: latitud, lon: longitud,
        prec: precision_mt ?? null,
        dist: distMin, estado, retraso: esRetraso,
        disp: (req.headers['user-agent'] || '').slice(0, 150)
      });

    // Mensaje descriptivo
    let mensaje;
    if (esDuplicada) {
      mensaje = `${tipo} duplicada: ya registró una ${tipo} válida hoy en ${puntoElegido.nombre} ` +
                `(${new Date(prevValida[0].fecha_hora).toLocaleTimeString('es-ES', { hour12: false })}).`;
    } else if (estado === 'FUERA_DE_RANGO') {
      mensaje = `Está a ${distMin} m de ${puntoElegido.nombre} (radio ${puntoElegido.radio_mt} m). ` +
                `Registrada como FUERA_DE_RANGO.`;
    } else if (esRetraso) {
      mensaje = `${tipo} registrada con RETRASO en ${puntoElegido.nombre} ` +
                `(tolerancia del turno: ${turno.tolerancia_min} min).`;
    } else {
      mensaje = `${tipo} registrada correctamente en ${puntoElegido.nombre}.`;
    }

    res.status(201).json({
      id: result.insertId, tipo,
      punto: puntoElegido.nombre,
      distancia_mt: distMin,
      radio_mt: puntoElegido.radio_mt,
      estado, es_retraso: !!esRetraso,
      mensaje
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/marcaciones/mias?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
router.get('/mias', autenticar, async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    const [rows] = await db.query(
      `SELECT m.id, m.tipo, m.fecha_hora, m.latitud, m.longitud, m.distancia_mt,
              m.estado, m.es_retraso, p.nombre AS punto
       FROM marcaciones m
       JOIN puntos_marcacion p ON p.id = m.punto_id
       WHERE m.empleado_id = :empId
         AND (:desde IS NULL OR DATE(m.fecha_hora) >= :desde)
         AND (:hasta IS NULL OR DATE(m.fecha_hora) <= :hasta)
       ORDER BY m.fecha_hora DESC LIMIT 200`,
      { empId: req.usuario.empleado_id, desde: desde || null, hasta: hasta || null });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
