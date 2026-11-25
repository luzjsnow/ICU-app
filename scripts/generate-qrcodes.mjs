import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const docsDir = path.join(rootDir, 'docs');

const REPO_URL = 'https://github.com/luzjsnow/ICU-app';
const RELEASES_URL = `${REPO_URL}/releases/latest`;
const APK_DIRECT_URL = `${REPO_URL}/releases/latest/download/ICU-Pump-Assistant.apk`;

const TARGETS = [
  {
    file: 'qr-releases.png',
    url: RELEASES_URL,
    label: 'Releases 最新版下载页（含安卓 APK 与 iOS Scriptable）',
  },
  {
    file: 'qr-apk.png',
    url: APK_DIRECT_URL,
    label: 'Android APK 直链下载',
  },
  {
    file: 'qr-repo.png',
    url: REPO_URL,
    label: 'GitHub 仓库主页',
  },
];

fs.mkdirSync(docsDir, { recursive: true });

for (const item of TARGETS) {
  const outPath = path.join(docsDir, item.file);
  await QRCode.toFile(outPath, item.url, {
    type: 'png',
    width: 600,
    margin: 3,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
  console.log(`✅ 已生成二维码: ${outPath} -> ${item.url} (${item.label})`);
}
