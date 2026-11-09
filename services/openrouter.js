// Pembungkus API OpenRouter (format kompatibel OpenAI Chat Completions).
// Model dibaca dari .env dan dicoba berurutan: kalau satu gagal/penuh, lanjut ke model berikutnya.
const URL = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 45000;

class AIError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function getModels() {
  return (process.env.OPENROUTER_MODELS || 'openrouter/free')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function chat(messages, { temperature = 0.4, max_tokens = 700 } = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new AIError('API key OpenRouter belum diisi di file .env', 500);

  let lastErr = new AIError('Tidak ada model yang tersedia', 503);

  for (const model of getModels()) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(URL, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'X-Title': 'FinAI',
        },
        body: JSON.stringify({ model, messages, temperature, max_tokens }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        lastErr = new AIError(msg, res.status);
        if (res.status === 401 || res.status === 402) throw lastErr; // key salah / kredit: percuma ganti model
        continue; // 429, 5xx, dll: coba model berikutnya
      }

      // Sebagian model "berpikir" menaruh proses berpikirnya di dalam tag <think>; buang agar tidak tampil ke pengguna
      const raw = data?.choices?.[0]?.message?.content;
      const text = typeof raw === 'string' ? raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim() : '';
      if (text) {
        return { text, model: data.model || model };
      }
      lastErr = new AIError('Model memberi respons kosong', 502);
    } catch (e) {
      if (e instanceof AIError && (e.status === 401 || e.status === 402)) throw e;
      lastErr = e.name === 'AbortError' ? new AIError('Model terlalu lama merespons', 504) : e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

// Pesan error ramah untuk pengguna
function friendlyMessage(e) {
  if (e.status === 401) return 'API key OpenRouter tidak valid. Periksa OPENROUTER_API_KEY di file .env.';
  if (e.status === 402) return 'Kredit OpenRouter tidak cukup untuk model ini. Gunakan model berakhiran :free.';
  if (e.status === 429) return 'Batas pemakaian model gratis sedang penuh. Tunggu sebentar lalu coba lagi.';
  if (e.status === 500 && /belum diisi/.test(e.message)) return e.message;
  return 'Asisten AI sedang tidak tersedia. Coba lagi beberapa saat.';
}

module.exports = { chat, friendlyMessage, AIError };
