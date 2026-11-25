import type {
  ActivePumpEntry,
  AmountUnit,
  DoseRangeSpec,
  DoseUnit,
  DrugRecord,
  NeeKey,
  PumpRecipe,
  UnitFamily,
  VisKey,
} from '../types/drug';

interface AmountUnitMeta {
  family: UnitFamily;
  /** 换算到该单位族基准单位的系数（mass→μg, activity→U, mmol→mmol, mEq→mEq） */
  toBase: number;
  display: string;
}

interface DoseUnitMeta {
  family: UnitFamily;
  toBase: number;
  perKg: boolean;
  perMin: boolean;
  display: string;
}

export const AMOUNT_UNIT_META: Record<AmountUnit, AmountUnitMeta> = {
  g: { family: 'mass', toBase: 1e6, display: 'g' },
  mg: { family: 'mass', toBase: 1e3, display: 'mg' },
  ug: { family: 'mass', toBase: 1, display: 'μg' },
  U: { family: 'activity', toBase: 1, display: 'U' },
  mU: { family: 'activity', toBase: 1e-3, display: 'mU' },
  mmol: { family: 'mmol', toBase: 1, display: 'mmol' },
  mEq: { family: 'mEq', toBase: 1, display: 'mEq' },
};

export const DOSE_UNIT_META: Record<DoseUnit, DoseUnitMeta> = {
  'ng/kg/min': { family: 'mass', toBase: 1e-3, perKg: true, perMin: true, display: 'ng/kg/min' },
  'ug/kg/min': { family: 'mass', toBase: 1, perKg: true, perMin: true, display: 'μg/kg/min' },
  'mg/kg/min': { family: 'mass', toBase: 1e3, perKg: true, perMin: true, display: 'mg/kg/min' },
  'ug/kg/h': { family: 'mass', toBase: 1, perKg: true, perMin: false, display: 'μg/kg/h' },
  'mg/kg/h': { family: 'mass', toBase: 1e3, perKg: true, perMin: false, display: 'mg/kg/h' },
  'U/kg/h': { family: 'activity', toBase: 1, perKg: true, perMin: false, display: 'U/kg/h' },
  'U/kg/min': { family: 'activity', toBase: 1, perKg: true, perMin: true, display: 'U/kg/min' },
  'mU/kg/min': { family: 'activity', toBase: 1e-3, perKg: true, perMin: true, display: 'mU/kg/min' },
  'ug/min': { family: 'mass', toBase: 1, perKg: false, perMin: true, display: 'μg/min' },
  'mg/min': { family: 'mass', toBase: 1e3, perKg: false, perMin: true, display: 'mg/min' },
  'ug/h': { family: 'mass', toBase: 1, perKg: false, perMin: false, display: 'μg/h' },
  'mg/h': { family: 'mass', toBase: 1e3, perKg: false, perMin: false, display: 'mg/h' },
  'g/h': { family: 'mass', toBase: 1e6, perKg: false, perMin: false, display: 'g/h' },
  'U/min': { family: 'activity', toBase: 1, perKg: false, perMin: true, display: 'U/min' },
  'U/h': { family: 'activity', toBase: 1, perKg: false, perMin: false, display: 'U/h' },
  'mU/min': { family: 'activity', toBase: 1e-3, perKg: false, perMin: true, display: 'mU/min' },
  'mmol/h': { family: 'mmol', toBase: 1, perKg: false, perMin: false, display: 'mmol/h' },
  'mEq/h': { family: 'mEq', toBase: 1, perKg: false, perMin: false, display: 'mEq/h' },
};

export function formatDoseUnit(unit: DoseUnit): string {
  return DOSE_UNIT_META[unit].display;
}

export function formatAmountUnit(unit: AmountUnit): string {
  return AMOUNT_UNIT_META[unit].display;
}

export function isWeightBasedUnit(unit: DoseUnit): boolean {
  return DOSE_UNIT_META[unit].perKg;
}

/**
 * 格式化临床数值，消除浮点误差并保留适合临床阅读的精度
 */
export function formatClinicalNumber(value: number, maxDecimals = 3): string {
  if (!Number.isFinite(value)) return '--';
  if (Math.abs(value) < 1e-12) return '0';

  const abs = Math.abs(value);
  let decimals = maxDecimals;
  if (abs >= 100) decimals = Math.min(maxDecimals, 1);
  else if (abs >= 10) decimals = Math.min(maxDecimals, 2);
  else if (abs >= 1) decimals = Math.min(maxDecimals, 2);
  else if (abs >= 0.01) decimals = Math.min(maxDecimals, 3);
  else decimals = Math.max(maxDecimals, 4);

  const fixed = value.toFixed(decimals);
  return fixed.replace(/\.?0+$/, '');
}

/**
 * 根据配比模式计算注射器/输液袋内实际药物总量
 */
export function resolveEffectiveDrugAmount(
  recipe: Pick<PumpRecipe, 'mode' | 'drugAmount' | 'weightFactor'>,
  weightKg: number
): number {
  if (recipe.mode === 'weight_rule') {
    if (!Number.isFinite(weightKg) || weightKg <= 0) return 0;
    return (recipe.weightFactor ?? 0) * weightKg;
  }
  return recipe.drugAmount ?? 0;
}

/**
 * 计算泵液浓度（基准单位/mL），同时返回易读浓度字符串（原单位/mL 及 μg/mL 等）
 */
export function calculateConcentration(
  drugAmount: number,
  amountUnit: AmountUnit,
  totalVolumeMl: number
): {
  basePerMl: number;
  rawPerMl: number;
  displayText: string;
} {
  if (
    !Number.isFinite(drugAmount) ||
    !Number.isFinite(totalVolumeMl) ||
    drugAmount <= 0 ||
    totalVolumeMl <= 0
  ) {
    return { basePerMl: 0, rawPerMl: 0, displayText: '--' };
  }

  const meta = AMOUNT_UNIT_META[amountUnit];
  const rawPerMl = drugAmount / totalVolumeMl;
  const basePerMl = (drugAmount * meta.toBase) / totalVolumeMl;

  let displayText = `${formatClinicalNumber(rawPerMl, 3)} ${meta.display}/mL`;
  if (amountUnit === 'mg' && rawPerMl < 1) {
    displayText = `${formatClinicalNumber(basePerMl, 1)} μg/mL（${formatClinicalNumber(rawPerMl, 3)} mg/mL）`;
  } else if (amountUnit === 'g' && rawPerMl < 0.1) {
    displayText = `${formatClinicalNumber(rawPerMl * 1000, 1)} mg/mL`;
  }

  return { basePerMl, rawPerMl, displayText };
}

/**
 * 正向计算：已知目标给药剂量 -> 推算微量泵泵速 (mL/h)
 */
export function doseToRateMlPerHour(params: {
  dose: number;
  doseUnit: DoseUnit;
  drugAmount: number;
  amountUnit: AmountUnit;
  totalVolumeMl: number;
  weightKg: number;
}): number | null {
  const { dose, doseUnit, drugAmount, amountUnit, totalVolumeMl, weightKg } = params;

  if (!Number.isFinite(dose) || dose < 0) return null;
  if (!Number.isFinite(drugAmount) || drugAmount <= 0) return null;
  if (!Number.isFinite(totalVolumeMl) || totalVolumeMl <= 0) return null;

  const doseMeta = DOSE_UNIT_META[doseUnit];
  const amountMeta = AMOUNT_UNIT_META[amountUnit];
  if (doseMeta.family !== amountMeta.family) return null;

  if (doseMeta.perKg && (!Number.isFinite(weightKg) || weightKg <= 0)) return null;
  if (dose === 0) return 0;

  const concentrationBasePerMl = (drugAmount * amountMeta.toBase) / totalVolumeMl;
  const basePerHour =
    dose *
    doseMeta.toBase *
    (doseMeta.perKg ? weightKg : 1) *
    (doseMeta.perMin ? 60 : 1);

  return basePerHour / concentrationBasePerMl;
}

/**
 * 反向计算：已知当前微量泵泵速 (mL/h) -> 反推当前实际给药剂量
 */
export function rateMlPerHourToDose(params: {
  rateMlPerHour: number;
  doseUnit: DoseUnit;
  drugAmount: number;
  amountUnit: AmountUnit;
  totalVolumeMl: number;
  weightKg: number;
}): number | null {
  const { rateMlPerHour, doseUnit, drugAmount, amountUnit, totalVolumeMl, weightKg } = params;

  if (!Number.isFinite(rateMlPerHour) || rateMlPerHour < 0) return null;
  if (!Number.isFinite(drugAmount) || drugAmount <= 0) return null;
  if (!Number.isFinite(totalVolumeMl) || totalVolumeMl <= 0) return null;

  const doseMeta = DOSE_UNIT_META[doseUnit];
  const amountMeta = AMOUNT_UNIT_META[amountUnit];
  if (doseMeta.family !== amountMeta.family) return null;

  if (doseMeta.perKg && (!Number.isFinite(weightKg) || weightKg <= 0)) return null;
  if (rateMlPerHour === 0) return 0;

  const concentrationBasePerMl = (drugAmount * amountMeta.toBase) / totalVolumeMl;
  const basePerHour = rateMlPerHour * concentrationBasePerMl;

  return (
    basePerHour /
    (doseMeta.toBase * (doseMeta.perKg ? weightKg : 1) * (doseMeta.perMin ? 60 : 1))
  );
}

/**
 * 同维度剂量单位换算（例如 μg/kg/min ↔ μg/min ↔ mg/h，或 U/min ↔ U/h ↔ U/kg/min）
 */
export function convertDoseUnit(
  value: number,
  fromUnit: DoseUnit,
  toUnit: DoseUnit,
  weightKg: number
): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  if (fromUnit === toUnit) return value;

  const fromMeta = DOSE_UNIT_META[fromUnit];
  const toMeta = DOSE_UNIT_META[toUnit];
  if (fromMeta.family !== toMeta.family) return null;

  if ((fromMeta.perKg || toMeta.perKg) && (!Number.isFinite(weightKg) || weightKg <= 0)) {
    return null;
  }

  const basePerHour =
    value *
    fromMeta.toBase *
    (fromMeta.perKg ? weightKg : 1) *
    (fromMeta.perMin ? 60 : 1);

  return (
    basePerHour /
    (toMeta.toBase * (toMeta.perKg ? weightKg : 1) * (toMeta.perMin ? 60 : 1))
  );
}

export type DoseSafetyLevel = 'zero' | 'below' | 'normal' | 'high' | 'danger';

export interface DoseSafetyEvaluation {
  level: DoseSafetyLevel;
  label: string;
  /** 用于进度条显示（0 ~ 100） */
  gaugePercent: number;
  doseInRangeUnit: number | null;
}

/**
 * 评估当前给药剂量相对于临床推荐区间与高危极量警戒线的安全等级
 */
export function evaluateDoseSafety(
  dose: number | null,
  doseUnit: DoseUnit,
  range: DoseRangeSpec,
  weightKg: number
): DoseSafetyEvaluation {
  if (dose === null || !Number.isFinite(dose) || dose <= 0) {
    return {
      level: 'zero',
      label: '未启动',
      gaugePercent: 0,
      doseInRangeUnit: 0,
    };
  }

  const normalized = convertDoseUnit(dose, doseUnit, range.unit, weightKg);
  if (normalized === null) {
    return {
      level: 'normal',
      label: '无法映射区间',
      gaugePercent: 50,
      doseInRangeUnit: null,
    };
  }

  const ceiling = range.warningMax ?? range.max * 1.5;
  const gaugePercent = Math.max(2, Math.min(100, (normalized / Math.max(ceiling, 1e-9)) * 100));

  if (range.warningMax !== undefined && normalized > range.warningMax + 1e-12) {
    return {
      level: 'danger',
      label: '超极量警戒',
      gaugePercent: 100,
      doseInRangeUnit: normalized,
    };
  }
  if (normalized > range.max + 1e-12) {
    return {
      level: 'high',
      label: '高于常规上限',
      gaugePercent,
      doseInRangeUnit: normalized,
    };
  }
  if (normalized < range.min - 1e-12) {
    return {
      level: 'below',
      label: '低于常规起始',
      gaugePercent,
      doseInRangeUnit: normalized,
    };
  }

  return {
    level: 'normal',
    label: '常规推荐范围',
    gaugePercent,
    doseInRangeUnit: normalized,
  };
}

export interface ConcentrationOptionResult {
  label: string;
  multiplier: number;
  newDrugAmount: number;
  amountUnit: AmountUnit;
  newTotalVolumeMl: number;
  newRateMlPerHour: number;
  syringeDurationHours: number | null;
  fluidPer24hMl: number;
  fluidSavedPer24hMl: number;
}

/**
 * 浓缩/稀释换泵计算：保持当前给药剂量严格不变，输出不同浓度配比的新泵速与节液量
 */
export function calculateConcentrationSwitch(params: {
  currentDrugAmount: number;
  amountUnit: AmountUnit;
  currentTotalVolumeMl: number;
  currentRateMlPerHour: number;
  targetMultiplier?: number;
  customNewDrugAmount?: number;
  customNewTotalVolumeMl?: number;
  label?: string;
}): ConcentrationOptionResult | null {
  const {
    currentDrugAmount,
    amountUnit,
    currentTotalVolumeMl,
    currentRateMlPerHour,
    targetMultiplier,
    customNewDrugAmount,
    customNewTotalVolumeMl,
    label,
  } = params;

  if (
    !Number.isFinite(currentDrugAmount) ||
    currentDrugAmount <= 0 ||
    !Number.isFinite(currentTotalVolumeMl) ||
    currentTotalVolumeMl <= 0 ||
    !Number.isFinite(currentRateMlPerHour) ||
    currentRateMlPerHour < 0
  ) {
    return null;
  }

  const newTotalVolumeMl = customNewTotalVolumeMl ?? currentTotalVolumeMl;
  const newDrugAmount =
    customNewDrugAmount !== undefined
      ? customNewDrugAmount
      : currentDrugAmount * (targetMultiplier ?? 1);

  if (newDrugAmount <= 0 || newTotalVolumeMl <= 0) return null;

  const currentConc = currentDrugAmount / currentTotalVolumeMl;
  const newConc = newDrugAmount / newTotalVolumeMl;
  const effectiveMultiplier = newConc / currentConc;

  const newRateMlPerHour = currentRateMlPerHour / effectiveMultiplier;
  const syringeDurationHours =
    newRateMlPerHour > 0 ? newTotalVolumeMl / newRateMlPerHour : null;
  const currentFluid24h = currentRateMlPerHour * 24;
  const newFluid24h = newRateMlPerHour * 24;

  return {
    label: label ?? `${formatClinicalNumber(effectiveMultiplier, 2)}× 浓度`,
    multiplier: effectiveMultiplier,
    newDrugAmount,
    amountUnit,
    newTotalVolumeMl,
    newRateMlPerHour,
    syringeDurationHours,
    fluidPer24hMl: newFluid24h,
    fluidSavedPer24hMl: currentFluid24h - newFluid24h,
  };
}

export interface RemainingTimeEstimate {
  hoursTotal: number;
  hoursPart: number;
  minutesPart: number;
  durationText: string;
  finishTimeText: string;
}

/**
 * 估算当前注射器剩余药液可维持时间及预计打完时刻
 */
export function estimateRemainingTime(
  remainingMl: number,
  rateMlPerHour: number,
  now: Date = new Date()
): RemainingTimeEstimate | null {
  if (
    !Number.isFinite(remainingMl) ||
    remainingMl <= 0 ||
    !Number.isFinite(rateMlPerHour) ||
    rateMlPerHour <= 0
  ) {
    return null;
  }

  const hoursTotal = remainingMl / rateMlPerHour;
  const totalMinutes = Math.round(hoursTotal * 60);
  const hoursPart = Math.floor(totalMinutes / 60);
  const minutesPart = totalMinutes % 60;

  const durationText =
    hoursPart > 0
      ? minutesPart > 0
        ? `${hoursPart} 小时 ${minutesPart} 分`
        : `${hoursPart} 小时`
      : `${minutesPart} 分钟`;

  const finishDate = new Date(now.getTime() + hoursTotal * 3600 * 1000);
  const hh = String(finishDate.getHours()).padStart(2, '0');
  const mm = String(finishDate.getMinutes()).padStart(2, '0');
  const isNextDay = finishDate.getDate() !== now.getDate();
  const finishTimeText = isNextDay ? `次日 ${hh}:${mm}` : `${hh}:${mm}`;

  return {
    hoursTotal,
    hoursPart,
    minutesPart,
    durationText,
    finishTimeText,
  };
}

/**
 * 去甲肾上腺素等效剂量 (NEE, Norepinephrine Equivalent) 系数
 * 参考 Goradia et al. (J Crit Care 2021) & Kotani et al. (Crit Care 2023)
 * 输出统一为 μg/kg/min 去甲肾上腺素等效剂量
 */
export const NEE_COEFFICIENTS: Record<
  NeeKey,
  { requiredUnit: DoseUnit; factor: number; formulaLabel: string }
> = {
  norepinephrine: {
    requiredUnit: 'ug/kg/min',
    factor: 1,
    formulaLabel: '去甲肾上腺素(μg/kg/min) × 1',
  },
  epinephrine: {
    requiredUnit: 'ug/kg/min',
    factor: 1,
    formulaLabel: '肾上腺素(μg/kg/min) × 1',
  },
  dopamine: {
    requiredUnit: 'ug/kg/min',
    factor: 0.01,
    formulaLabel: '多巴胺(μg/kg/min) ÷ 100',
  },
  phenylephrine: {
    requiredUnit: 'ug/kg/min',
    factor: 0.1,
    formulaLabel: '去氧肾上腺素(μg/kg/min) ÷ 10',
  },
  vasopressin: {
    requiredUnit: 'U/min',
    factor: 2.5,
    formulaLabel: '血管加压素(U/min) × 2.5',
  },
  metaraminol: {
    requiredUnit: 'ug/kg/min',
    factor: 0.125,
    formulaLabel: '间羟胺(μg/kg/min) ÷ 8',
  },
};

/**
 * 血管活性-正性肌力评分 (VIS, Vasoactive-Inotropic Score, Gaies 2010)
 * VIS = Dopamine + Dobutamine + 100×Epi + 100×NE + 10×Milrinone + 10000×Vasopressin(U/kg/min)
 */
export const VIS_COEFFICIENTS: Record<
  VisKey,
  { requiredUnit: DoseUnit; factor: number; formulaLabel: string }
> = {
  dopamine: {
    requiredUnit: 'ug/kg/min',
    factor: 1,
    formulaLabel: '多巴胺(μg/kg/min) × 1',
  },
  dobutamine: {
    requiredUnit: 'ug/kg/min',
    factor: 1,
    formulaLabel: '多巴酚丁胺(μg/kg/min) × 1',
  },
  epinephrine: {
    requiredUnit: 'ug/kg/min',
    factor: 100,
    formulaLabel: '肾上腺素(μg/kg/min) × 100',
  },
  norepinephrine: {
    requiredUnit: 'ug/kg/min',
    factor: 100,
    formulaLabel: '去甲肾上腺素(μg/kg/min) × 100',
  },
  milrinone: {
    requiredUnit: 'ug/kg/min',
    factor: 10,
    formulaLabel: '米力农(μg/kg/min) × 10',
  },
  vasopressin: {
    requiredUnit: 'U/kg/min',
    factor: 10000,
    formulaLabel: '血管加压素(U/kg/min) × 10000',
  },
};

export interface ScoreContribution {
  pumpId: string;
  drugName: string;
  rawDose: number;
  unit: DoseUnit;
  contribution: number;
  formulaLabel: string;
}

export interface MultiPumpSummary {
  activePumpCount: number;
  totalFluidMlPerHour: number;
  totalFluidMlPer24h: number;
  totalNee: number;
  neeBreakdown: ScoreContribution[];
  totalVis: number;
  visBreakdown: ScoreContribution[];
}

/**
 * 汇总单患者多路微量泵的液体负荷、去甲等效剂量 (NEE) 及血管活性-正性肌力评分 (VIS)
 */
export function calculateMultiPumpSummary(
  pumps: ActivePumpEntry[],
  drugMap: Map<string, DrugRecord>,
  weightKg: number
): MultiPumpSummary {
  let totalFluidMlPerHour = 0;
  let activePumpCount = 0;
  let totalNee = 0;
  let totalVis = 0;
  const neeBreakdown: ScoreContribution[] = [];
  const visBreakdown: ScoreContribution[] = [];

  for (const pump of pumps) {
    if (!Number.isFinite(pump.rateMlPerHour) || pump.rateMlPerHour <= 0) continue;

    activePumpCount += 1;
    totalFluidMlPerHour += pump.rateMlPerHour;

    const drug = drugMap.get(pump.drugId);
    if (!drug) continue;

    const effectiveAmount = resolveEffectiveDrugAmount(
      {
        mode: pump.mode,
        drugAmount: pump.drugAmount,
        weightFactor: pump.weightFactor,
      },
      weightKg
    );

    if (drug.neeKey) {
      const cfg = NEE_COEFFICIENTS[drug.neeKey];
      const rawDose = rateMlPerHourToDose({
        rateMlPerHour: pump.rateMlPerHour,
        doseUnit: cfg.requiredUnit,
        drugAmount: effectiveAmount,
        amountUnit: pump.amountUnit,
        totalVolumeMl: pump.totalVolumeMl,
        weightKg,
      });
      if (rawDose !== null && rawDose > 0) {
        const contribution = rawDose * cfg.factor;
        totalNee += contribution;
        neeBreakdown.push({
          pumpId: pump.id,
          drugName: drug.nameCn,
          rawDose,
          unit: cfg.requiredUnit,
          contribution,
          formulaLabel: cfg.formulaLabel,
        });
      }
    }

    if (drug.visKey) {
      const cfg = VIS_COEFFICIENTS[drug.visKey];
      const rawDose = rateMlPerHourToDose({
        rateMlPerHour: pump.rateMlPerHour,
        doseUnit: cfg.requiredUnit,
        drugAmount: effectiveAmount,
        amountUnit: pump.amountUnit,
        totalVolumeMl: pump.totalVolumeMl,
        weightKg,
      });
      if (rawDose !== null && rawDose > 0) {
        const contribution = rawDose * cfg.factor;
        totalVis += contribution;
        visBreakdown.push({
          pumpId: pump.id,
          drugName: drug.nameCn,
          rawDose,
          unit: cfg.requiredUnit,
          contribution,
          formulaLabel: cfg.formulaLabel,
        });
      }
    }
  }

  return {
    activePumpCount,
    totalFluidMlPerHour,
    totalFluidMlPer24h: totalFluidMlPerHour * 24,
    totalNee,
    neeBreakdown,
    totalVis,
    visBreakdown,
  };
}
