if (API.token()) location.href = '/';

const $ = (id) => document.getElementById(id);
let mode = 'login';

function setMode(m) {
  mode = m;
  document.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  $('nameWrap').classList.toggle('hidden', m !== 'register');
  $('formTitle').textContent = m === 'login' ? 'Selamat datang' : 'Buat akun baru';
  $('formSub').textContent = m === 'login' ? 'Masuk untuk melanjutkan.' : 'Gratis, cuma butuh satu menit.';
  $('submitBtn').textContent = m === 'login' ? 'Masuk' : 'Daftar';
  $('password').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  $('errorBox').classList.add('hidden');
}

document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('submitBtn');
  btn.disabled = true;
  $('errorBox').classList.add('hidden');

  try {
    const body = { email: $('email').value, password: $('password').value };
    if (mode === 'register') body.name = $('name').value;
    const data = await API.post(mode === 'login' ? '/api/auth/login' : '/api/auth/register', body);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    location.href = '/';
  } catch (err) {
    $('errorBox').textContent = err.message;
    $('errorBox').classList.remove('hidden');
    btn.disabled = false;
  }
});
