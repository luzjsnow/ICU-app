import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Droplets,
  Edit3,
  Plus,
  Save,
  ShieldAlert,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import {
  CATEGORY_META,
  type AmountUnit,
  type DoseUnit,
  type DrugCategory,
  type DrugRecord,
  type IvRouteRequirement,
  type PumpRecipe,
} from '../types/drug';
import { AMOUNT_UNIT_META, DOSE_UNIT_META, formatDoseUnit } from '../core/calculator';

interface DrugDetailModalProps {
  drug: DrugRecord | null;
  isCreating?: boolean;
  onClose: () => void;
  onUseInCalculator: (drug: DrugRecord) => void;
  onToggleVerified: (drugId: string) => void;
  onSaveDrug: (drug: DrugRecord) => void;
  onDeleteDrug?: (drugId: string) => void;
}

const AMOUNT_UNITS = Object.keys(AMOUNT_UNIT_META) as AmountUnit[];
const DOSE_UNITS = Object.keys(DOSE_UNIT_META) as DoseUnit[];
const CATEGORIES = Object.keys(CATEGORY_META) as DrugCategory[];

function createBlankDrug(): DrugRecord {
  return {
    id: `custom_${Date.now()}`,
    nameCn: '',
    nameEn: '',
    aliases: [],
    category: 'other',
    highAlert: false,
    vialSpec: '',
    defaultDoseUnit: 'mg/h',
    supportedDoseUnits: ['mg/h', 'ug/kg/min'],
    doseRange: {
      min: 1,
      max: 10,
      warningMax: 20,
      unit: 'mg/h',
      text: '1 ~ 10 mg/h',
    },
    recipes: [
      {
        id: `rec_${Date.now()}`,
        label: '常规 50mg / 50mL',
        mode: 'fixed',
        drugAmount: 50,
        amountUnit: 'mg',
        totalVolumeMl: 50,
        multiplier: 1,
        diluentNote: '50mg + NS 至 50mL',
        isDefault: true,
      },
    ],
    diluents: 'NS 或 5%GS',
    route: 'peripheral_ok',
    routeNote: '外周或中心静脉均可',
    lightProtection: false,
    incompatibilities: '建议独立通道泵注',
    clinicalNotes: [],
    verified: true,
    custom: true,
    departmentNote: '',
  };
}

export const DrugDetailModal: React.FC<DrugDetailModalProps> = ({
  drug,
  isCreating = false,
  onClose,
  onUseInCalculator,
  onToggleVerified,
  onSaveDrug,
  onDeleteDrug,
}) => {
  const [editing, setEditing] = useState(isCreating);
  const [draft, setDraft] = useState<DrugRecord>(drug ?? createBlankDrug());
  const [aliasInput, setAliasInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const init = isCreating ? createBlankDrug() : drug ?? createBlankDrug();
    setDraft(JSON.parse(JSON.stringify(init)) as DrugRecord);
    setAliasInput(init.aliases.join('、'));
    setNotesInput(init.clinicalNotes.join('\n'));
    setEditing(isCreating);
    setErrorMsg('');
  }, [drug, isCreating]);

  if (!drug && !isCreating) return null;

  const handleRecipeChange = (index: number, patch: Partial<PumpRecipe>) => {
    setDraft((prev) => {
      const next = [...prev.recipes];
      next[index] = { ...next[index], ...patch };
      return { ...prev, recipes: next };
    });
  };

  const handleAddRecipe = () => {
    const amountUnit = draft.recipes[0]?.amountUnit ?? 'mg';
    setDraft((prev) => ({
      ...prev,
      recipes: [
        ...prev.recipes,
        {
          id: `rec_${Date.now()}_${prev.recipes.length}`,
          label: '新增配比 / 50mL',
          mode: 'fixed',
          drugAmount: 50,
          amountUnit,
          totalVolumeMl: 50,
          diluentNote: '',
        },
      ],
    }));
  };

  const handleRemoveRecipe = (index: number) => {
    if (draft.recipes.length <= 1) return;
    setDraft((prev) => ({
      ...prev,
      recipes: prev.recipes.filter((_, i) => i !== index),
    }));
  };

  const handleSave = () => {
    if (!draft.nameCn.trim()) {
      setErrorMsg('请填写药物中文名称');
      return;
    }
    if (draft.recipes.length === 0) {
      setErrorMsg('至少需要保留 1 个配比方案');
      return;
    }

    const doseFamily = DOSE_UNIT_META[draft.defaultDoseUnit].family;
    for (const r of draft.recipes) {
      const amtFamily = AMOUNT_UNIT_META[r.amountUnit].family;
      if (amtFamily !== doseFamily) {
        setErrorMsg(
          `配比「${r.label}」药量单位(${r.amountUnit})与默认剂量单位(${formatDoseUnit(
            draft.defaultDoseUnit
          )})维度不匹配，请统一为质量(g/mg/μg)或活性单位(U/mU)`
        );
        return;
      }
      if (r.totalVolumeMl <= 0) {
        setErrorMsg(`配比「${r.label}」总容积必须大于 0`);
        return;
      }
      if (r.mode === 'fixed' && (!r.drugAmount || r.drugAmount <= 0)) {
        setErrorMsg(`配比「${r.label}」药量必须大于 0`);
        return;
      }
      if (r.mode === 'weight_rule' && (!r.weightFactor || r.weightFactor <= 0)) {
        setErrorMsg(`配比「${r.label}」体重系数必须大于 0`);
        return;
      }
    }

    const sameFamilyUnits = DOSE_UNITS.filter(
      (u) => DOSE_UNIT_META[u].family === doseFamily
    );
    const cleanedSupported = Array.from(
      new Set([
        draft.defaultDoseUnit,
        ...draft.supportedDoseUnits.filter((u) => sameFamilyUnits.includes(u)),
      ])
    );

    const finalRecord: DrugRecord = {
      ...draft,
      nameCn: draft.nameCn.trim(),
      nameEn: draft.nameEn.trim() || draft.nameCn.trim(),
      aliases: aliasInput
        .split(/[,，、\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      clinicalNotes: notesInput
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      supportedDoseUnits: cleanedSupported,
      doseRange: {
        ...draft.doseRange,
        unit: draft.defaultDoseUnit,
      },
      verified: true,
    };

    onSaveDrug(finalRecord);
    setEditing(false);
    if (isCreating) onClose();
  };

  const current = editing ? draft : drug!;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* 顶部栏 */}
      <div className="safe-top flex items-center justify-between border-b border-slate-200 bg-white px-4 pb-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0 flex-1 pr-2">
          <h2 className="truncate text-base font-bold text-slate-900 dark:text-slate-100">
            {isCreating ? '新增科室自定义药物' : editing ? `编辑：${current.nameCn}` : current.nameCn}
          </h2>
          {!isCreating && !editing && (
            <p className="truncate text-xs text-slate-400">{current.nameEn}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 active:scale-95 dark:bg-slate-800 dark:text-slate-200"
            >
              <Edit3 className="h-3.5 w-3.5" />
              编辑配比
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {editing ? (
          <div className="mx-auto max-w-2xl space-y-4 pb-8">
            {errorMsg && (
              <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                {errorMsg}
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">基本信息</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">中文通用名 *</span>
                  <input
                    type="text"
                    value={draft.nameCn}
                    onChange={(e) => setDraft({ ...draft, nameCn: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    placeholder="如 去甲肾上腺素"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">英文名</span>
                  <input
                    type="text"
                    value={draft.nameEn}
                    onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    placeholder="如 Norepinephrine"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">药品分类</span>
                  <select
                    value={draft.category}
                    onChange={(e) =>
                      setDraft({ ...draft, category: e.target.value as DrugCategory })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_META[c].label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-500">默认给药单位</span>
                  <select
                    value={draft.defaultDoseUnit}
                    onChange={(e) => {
                      const nextUnit = e.target.value as DoseUnit;
                      setDraft({
                        ...draft,
                        defaultDoseUnit: nextUnit,
                        doseRange: { ...draft.doseRange, unit: nextUnit },
                      });
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    {DOSE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {DOSE_UNIT_META[u].display}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">
                  别名 / 商品名 / 拼音首字母（顿号或空格分隔，用于秒搜）
                </span>
                <input
                  type="text"
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">本科室常见安瓿/西林瓶规格</span>
                <input
                  type="text"
                  value={draft.vialSpec}
                  onChange={(e) => setDraft({ ...draft, vialSpec: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </label>

              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">推荐下限</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={draft.doseRange.min}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        doseRange: { ...draft.doseRange, min: Number(e.target.value) || 0 },
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">常规上限</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={draft.doseRange.max}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        doseRange: { ...draft.doseRange, max: Number(e.target.value) || 0 },
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">极量警戒线</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={draft.doseRange.warningMax ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        doseRange: {
                          ...draft.doseRange,
                          warningMax: e.target.value ? Number(e.target.value) : undefined,
                        },
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">剂量范围文字说明</span>
                <input
                  type="text"
                  value={draft.doseRange.text}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      doseRange: { ...draft.doseRange, text: e.target.value },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </label>

              <div className="flex flex-wrap gap-4 pt-1 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.highAlert}
                    onChange={(e) => setDraft({ ...draft, highAlert: e.target.checked })}
                    className="h-4 w-4 rounded accent-rose-600"
                  />
                  高警示药品
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.lightProtection}
                    onChange={(e) => setDraft({ ...draft, lightProtection: e.target.checked })}
                    className="h-4 w-4 rounded accent-amber-500"
                  />
                  需避光输注
                </label>
                <select
                  value={draft.route}
                  onChange={(e) =>
                    setDraft({ ...draft, route: e.target.value as IvRouteRequirement })
                  }
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="cvc_required">必须中心静脉(CVC)</option>
                  <option value="cvc_preferred">建议中心静脉</option>
                  <option value="peripheral_ok">外周/中心均可</option>
                </select>
              </div>
            </div>

            {/* 配比模板编辑 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  科室常用配比模板（{draft.recipes.length}）
                </h3>
                <button
                  type="button"
                  onClick={handleAddRecipe}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  新增配比
                </button>
              </div>

              {draft.recipes.map((rec, idx) => (
                <div
                  key={rec.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={rec.label}
                      onChange={(e) => handleRecipeChange(idx, { label: e.target.value })}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900"
                      placeholder="配比名称"
                    />
                    <select
                      value={rec.mode}
                      onChange={(e) =>
                        handleRecipeChange(idx, {
                          mode: e.target.value as 'fixed' | 'weight_rule',
                          weightFactor: e.target.value === 'weight_rule' ? rec.weightFactor ?? 0.3 : undefined,
                          drugAmount: e.target.value === 'fixed' ? rec.drugAmount ?? 50 : undefined,
                        })
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="fixed">固定配比</option>
                      <option value="weight_rule">体重系数法</option>
                    </select>
                    {draft.recipes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRecipe(idx)}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="block">
                      <span className="text-[11px] text-slate-500">
                        {rec.mode === 'weight_rule' ? '系数(×kg)' : '药物总量'}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={rec.mode === 'weight_rule' ? rec.weightFactor ?? '' : rec.drugAmount ?? ''}
                        onChange={(e) =>
                          rec.mode === 'weight_rule'
                            ? handleRecipeChange(idx, { weightFactor: Number(e.target.value) })
                            : handleRecipeChange(idx, { drugAmount: Number(e.target.value) })
                        }
                        className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-500">药量单位</span>
                      <select
                        value={rec.amountUnit}
                        onChange={(e) =>
                          handleRecipeChange(idx, { amountUnit: e.target.value as AmountUnit })
                        }
                        className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                      >
                        {AMOUNT_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {AMOUNT_UNIT_META[u].display}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-500">总容积(mL)</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={rec.totalVolumeMl}
                        onChange={(e) =>
                          handleRecipeChange(idx, { totalVolumeMl: Number(e.target.value) })
                        }
                        className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                    </label>
                  </div>

                  <input
                    type="text"
                    value={rec.diluentNote ?? ''}
                    onChange={(e) => handleRecipeChange(idx, { diluentNote: e.target.value })}
                    placeholder="配法备注（如 去甲 8mg + 5%GS 至 50mL）"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
              ))}
            </div>

            {/* 临床说明与本科室备注 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">推荐溶媒</span>
                <input
                  type="text"
                  value={draft.diluents}
                  onChange={(e) => setDraft({ ...draft, diluents: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">主要配伍禁忌</span>
                <input
                  type="text"
                  value={draft.incompatibilities}
                  onChange={(e) => setDraft({ ...draft, incompatibilities: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">本科室专属备注（置顶醒目展示）</span>
                <textarea
                  rows={2}
                  value={draft.departmentNote ?? ''}
                  onChange={(e) => setDraft({ ...draft, departmentNote: e.target.value })}
                  placeholder="例如：本科室统一用 2mg/支 重酒石酸去甲肾上腺素，标准 12mg+44mL NS..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">临床要点（每行一条）</span>
                <textarea
                  rows={4}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-3 pb-8">
            {/* 标签行 */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                  CATEGORY_META[current.category].colorClass
                }`}
              >
                {CATEGORY_META[current.category].label}
              </span>
              {current.highAlert && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2 py-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  ISMP 高警示药品
                </span>
              )}
              {current.lightProtection && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <Sun className="h-3.5 w-3.5" />
                  需避光
                </span>
              )}
              <button
                type="button"
                onClick={() => onToggleVerified(current.id)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  current.verified
                    ? 'bg-emerald-500 text-white'
                    : 'border border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {current.verified ? '本科室已核对' : '点击标记已核对'}
              </button>
            </div>

            {current.departmentNote && (
              <div className="rounded-2xl border border-sky-300 bg-sky-50 p-3.5 text-xs text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                <div className="font-bold">本科室自定义备注</div>
                <p className="mt-1 leading-relaxed">{current.departmentNote}</p>
              </div>
            )}

            {/* 规格与剂量范围 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-2.5">
              <div>
                <div className="text-xs font-medium text-slate-400">临床常见规格</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {current.vialSpec || '未填写'}
                </div>
              </div>
              <div className="border-t border-slate-100 pt-2.5 dark:border-slate-800">
                <div className="text-xs font-medium text-slate-400">推荐剂量区间与极量</div>
                <div className="mt-0.5 text-sm font-semibold text-sky-700 dark:text-sky-300">
                  {current.doseRange.text}
                </div>
              </div>
            </div>

            {/* 常用配比方案 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2.5 flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
                <Droplets className="h-4 w-4 text-sky-500" />
                预置泵配比方案（{current.recipes.length}）
              </div>
              <div className="space-y-2">
                {current.recipes.map((rec) => (
                  <div
                    key={rec.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {rec.label}
                      </span>
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {rec.mode === 'weight_rule' ? '体重系数法' : `${rec.totalVolumeMl} mL 固定配比`}
                      </span>
                    </div>
                    {rec.diluentNote && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {rec.diluentNote}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 通路、溶媒与配伍禁忌 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-3 text-xs">
              <div>
                <div className="font-bold text-slate-700 dark:text-slate-200">推荐溶媒</div>
                <p className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
                  {current.diluents}
                </p>
              </div>
              <div className="border-t border-slate-100 pt-2.5 dark:border-slate-800">
                <div className="font-bold text-slate-700 dark:text-slate-200">静脉通路要求</div>
                <p
                  className={`mt-1 leading-relaxed ${
                    current.route === 'cvc_required'
                      ? 'font-semibold text-rose-600 dark:text-rose-400'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {current.routeNote}
                </p>
              </div>
              {current.specialTubing && (
                <div className="rounded-xl bg-amber-50 p-2.5 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  <span className="font-bold">特殊管路：</span>
                  {current.specialTubing}
                </div>
              )}
              <div className="border-t border-slate-100 pt-2.5 dark:border-slate-800">
                <div className="flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  主要配伍禁忌
                </div>
                <p className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
                  {current.incompatibilities}
                </p>
              </div>
            </div>

            {/* 临床要点 */}
            {current.clinicalNotes.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                  ICU 临床要点与注意事项
                </div>
                <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {current.clinicalNotes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            )}

            {current.custom && onDeleteDrug && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`确定删除自定义药物「${current.nameCn}」？`)) {
                    onDeleteDrug(current.id);
                    onClose();
                  }
                }}
                className="w-full rounded-xl border border-rose-200 py-2.5 text-xs font-semibold text-rose-600 dark:border-rose-900 dark:text-rose-400"
              >
                删除此自定义药物
              </button>
            )}
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="safe-bottom border-t border-slate-200 bg-white px-4 pt-3 dark:border-slate-800 dark:bg-slate-900">
        {editing ? (
          <div className="mx-auto flex max-w-2xl gap-2">
            <button
              type="button"
              onClick={() => (isCreating ? onClose() : setEditing(false))}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex flex-[2] items-center justify-center gap-1.5 rounded-xl bg-sky-600 py-3 text-sm font-bold text-white shadow-sm active:scale-[0.99]"
            >
              <Save className="h-4 w-4" />
              保存并标记为本科室已核对
            </button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl gap-2">
            <button
              type="button"
              onClick={() => {
                onUseInCalculator(current);
                onClose();
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-sm font-bold text-white shadow-sm active:scale-[0.99]"
            >
              <Calculator className="h-4 w-4" />
              用此药进入泵速换算
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
