import React, { useRef } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Moon,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sun,
  Upload,
} from 'lucide-react';
import type { DrugRecord, PersistedAppState } from '../types/drug';
import { CATEGORY_META } from '../types/drug';
import {
  exportFileCrossPlatform,
  isScriptableEnv,
  requestNativeImportIfScriptable,
} from '../utils/storageBridge';
import { QrShareCard } from './QrShareCard';

interface SettingsViewProps {
  state: PersistedAppState;
  drugs: DrugRecord[];
  onToggleTheme: () => void;
  onImportStateJson: (jsonText: string) => void;
  onResetCustomDrugs: () => void;
  onNotify: (msg: string) => void;
}

function escapeCsvCell(val: string): string {
  const s = String(val ?? '').replace(/"/g, '""');
  return `"${s}"`;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  state,
  drugs,
  onToggleTheme,
  onImportStateJson,
  onResetCustomDrugs,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const verifiedCount = drugs.filter((d) => d.verified).length;
  const verifiedPercent = drugs.length > 0 ? Math.round((verifiedCount / drugs.length) * 100) : 0;

  const handleExportBackup = () => {
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        app: 'ICU泵助手',
        version: state.version,
        favoriteDrugIds: state.favoriteDrugIds,
        verifiedDrugIds: state.verifiedDrugIds,
        drugOverrides: state.drugOverrides,
        deletedDrugIds: state.deletedDrugIds,
      },
      null,
      2
    );
    const dateStr = new Date().toISOString().slice(0, 10);
    exportFileCrossPlatform(payload, `ICU泵助手_科室药库备份_${dateStr}.json`);
    onNotify('已触发备份文件导出');
  };

  const handleExportCsv = () => {
    const headers = [
      '分类',
      '中文名',
      '英文名',
      '是否已核对',
      '高警示',
      '常见规格',
      '默认配比',
      '推荐剂量范围',
      '推荐溶媒',
      '通路要求',
      '避光',
      '本科室备注',
    ];

    const rows = drugs.map((d) => {
      const defRec = d.recipes.find((r) => r.isDefault) ?? d.recipes[0];
      return [
        CATEGORY_META[d.category].label,
        d.nameCn,
        d.nameEn,
        d.verified ? '已核对' : '待核对',
        d.highAlert ? '是' : '否',
        d.vialSpec,
        defRec ? `${defRec.label} (${defRec.diluentNote ?? ''})` : '',
        d.doseRange.text,
        d.diluents,
        d.routeNote,
        d.lightProtection ? '需避光' : '否',
        d.departmentNote ?? '',
      ]
        .map(escapeCsvCell)
        .join(',');
    });

    // UTF-8 BOM 确保 Windows/Mac Excel 直接双击打开无乱码
    const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    exportFileCrossPlatform(
      csvContent,
      `ICU泵药核对总表_${dateStr}.csv`,
      'text/csv;charset=utf-8'
    );
    onNotify('已导出 Excel/CSV 药品核对总表');
  };

  const handleImportClick = () => {
    if (requestNativeImportIfScriptable()) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImportStateJson(reader.result);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pb-6 pt-3">
      {/* 核对进度卡 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                本科室药库核对进度
              </div>
              <div className="text-xs text-slate-400">
                共 {drugs.length} 种 ICU 泵注药，已核对 {verifiedCount} 种
              </div>
            </div>
          </div>
          <span className="font-mono text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {verifiedPercent}%
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${verifiedPercent}%` }}
          />
        </div>
      </div>

      {/* 外观与运行环境 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {state.theme === 'dark' ? (
              <Moon className="h-5 w-5 text-sky-400" />
            ) : (
              <Sun className="h-5 w-5 text-amber-500" />
            )}
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                夜班护眼暗黑模式
              </div>
              <div className="text-xs text-slate-400">
                ICU 夜间低光病房查看不刺眼
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className={`relative h-7 w-12 rounded-full transition ${
              state.theme === 'dark' ? 'bg-sky-600' : 'bg-slate-300'
            }`}
            aria-label="切换暗黑模式"
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                state.theme === 'dark' ? 'left-5.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Smartphone className="h-4 w-4 text-slate-400" />
            当前运行容器
          </span>
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {isScriptableEnv() ? 'iOS Scriptable 原生文件桥接' : '本地 Web / Android Capacitor'}
          </span>
        </div>
      </div>

      {/* 科室备份与表格导出 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2.5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          科室配置备份、导入与共享
        </h3>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          所有自定义配比与核对记录均纯本地保存。核对完成后可一键导出 JSON 备份，隔空投送/微信发给同科室同事直接导入。
        </p>

        <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleExportBackup}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 py-2.5 text-xs font-bold text-white active:scale-[0.98]"
          >
            <Download className="h-4 w-4" />
            导出科室药库备份 (.json)
          </button>

          <button
            type="button"
            onClick={handleImportClick}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Upload className="h-4 w-4" />
            导入科室药库备份 (.json)
          </button>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 py-2.5 text-xs font-bold text-emerald-700 active:scale-[0.98] dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <FileSpreadsheet className="h-4 w-4" />
          导出 Excel 药品配比核对总表 (.csv)
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* 扫码下载 / 分享给科室同事 */}
      <QrShareCard onNotify={onNotify} />

      {/* 核心临床公式说明 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2.5">
        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
          <BookOpen className="h-4 w-4 text-sky-500" />
          内置临床计算公式说明
        </div>
        <div className="space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
            <div className="font-bold text-slate-800 dark:text-slate-100">
              1. 通用双向泵速公式
            </div>
            <p className="mt-1 font-mono text-[11px]">
              浓度 C = 药液总药量 / 总容积(mL)
              <br />
              泵速(mL/h) = [目标剂量 × 体重(若按kg) × 60(若按min)] / 浓度 C
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
            <div className="font-bold text-slate-800 dark:text-slate-100">
              2. ICU 经典 50mL 体重系数速配法则
            </div>
            <p className="mt-1">
              • <strong>0.3 × 体重(kg) mg 配至 50mL</strong> → 1 mL/h = 0.1 μg/kg/min（去甲、肾上腺素、米力农等）
              <br />• <strong>3 × 体重(kg) mg 配至 50mL</strong> → 1 mL/h = 1.0 μg/kg/min（多巴胺、多巴酚丁胺、间羟胺等）
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
            <div className="font-bold text-slate-800 dark:text-slate-100">
              3. NEE 去甲等效剂量（Goradia 2021 / Kotani 2023）
            </div>
            <p className="mt-1 font-mono text-[11px]">
              NEE = NE + Epi + Dopamine/100 + Phenylephrine/10 + Metaraminol/8 + Vasopressin(U/min)×2.5
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
            <div className="font-bold text-slate-800 dark:text-slate-100">
              4. VIS 血管活性-正性肌力评分（Gaies 2010）
            </div>
            <p className="mt-1 font-mono text-[11px]">
              VIS = Dopamine + Dobutamine + 100×Epi + 100×NE + 10×Milrinone + 10000×Vasopressin(U/kg/min)
            </p>
          </div>
        </div>
      </div>

      {/* 医疗合规免责声明 & 重置 */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
        <div className="flex items-center gap-1.5 font-bold">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          重要临床安全声明
        </div>
        <p className="mt-1.5">
          本工具为个人离线计算辅助软件，预置药品配比与剂量范围整理自公开临床指南与国内常见制剂规格，<strong>不能替代医院医嘱系统、药品说明书或医师独立临床判断</strong>。不同厂家制剂规格（如去甲肾上腺素盐基/游离碱、替罗非班 50 vs 250 μg/mL、阿托品 0.5 vs 5 mg）可能存在显著差异，临床给药前请务必严格执行双人核对制度。
        </p>
      </div>

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={() => {
            if (window.confirm('确定恢复出厂内置药物库？您修改和新增的自定义药物将被清空。')) {
              onResetCustomDrugs();
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          恢复出厂默认药库
        </button>
      </div>

      <div className="flex items-center justify-center gap-1 pb-2 text-[11px] text-slate-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        ICU 泵助手 v1.0 · 全程零联网 · 零隐私上传
      </div>
    </div>
  );
};
