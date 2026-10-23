import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';

const watchDirs = ['backend/src', 'backend/alembic', 'frontend/src', 'docs'];
let timer = null;
let running = false;

function triggerBundle() {
  if (running) return;
  running = true;
  console.log(`\n[WATCH-AI] Обнаружены правки кода. Обновляем Google Диск...`);
  exec('node scripts/bundle-ai-context.mjs', (err) => {
    running = false;
    if (err) {
      console.error('[WATCH-AI] Ошибка обновления:', err.message);
    } else {
      console.log('[WATCH-AI] Google Диск успешно обновлен!');
    }
  });
}

function onFileChange(filename) {
  if (!filename) return;
  if (
    filename.endsWith('.tmp') ||
    filename.endsWith('~') ||
    filename.includes('__pycache__') ||
    filename.includes('.git')
  ) {
    return;
  }
  clearTimeout(timer);
  timer = setTimeout(triggerBundle, 5000); // пауза 5 секунд после последней правки
}

console.log('[WATCH-AI] Фоновый наблюдатель запущен.');
console.log('[WATCH-AI] Папки под наблюдением:', watchDirs.join(', '));

for (const dir of watchDirs) {
  const fullPath = path.resolve(dir);
  if (fs.existsSync(fullPath)) {
    try {
      fs.watch(fullPath, { recursive: true }, (_, filename) => onFileChange(filename));
    } catch (e) {
      console.warn(`[WATCH-AI] Не удалось отслеживать ${dir}:`, e.message);
    }
  }
}

setInterval(() => {}, 1000 * 60 * 60);
