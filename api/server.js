// Servidor principal: API REST + servir la UI estática
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false })); // CSP simplificado para el demo
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Rutas de la API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/marcaciones', require('./routes/marcaciones'));
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api', require('./routes/catalogos'));

// UI estática
app.use(express.static('../public'));

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
