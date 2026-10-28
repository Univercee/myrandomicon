type Status = 'ready' | 'pending' | 'error' | 'rate_limited' | 'none';

const tg = (window as any).Telegram?.WebApp;
tg?.ready();
tg?.expand();

const headers = { Authorization: `tma ${tg?.initData ?? ''}` };
const img = document.getElementById('icon') as HTMLImageElement;
const msg = document.getElementById('msg')!;
const retry = document.getElementById('retry') as HTMLButtonElement;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(path: string, method = 'GET'): Promise<Response> {
  return fetch(path, { method, headers });
}

async function showImage() {
  const res = await api('/api/icon/image');
  if (!res.ok) throw new Error('image');
  img.src = URL.createObjectURL(await res.blob());
  img.classList.remove('hidden');
  msg.textContent = '';
}

async function run() {
  retry.classList.add('hidden');
  msg.textContent = 'Генерируем вашу иконку…';
  try {
    const first = await api('/api/icon', 'POST');
    if (!first.ok) throw new Error(String(first.status));
    let status: Status = (await first.json()).status;
    while (status === 'pending' || status === 'none') {
      await sleep(2000);
      status = (await (await api('/api/icon/status')).json()).status;
    }
    if (status === 'ready') return await showImage();
    msg.textContent =
      status === 'rate_limited' ? 'Сервис перегружен, попробуйте чуть позже.' : 'Не удалось создать иконку.';
  } catch {
    msg.textContent = 'Ошибка соединения.';
  }
  retry.classList.remove('hidden');
}

retry.addEventListener('click', run);
run();
