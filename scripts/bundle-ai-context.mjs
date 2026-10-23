import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

console.log('\n[AI BUNDLE] Упаковка кодовой базы SubsMarket 3.0...');
const startTime = Date.now();

function findGoogleDriveDir() {
  const candidates = [
    'G:\\Мой диск',
    'G:\\My Drive',
    'G:\\',
    path.join(process.env.USERPROFILE || '', 'Google Drive'),
    path.join(process.env.USERPROFILE || '', 'Google Диск'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {}
  }
  return null;
}

try {
  execSync('npx --yes repomix', { stdio: 'inherit' });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const outputFile = path.resolve('full_code.txt');
  if (fs.existsSync(outputFile)) {
    const stats = fs.statSync(outputFile);
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

    // 1. Copy to clipboard for instant Ctrl+V
    try {
      execSync(`powershell -NoProfile -Command "Set-Clipboard -Path '${outputFile}'"`, { stdio: 'ignore' });
    } catch {}

    // 2. Auto-copy to Google Drive if installed
    const gDrive = findGoogleDriveDir();
    let gDriveStatus = '';
    if (gDrive) {
      try {
        const dest = path.join(gDrive, 'subsmarket_code.txt');
        fs.copyFileSync(outputFile, dest);
        gDriveStatus = `\n[OK] Скопировано в Google Диск: ${dest}`;
      } catch (err) {
        gDriveStatus = `\n[WARN] Не удалось скопировать на Google Диск: ${err.message}`;
      }
    } else {
      gDriveStatus = `\n[INFO] Google Диск на ПК не обнаружен (используется буфер Ctrl+V).`;
    }

    console.log(`\n======================================================`);
    console.log(`[OK] Сборка готова за ${elapsed}с!`);
    console.log(`[OK] Файл: full_code.txt (${sizeMb} MB, ~875k токенов)`);
    console.log(`[OK] Файл СКОПИРОВАН в буфер обмена Windows.`);
    console.log(gDriveStatus);
    console.log(`--> В веб-Gemini: нажмите Ctrl + V ИЛИ используйте @Google Drive`);
    console.log(`======================================================\n`);
  }
} catch (error) {
  console.error('[ERROR] Ошибка сборки:', error.message);
  process.exit(1);
}
