if (!API.token()) location.href = '/login.html';

const $ = (id) => document.getElementById(id);
const state = { month: todayStr().slice(0, 7), categories: [], type: 'expense' };
let donutChart = null;
let barChart = null;

const PALETTE = ['#0e9f6e', '#14b8a6', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#64748b'];

// ---------------------------------------------------------------- Dashboard
function deltaText(cur, prev, goodWhenUp) {
  if (!prev) return cur ? 'Belum ada data bulan lalu' : ' ';
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return 'Sama seperti bulan lalu';
  const arrow = pct > 0 ? '▲' : '▼';
  return `${arrow} ${Math.abs(pct)}% dari bulan lalu`;
}

async function loadDashboard() {
  const d = await API.get('/api/dashboard?month=' + state.month);
  const s = d.summary;
  const p = d.previous;

  $('sumBalance').textContent = rupiah(s.balance);
  $('sumIncome').textContent = rupiah(s.income);
  $('sumExpense').textContent = rupiah(s.expense);
  $('deltaBalance').textContent = s.balance >= 0 ? 'Masih surplus 👍' : 'Pengeluaran melebihi pemasukan';
  $('deltaIncome').textContent = deltaText(s.income, p.income);
  $('deltaExpense').textContent = deltaText(s.expense, p.expense);

  renderDonut(d.expenseByCategory);
  renderBars(d.trend);
}

function renderDonut(items) {
  const empty = !items.length;
  $('donutEmpty').classList.toggle('hidden', !empty);
  $('donut').parentElement.classList.toggle('hidden', empty);
  if (donutChart) donutChart.destroy();
  if (empty) return;

  donutChart = new Chart($('donut'), {
    type: 'doughnut',
    data: {
      labels: items.map((i) => `${i.icon} ${i.name}`),
      datasets: [{ data: items.map((i) => i.total), backgroundColor: items.map((_, i) => PALETTE[i % PALETTE.length]), borderWidth: 2, borderColor: '#fff' }],
    },
    options: {
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 10, usePointStyle: true, font: { family: 'Plus Jakarta Sans', size: 12 } } },
        tooltip: { callbacks: { label: (c) => ` ${rupiah(c.parsed)}` } },
      },
    },
  });
}

function renderBars(trend) {
  if (barChart) barChart.destroy();
  barChart = new Chart($('bars'), {
    type: 'bar',
    data: {
      labels: trend.map((t) => monthLabel(t.month)),
      datasets: [
        { label: 'Pemasukan', data: trend.map((t) => t.income), backgroundColor: '#0e9f6e', borderRadius: 6 },
        { label: 'Pengeluaran', data: trend.map((t) => t.expense), backgroundColor: '#e0533d', borderRadius: 6 },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { boxWidth: 10, usePointStyle: true, font: { family: 'Plus Jakarta Sans', size: 12 } } },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${rupiah(c.parsed.y)}` } },
      },
      scales: {
        y: { beginAtZero: true, grid: { color: '#eef2f0' }, ticks: { callback: (v) => (v >= 1e6 ? v / 1e6 + ' jt' : v >= 1e3 ? v / 1e3 + ' rb' : v) } },
        x: { grid: { display: false } },
      },
    },
  });
}

// ---------------------------------------------------------------- Transaksi
async function loadCategories() {
  const d = await API.get('/api/transactions/categories');
  state.categories = d.categories;
  fillCategories();
}

function fillCategories() {
  const opts = state.categories.filter((c) => c.type === state.type);
  $('fCategory').innerHTML = opts.map((c) => `<option value="${c.id}">${esc(c.icon)} ${esc(c.name)}</option>`).join('');
}

function setType(type) {
  state.type = type;
  document.querySelectorAll('#typeSeg button').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
  fillCategories();
}

document.querySelectorAll('#typeSeg button').forEach((b) => b.addEventListener('click', () => setType(b.dataset.type)));

async function loadTransactions() {
  const d = await API.get('/api/transactions?month=' + state.month);
  const list = $('trxList');
  $('trxCount').textContent = d.transactions.length ? `${d.transactions.length} transaksi` : '';

  if (!d.transactions.length) {
    list.innerHTML = '<li class="empty">Belum ada transaksi di bulan ini. Catat yang pertama di atas ☝️</li>';
    return;
  }
  list.innerHTML = d.transactions
    .map(
      (t) => `
      <li class="trx">
        <div class="ico">${esc(t.icon)}</div>
        <div class="info">
          <div class="title">${esc(t.description || t.category)}</div>
          <div class="meta">${esc(t.category)} · ${dateLabel(t.trx_date)}</div>
        </div>
        <div class="amt ${t.type}">${t.type === 'income' ? '+' : '-'}${rupiah(t.amount)}</div>
        <button class="icon-btn" data-del="${t.id}" title="Hapus" aria-label="Hapus transaksi">✕</button>
      </li>`
    )
    .join('');
}

$('trxList').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-del]');
  if (!btn || !confirm('Hapus transaksi ini?')) return;
  try {
    await API.del('/api/transactions/' + btn.dataset.del);
    await refreshAll();
  } catch (err) {
    toast(err.message, true);
  }
});

$('trxForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await API.post('/api/transactions', {
      type: state.type,
      category_id: Number($('fCategory').value),
      amount: Number($('fAmount').value),
      description: $('fDesc').value,
      trx_date: $('fDate').value,
    });
    $('fAmount').value = '';
    $('fDesc').value = '';
    $('quickText').value = '';
    toast('Transaksi tersimpan ✓');
    // pindah ke bulan transaksi yang baru disimpan supaya langsung terlihat
    const ym = $('fDate').value.slice(0, 7);
    if (ym !== state.month) {
      state.month = ym;
      $('monthPicker').value = ym;
    }
    await refreshAll();
  } catch (err) {
    toast(err.message, true);
  }
});

// Catat cepat: kalimat biasa -> draf transaksi (AI)
$('quickBtn').addEventListener('click', async () => {
  const text = $('quickText').value.trim();
  if (!text) return toast('Tulis dulu transaksinya', true);
  const btn = $('quickBtn');
  btn.disabled = true;
  btn.textContent = 'Membaca...';
  try {
    const { draft } = await API.post('/api/ai/parse', { text });
    setType(draft.type);
    $('fCategory').value = String(draft.category_id);
    $('fAmount').value = draft.amount;
    $('fDesc').value = draft.description;
    $('fDate').value = draft.trx_date;
    toast('Sudah terisi. Periksa dulu, lalu klik Simpan transaksi.');
    $('fAmount').focus();
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Isi otomatis';
  }
});
$('quickText').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    $('quickBtn').click();
  }
});

// ---------------------------------------------------------------- Target tabungan
async function loadGoals() {
  const { goals } = await API.get('/api/goals');
  const box = $('goals');
  if (!goals.length) {
    box.innerHTML = '<div class="empty" style="grid-column:1/-1;padding:1rem">Belum ada target. Tambahkan di bawah.</div>';
    return;
  }
  box.innerHTML = goals
    .map((g) => {
      const pct = Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100));
      return `
      <div class="goal">
        <div class="goal-top">
          <div class="goal-title">${esc(g.title)}</div>
          <button class="icon-btn" data-gdel="${g.id}" title="Hapus target" aria-label="Hapus target">✕</button>
        </div>
        <div class="progress"><div style="width:${pct}%"></div></div>
        <div class="goal-meta">${rupiah(g.saved_amount)} / ${rupiah(g.target_amount)} · ${pct}%${g.deadline ? ' · sampai ' + dateLabel(g.deadline) : ''}</div>
        <div class="goal-add">
          <input type="number" min="1" placeholder="Tambah tabungan" data-ginput="${g.id}">
          <button class="btn soft small" data-gadd="${g.id}">Tabung</button>
        </div>
      </div>`;
    })
    .join('');
}

$('goals').addEventListener('click', async (e) => {
  try {
    const add = e.target.closest('[data-gadd]');
    const del = e.target.closest('[data-gdel]');
    if (add) {
      const id = add.dataset.gadd;
      const amount = Number(document.querySelector(`[data-ginput="${id}"]`).value);
      if (!amount || amount <= 0) return toast('Isi nominal tabungan', true);
      await API.patch(`/api/goals/${id}/add`, { amount });
      toast('Tabungan ditambahkan ✓');
      await loadGoals();
    } else if (del && confirm('Hapus target ini?')) {
      await API.del('/api/goals/' + del.dataset.gdel);
      await loadGoals();
    }
  } catch (err) {
    toast(err.message, true);
  }
});

$('goalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await API.post('/api/goals', {
      title: $('gTitle').value,
      target_amount: Number($('gTarget').value),
      deadline: $('gDeadline').value || null,
    });
    e.target.reset();
    await loadGoals();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------------------------------------------------------------- Chat AI
// Markdown sederhana (tebal, daftar) setelah teks di-escape agar aman dari XSS
function renderMarkdown(text) {
  const lines = esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').split('\n');
  let html = '';
  let inList = false;
  for (const line of lines) {
    const m = line.match(/^\s*[-*•]\s+(.*)/) || line.match(/^\s*\d+[.)]\s+(.*)/);
    if (m) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${m[1]}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (line.trim()) html += `<p>${line}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function addBubble(role, content, { error = false, typing = false } = {}) {
  const el = document.createElement('div');
  el.className = `bubble ${role === 'user' ? 'user' : 'bot'}${error ? ' error' : ''}`;
  if (typing) el.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
  else if (role === 'user') el.textContent = content;
  else el.innerHTML = renderMarkdown(content);
  $('chatBody').appendChild(el);
  $('chatBody').scrollTop = $('chatBody').scrollHeight;
  return el;
}

const WELCOME = 'Halo! Aku FinAI 👋 Aku bisa membaca ringkasan keuanganmu dan membantu mencari pola boros, memberi saran hemat, atau menyusun target tabungan. Coba tanya sesuatu!';

async function loadChat() {
  $('chatBody').innerHTML = '';
  try {
    const { messages } = await API.get('/api/ai/history');
    if (!messages.length) addBubble('assistant', WELCOME);
    messages.forEach((m) => addBubble(m.role, m.content));
  } catch {
    addBubble('assistant', WELCOME);
  }
}

function setChatBusy(busy) {
  $('chatSend').disabled = busy;
  $('insightBtn').disabled = busy;
  $('chatInput').disabled = busy;
}

async function askAI(message) {
  addBubble('user', message);
  const typing = addBubble('assistant', '', { typing: true });
  setChatBusy(true);
  try {
    const { reply } = await API.post('/api/ai/chat', { message });
    typing.remove();
    addBubble('assistant', reply);
  } catch (err) {
    typing.remove();
    addBubble('assistant', err.message, { error: true });
  } finally {
    setChatBusy(false);
    $('chatInput').focus();
  }
}

$('chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = $('chatInput').value.trim();
  if (!msg) return;
  $('chatInput').value = '';
  askAI(msg);
});

$('chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (chip) askAI(chip.textContent);
});

$('insightBtn').addEventListener('click', async () => {
  addBubble('user', '💡 Minta saran hemat bulan ini');
  const typing = addBubble('assistant', '', { typing: true });
  setChatBusy(true);
  try {
    const { reply } = await API.post('/api/ai/insight');
    typing.remove();
    addBubble('assistant', reply);
  } catch (err) {
    typing.remove();
    addBubble('assistant', err.message, { error: true });
  } finally {
    setChatBusy(false);
  }
});

$('clearChat').addEventListener('click', async () => {
  if (!confirm('Hapus seluruh riwayat chat?')) return;
  try {
    await API.del('/api/ai/history');
    await loadChat();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------------------------------------------------------------- Mulai
async function refreshAll() {
  $('monthText').textContent = 'Data bulan ' + monthLabel(state.month);
  await Promise.all([loadDashboard(), loadTransactions(), loadGoals()]);
}

$('monthPicker').addEventListener('change', (e) => {
  if (!e.target.value) return;
  state.month = e.target.value;
  refreshAll().catch((err) => toast(err.message, true));
});

$('logoutBtn').addEventListener('click', logout);

(async function init() {
  try {
    const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    $('userName').textContent = user ? user.name : '';
    $('monthPicker').value = state.month;
    $('fDate').value = todayStr();
    await loadCategories();
    await Promise.all([refreshAll(), loadChat()]);
  } catch (err) {
    toast(err.message, true);
  }
})();
