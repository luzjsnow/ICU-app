import type { PersistedAppState } from '../types/drug';

const STORAGE_KEY = 'icu_pump_pro_state_v1';

interface ScriptableActionMessage {
  type: 'saveState' | 'exportJson' | 'requestImportJson' | 'copyText';
  payload?: string;
  filename?: string;
}

declare global {
  interface Window {
    __SCRIPTABLE_MODE__?: boolean;
    __ICU_INITIAL_DATA__?: string;
    __SCRIPTABLE_SEND__?: (msg: ScriptableActionMessage) => void;
    __ICU_ON_IMPORT_JSON__?: (jsonText: string) => void;
  }
}

export function isScriptableEnv(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__SCRIPTABLE_MODE__);
}

export const DEFAULT_APP_STATE: PersistedAppState = {
  version: 1,
  theme: 'light',
  weightKg: 65,
  favoriteDrugIds: [
    'norepinephrine',
    'epinephrine',
    'vasopressin',
    'remifentanil',
    'propofol',
    'midazolam',
    'dexmedetomidine',
    'insulin',
  ],
  verifiedDrugIds: [],
  drugOverrides: {},
  deletedDrugIds: [],
  activePumps: [],
  lastSelectedDrugId: 'norepinephrine',
  disclaimerAccepted: false,
};

export function loadPersistedState(): PersistedAppState {
  try {
    // 1. 优先读取 iOS Scriptable 宿主启动时从本地/iCloud 文件注入的数据
    if (typeof window !== 'undefined' && typeof window.__ICU_INITIAL_DATA__ === 'string' && window.__ICU_INITIAL_DATA__.trim()) {
      const parsed = JSON.parse(window.__ICU_INITIAL_DATA__) as Partial<PersistedAppState>;
      return { ...DEFAULT_APP_STATE, ...parsed };
    }
  } catch {
    // 忽略损坏数据并回退
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedAppState>;
      return { ...DEFAULT_APP_STATE, ...parsed };
    }
  } catch {
    // WKWebView 受限时静默回退
  }

  return { ...DEFAULT_APP_STATE };
}

export function savePersistedState(state: PersistedAppState): void {
  const serialized = JSON.stringify(state);
  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // 忽略无 localStorage 权限环境
  }

  if (typeof window !== 'undefined' && typeof window.__SCRIPTABLE_SEND__ === 'function') {
    window.__SCRIPTABLE_SEND__({
      type: 'saveState',
      payload: serialized,
    });
  }
}

/**
 * 跨平台复制文本：iOS Scriptable 走原生 Pasteboard，其余环境走 Clipboard API + 兜底方案
 */
export async function copyTextCrossPlatform(text: string): Promise<boolean> {
  if (typeof window !== 'undefined' && typeof window.__SCRIPTABLE_SEND__ === 'function') {
    window.__SCRIPTABLE_SEND__({
      type: 'copyText',
      payload: text,
    });
    return true;
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 降级到 textarea 复制
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * 跨平台导出 JSON/CSV 备份文件：Scriptable 调起 iOS 系统分享菜单，网页/安卓触发下载
 */
export function exportFileCrossPlatform(content: string, filename: string, mime = 'application/json;charset=utf-8'): void {
  if (typeof window !== 'undefined' && typeof window.__SCRIPTABLE_SEND__ === 'function') {
    window.__SCRIPTABLE_SEND__({
      type: 'exportJson',
      payload: content,
      filename,
    });
    return;
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 在 Scriptable 环境下触发 iOS 原生“文件”选择器导入备份
 */
export function requestNativeImportIfScriptable(): boolean {
  if (typeof window !== 'undefined' && typeof window.__SCRIPTABLE_SEND__ === 'function') {
    window.__SCRIPTABLE_SEND__({
      type: 'requestImportJson',
    });
    return true;
  }
  return false;
}
