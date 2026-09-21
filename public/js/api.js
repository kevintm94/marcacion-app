// Cliente HTTP con manejo de token JWT
const API = {
  token: localStorage.getItem('token'),
  usuario: JSON.parse(localStorage.getItem('usuario') || 'null'),

  async request(metodo, url, body) {
    const res = await fetch(url, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(API.token ? { Authorization: `Bearer ${API.token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !url.includes('/auth/login')) {
      API.logout();
      throw new Error(data.error || 'Sesión expirada');
    }
    if (!res.ok) throw new Error(data.error || 'Error en la petición');
    return data;
  },

  get:  (url) => API.request('GET', url),
  post: (url, body) => API.request('POST', url, body),
  put:  (url, body) => API.request('PUT', url, body),

  login(username, password) {
    return API.post('/api/auth/login', { username, password });
  },

  guardarSesion(token, usuario) {
    API.token = token;
    API.usuario = usuario;
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(usuario));
  },

  logout() {
    API.token = null;
    API.usuario = null;
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    location.reload();
  },

  puedeGestionar() {
    return ['OPERACIONES', 'ADMIN'].includes(API.usuario?.rol);
  },
  puedeVerReportes() {
    return ['REVISOR_RH', 'OPERACIONES', 'ADMIN'].includes(API.usuario?.rol);
  }
};
