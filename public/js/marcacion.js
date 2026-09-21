// Vista mobile-first: GPS, reloj en vivo y marcación E/S
const Marcacion = {
  posicion: null,
  puntos: [],

  async iniciar() {
    document.getElementById('marc-saludo').textContent =
      `Hola, ${API.usuario.nombres} ${API.usuario.apellidos}`;
    this.iniciarReloj();
    this.solicitarGPS();
    this.cargarMisMarcaciones();
    document.getElementById('btn-entrada').onclick = () => this.marcar('ENTRADA');
    document.getElementById('btn-salida').onclick  = () => this.marcar('SALIDA');
  },

  iniciarReloj() {
    const tick = () => {
      document.getElementById('marc-reloj').textContent =
        new Date().toLocaleTimeString('es-ES', { hour12: false });
    };
    tick();
    setInterval(tick, 1000);
  },

  solicitarGPS() {
    const badge = document.getElementById('marc-gps-estado');
    if (!navigator.geolocation) {
      badge.textContent = '❌ GPS no disponible en este dispositivo';
      return;
    }
    navigator.geolocation.watchPosition(
      async (pos) => {
        this.posicion = pos;
        badge.className = 'badge text-bg-success';
        badge.textContent = `📍 GPS listo (±${Math.round(pos.coords.accuracy)} m)`;
        document.getElementById('marc-coords').textContent =
          `Lat ${pos.coords.latitude.toFixed(6)}, Lon ${pos.coords.longitude.toFixed(6)}`;
        await this.mostrarPuntoCercano(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        badge.className = 'badge text-bg-danger';
        badge.textContent = '❌ Active la ubicación del dispositivo';
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
  },

  async mostrarPuntoCercano(lat, lon) {
    try {
      this.puntos = await API.get('/api/marcaciones/mis-puntos');
      if (this.puntos.length === 0) {
        document.getElementById('marc-punto-cercano').textContent =
          'No tiene puntos autorizados. Contacte a RRHH.';
        return;
      }
      let cercano = null, min = Infinity;
      for (const p of this.puntos) {
        const d = this.haversine(lat, lon, Number(p.latitud), Number(p.longitud));
        if (d < min) { min = d; cercano = p; }
      }
      const dentro = min <= cercano.radio_mt;
      document.getElementById('marc-punto-cercano').innerHTML =
        `Punto: <strong>${cercano.nombre}</strong> — a ${min} m ` +
        (dentro ? '<span class="text-success">(dentro del rango ✅)</span>'
                : `<span class="text-warning">(radio ${cercano.radio_mt} m ⚠️)</span>`);
    } catch { /* silencioso */ }
  },

  haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000, r = d => d * Math.PI / 180;
    const a = Math.sin(r(lat2 - lat1) / 2) ** 2 +
      Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(a)));
  },

  async marcar(tipo) {
    const resDiv = document.getElementById('marc-resultado');
    if (!this.posicion) {
      resDiv.innerHTML = '<div class="alert alert-warning">Espere a que el GPS obtenga su ubicación.</div>';
      return;
    }
    const btn = document.getElementById(tipo === 'ENTRADA' ? 'btn-entrada' : 'btn-salida');
    btn.disabled = true;
    try {
      const data = await API.post('/api/marcaciones', {
        tipo,
        latitud: this.posicion.coords.latitude,
        longitud: this.posicion.coords.longitude,
        precision_mt: Math.round(this.posicion.coords.accuracy)
      });
      const clase = data.estado === 'VALIDA' ? 'alert-success'
                  : data.estado === 'DUPLICADA' ? 'alert-secondary' : 'alert-warning';
      resDiv.innerHTML = `<div class="alert ${clase}">${data.mensaje}</div>`;
      this.cargarMisMarcaciones();
    } catch (ex) {
      resDiv.innerHTML = `<div class="alert alert-danger">${ex.message}</div>`;
    } finally {
      btn.disabled = false;
    }
  },

  async cargarMisMarcaciones() {
    try {
      const rows = await API.get('/api/marcaciones/mias');
      document.getElementById('lista-marcaciones').innerHTML = rows.length
        ? rows.slice(0, 10).map(m => `
          <div class="d-flex justify-content-between border-bottom py-1">
            <span>${m.tipo === 'ENTRADA' ? '🟢' : '🔴'} ${m.punto}</span>
            <span class="text-muted">${new Date(m.fecha_hora).toLocaleString('es-ES')}
              <em>(${m.estado}${m.es_retraso ? ' · RETRASO' : ''})</em></span>
          </div>`).join('')
        : '<p class="text-muted">Sin marcaciones aún.</p>';
    } catch { /* silencioso */ }
  }
};
