// Crea el usuario administrador por defecto (admin / Admin123*)
const bcrypt = require('bcryptjs');
const db = require('./db');

(async () => {
  try {
    const hash = await bcrypt.hash('Admin123*', 10);
    await db.query(
      `INSERT IGNORE INTO usuarios (empleado_id, username, password_hash, rol_id)
       VALUES (1, 'admin', :hash, 4)`, { hash });
    console.log('Usuario admin listo -> username: admin, password: Admin123*');
    process.exit(0);
  } catch (err) {
    console.error('Error en seed:', err.message);
    process.exit(1);
  }
})();
