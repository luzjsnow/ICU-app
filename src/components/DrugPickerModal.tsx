import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Search,
  Star,
  Sun,
  X,
} from 'lucide-react';
import {
  CATEGORY_META,
  type DrugCategory,
  type DrugRecord,
} from '../types/drug';
import { searchDrugs } from '../data/icuDrugs';

interface DrugPickerModalProps {
  open: boolean;
  drugs: DrugRecord[];
  favoriteIds: string[];
  selectedDrugId?: string;
  title?: string;
  onSelect: (drug: DrugRecord) => void;
  onToggleFavorite: (drugId: string) => void;
  onClose: () => void;
}

const ALL_CATEGORIES = Object.keys(CATEGORY_META) as DrugCategory[];

export const DrugPickerModal: React.FC<DrugPickerModalProps> = ({
  open,
  drugs,
  favoriteIds,
  selectedDrugId,
  title = '选择 ICU 泵注药物',
  onSelect,
  onToggleFavorite,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DrugCategory | 'all' | 'favorite'>('all');

  const favSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const filtered = useMemo(() => {
    let base = drugs;
    if (category === 'favorite') {
      base = base.filter((d) => favSet.has(d.id) || d.isCommon);
    } else if (category !== 'all') {
      base = base.filter((d) => d.category === category);
    }

    const searched = searchDrugs(base, query);
    return [...searched].sort((a, b) => {
      const aFav = favSet.has(a.id) ? 2 : a.isCommon ? 1 : 0;
      const bFav = favSet.has(b.id) ? 2 : b.isCommon ? 1 : 0;
      if (bFav !== aFav) return bFav - aFav;
      return a.nameCn.localeCompare(b.nameCn, 'zh-CN');
    });
  }, [drugs, category, query, favSet]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* 顶部栏 */}
      <div className="safe-top border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pb-3">
        <div className="flex items-center justify-between gap-3 pt-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 秒搜输入框 */}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜中文 / 英文 / 简称 / 拼音首字母（如 qj、去甲、NE、丙泊酚）"
            autoFocus
            className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 分类筛选横滑条 */}
        <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
              category === 'all'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            全部 ({drugs.length})
          </button>
          <button
            type="button"
            onClick={() => setCategory('favorite')}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
              category === 'favorite'
                ? 'bg-amber-500 text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            高频/收藏
          </button>
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                category === cat
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {CATEGORY_META[cat].shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* 药物列表 */}
      <div className="safe-bottom flex-1 overflow-y-auto px-3 py-2.5">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            未找到匹配药物，可尝试英文缩写或拼音首字母
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((drug) => {
              const isSelected = drug.id === selectedDrugId;
              const isFav = favSet.has(drug.id);
              const defaultRecipe = drug.recipes.find((r) => r.isDefault) ?? drug.recipes[0];
              return (
                <div
                  key={drug.id}
                  onClick={() => {
                    onSelect(drug);
                    onClose();
                  }}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-2xl border p-3 transition active:scale-[0.99] ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50/70 dark:border-sky-400 dark:bg-sky-950/40'
                      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {drug.nameCn}
                      </span>
                      <span className="truncate text-xs text-slate-400">
                        {drug.nameEn}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                          CATEGORY_META[drug.category].colorClass
                        }`}
                      >
                        {CATEGORY_META[drug.category].shortLabel}
                      </span>
                      {drug.highAlert && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          高警示
                        </span>
                      )}
                      {drug.route === 'cvc_required' && (
                        <span className="rounded-md bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                          须CVC
                        </span>
                      )}
                      {drug.lightProtection && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                          <Sun className="h-2.5 w-2.5" />
                          避光
                        </span>
                      )}
                      {drug.verified && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          已核对
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      默认：{defaultRecipe?.label ?? '--'} · 范围：{drug.doseRange.min}~{drug.doseRange.max}{' '}
                      {drug.doseRange.unit.replace('ug', 'μg')}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(drug.id);
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 active:scale-90"
                    aria-label="收藏"
                  >
                    <Star
                      className={`h-5 w-5 ${
                        isFav
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
