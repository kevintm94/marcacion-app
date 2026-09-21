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

function iniciarApp() {
  document.getElementById('vista-login').classList.add('d-none');
  document.getElementById('nav-principal').classList.remove('d-none');
  document.getElementById('nav-usuario').textContent =
    `${API.usuario.nombres} ${API.usuario.apellidos} (${API.usuario.rol})`;

  if (API.puedeGestionar()) {
    document.querySelectorAll('.tab-op').forEach(el => el.classList.remove('d-none'));
  }
  if (API.puedeVerReportes()) {
    document.querySelectorAll('.tab-rh').forEach(el => el.classList.remove('d-none'));
  }

  // Por defecto: panel admin si tiene permisos, si no la marcación
  if (API.puedeGestionar() || API.puedeVerReportes()) {
    mostrarVista('admin');
  } else {
    mostrarVista('marcacion');
  }

  // Enlace rápido a marcación para quien también tiene panel admin
  if (API.puedeGestionar() || API.puedeVerReportes()) {
    const nav = document.getElementById('nav-principal').querySelector('.d-flex');
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline-light btn-sm';
    btn.id = 'btn-ir-marcacion';
    btn.textContent = 'Marcación';
    btn.onclick = () => mostrarVista('marcacion');
    nav.insertBefore(btn, nav.firstChild);
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
