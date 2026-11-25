import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, QrCode } from 'lucide-react';
import { copyTextCrossPlatform } from '../utils/storageBridge';

export const GITHUB_REPO_URL = 'https://github.com/luzjsnow/ICU-app';
export const GITHUB_RELEASES_URL = 'https://github.com/luzjsnow/ICU-app/releases/latest';
export const GITHUB_APK_DIRECT_URL =
  'https://github.com/luzjsnow/ICU-app/releases/latest/download/ICU-Pump-Assistant.apk';

type QrTargetKey = 'releases' | 'apk' | 'repo';

const QR_TARGETS: Record<
  QrTargetKey,
  { label: string; url: string; subtitle: string }
> = {
  releases: {
    label: '下载页 (推荐)',
    url: GITHUB_RELEASES_URL,
    subtitle: '含安卓 APK 与 iOS Scriptable 离线脚本，免登录下载',
  },
  apk: {
    label: '安卓 APK 直链',
    url: GITHUB_APK_DIRECT_URL,
    subtitle: '手机浏览器扫码直接拉起下载 ICU-Pump-Assistant.apk',
  },
  repo: {
    label: 'GitHub 仓库',
    url: GITHUB_REPO_URL,
    subtitle: '查看完整安装说明、更新记录与全部源码',
  },
};

interface QrShareCardProps {
  onNotify: (msg: string) => void;
}

export const QrShareCard: React.FC<QrShareCardProps> = ({ onNotify }) => {
  const [target, setTarget] = useState<QrTargetKey>('releases');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const current = QR_TARGETS[target];

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(current.url, {
      width: 440,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [current.url]);

  const handleCopyUrl = async () => {
    const ok = await copyTextCrossPlatform(current.url);
    if (ok) {
      setCopied(true);
      onNotify('已复制下载链接');
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              扫码下载 / 分享给同事
            </h3>
            <p className="text-[11px] text-slate-400">
              离线即时生成标准二维码，面对面扫码即可获取
            </p>
          </div>
        </div>
      </div>

      {/* 切换三个扫码入口 */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {(Object.keys(QR_TARGETS) as QrTargetKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTarget(key)}
            className={`rounded-lg py-1.5 text-[11px] font-bold transition ${
              target === key
                ? 'bg-white text-sky-700 shadow-2xs dark:bg-slate-700 dark:text-sky-300'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {QR_TARGETS[key].label}
          </button>
        ))}
      </div>

      {/* 二维码纯白底展示区（暗黑模式下同样保持高对比度秒扫） */}
      <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/50">
        <div className="rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-slate-200/80">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`${current.label}二维码`}
              className="h-44 w-44 rounded-lg"
            />
          ) : (
            <div className="flex h-44 w-44 items-center justify-center text-xs text-slate-400">
              二维码生成中...
            </div>
          )}
        </div>

        <p className="mt-2.5 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
          {current.subtitle}
        </p>

        <div className="mt-2 flex w-full items-center gap-2 rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {current.url}
          </span>
          <button
            type="button"
            onClick={handleCopyUrl}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700 active:scale-95 dark:bg-sky-950 dark:text-sky-300"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? '已复制' : '复制'}
          </button>
        </div>

        <p className="mt-2 text-center text-[11px] text-amber-600 dark:text-amber-400">
          提示：微信扫一扫如无法直接下载 APK，请点右上角「···」选择「在默认浏览器中打开」。
        </p>
      </div>
    </div>
  );
};
