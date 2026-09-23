// Punto de entrada: sesión, navegación y control de vistas
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-login').addEventListener('click', async (e) => {
    e.preventDefault();
    const err = document.getElementById('login-error');
    err.classList.add('d-none');
    try {
      const data = await API.login(
        document.getElementById('login-user').value.trim(),
        document.getElementById('login-pass').value
      );
      API.guardarSesion(data.token, data.usuario);
      iniciarApp();
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove('d-none');
    }
  });

  document.getElementById('btn-logout').addEventListener('click', () => API.logout());

  if (API.token && API.usuario) iniciarApp();
});

async function iniciarApp() {
  document.getElementById('vista-login').classList.add('d-none');
  document.getElementById('nav-principal').classList.remove('d-none');
  document.getElementById('nav-usuario').textContent =
    `${API.usuario.nombres} ${API.usuario.apellidos} (${API.usuario.rol})`;

  const esEmpleado = API.usuario.rol === 'EMPLEADO';
  const nav = document.getElementById('nav-principal').querySelector('.d-flex');

  // Pestañas según rol
  if (API.puedeGestionar()) {
    document.querySelectorAll('.tab-op').forEach(el => el.classList.remove('d-none'));
  }
  if (API.puedeVerReportes()) {
    document.querySelectorAll('.tab-rh').forEach(el => el.classList.remove('d-none'));
  }

  if (!esEmpleado) {
    // Botón para volver al panel de administración (visible en la vista de marcación)
    const btnAdmin = document.createElement('button');
    btnAdmin.className = 'btn btn-outline-light btn-sm';
    btnAdmin.id = 'btn-ir-admin';
    btnAdmin.textContent = 'Administración';
    btnAdmin.onclick = () => mostrarVista('admin');
    nav.insertBefore(btnAdmin, nav.firstChild);

    // Botón Marcación: solo si tiene al menos un punto Y un turno asignados
    try {
      const cfg = await API.get('/api/marcaciones/mi-config');
      if (cfg.tienePunto && cfg.tieneTurno) {
        const btnMarc = document.createElement('button');
        btnMarc.className = 'btn btn-outline-light btn-sm';
        btnMarc.id = 'btn-ir-marcacion';
        btnMarc.textContent = 'Marcación';
        btnMarc.onclick = () => mostrarVista('marcacion');
        nav.insertBefore(btnMarc, nav.firstChild);
      }
    } catch { /* sin configuración -> solo admin */ }

    mostrarVista('admin');
  } else {
    mostrarVista('marcacion');
  }

  document.querySelectorAll('#tabs-admin .nav-link').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('#tabs-admin .nav-link').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      Admin.cargarTab(tab.dataset.tab);
    });
  });
}

function mostrarVista(nombre) {
  document.getElementById('vista-marcacion').classList.toggle('d-none', nombre !== 'marcacion');
  document.getElementById('vista-admin').classList.toggle('d-none', nombre !== 'admin');
  if (nombre === 'marcacion') Marcacion.iniciar();
  if (nombre === 'admin') Admin.cargarTab('reportes');
}
