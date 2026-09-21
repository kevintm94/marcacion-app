// Autenticación: login y perfil
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.username, u.password_hash, u.activo, r.nombre AS rol,
              e.id AS empleado_id, e.nombres, e.apellidos
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN empleados e ON e.id = u.empleado_id
       WHERE u.username = :username`, { username });

    const usuario = rows[0];
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const ok = await bcrypt.compare(password, usuario.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: usuario.id, empleado_id: usuario.empleado_id, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({
      token,
      usuario: {
        id: usuario.id,
        empleado_id: usuario.empleado_id,
        username: usuario.username,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        rol: usuario.rol
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/perfil', autenticar, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.username, r.nombre AS rol, e.nombres, e.apellidos, e.codigo
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN empleados e ON e.id = u.empleado_id
       WHERE u.id = :id`, { id: req.usuario.id });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
