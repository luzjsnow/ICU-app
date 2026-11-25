import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const singleHtmlPath = path.join(rootDir, 'dist-single', 'index.html');
const outDir = path.join(rootDir, 'dist-scriptable');
const outScriptPath = path.join(outDir, 'ICU泵助手.js');

if (!fs.existsSync(singleHtmlPath)) {
  console.error('❌ 未找到 dist-single/index.html，请先执行 npm run build:single');
  process.exit(1);
}

const rawHtml = fs.readFileSync(singleHtmlPath, 'utf-8');
const buildHash = crypto.createHash('sha256').update(rawHtml).digest('hex').slice(0, 12);

// 为 iOS Scriptable WebView 注入离线桥接桩代码（零丢消息队列 + 原生文件持久化 + 原生复制/分享/导入）
const bridgeInjectionSnippet = `
<script>
(function () {
  window.__SCRIPTABLE_MODE__ = true;
  window.__SC_QUEUE__ = [];
  window.__SC_RESOLVE__ = null;
  window.__SCRIPTABLE_SEND__ = function (msg) {
    var raw = JSON.stringify(msg);
    if (window.__SC_RESOLVE__) {
      var cb = window.__SC_RESOLVE__;
      window.__SC_RESOLVE__ = null;
      cb(raw);
    } else {
      window.__SC_QUEUE__.push(raw);
    }
  };
  window.__SC_POLL__ = function (cb) {
    if (window.__SC_QUEUE__.length > 0) {
      cb(window.__SC_QUEUE__.shift());
    } else {
      window.__SC_RESOLVE__ = cb;
    }
  };
})();
</script>
`;

// 1. 移除内联 module 脚本上的 crossorigin 属性，避免旧版 iOS WKWebView file:// 场景触发多余 CORS 校验
// 2. 将桥接桩与初始数据占位符注入 <head> 最顶部，确保早于所有业务代码执行
const normalizedHtml = rawHtml.replace(
  '<script type="module" crossorigin>',
  '<script type="module">'
);

const htmlWithBridgePlaceholder = normalizedHtml.replace(
  '<head>',
  `<head>${bridgeInjectionSnippet}<!--__ICU_INITIAL_DATA_INJECT__-->`
);

const scriptableCode = `// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: medkit;
/**
 * ICU 泵助手 · iOS Scriptable 离线全屏版
 * 构建版本: ${buildHash}
 * 说明：
 * 1. 完全离线运行，无需联网、无需苹果开发者账号、永不过期。
 * 2. 自定义配比与本科室核对记录自动持久化至 Scriptable 文档目录（支持 iCloud 自动同步）。
 * 3. 可在 iOS「快捷指令」新建指令 -> 添加「Scriptable: 运行脚本(ICU泵助手)」->「添加到主屏幕」，即可像原生 App 一样一键打开。
 */

const BUILD_HASH = ${JSON.stringify(buildHash)};
const HTML_TEMPLATE = ${JSON.stringify(htmlWithBridgePlaceholder)};

function resolveFileManager() {
  try {
    const icloud = FileManager.iCloud();
    const docDir = icloud.documentsDirectory();
    if (docDir) return icloud;
  } catch (_) {
    // 未开启 iCloud 时回退本地存储
  }
  return FileManager.local();
}

const fm = resolveFileManager();
const dataDir = fm.joinPath(fm.documentsDirectory(), 'ICU_Pump_Pro');
if (!fm.fileExists(dataDir)) {
  fm.createDirectory(dataDir, true);
}

const statePath = fm.joinPath(dataDir, 'state_v1.json');
let savedStateStr = '';
try {
  if (fm.fileExists(statePath)) {
    if (fm.isFileStoredIniCloud && fm.isFileStoredIniCloud(statePath) && !fm.isFileDownloaded(statePath)) {
      await fm.downloadFileFromiCloud(statePath);
    }
    savedStateStr = fm.readString(statePath) || '';
  }
} catch (err) {
  console.warn('读取本地状态失败，将使用默认配置: ' + err);
}

const initScript =
  '<script>window.__ICU_INITIAL_DATA__ = ' +
  JSON.stringify(savedStateStr) +
  ';<\\/script>';

const finalHtml = HTML_TEMPLATE.replace('<!--__ICU_INITIAL_DATA_INJECT__-->', initScript);

// 写入本地缓存文件并通过 loadFile 加载，兼容大体积单文件与低内存运行
const localFm = FileManager.local();
const htmlFilePath = localFm.joinPath(localFm.cacheDirectory(), 'icu_pump_pro_' + BUILD_HASH + '.html');
localFm.writeString(htmlFilePath, finalHtml);

const wv = new WebView();
await wv.loadFile(htmlFilePath);

let loopActive = true;

async function startBridgeLoop() {
  while (loopActive) {
    try {
      const rawMsg = await wv.evaluateJavaScript('window.__SC_POLL__(completion);', true);
      if (!loopActive || !rawMsg) break;

      const msg = JSON.parse(rawMsg);
      if (msg.type === 'saveState' && typeof msg.payload === 'string') {
        fm.writeString(statePath, msg.payload);
      } else if (msg.type === 'copyText' && typeof msg.payload === 'string') {
        Pasteboard.copyString(msg.payload);
      } else if (msg.type === 'exportJson' && typeof msg.payload === 'string') {
        const fname = msg.filename || 'ICU_Pump_Backup.json';
        const tempPath = localFm.joinPath(localFm.temporaryDirectory(), fname);
        localFm.writeString(tempPath, msg.payload);
        await ShareSheet.present([tempPath]);
      } else if (msg.type === 'requestImportJson') {
        try {
          const picked = await DocumentPicker.openFile();
          if (picked) {
            const importedText = localFm.readString(picked);
            if (importedText) {
              await wv.evaluateJavaScript(
                'window.__ICU_ON_IMPORT_JSON__ && window.__ICU_ON_IMPORT_JSON__(' +
                  JSON.stringify(importedText) +
                  ');'
              );
            }
          }
        } catch (_) {
          // 用户取消选择文件时忽略
        }
      }
    } catch (err) {
      break;
    }
  }
}

startBridgeLoop();
await wv.present(true);
loopActive = false;
Script.complete();
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outScriptPath, scriptableCode, 'utf-8');

const sizeKb = (Buffer.byteLength(scriptableCode, 'utf-8') / 1024).toFixed(1);
console.log(`✅ 已成功生成 iOS Scriptable 独立离线脚本：${outScriptPath}（${sizeKb} KB，构建号 ${buildHash}）`);
