import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Droplets,
  Info,
  Layers,
  PlusCircle,
  Scale,
  ShieldAlert,
  Star,
  Sun,
} from 'lucide-react';
import {
  CATEGORY_META,
  type ActivePumpEntry,
  type AmountUnit,
  type DoseUnit,
  type DrugRecord,
  type PumpRecipe,
} from '../types/drug';
import {
  AMOUNT_UNIT_META,
  calculateConcentration,
  calculateConcentrationSwitch,
  convertDoseUnit,
  doseToRateMlPerHour,
  estimateRemainingTime,
  evaluateDoseSafety,
  formatAmountUnit,
  formatClinicalNumber,
  formatDoseUnit,
  isWeightBasedUnit,
  rateMlPerHourToDose,
  resolveEffectiveDrugAmount,
} from '../core/calculator';
import { copyTextCrossPlatform } from '../utils/storageBridge';

interface CalculatorViewProps {
  drug: DrugRecord;
  weightKg: number;
  isFavorite: boolean;
  onWeightChange: (weight: number) => void;
  onOpenDrugPicker: () => void;
  onToggleFavorite: (drugId: string) => void;
  onOpenDrugDetail: (drug: DrugRecord) => void;
  onAddToMultiPump: (entry: Omit<ActivePumpEntry, 'id'>) => void;
  onNotify: (msg: string) => void;
}

const VOLUME_PRESETS = [20, 50, 100, 250, 500];

export const CalculatorView: React.FC<CalculatorViewProps> = ({
  drug,
  weightKg,
  isFavorite,
  onWeightChange,
  onOpenDrugPicker,
  onToggleFavorite,
  onOpenDrugDetail,
  onAddToMultiPump,
  onNotify,
}) => {
  const defaultRecipe = useMemo(
    () => drug.recipes.find((r) => r.isDefault) ?? drug.recipes[0],
    [drug]
  );

  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(defaultRecipe.id);
  const [recipeMode, setRecipeMode] = useState<'fixed' | 'weight_rule'>(defaultRecipe.mode);
  const [drugAmountText, setDrugAmountText] = useState<string>(
    String(defaultRecipe.drugAmount ?? 8)
  );
  const [weightFactorText, setWeightFactorText] = useState<string>(
    String(defaultRecipe.weightFactor ?? 0.3)
  );
  const [amountUnit, setAmountUnit] = useState<AmountUnit>(defaultRecipe.amountUnit);
  const [totalVolumeText, setTotalVolumeText] = useState<string>(
    String(defaultRecipe.totalVolumeMl)
  );

  const [doseUnit, setDoseUnit] = useState<DoseUnit>(drug.defaultDoseUnit);
  const [lastEdited, setLastEdited] = useState<'dose' | 'rate'>('dose');
  const [doseText, setDoseText] = useState<string>(String(drug.doseRange.min));
  const [rateText, setRateText] = useState<string>('');

  const [subPanel, setSubPanel] = useState<'concentrate' | 'runtime'>('concentrate');
  const [customConcAmountText, setCustomConcAmountText] = useState<string>('');
  const [customConcVolText, setCustomConcVolText] = useState<string>('50');
  const [remainingMlText, setRemainingMlText] = useState<string>('50');
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // 切换药物时，重置为该药默认 50mL 配比及常规起始剂量
  useEffect(() => {
    const rec = drug.recipes.find((r) => r.isDefault) ?? drug.recipes[0];
    setSelectedRecipeId(rec.id);
    setRecipeMode(rec.mode);
    setDrugAmountText(String(rec.drugAmount ?? (rec.weightFactor ? rec.weightFactor * weightKg : 50)));
    setWeightFactorText(String(rec.weightFactor ?? 0.3));
    setAmountUnit(rec.amountUnit);
    setTotalVolumeText(String(rec.totalVolumeMl));
    setDoseUnit(drug.defaultDoseUnit);
    setLastEdited('dose');
    setDoseText(String(drug.doseRange.min));
    setRemainingMlText(String(rec.totalVolumeMl));
    setCustomConcVolText(String(rec.totalVolumeMl));
    setCustomConcAmountText('');
    setShowNotes(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drug.id]);

  const parsedWeight = Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 0;
  const parsedVolume = parseFloat(totalVolumeText) || 0;
  const parsedFixedAmount = parseFloat(drugAmountText) || 0;
  const parsedWeightFactor = parseFloat(weightFactorText) || 0;

  const effectiveAmount = useMemo(
    () =>
      resolveEffectiveDrugAmount(
        {
          mode: recipeMode,
          drugAmount: parsedFixedAmount,
          weightFactor: parsedWeightFactor,
        },
        parsedWeight
      ),
    [recipeMode, parsedFixedAmount, parsedWeightFactor, parsedWeight]
  );

  const concentration = useMemo(
    () => calculateConcentration(effectiveAmount, amountUnit, parsedVolume),
    [effectiveAmount, amountUnit, parsedVolume]
  );

  // 核心双向实时换算结果
  const { computedDose, computedRate } = useMemo(() => {
    if (lastEdited === 'dose') {
      const d = parseFloat(doseText);
      if (!Number.isFinite(d) || d < 0) {
        return { computedDose: null, computedRate: null };
      }
      const r = doseToRateMlPerHour({
        dose: d,
        doseUnit,
        drugAmount: effectiveAmount,
        amountUnit,
        totalVolumeMl: parsedVolume,
        weightKg: parsedWeight,
      });
      return { computedDose: d, computedRate: r };
    } else {
      const r = parseFloat(rateText);
      if (!Number.isFinite(r) || r < 0) {
        return { computedDose: null, computedRate: null };
      }
      const d = rateMlPerHourToDose({
        rateMlPerHour: r,
        doseUnit,
        drugAmount: effectiveAmount,
        amountUnit,
        totalVolumeMl: parsedVolume,
        weightKg: parsedWeight,
      });
      return { computedDose: d, computedRate: r };
    }
  }, [
    lastEdited,
    doseText,
    rateText,
    doseUnit,
    effectiveAmount,
    amountUnit,
    parsedVolume,
    parsedWeight,
  ]);

  const displayedDoseInput =
    lastEdited === 'dose'
      ? doseText
      : computedDose !== null
      ? formatClinicalNumber(computedDose, 4)
      : '';

  const displayedRateInput =
    lastEdited === 'rate'
      ? rateText
      : computedRate !== null
      ? formatClinicalNumber(computedRate, 2)
      : '';

  const safety = useMemo(
    () => evaluateDoseSafety(computedDose, doseUnit, drug.doseRange, parsedWeight),
    [computedDose, doseUnit, drug.doseRange, parsedWeight]
  );

  const activeRate = computedRate ?? 0;

  // 应用同药的预置配比（保持当前目标剂量不变，自动推算新泵速，防换浓度倍增过量）
  const applyRecipe = (rec: PumpRecipe) => {
    const keepDose = computedDose;
    setSelectedRecipeId(rec.id);
    setRecipeMode(rec.mode);
    if (rec.mode === 'fixed' && rec.drugAmount !== undefined) {
      setDrugAmountText(String(rec.drugAmount));
    }
    if (rec.mode === 'weight_rule' && rec.weightFactor !== undefined) {
      setWeightFactorText(String(rec.weightFactor));
    }
    setAmountUnit(rec.amountUnit);
    setTotalVolumeText(String(rec.totalVolumeMl));
    setRemainingMlText(String(rec.totalVolumeMl));
    setCustomConcVolText(String(rec.totalVolumeMl));

    if (keepDose !== null && keepDose > 0) {
      setLastEdited('dose');
      setDoseText(formatClinicalNumber(keepDose, 4));
    }
  };

  // 切换剂量显示单位，同步换算当前数值
  const handleDoseUnitSwitch = (nextUnit: DoseUnit) => {
    if (nextUnit === doseUnit) return;
    if (computedDose !== null) {
      const converted = convertDoseUnit(computedDose, doseUnit, nextUnit, parsedWeight);
      if (converted !== null) {
        setDoseText(formatClinicalNumber(converted, 4));
      }
    }
    setDoseUnit(nextUnit);
  };

  // 微调泵速按钮 (+/- 0.1, 0.5, 1, 2 mL/h)
  const stepRate = (delta: number) => {
    const base = computedRate ?? 0;
    const next = Math.max(0, Math.round((base + delta) * 100) / 100);
    setLastEdited('rate');
    setRateText(formatClinicalNumber(next, 2));
  };

  // 一键填入推荐剂量档位
  const applyQuickDose = (targetInRangeUnit: number) => {
    const converted = convertDoseUnit(
      targetInRangeUnit,
      drug.doseRange.unit,
      doseUnit,
      parsedWeight
    );
    if (converted === null) return;
    setLastEdited('dose');
    setDoseText(formatClinicalNumber(converted, 4));
  };

  // 浓缩换泵对比表
  const concOptions = useMemo(() => {
    if (effectiveAmount <= 0 || parsedVolume <= 0) return [];
    const presets = [
      { mult: 0.5, label: '0.5× 稀释' },
      { mult: 1, label: '当前 1×' },
      { mult: 2, label: '2× 浓缩' },
      { mult: 4, label: '4× 浓缩' },
    ];
    return presets
      .map((p) =>
        calculateConcentrationSwitch({
          currentDrugAmount: effectiveAmount,
          amountUnit,
          currentTotalVolumeMl: parsedVolume,
          currentRateMlPerHour: activeRate,
          targetMultiplier: p.mult,
          label: p.label,
        })
      )
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [effectiveAmount, amountUnit, parsedVolume, activeRate]);

  const customConcResult = useMemo(() => {
    const amt = parseFloat(customConcAmountText);
    const vol = parseFloat(customConcVolText);
    if (!Number.isFinite(amt) || amt <= 0 || !Number.isFinite(vol) || vol <= 0) return null;
    return calculateConcentrationSwitch({
      currentDrugAmount: effectiveAmount,
      amountUnit,
      currentTotalVolumeMl: parsedVolume,
      currentRateMlPerHour: activeRate,
      customNewDrugAmount: amt,
      customNewTotalVolumeMl: vol,
      label: '自定义浓缩',
    });
  }, [customConcAmountText, customConcVolText, effectiveAmount, amountUnit, parsedVolume, activeRate]);

  const runtimeEstimate = useMemo(() => {
    const rem = parseFloat(remainingMlText) || 0;
    return estimateRemainingTime(rem, activeRate);
  }, [remainingMlText, activeRate]);

  const handleCopySummary = async () => {
    if (computedRate === null || computedDose === null) return;
    const recipeDesc =
      recipeMode === 'weight_rule'
        ? `${parsedWeightFactor}×体重=${formatClinicalNumber(effectiveAmount, 2)}${formatAmountUnit(
            amountUnit
          )}/${parsedVolume}mL`
        : `${formatClinicalNumber(effectiveAmount, 2)}${formatAmountUnit(
            amountUnit
          )}/${parsedVolume}mL`;

    const text = `【ICU微泵】${drug.nameCn}（${recipeDesc}，体重${parsedWeight}kg）：泵速 ${formatClinicalNumber(
      computedRate,
      2
    )} mL/h → 剂量 ${formatClinicalNumber(computedDose, 3)} ${formatDoseUnit(doseUnit)}`;

    const ok = await copyTextCrossPlatform(text);
    if (ok) {
      setCopied(true);
      onNotify('已复制当前泵速摘要');
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleAddToPanel = () => {
    if (computedRate === null || computedRate <= 0) {
      onNotify('请先输入大于 0 的泵速或目标剂量');
      return;
    }
    onAddToMultiPump({
      drugId: drug.id,
      recipeId: selectedRecipeId,
      mode: recipeMode,
      drugAmount: effectiveAmount,
      weightFactor: recipeMode === 'weight_rule' ? parsedWeightFactor : undefined,
      amountUnit,
      totalVolumeMl: parsedVolume,
      rateMlPerHour: Math.round(computedRate * 100) / 100,
      displayDoseUnit: doseUnit,
      remainingMl: parsedVolume,
    });
  };

  const safetyColorMap = {
    zero: {
      bar: 'bg-slate-300 dark:bg-slate-700',
      badge: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
      ring: 'border-slate-200 dark:border-slate-800',
    },
    below: {
      bar: 'bg-sky-500',
      badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
      ring: 'border-sky-300 dark:border-sky-800',
    },
    normal: {
      bar: 'bg-emerald-500',
      badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
      ring: 'border-emerald-300 dark:border-emerald-800/70',
    },
    high: {
      bar: 'bg-amber-500',
      badge: 'bg-amber-500/20 text-amber-800 dark:text-amber-300',
      ring: 'border-amber-400 dark:border-amber-600',
    },
    danger: {
      bar: 'bg-rose-600',
      badge: 'bg-rose-600 text-white',
      ring: 'border-rose-500 ring-2 ring-rose-500/25',
    },
  }[safety.level];

  const sameFamilyAmountUnits = (Object.keys(AMOUNT_UNIT_META) as AmountUnit[]).filter(
    (u) => AMOUNT_UNIT_META[u].family === AMOUNT_UNIT_META[drug.recipes[0].amountUnit].family
  );

  const needsWeight = isWeightBasedUnit(doseUnit) || recipeMode === 'weight_rule';

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pb-6 pt-3">
      {/* 1. 选药顶卡 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onOpenDrugPicker}
            className="min-w-0 flex-1 text-left active:opacity-75"
          >
            <div className="flex items-center gap-1.5">
              <span className="truncate text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                {drug.nameCn}
              </span>
              <span className="rounded-lg bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                切换药物 ▾
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400">{drug.nameEn}</span>
              <span
                className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                  CATEGORY_META[drug.category].colorClass
                }`}
              >
                {CATEGORY_META[drug.category].shortLabel}
              </span>
              {drug.highAlert && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="h-3 w-3" />
                  高警示
                </span>
              )}
              {drug.route === 'cvc_required' && (
                <span className="rounded-md bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                  须CVC
                </span>
              )}
              {drug.lightProtection && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                  <Sun className="h-3 w-3" />
                  避光
                </span>
              )}
              {drug.verified && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  已核对
                </span>
              )}
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleFavorite(drug.id)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 active:scale-90 dark:bg-slate-800"
              aria-label="收藏药物"
            >
              <Star
                className={`h-4.5 w-4.5 ${
                  isFavorite
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => onOpenDrugDetail(drug)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-600 active:scale-90 dark:bg-slate-800 dark:text-slate-300"
              aria-label="药物说明书与编辑"
            >
              <Info className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* 患者体重快捷栏 */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <Scale className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              参考体重
            </span>
            {!needsWeight && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400 dark:bg-slate-800">
                当前单位非体重依赖
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onWeightChange(Math.max(1, weightKg - 5))}
              className="h-8 rounded-lg bg-slate-100 px-2 font-mono text-xs font-semibold text-slate-600 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
            >
              -5
            </button>
            <div className="relative flex items-center">
              <input
                type="number"
                inputMode="decimal"
                value={weightKg || ''}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  onWeightChange(Number.isFinite(v) && v >= 0 ? v : 0);
                }}
                className="h-8 w-20 rounded-lg border border-slate-200 bg-slate-50 pl-2 pr-7 text-right font-mono text-sm font-bold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <span className="pointer-events-none absolute right-2 text-xs text-slate-400">
                kg
              </span>
            </div>
            <button
              type="button"
              onClick={() => onWeightChange(weightKg + 5)}
              className="h-8 rounded-lg bg-slate-100 px-2 font-mono text-xs font-semibold text-slate-600 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
            >
              +5
            </button>
          </div>
        </div>
      </div>

      {/* 2. 泵配比卡片（固定配比为主 + 体重系数配法） */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Droplets className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              泵液配比（默认 50mL）
            </span>
          </div>

          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setRecipeMode('fixed')}
              className={`rounded-md px-2.5 py-1 transition ${
                recipeMode === 'fixed'
                  ? 'bg-white text-sky-700 shadow-2xs dark:bg-slate-700 dark:text-sky-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              固定配比
            </button>
            <button
              type="button"
              onClick={() => setRecipeMode('weight_rule')}
              className={`rounded-md px-2.5 py-1 transition ${
                recipeMode === 'weight_rule'
                  ? 'bg-white text-sky-700 shadow-2xs dark:bg-slate-700 dark:text-sky-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              体重系数法
            </button>
          </div>
        </div>

        {/* 预置配比快捷胶囊 */}
        <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
          {drug.recipes.map((rec) => {
            const active =
              selectedRecipeId === rec.id &&
              recipeMode === rec.mode &&
              Number(totalVolumeText) === rec.totalVolumeMl &&
              ((rec.mode === 'fixed' && Number(drugAmountText) === rec.drugAmount) ||
                (rec.mode === 'weight_rule' && Number(weightFactorText) === rec.weightFactor));
            return (
              <button
                key={rec.id}
                type="button"
                onClick={() => applyRecipe(rec)}
                className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                  active
                    ? 'border-sky-600 bg-sky-600 text-white shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                {rec.label}
              </button>
            );
          })}
        </div>

        {/* 手动调整药量与总容积 */}
        <div className="mt-2.5 grid grid-cols-12 gap-2">
          {recipeMode === 'fixed' ? (
            <div className="col-span-5">
              <label className="block text-[11px] font-medium text-slate-500">药量</label>
              <input
                type="number"
                inputMode="decimal"
                value={drugAmountText}
                onChange={(e) => {
                  setDrugAmountText(e.target.value);
                  setSelectedRecipeId('custom');
                }}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-base font-bold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          ) : (
            <div className="col-span-5">
              <label className="block text-[11px] font-medium text-slate-500">
                体重系数 (×kg)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={weightFactorText}
                onChange={(e) => {
                  setWeightFactorText(e.target.value);
                  setSelectedRecipeId('custom');
                }}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-base font-bold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          )}

          <div className="col-span-3">
            <label className="block text-[11px] font-medium text-slate-500">单位</label>
            <select
              value={amountUnit}
              onChange={(e) => setAmountUnit(e.target.value as AmountUnit)}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 text-sm font-semibold text-slate-800 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {sameFamilyAmountUnits.map((u) => (
                <option key={u} value={u}>
                  {formatAmountUnit(u)}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-4">
            <label className="block text-[11px] font-medium text-slate-500">总容积 (mL)</label>
            <input
              type="number"
              inputMode="decimal"
              value={totalVolumeText}
              onChange={(e) => {
                setTotalVolumeText(e.target.value);
                setSelectedRecipeId('custom');
              }}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-base font-bold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* 快捷容积 & 体重系数快捷按钮 */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {VOLUME_PRESETS.map((vol) => (
              <button
                key={vol}
                type="button"
                onClick={() => {
                  setTotalVolumeText(String(vol));
                  setRemainingMlText(String(vol));
                }}
                className={`rounded-lg px-2 py-1 font-mono text-[11px] font-semibold transition ${
                  parsedVolume === vol
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {vol}mL
              </button>
            ))}
          </div>

          {recipeMode === 'weight_rule' && AMOUNT_UNIT_META[amountUnit].family === 'mass' && (
            <div className="flex items-center gap-1">
              {[0.3, 3].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setWeightFactorText(String(f));
                    setAmountUnit('mg');
                    setTotalVolumeText('50');
                  }}
                  className="rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                >
                  {f}×kg
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 实时浓度条 */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1 rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/70">
          <span className="text-slate-500 dark:text-slate-400">
            {recipeMode === 'weight_rule' ? (
              <>
                需抽药量：
                <strong className="font-mono text-slate-900 dark:text-white">
                  {formatClinicalNumber(effectiveAmount, 2)} {formatAmountUnit(amountUnit)}
                </strong>{' '}
                配至 {parsedVolume}mL
              </>
            ) : (
              <>当前泵液浓度</>
            )}
          </span>
          <span className="font-mono font-bold text-sky-700 dark:text-sky-300">
            {concentration.displayText}
          </span>
        </div>
      </div>

      {/* 3. 核心双向换算卡（目标剂量 ⇄ 泵速 mL/h） */}
      <div
        className={`rounded-2xl border bg-white p-4 shadow-xs transition dark:bg-slate-900 ${safetyColorMap.ring}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
            <ArrowLeftRight className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            剂量 ⇄ 泵速 双向实时换算
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${safetyColorMap.badge}`}>
            {safety.label}
          </span>
        </div>

        {/* 双大输入框 */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* 左侧：目标剂量 */}
          <div
            className={`rounded-2xl border p-3 transition ${
              lastEdited === 'dose'
                ? 'border-sky-500 bg-sky-50/50 dark:border-sky-500 dark:bg-sky-950/30'
                : 'border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                给药剂量
              </span>
              <span className="text-[10px] text-slate-400">
                {lastEdited === 'dose' ? '输入中 → 算泵速' : '由泵速反推'}
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <input
                type="number"
                inputMode="decimal"
                value={displayedDoseInput}
                onFocus={() => {
                  if (lastEdited !== 'dose') {
                    setLastEdited('dose');
                    setDoseText(displayedDoseInput);
                  }
                }}
                onChange={(e) => {
                  setLastEdited('dose');
                  setDoseText(e.target.value);
                }}
                placeholder="0"
                className="w-full bg-transparent font-mono text-3xl font-extrabold tabular-nums text-slate-900 focus:outline-none dark:text-white"
              />
              <span className="shrink-0 font-mono text-xs font-bold text-sky-700 dark:text-sky-300">
                {formatDoseUnit(doseUnit)}
              </span>
            </div>

            {/* 剂量单位快捷切换 */}
            {drug.supportedDoseUnits.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {drug.supportedDoseUnits.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleDoseUnitSwitch(u)}
                    className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold transition ${
                      doseUnit === u
                        ? 'bg-sky-600 text-white'
                        : 'bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700'
                    }`}
                  >
                    {formatDoseUnit(u)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 右侧：泵速 mL/h */}
          <div
            className={`rounded-2xl border p-3 transition ${
              lastEdited === 'rate'
                ? 'border-sky-500 bg-sky-50/50 dark:border-sky-500 dark:bg-sky-950/30'
                : 'border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                微量泵走速
              </span>
              <span className="text-[10px] text-slate-400">
                {lastEdited === 'rate' ? '输入中 → 反推剂量' : '正向计算结果'}
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <input
                type="number"
                inputMode="decimal"
                value={displayedRateInput}
                onFocus={() => {
                  if (lastEdited !== 'rate') {
                    setLastEdited('rate');
                    setRateText(displayedRateInput);
                  }
                }}
                onChange={(e) => {
                  setLastEdited('rate');
                  setRateText(e.target.value);
                }}
                placeholder="0"
                className="w-full bg-transparent font-mono text-3xl font-extrabold tabular-nums text-sky-700 focus:outline-none dark:text-sky-300"
              />
              <span className="shrink-0 font-mono text-sm font-bold text-slate-500 dark:text-slate-400">
                mL/h
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>24h 液量：{formatClinicalNumber(activeRate * 24, 0)} mL</span>
              <span>
                满管({parsedVolume}mL)：
                {activeRate > 0 ? `${formatClinicalNumber(parsedVolume / activeRate, 1)} h` : '--'}
              </span>
            </div>
          </div>
        </div>

        {/* 临床快捷微调泵速按钮条 */}
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>走速微调 (mL/h)</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => applyQuickDose(drug.doseRange.min)}
                className="font-semibold text-sky-600 hover:underline dark:text-sky-400"
              >
                起始 {drug.doseRange.min}
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() =>
                  applyQuickDose(
                    Number(((drug.doseRange.min + drug.doseRange.max) / 2).toPrecision(3))
                  )
                }
                className="font-semibold text-sky-600 hover:underline dark:text-sky-400"
              >
                中值
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => applyQuickDose(drug.doseRange.max)}
                className="font-semibold text-amber-600 hover:underline dark:text-amber-400"
              >
                上限 {drug.doseRange.max}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {[-1, -0.5, -0.1, 0.1, 0.5, 1].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => stepRate(step)}
                className={`h-9 rounded-xl font-mono text-xs font-bold transition active:scale-95 ${
                  step < 0
                    ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    : 'bg-sky-50 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300'
                }`}
              >
                {step > 0 ? `+${step}` : step}
              </button>
            ))}
          </div>
        </div>

        {/* 安全范围指示条 */}
        <div className="mt-3 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className={`h-full rounded-full transition-all duration-200 ${safetyColorMap.bar}`}
              style={{ width: `${safety.gaugePercent}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
            {(safety.level === 'high' || safety.level === 'danger') && (
              <AlertTriangle
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                  safety.level === 'danger' ? 'text-rose-600' : 'text-amber-500'
                }`}
              />
            )}
            <span>
              <strong className="text-slate-700 dark:text-slate-200">参考范围：</strong>
              {drug.doseRange.text}
            </span>
          </div>
        </div>

        {/* 底部双操作按钮 */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleAddToPanel}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 py-2.5 text-xs font-bold text-white shadow-2xs active:scale-[0.98]"
          >
            <PlusCircle className="h-4 w-4" />
            加入多路泵面板
          </button>
          <button
            type="button"
            onClick={handleCopySummary}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            {copied ? '已复制摘要' : '复制配泵摘要'}
          </button>
        </div>
      </div>

      {/* 4. 浓缩换泵 & 续泵剩余时间 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setSubPanel('concentrate')}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
              subPanel === 'concentrate'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            浓缩/限液换泵
          </button>
          <button
            type="button"
            onClick={() => setSubPanel('runtime')}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
              subPanel === 'runtime'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            续泵剩余时间
          </button>
        </div>

        {subPanel === 'concentrate' ? (
          <div className="mt-3 space-y-2.5">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              保持当前给药剂量（
              <strong className="font-mono text-slate-800 dark:text-slate-200">
                {computedDose !== null ? formatClinicalNumber(computedDose, 3) : '--'}{' '}
                {formatDoseUnit(doseUnit)}
              </strong>
              ）严格不变，一键对比不同浓度配比的新走速与 24h 节液量：
            </p>

            <div className="grid grid-cols-2 gap-2">
              {concOptions.map((opt) => (
                <div
                  key={opt.label}
                  className={`rounded-xl border p-2.5 ${
                    opt.multiplier === 1
                      ? 'border-sky-300 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/30'
                      : 'border-slate-200 bg-slate-50/60 dark:border-slate-700/80 dark:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                      {opt.label}
                    </span>
                    {opt.fluidSavedPer24hMl > 0.5 && (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                        省 {Math.round(opt.fluidSavedPer24hMl)}mL/日
                      </span>
                    )}
                  </div>
                  <div className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {formatClinicalNumber(opt.newDrugAmount, 2)}
                    {formatAmountUnit(opt.amountUnit)} / {opt.newTotalVolumeMl}mL
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="font-mono text-lg font-extrabold text-sky-700 dark:text-sky-300">
                      {formatClinicalNumber(opt.newRateMlPerHour, 2)}{' '}
                      <span className="text-[11px] font-semibold">mL/h</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {opt.syringeDurationHours
                        ? `${formatClinicalNumber(opt.syringeDurationHours, 1)}h/管`
                        : '--'}
                    </span>
                  </div>

                  {opt.multiplier !== 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setRecipeMode('fixed');
                        setSelectedRecipeId('custom');
                        setDrugAmountText(formatClinicalNumber(opt.newDrugAmount, 3));
                        setTotalVolumeText(String(opt.newTotalVolumeMl));
                        setLastEdited('rate');
                        setRateText(formatClinicalNumber(opt.newRateMlPerHour, 2));
                        onNotify(`已切换为 ${opt.label}，等效新泵速 ${formatClinicalNumber(opt.newRateMlPerHour, 2)} mL/h`);
                      }}
                      className="mt-2 w-full rounded-lg bg-white py-1 text-[11px] font-bold text-sky-700 ring-1 ring-slate-200 active:scale-95 dark:bg-slate-900 dark:text-sky-300 dark:ring-slate-700"
                    >
                      切换为此浓度
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* 自定义新配比换算行 */}
            <div className="rounded-xl border border-dashed border-slate-300 p-2.5 dark:border-slate-700">
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                任意新配比换算（如改药量或改 100mL/250mL 输液袋）
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={customConcAmountText}
                  onChange={(e) => setCustomConcAmountText(e.target.value)}
                  placeholder={`新药量(${formatAmountUnit(amountUnit)})`}
                  className="h-9 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <span className="text-xs text-slate-400">/</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={customConcVolText}
                  onChange={(e) => setCustomConcVolText(e.target.value)}
                  placeholder="新总容积mL"
                  className="h-9 w-24 rounded-lg border border-slate-200 bg-slate-50 px-2.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <span className="text-xs text-slate-400">mL</span>
              </div>
              {customConcResult && (
                <div className="mt-2 flex items-center justify-between rounded-lg bg-sky-50 px-2.5 py-2 text-xs dark:bg-sky-950/50">
                  <span>
                    等效新泵速：
                    <strong className="font-mono text-sm text-sky-700 dark:text-sky-300">
                      {formatClinicalNumber(customConcResult.newRateMlPerHour, 2)} mL/h
                    </strong>
                    {customConcResult.syringeDurationHours
                      ? `（维持 ${formatClinicalNumber(customConcResult.syringeDurationHours, 1)} h）`
                      : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRecipeMode('fixed');
                      setSelectedRecipeId('custom');
                      setDrugAmountText(formatClinicalNumber(customConcResult.newDrugAmount, 3));
                      setTotalVolumeText(String(customConcResult.newTotalVolumeMl));
                      setLastEdited('rate');
                      setRateText(formatClinicalNumber(customConcResult.newRateMlPerHour, 2));
                    }}
                    className="rounded bg-sky-600 px-2 py-1 text-[11px] font-bold text-white"
                  >
                    采用
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                注射器当前剩余药液
              </span>
              <div className="flex items-center gap-1.5">
                {[10, 20, 30, 50].map((ml) => (
                  <button
                    key={ml}
                    type="button"
                    onClick={() => setRemainingMlText(String(ml))}
                    className={`rounded-lg px-2 py-1 font-mono text-xs font-semibold ${
                      Number(remainingMlText) === ml
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {ml}
                  </button>
                ))}
                <input
                  type="number"
                  inputMode="decimal"
                  value={remainingMlText}
                  onChange={(e) => setRemainingMlText(e.target.value)}
                  className="h-8 w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 text-right font-mono text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                />
                <span className="text-xs text-slate-400">mL</span>
              </div>
            </div>

            {runtimeEstimate ? (
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
                <div>
                  <div className="text-[11px] text-slate-400">预计还可维持</div>
                  <div className="mt-0.5 font-mono text-lg font-extrabold text-slate-900 dark:text-white">
                    {runtimeEstimate.durationText}
                  </div>
                </div>
                <div className="border-l border-slate-200 pl-3 dark:border-slate-700">
                  <div className="text-[11px] text-slate-400">预计打完时刻（提前备泵）</div>
                  <div className="mt-0.5 font-mono text-lg font-extrabold text-sky-700 dark:text-sky-300">
                    {runtimeEstimate.finishTimeText}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-400 dark:bg-slate-800/70">
                输入大于 0 的当前泵速和剩余药液量即可预估续泵时间
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. 临床要点、溶媒与配伍速览（默认折叠核心摘要，点击展开全量） */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setShowNotes((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            溶媒、通路与配伍禁忌速查
          </div>
          {showNotes ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {/* 始终常驻的两行最关键安全提醒 */}
        <div className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <div>
            <span className="font-bold text-slate-700 dark:text-slate-200">溶媒：</span>
            {drug.diluents}
          </div>
          <div
            className={
              drug.route === 'cvc_required' ? 'font-semibold text-rose-600 dark:text-rose-400' : ''
            }
          >
            <span className="font-bold">通路：</span>
            {drug.routeNote}
          </div>
        </div>

        {showNotes && (
          <div className="mt-2.5 space-y-2 border-t border-slate-100 pt-2.5 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-300">
            {drug.specialTubing && (
              <div className="rounded-lg bg-amber-50 p-2 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                <strong>特殊管路：</strong>
                {drug.specialTubing}
              </div>
            )}
            <div>
              <strong className="text-rose-600 dark:text-rose-400">配伍禁忌：</strong>
              {drug.incompatibilities}
            </div>
            <div>
              <strong className="text-slate-700 dark:text-slate-200">常见规格：</strong>
              {drug.vialSpec}
            </div>
            {drug.departmentNote && (
              <div className="rounded-lg bg-sky-50 p-2 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200">
                <strong>本科室备注：</strong>
                {drug.departmentNote}
              </div>
            )}
            {drug.clinicalNotes.length > 0 && (
              <ul className="list-disc space-y-1 pl-4">
                {drug.clinicalNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
