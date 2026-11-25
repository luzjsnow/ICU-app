export type DrugCategory =
  | 'vasopressor'
  | 'analgesic'
  | 'sedative'
  | 'nmb'
  | 'antihypertensive'
  | 'antiarrhythmic'
  | 'anticoagulant'
  | 'endocrine_electrolyte'
  | 'diuretic_gi_resp'
  | 'other';

export type AmountUnit = 'g' | 'mg' | 'ug' | 'U' | 'mU' | 'mmol' | 'mEq';

export type DoseUnit =
  | 'ng/kg/min'
  | 'ug/kg/min'
  | 'mg/kg/min'
  | 'ug/kg/h'
  | 'mg/kg/h'
  | 'U/kg/h'
  | 'U/kg/min'
  | 'mU/kg/min'
  | 'ug/min'
  | 'mg/min'
  | 'ug/h'
  | 'mg/h'
  | 'g/h'
  | 'U/min'
  | 'U/h'
  | 'mU/min'
  | 'mmol/h'
  | 'mEq/h';

export type UnitFamily = 'mass' | 'activity' | 'mmol' | 'mEq';

export type IvRouteRequirement = 'cvc_required' | 'cvc_preferred' | 'peripheral_ok';

export type NeeKey =
  | 'norepinephrine'
  | 'epinephrine'
  | 'dopamine'
  | 'phenylephrine'
  | 'vasopressin'
  | 'metaraminol';

export type VisKey =
  | 'norepinephrine'
  | 'epinephrine'
  | 'dopamine'
  | 'dobutamine'
  | 'milrinone'
  | 'vasopressin';

export interface PumpRecipe {
  id: string;
  label: string;
  mode: 'fixed' | 'weight_rule';
  /** mode === 'fixed' 时使用：注射器/输液袋内药物总量 */
  drugAmount?: number;
  /** mode === 'weight_rule' 时使用：体重系数（实际药量 = weightFactor × weightKg） */
  weightFactor?: number;
  amountUnit: AmountUnit;
  /** 配制后的总液体体积（mL），ICU 微泵默认以 50 mL 为主 */
  totalVolumeMl: number;
  /** 浓缩倍数标签，例如 1, 2, 4 */
  multiplier?: number;
  /** 配法文字说明，例如 "去甲 8mg(4mL) + 5%GS 46mL" 或 "1 mL/h = 0.1 μg/kg/min" */
  diluentNote?: string;
  isDefault?: boolean;
}

export interface DoseRangeSpec {
  min: number;
  max: number;
  /** 超出此值亮红色危急极量警示 */
  warningMax?: number;
  unit: DoseUnit;
  /** 临床可读范围描述，如 "0.05 ~ 1.0 μg/kg/min（常用），极量可达 2~3 μg/kg/min" */
  text: string;
}

export interface DrugRecord {
  id: string;
  nameCn: string;
  nameEn: string;
  /** 简称、别名、商品名及拼音首字母，用于秒搜 */
  aliases: string[];
  category: DrugCategory;
  /** ISMP 高警示药品标识 */
  highAlert: boolean;
  /** ICU 最高频常用药置顶 */
  isCommon?: boolean;
  /** 国内临床常见安瓿/西林瓶规格 */
  vialSpec: string;
  defaultDoseUnit: DoseUnit;
  supportedDoseUnits: DoseUnit[];
  doseRange: DoseRangeSpec;
  recipes: PumpRecipe[];
  diluents: string;
  route: IvRouteRequirement;
  routeNote: string;
  lightProtection: boolean;
  specialTubing?: string;
  incompatibilities: string;
  clinicalNotes: string[];
  neeKey?: NeeKey;
  visKey?: VisKey;
  /** 本科室是否已核对 */
  verified?: boolean;
  /** 是否用户自定义新增药物 */
  custom?: boolean;
  /** 本科室自定义备注 */
  departmentNote?: string;
}

export interface ActivePumpEntry {
  id: string;
  drugId: string;
  recipeId?: string;
  mode: 'fixed' | 'weight_rule';
  drugAmount: number;
  weightFactor?: number;
  amountUnit: AmountUnit;
  totalVolumeMl: number;
  rateMlPerHour: number;
  displayDoseUnit: DoseUnit;
  remainingMl?: number;
  label?: string;
}

export interface PersistedAppState {
  version: number;
  theme: 'light' | 'dark';
  weightKg: number;
  favoriteDrugIds: string[];
  verifiedDrugIds: string[];
  /** 用户修改过的内置药或新增的自定义药（以 drug.id 为键覆盖） */
  drugOverrides: Record<string, DrugRecord>;
  /** 被用户隐藏/删除的内置药 id */
  deletedDrugIds: string[];
  /** 多路泵面板临时记录（不含患者姓名等任何隐私字段） */
  activePumps: ActivePumpEntry[];
  lastSelectedDrugId?: string;
  disclaimerAccepted?: boolean;
}

export const CATEGORY_META: Record<
  DrugCategory,
  { label: string; shortLabel: string; colorClass: string }
> = {
  vasopressor: {
    label: '血管活性与正性肌力',
    shortLabel: '血管活性',
    colorClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
  },
  analgesic: {
    label: '镇痛药',
    shortLabel: '镇痛',
    colorClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  sedative: {
    label: '镇静药',
    shortLabel: '镇静',
    colorClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
  },
  nmb: {
    label: '肌松药（神经肌肉阻滞）',
    shortLabel: '肌松',
    colorClass: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/30',
  },
  antihypertensive: {
    label: '降压与血管扩张药',
    shortLabel: '降压扩管',
    colorClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30',
  },
  antiarrhythmic: {
    label: '抗心律失常药',
    shortLabel: '抗心律失常',
    colorClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  },
  anticoagulant: {
    label: '抗凝与止血药',
    shortLabel: '抗凝止血',
    colorClass: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  },
  endocrine_electrolyte: {
    label: '内分泌、电解质与代谢',
    shortLabel: '代谢电解质',
    colorClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  },
  diuretic_gi_resp: {
    label: '利尿、消化与呼吸系统',
    shortLabel: '利尿/消化/呼吸',
    colorClass: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30',
  },
  other: {
    label: '其他 ICU 泵注药',
    shortLabel: '其他',
    colorClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  },
};
