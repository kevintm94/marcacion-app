// Panel admin para escritorio: CRUD de catálogos y reportes
// Edición/activación solo disponible para el usuario logeado con rol OPERACIONES/ADMIN
const Admin = {
  async cargarTab(tab) {
    const c = document.getElementById('contenido-admin');
    c.innerHTML = '<div class="spinner-border"></div>';
    try {
      if (tab === 'reportes')        await this.renderReportes(c);
      else if (tab === 'empleados')  await this.renderEmpleados(c);
      else if (tab === 'puntos')     await this.renderPuntos(c);
      else if (tab === 'turnos')     await this.renderTurnos(c);
      else if (tab === 'asignaciones') await this.renderAsignaciones(c);
    } catch (ex) {
      c.innerHTML = `<div class="alert alert-danger">${ex.message}</div>`;
    }
  },

  // ============ REPORTES ============
  async renderReportes(c) {
    const hoy = new Date().toISOString().slice(0, 10);
    c.innerHTML = `
      <div class="card shadow"><div class="card-body">
        <form id="f-rep" class="row g-2 mb-3">
          <div class="col-auto"><input type="date" class="form-control" id="rep-desde" value="${hoy}"></div>
          <div class="col-auto"><input type="date" class="form-control" id="rep-hasta" value="${hoy}"></div>
          <div class="col-auto"><button class="btn btn-primary">Consultar</button></div>
          <div class="col-auto"><button type="button" class="btn btn-outline-secondary" id="btn-export">Exportar CSV (desplegado)</button></div>
        </form>
        <p class="small text-muted">💡 Clic en una fila para desplegar el log de intentos de marcación.</p>
        <div class="table-responsive"><table class="table table-striped table-sm" id="t-rep">
          <thead><tr><th></th><th>Código</th><th>Empleado</th><th>Fecha</th><th>Punto</th>
            <th>Entrada</th><th>Salida</th><th>Retrasos</th><th>Fuera de rango</th><th>Duplicadas</th><th>Intentos</th></tr></thead>
          <tbody></tbody></table></div>
      </div></div>`;
    const rep = k => document.getElementById(`rep-${k}`).value;
    const estadoBadge = e =>
      e === 'VALIDA' ? 'success' : e === 'FUERA_DE_RANGO' ? 'warning' : 'secondary';

    let datos = [];
    const consultar = async () => {
      datos = await API.get(`/api/reportes/asistencia?desde=${rep('desde')}&hasta=${rep('hasta')}`);
      document.querySelector('#t-rep tbody').innerHTML = datos.map((r, i) => `
        <tr class="fila-grupo" data-i="${i}" style="cursor:pointer">
          <td>▸</td><td>${r.codigo}</td><td>${r.apellidos} ${r.nombres}</td>
          <td>${r.fecha?.slice(0, 10)}</td><td>${r.punto}</td>
          <td>${r.entrada || ''}</td><td>${r.salida || ''}</td>
          <td>${r.retrasos || 0}</td><td>${r.fuera_de_rango || 0}</td>
          <td>${r.duplicadas || 0}</td><td>${r.intentos}</td>
        </tr>
        <tr class="fila-log d-none" data-i="${i}">
          <td colspan="11" class="bg-light">
            <table class="table table-sm table-bordered mb-0 small">
              <thead><tr><th>Hora</th><th>Tipo</th><th>Estado</th><th>Distancia (m)</th><th>Precisión (m)</th></tr></thead>
              <tbody>${r.log.map(l => `
                <tr class="${l.estado !== 'VALIDA' ? 'text-muted' : ''}">
                  <td>${l.hora}</td><td>${l.tipo}</td>
                  <td><span class="badge text-bg-${estadoBadge(l.estado)}">${l.estado}</span>
                      ${l.es_retraso ? ' <span class="badge text-bg-danger">RETRASO</span>' : ''}</td>
                  <td>${l.distancia_mt}</td><td>${l.precision_mt ?? '—'}</td>
                </tr>`).join('')}</tbody>
            </table>
          </td>
        </tr>`).join('')
        || '<tr><td colspan="11" class="text-muted text-center">Sin datos</td></tr>';

      // Desplegar log al hacer clic en la fila
      document.querySelectorAll('.fila-grupo').forEach(f => {
        f.addEventListener('click', () => {
          const log = document.querySelector(`.fila-log[data-i="${f.dataset.i}"]`);
          log.classList.toggle('d-none');
          f.firstElementChild.textContent = log.classList.contains('d-none') ? '▸' : '▾';
        });
      });
    };

    document.getElementById('f-rep').onsubmit = e => { e.preventDefault(); consultar(); };
    document.getElementById('btn-export').onclick = () => {
      const lineas = ['codigo;empleado;fecha;punto;entrada_valida;salida_valida;retrasos;fuera_rango;duplicadas'];
      for (const r of datos) {
        lineas.push([r.codigo, `${r.apellidos} ${r.nombres}`, r.fecha?.slice(0, 10), r.punto,
          r.entrada || '', r.salida || '', r.retrasos || 0, r.fuera_de_rango || 0, r.duplicadas || 0].join(';'));
        for (const l of r.log) {
          lineas.push(['LOG', '', r.fecha?.slice(0, 10), r.punto,
            `${l.hora} ${l.tipo} ${l.estado}${l.es_retraso ? ' RETRASO' : ''}`,
            `dist=${l.distancia_mt}m`, `prec=${l.precision_mt ?? '-'}m`].join(';'));
        }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['\ufeff' + lineas.join('\n')], { type: 'text/csv' }));
      a.download = 'reporte_asistencia.csv'; a.click();
    };
    consultar();
  },

  // ============ EMPLEADOS Y USUARIOS (edición y activación) ============
  async renderEmpleados(c) {
    const [emps, roles] = await Promise.all([API.get('/api/empleados'), API.get('/api/roles')]);
    const puedeEditar = API.puedeGestionar(); // solo el usuario logeado con rol adecuado

    c.innerHTML = `
      <div class="row">
        <div class="col-lg-8"><div class="card shadow"><div class="card-body">
          <h6>Empleados</h6>
          <div class="table-responsive"><table class="table table-sm table-striped align-middle">
            <thead><tr><th>Código</th><th>Nombre</th><th>Usuario</th><th>Rol</th>
              <th>Empleado</th><th>Usuario acceso</th>${puedeEditar ? '<th>Acciones</th>' : ''}</tr></thead>
            <tbody>${emps.map(e => `
              <tr>
                <td>${e.codigo}</td><td>${e.apellidos} ${e.nombres}</td>
                <td>${e.username || '—'}</td><td>${e.rol || '—'}</td>
                <td>${e.activo ? '<span class="badge text-bg-success">Activo</span>' : '<span class="badge text-bg-secondary">Inactivo</span>'}</td>
                <td>${e.username ? (e.usuario_activo ? '<span class="badge text-bg-success">Activo</span>' : '<span class="badge text-bg-secondary">Inactivo</span>') : '—'}</td>
                ${puedeEditar ? `<td class="text-nowrap">
                  <button class="btn btn-sm btn-outline-primary" onclick="Admin.editarEmpleado(${e.id})">Editar</button>
                  <button class="btn btn-sm btn-outline-${e.activo ? 'danger' : 'success'}"
                    onclick="Admin.toggleEmpleado(${e.id}, ${e.activo ? 0 : 1})">
                    ${e.activo ? 'Inactivar' : 'Activar'}</button>
                  ${e.usuario_id ? `
                  <button class="btn btn-sm btn-outline-primary" onclick="Admin.editarUsuario(${e.usuario_id})">Usuario</button>
                  <button class="btn btn-sm btn-outline-secondary" onclick="Admin.toggleUsuario(${e.usuario_id}, ${e.usuario_activo ? 0 : 1})">
                    ${e.usuario_activo ? 'Bloquear acceso' : 'Permitir acceso'}</button>` : ''}
                </td>` : ''}
              </tr>`).join('')}</tbody>
          </table></div></div></div></div>
        <div class="col-lg-4" ${puedeEditar ? '' : 'hidden'}>
          <div class="card shadow mb-3"><div class="card-body">
            <h6>Nuevo empleado</h6>
            <form id="f-emp">
              <input class="form-control mb-2" name="codigo" placeholder="Código" required>
              <input class="form-control mb-2" name="nombres" placeholder="Nombres" required>
              <input class="form-control mb-2" name="apellidos" placeholder="Apellidos" required>
              <input class="form-control mb-2" name="correo" type="email" placeholder="Correo">
              <input class="form-control mb-2" name="telefono" placeholder="Teléfono">
              <button class="btn btn-primary w-100">Guardar</button>
            </form></div></div>
          <div class="card shadow"><div class="card-body">
            <h6>Crear usuario</h6>
            <form id="f-user">
              <select class="form-select mb-2" name="empleado_id" required>
                <option value="">Empleado…</option>
                ${emps.filter(e => !e.username).map(e =>
                  `<option value="${e.id}">${e.codigo} — ${e.apellidos} ${e.nombres}</option>`).join('')}
              </select>
              <input class="form-control mb-2" name="username" placeholder="Usuario" required>
              <input class="form-control mb-2" name="password" type="password" placeholder="Contraseña (mín. 6)" required>
              <select class="form-select mb-2" name="rol_id" required>
                ${roles.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('')}
              </select>
              <button class="btn btn-primary w-100">Crear usuario</button>
            </form></div></div>
        </div>
      </div>

      <!-- Modal editar empleado -->
      <div class="modal fade" id="modal-emp" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Editar empleado</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body"><form id="f-edit-emp">
          <input type="hidden" name="id">
          <div class="mb-2"><label class="form-label small">Código</label>
            <input class="form-control" name="codigo" readonly></div>
          <div class="mb-2"><label class="form-label small">Nombres</label>
            <input class="form-control" name="nombres" required></div>
          <div class="mb-2"><label class="form-label small">Apellidos</label>
            <input class="form-control" name="apellidos" required></div>
          <div class="mb-2"><label class="form-label small">Correo</label>
            <input class="form-control" name="correo" type="email"></div>
          <div class="mb-2"><label class="form-label small">Teléfono</label>
            <input class="form-control" name="telefono"></div>
        </form></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
          <button class="btn btn-primary" id="btn-guardar-emp">Guardar cambios</button>
        </div>
      </div></div></div>

      <!-- Modal editar usuario -->
      <div class="modal fade" id="modal-user" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Editar usuario</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body"><form id="f-edit-user">
          <input type="hidden" name="id">
          <div class="mb-2"><label class="form-label small">Usuario</label>
            <input class="form-control" name="username" readonly></div>
          <div class="mb-2"><label class="form-label small">Rol</label>
            <select class="form-select" name="rol_id">
              ${roles.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('')}
            </select></div>
          <div class="mb-2"><label class="form-label small">Nueva contraseña (dejar vacío para no cambiar)</label>
            <input class="form-control" name="password" type="password" placeholder="Mín. 6 caracteres"></div>
        </form></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
          <button class="btn btn-primary" id="btn-guardar-user">Guardar cambios</button>
        </div>
      </div></div></div>`;

    if (puedeEditar) {
      document.getElementById('f-emp').onsubmit = async e => {
        e.preventDefault();
        try { await API.post('/api/empleados', Object.fromEntries(new FormData(e.target))); this.cargarTab('empleados'); }
        catch (ex) { alert(ex.message); }
      };
      document.getElementById('f-user').onsubmit = async e => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.target));
        d.empleado_id = +d.empleado_id; d.rol_id = +d.rol_id;
        try { await API.post('/api/usuarios', d); this.cargarTab('empleados'); }
        catch (ex) { alert(ex.message); }
      };
      document.getElementById('btn-guardar-emp').onclick = async () => {
        const d = Object.fromEntries(new FormData(document.getElementById('f-edit-emp')));
        const id = d.id; delete d.id;
        try {
          await API.put(`/api/empleados/${id}`, { ...d, activo: 1 });
          bootstrap.Modal.getInstance(document.getElementById('modal-emp')).hide();
          this.cargarTab('empleados');
        } catch (ex) { alert(ex.message); }
      };
      document.getElementById('btn-guardar-user').onclick = async () => {
        const d = Object.fromEntries(new FormData(document.getElementById('f-edit-user')));
        const id = d.id; delete d.id;
        if (!d.password) delete d.password;
        try {
          await API.put(`/api/usuarios/${id}`, { ...d, activo: 1 });
          bootstrap.Modal.getInstance(document.getElementById('modal-user')).hide();
          this.cargarTab('empleados');
        } catch (ex) { alert(ex.message); }
      };
    }
  },

  async editarEmpleado(id) {
    const emps = await API.get('/api/empleados');
    const e = emps.find(x => x.id === id);
    const f = document.getElementById('f-edit-emp');
    f.id.value = e.id; f.codigo.value = e.codigo; f.nombres.value = e.nombres;
    f.apellidos.value = e.apellidos; f.correo.value = e.correo || '';
    f.telefono.value = e.telefono || '';
    new bootstrap.Modal(document.getElementById('modal-emp')).show();
  },

  async toggleEmpleado(id, activo) {
    const emps = await API.get('/api/empleados');
    const e = emps.find(x => x.id === id);
    await API.put(`/api/empleados/${id}`, {
      nombres: e.nombres, apellidos: e.apellidos, correo: e.correo,
      telefono: e.telefono, activo
    });
    this.cargarTab('empleados');
  },

  async editarUsuario(id) {
    const [emps, roles] = await Promise.all([API.get('/api/empleados'), API.get('/api/roles')]);
    const u = emps.find(x => x.usuario_id === id);
    const f = document.getElementById('f-edit-user');
    f.id.value = id; f.username.value = u.username; f.password.value = '';
    f.rol_id.value = u.rol_id || roles[0].id;
    new bootstrap.Modal(document.getElementById('modal-user')).show();
  },

  async toggleUsuario(id, activo) {
    const emps = await API.get('/api/empleados');
    const u = emps.find(x => x.usuario_id === id);
    await API.put(`/api/usuarios/${id}`, { rol_id: u.rol_id, activo });
    this.cargarTab('empleados');
  },

  // ============ PUNTOS ============
  async renderPuntos(c) {
    const puntos = await API.get('/api/puntos');
    c.innerHTML = `
      <div class="row"><div class="col-lg-7"><div class="card shadow"><div class="card-body">
        <h6>Puntos de marcación</h6>
        <table class="table table-sm table-striped"><thead>
          <tr><th>Nombre</th><th>Dirección</th><th>Lat</th><th>Lon</th><th>Radio (m)</th><th>Activo</th></tr></thead>
          <tbody>${puntos.map(p => `<tr><td>${p.nombre}</td><td>${p.direccion || ''}</td>
            <td>${p.latitud}</td><td>${p.longitud}</td><td>${p.radio_mt}</td>
            <td>${p.activo ? '✅' : '⛔'}</td></tr>`).join('')}</tbody></table>
      </div></div></div>
      <div class="col-lg-5" ${API.puedeGestionar() ? '' : 'hidden'}><div class="card shadow"><div class="card-body">
        <h6>Nuevo punto</h6>
        <form id="f-punto">
          <input class="form-control mb-2" name="nombre" placeholder="Nombre (ej. Sucursal Norte)" required>
          <input class="form-control mb-2" name="direccion" placeholder="Dirección">
          <input class="form-control mb-2" name="latitud" type="number" step="any" placeholder="Latitud (ej. 19.432608)" required>
          <input class="form-control mb-2" name="longitud" type="number" step="any" placeholder="Longitud (ej. -99.133208)" required>
          <input class="form-control mb-2" name="radio_mt" type="number" placeholder="Radio tolerancia en metros" value="100">
          <button class="btn btn-primary w-100">Guardar</button>
        </form>
        <p class="small text-muted mt-2">💡 Obtén coordenadas desde Google Maps (clic derecho → coordenadas).</p>
      </div></div></div></div>`;
    const f = document.getElementById('f-punto');
    if (f) f.onsubmit = async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      d.latitud = +d.latitud; d.longitud = +d.longitud; d.radio_mt = +d.radio_mt || 100;
      try { await API.post('/api/puntos', d); this.cargarTab('puntos'); }
      catch (ex) { alert(ex.message); }
    };
  },

  // ============ TURNOS ============
  async renderTurnos(c) {
    const turnos = await API.get('/api/turnos');
    c.innerHTML = `
      <div class="row"><div class="col-lg-7"><div class="card shadow"><div class="card-body">
        <h6>Turnos</h6>
        <table class="table table-sm table-striped"><thead>
          <tr><th>Nombre</th><th>Entrada</th><th>Salida</th><th>Tolerancia (min)</th><th>Activo</th></tr></thead>
          <tbody>${turnos.map(t => `<tr><td>${t.nombre}</td><td>${t.hora_entrada}</td>
            <td>${t.hora_salida}</td><td>${t.tolerancia_min}</td><td>${t.activo ? '✅' : '⛔'}</td></tr>`).join('')}
          </tbody></table></div></div></div>
      <div class="col-lg-5" ${API.puedeGestionar() ? '' : 'hidden'}><div class="card shadow"><div class="card-body">
        <h6>Nuevo turno</h6>
        <form id="f-turno">
          <input class="form-control mb-2" name="nombre" placeholder="Nombre del turno" required>
          <label class="form-label small">Hora entrada</label>
          <input class="form-control mb-2" name="hora_entrada" type="time" required>
          <label class="form-label small">Hora salida</label>
          <input class="form-control mb-2" name="hora_salida" type="time" required>
          <input class="form-control mb-2" name="tolerancia_min" type="number" value="10" placeholder="Tolerancia (min)">
          <button class="btn btn-primary w-100">Guardar</button>
        </form></div></div></div></div>`;
    const f = document.getElementById('f-turno');
    if (f) f.onsubmit = async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      d.tolerancia_min = +d.tolerancia_min || 10;
      await API.post('/api/turnos', d);
      this.cargarTab('turnos');
    };
  },

  // ============ ASIGNACIONES (REVISOR_RH, OPERACIONES, ADMIN) ============
  async renderAsignaciones(c) {
    const [emps, puntos, turnos, asigP, asigT] = await Promise.all([
      API.get('/api/empleados'), API.get('/api/puntos'),
      API.get('/api/turnos'), API.get('/api/empleado-punto'), API.get('/api/empleado-turno')
    ]);
    c.innerHTML = `
      <div class="row">
        <div class="col-lg-6">
          <div class="card shadow mb-3"><div class="card-body">
            <h6>Asignar empleado → punto</h6>
            <form id="f-ap" class="row g-2">
              <div class="col"><select class="form-select" name="empleado_id" required>
                ${emps.filter(e => e.activo).map(e => `<option value="${e.id}">${e.codigo} — ${e.apellidos}</option>`).join('')}
              </select></div>
              <div class="col"><select class="form-select" name="punto_id" required>
                ${puntos.filter(p => p.activo).map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
              </select></div>
              <div class="col-auto"><button class="btn btn-primary">Asignar</button></div>
            </form>
            <table class="table table-sm mt-3"><thead><tr><th>Empleado</th><th>Punto</th><th>Activo</th><th></th></tr></thead>
            <tbody>${asigP.map(a => `<tr><td>${a.apellidos} ${a.nombres}</td><td>${a.punto}</td>
              <td>${a.activo ? '✅' : '⛔'}</td>
              <td><button class="btn btn-sm btn-outline-${a.activo ? 'danger' : 'success'}"
                onclick="Admin.toggleAsig('empleado-punto',${a.id},${a.activo ? 0 : 1})">
                ${a.activo ? 'Desactivar' : 'Activar'}</button></td></tr>`).join('')}
            </tbody></table></div></div>
        </div>
        <div class="col-lg-6">
          <div class="card shadow"><div class="card-body">
            <h6>Asignar empleado → turno <small class="text-muted">(un turno activo por periodo; los solapados se crean inactivos)</small></h6>
            <div id="msg-at"></div>
            <form id="f-at" class="row g-2">
              <div class="col-12"><select class="form-select" name="empleado_id" required>
                ${emps.filter(e => e.activo).map(e => `<option value="${e.id}">${e.codigo} — ${e.apellidos}</option>`).join('')}
              </select></div>
              <div class="col"><select class="form-select" name="turno_id" required>
                ${turnos.filter(t => t.activo).map(t => `<option value="${t.id}">${t.nombre}</option>`).join('')}
              </select></div>
              <div class="col"><input class="form-control" type="date" name="fecha_inicio" required></div>
              <div class="col"><input class="form-control" type="date" name="fecha_fin"></div>
              <div class="col-auto"><button class="btn btn-primary">Asignar</button></div>
            </form>
            <table class="table table-sm mt-3"><thead><tr><th>Empleado</th><th>Turno</th><th>Vigencia</th><th>Estado</th><th></th></tr></thead>
            <tbody>${asigT.map(a => `<tr class="${a.activo ? '' : 'text-muted'}">
              <td>${a.apellidos} ${a.nombres}</td><td>${a.turno}</td>
              <td class="small">${a.fecha_inicio?.slice(0,10)} → ${a.fecha_fin ? a.fecha_fin.slice(0,10) : '∞'}</td>
              <td>${a.activo ? '<span class="badge text-bg-success">Activo</span>' : '<span class="badge text-bg-secondary">Inactivo</span>'}</td>
              <td><button class="btn btn-sm btn-outline-${a.activo ? 'danger' : 'success'}"
                onclick="Admin.toggleAsig('empleado-turno',${a.id},${a.activo ? 0 : 1})">
                ${a.activo ? 'Desactivar' : 'Activar'}</button></td></tr>`).join('')}
            </tbody></table></div></div>
        </div>
      </div>`;
    document.getElementById('f-ap').onsubmit = async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      try { await API.post('/api/empleado-punto', { empleado_id: +d.empleado_id, punto_id: +d.punto_id });
        this.cargarTab('asignaciones'); } catch (ex) { alert(ex.message); }
    };
    document.getElementById('f-at').onsubmit = async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      const msg = document.getElementById('msg-at');
      try {
        const res = await API.post('/api/empleado-turno', {
          empleado_id: +d.empleado_id, turno_id: +d.turno_id,
          fecha_inicio: d.fecha_inicio, fecha_fin: d.fecha_fin || null });
        if (res.advertencia) {
          msg.innerHTML = `<div class="alert alert-warning py-2">${res.advertencia}</div>`;
          this.cargarTab('asignaciones');
          // preservar el mensaje tras recargar
          setTimeout(() => { document.getElementById('msg-at').innerHTML =
            `<div class="alert alert-warning py-2">${res.advertencia}</div>`; }, 300);
        } else {
          this.cargarTab('asignaciones');
        }
      } catch (ex) { msg.innerHTML = `<div class="alert alert-danger py-2">${ex.message}</div>`; }
    };
  },

  async toggleAsig(tipo, id, activo) {
    try {
      await API.put(`/api/${tipo}/${id}`, { activo });
      this.cargarTab('asignaciones');
    } catch (ex) { alert(ex.message); }
  }
};
