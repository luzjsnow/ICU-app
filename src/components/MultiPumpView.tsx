import React, { useMemo, useState } from 'react';
import {
  Activity,
  Calculator,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Droplets,
  Layers,
  Plus,
  Scale,
  Trash2,
} from 'lucide-react';
import type { ActivePumpEntry, DrugRecord } from '../types/drug';
import {
  calculateMultiPumpSummary,
  estimateRemainingTime,
  evaluateDoseSafety,
  formatAmountUnit,
  formatClinicalNumber,
  formatDoseUnit,
  rateMlPerHourToDose,
  resolveEffectiveDrugAmount,
} from '../core/calculator';
import { copyTextCrossPlatform } from '../utils/storageBridge';

interface MultiPumpViewProps {
  pumps: ActivePumpEntry[];
  drugMap: Map<string, DrugRecord>;
  weightKg: number;
  onWeightChange: (weight: number) => void;
  onAddPumpClick: () => void;
  onUpdatePump: (id: string, patch: Partial<ActivePumpEntry>) => void;
  onRemovePump: (id: string) => void;
  onClearAll: () => void;
  onInspectInCalculator: (drug: DrugRecord) => void;
  onNotify: (msg: string) => void;
}

export const MultiPumpView: React.FC<MultiPumpViewProps> = ({
  pumps,
  drugMap,
  weightKg,
  onWeightChange,
  onAddPumpClick,
  onUpdatePump,
  onRemovePump,
  onClearAll,
  onInspectInCalculator,
  onNotify,
}) => {
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const summary = useMemo(
    () => calculateMultiPumpSummary(pumps, drugMap, weightKg),
    [pumps, drugMap, weightKg]
  );

  const handleCopyHandover = async () => {
    if (pumps.length === 0) return;
    const lines: string[] = [
      `【ICU 多路微泵汇总】（参考体重 ${weightKg} kg）`,
    ];

    pumps.forEach((p, idx) => {
      const drug = drugMap.get(p.drugId);
      if (!drug) return;
      const effectiveAmount = resolveEffectiveDrugAmount(
        { mode: p.mode, drugAmount: p.drugAmount, weightFactor: p.weightFactor },
        weightKg
      );
      const dose = rateMlPerHourToDose({
        rateMlPerHour: p.rateMlPerHour,
        doseUnit: p.displayDoseUnit,
        drugAmount: effectiveAmount,
        amountUnit: p.amountUnit,
        totalVolumeMl: p.totalVolumeMl,
        weightKg,
      });
      lines.push(
        `${idx + 1}. ${drug.nameCn}（${formatClinicalNumber(effectiveAmount, 2)}${formatAmountUnit(
          p.amountUnit
        )}/${p.totalVolumeMl}mL）：${formatClinicalNumber(p.rateMlPerHour, 2)} mL/h → ${
          dose !== null ? formatClinicalNumber(dose, 3) : '--'
        } ${formatDoseUnit(p.displayDoseUnit)}`
      );
    });

    lines.push(
      `---`,
      `微泵总入液：${formatClinicalNumber(summary.totalFluidMlPerHour, 1)} mL/h（约 ${Math.round(
        summary.totalFluidMlPer24h
      )} mL/24h）`
    );
    if (summary.totalNee > 0) {
      lines.push(`去甲等效剂量(NEE)：${formatClinicalNumber(summary.totalNee, 3)} μg/kg/min`);
    }
    if (summary.totalVis > 0) {
      lines.push(`血管活性评分(VIS)：${formatClinicalNumber(summary.totalVis, 1)}`);
    }

    const ok = await copyTextCrossPlatform(lines.join('\n'));
    if (ok) {
      setCopied(true);
      onNotify('已复制多路微泵汇总文本');
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pb-6 pt-3">
      {/* 顶部体重 + 清空 + 复制 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              当前参考体重
            </span>
            <div className="relative flex items-center">
              <input
                type="number"
                inputMode="decimal"
                value={weightKg || ''}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  onWeightChange(Number.isFinite(v) && v >= 0 ? v : 0);
                }}
                className="h-8 w-20 rounded-lg border border-slate-200 bg-slate-50 pl-2 pr-7 text-right font-mono text-sm font-bold dark:border-slate-700 dark:bg-slate-800"
              />
              <span className="pointer-events-none absolute right-2 text-xs text-slate-400">
                kg
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {pumps.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleCopyHandover}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 active:scale-95 dark:bg-slate-800 dark:text-slate-200"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  复制汇总
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('确定清空当前面板中的所有微泵记录？')) {
                      onClearAll();
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 active:scale-95 dark:bg-rose-950/60 dark:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  清空
                </button>
              </>
            )}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          纯离线临时演算面板，不记录患者姓名/住院号等任何隐私信息。
        </p>
      </div>

      {/* 三大核心汇总 KPI 卡 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <Droplets className="h-3.5 w-3.5 text-sky-500" />
            微泵总入液
          </div>
          <div className="mt-1 font-mono text-lg font-extrabold tabular-nums text-slate-900 dark:text-white">
            {formatClinicalNumber(summary.totalFluidMlPerHour, 1)}
            <span className="ml-0.5 text-[10px] font-semibold text-slate-400">mL/h</span>
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-400">
            ≈ {Math.round(summary.totalFluidMlPer24h)} mL/24h
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowScoreBreakdown((v) => !v)}
          className="rounded-2xl border border-slate-200 bg-white p-3 text-left active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Activity className="h-3.5 w-3.5 text-rose-500" />
              NEE 等效
            </span>
          </div>
          <div className="mt-1 font-mono text-lg font-extrabold tabular-nums text-rose-600 dark:text-rose-400">
            {formatClinicalNumber(summary.totalNee, 3)}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">μg/kg/min 去甲</div>
        </button>

        <button
          type="button"
          onClick={() => setShowScoreBreakdown((v) => !v)}
          className="rounded-2xl border border-slate-200 bg-white p-3 text-left active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span>VIS 评分</span>
            {showScoreBreakdown ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </div>
          <div className="mt-1 font-mono text-lg font-extrabold tabular-nums text-indigo-600 dark:text-indigo-400">
            {formatClinicalNumber(summary.totalVis, 1)}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">点击看公式明细</div>
        </button>
      </div>

      {/* 可展开的 NEE / VIS 公式透明明细 */}
      {showScoreBreakdown && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-xs dark:border-slate-800 dark:bg-slate-900 space-y-2.5">
          <div>
            <div className="font-bold text-rose-600 dark:text-rose-400">
              去甲肾上腺素等效剂量 (NEE · Goradia 2021 / Kotani 2023)
            </div>
            {summary.neeBreakdown.length === 0 ? (
              <p className="mt-1 text-slate-400">当前无纳入 NEE 计算的血管活性药物</p>
            ) : (
              <ul className="mt-1 space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                {summary.neeBreakdown.map((item) => (
                  <li key={item.pumpId} className="flex justify-between gap-2">
                    <span>
                      {item.drugName}（{formatClinicalNumber(item.rawDose, 3)}{' '}
                      {formatDoseUnit(item.unit)}）
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      +{formatClinicalNumber(item.contribution, 3)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-100 pt-2.5 dark:border-slate-800">
            <div className="font-bold text-indigo-600 dark:text-indigo-400">
              血管活性-正性肌力评分 (VIS · Gaies 2010)
            </div>
            {summary.visBreakdown.length === 0 ? (
              <p className="mt-1 text-slate-400">当前无纳入 VIS 计算的药物</p>
            ) : (
              <ul className="mt-1 space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                {summary.visBreakdown.map((item) => (
                  <li key={item.pumpId} className="flex justify-between gap-2">
                    <span>{item.formulaLabel}</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      +{formatClinicalNumber(item.contribution, 1)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* 活跃微泵列表 */}
      {pumps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
            <Layers className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">
            当前暂无在用微泵
          </p>
          <p className="mt-1 text-xs text-slate-400">
            点击下方按钮添加多路药物，自动汇总总入液量、NEE 与 VIS 评分
          </p>
          <button
            type="button"
            onClick={onAddPumpClick}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm active:scale-95"
          >
            <Plus className="h-4 w-4" />
            添加第一路微泵
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {pumps.map((pump) => {
            const drug = drugMap.get(pump.drugId);
            if (!drug) return null;

            const effectiveAmount = resolveEffectiveDrugAmount(
              {
                mode: pump.mode,
                drugAmount: pump.drugAmount,
                weightFactor: pump.weightFactor,
              },
              weightKg
            );
            const dose = rateMlPerHourToDose({
              rateMlPerHour: pump.rateMlPerHour,
              doseUnit: pump.displayDoseUnit,
              drugAmount: effectiveAmount,
              amountUnit: pump.amountUnit,
              totalVolumeMl: pump.totalVolumeMl,
              weightKg,
            });
            const safety = evaluateDoseSafety(
              dose,
              pump.displayDoseUnit,
              drug.doseRange,
              weightKg
            );
            const est = estimateRemainingTime(
              pump.remainingMl ?? pump.totalVolumeMl,
              pump.rateMlPerHour
            );

            const badgeClass =
              safety.level === 'danger'
                ? 'bg-rose-600 text-white'
                : safety.level === 'high'
                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                : safety.level === 'normal'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';

            return (
              <div
                key={pump.id}
                className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {drug.nameCn}
                      </span>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {formatClinicalNumber(effectiveAmount, 2)}
                        {formatAmountUnit(pump.amountUnit)} / {pump.totalVolumeMl}mL
                      </span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${badgeClass}`}>
                        {safety.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-mono text-xl font-extrabold tabular-nums text-sky-700 dark:text-sky-300">
                        {dose !== null ? formatClinicalNumber(dose, 3) : '--'}
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-500">
                        {formatDoseUnit(pump.displayDoseUnit)}
                      </span>
                      {est && (
                        <span className="text-[11px] text-slate-400">
                          · 满管约 {est.durationText}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onInspectInCalculator(drug)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                      title="在单泵页精算"
                    >
                      <Calculator className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemovePump(pump.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500 dark:bg-rose-950/60 dark:text-rose-400"
                      title="移除该路泵"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* 内联调速控制条 */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                  <div className="flex items-center gap-1">
                    {[-0.5, -0.1].map((delta) => (
                      <button
                        key={delta}
                        type="button"
                        onClick={() =>
                          onUpdatePump(pump.id, {
                            rateMlPerHour: Math.max(
                              0,
                              Math.round((pump.rateMlPerHour + delta) * 100) / 100
                            ),
                          })
                        }
                        className="h-8 rounded-lg bg-slate-100 px-2 font-mono text-xs font-bold text-slate-700 active:scale-95 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {delta}
                      </button>
                    ))}

                    <div className="relative flex items-center">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={pump.rateMlPerHour}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          onUpdatePump(pump.id, {
                            rateMlPerHour: Number.isFinite(v) && v >= 0 ? v : 0,
                          });
                        }}
                        className="h-8 w-22 rounded-lg border border-slate-200 bg-slate-50 pl-2 pr-9 text-right font-mono text-xs font-extrabold dark:border-slate-700 dark:bg-slate-800"
                      />
                      <span className="pointer-events-none absolute right-1.5 font-mono text-[10px] text-slate-400">
                        mL/h
                      </span>
                    </div>

                    {[0.1, 0.5].map((delta) => (
                      <button
                        key={delta}
                        type="button"
                        onClick={() =>
                          onUpdatePump(pump.id, {
                            rateMlPerHour: Math.round((pump.rateMlPerHour + delta) * 100) / 100,
                          })
                        }
                        className="h-8 rounded-lg bg-sky-50 px-2 font-mono text-xs font-bold text-sky-700 active:scale-95 dark:bg-sky-950 dark:text-sky-300"
                      >
                        +{delta}
                      </button>
                    ))}
                  </div>

                  {/* 一键 2倍浓缩减液（保持剂量严格不变） */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextAmt = Math.round(effectiveAmount * 2 * 1000) / 1000;
                      const nextRate = Math.round((pump.rateMlPerHour / 2) * 100) / 100;
                      onUpdatePump(pump.id, {
                        mode: 'fixed',
                        drugAmount: nextAmt,
                        weightFactor: undefined,
                        rateMlPerHour: nextRate,
                      });
                      onNotify(`${drug.nameCn} 已等效 2× 浓缩，新泵速 ${nextRate} mL/h`);
                    }}
                    className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 active:scale-95 dark:bg-emerald-950/60 dark:text-emerald-300"
                  >
                    2× 浓缩减液
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={onAddPumpClick}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/40 py-3.5 text-sm font-bold text-sky-700 active:scale-[0.99] dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300"
          >
            <Plus className="h-4.5 w-4.5" />
            添加一路新微泵
          </button>
        </div>
      )}
    </div>
  );
};
