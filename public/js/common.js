// Fungsi bantu yang dipakai di semua halaman
const TOKEN_KEY = 'finai_token';
const USER_KEY = 'finai_user';

const API = {
  token: () => localStorage.getItem(TOKEN_KEY),

  async request(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (API.token()) headers.Authorization = 'Bearer ' + API.token();

    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401 && !url.startsWith('/api/auth/login') && !url.startsWith('/api/auth/register')) {
      logout();
      throw new Error(data.error || 'Sesi berakhir');
    }
    if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
    return data;
  },
  get: (url) => API.request('GET', url),
  post: (url, body) => API.request('POST', url, body || {}),
  patch: (url, body) => API.request('PATCH', url, body || {}),
  del: (url) => API.request('DELETE', url),
};

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  location.href = '/login.html';
}

const rupiah = (n) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS_ID[m - 1]} ${String(y).slice(2)}`;
}
function dateLabel(s) {
  const [y, m, d] = s.split('-').map(Number);
  return `${d} ${MONTHS_ID[m - 1]} ${y}`;
}

let toastTimer;
function toast(msg, isError = false) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.className = 'toast show' + (isError ? ' err' : '');
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
