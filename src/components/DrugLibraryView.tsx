import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
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

interface DrugLibraryViewProps {
  drugs: DrugRecord[];
  favoriteIds: string[];
  onSelectDrugDetail: (drug: DrugRecord) => void;
  onCreateNewDrug: () => void;
  onToggleFavorite: (drugId: string) => void;
}

type QuickFilter = 'all' | 'common' | 'highAlert' | 'verified' | 'unverified';
const ALL_CATEGORIES = Object.keys(CATEGORY_META) as DrugCategory[];

export const DrugLibraryView: React.FC<DrugLibraryViewProps> = ({
  drugs,
  favoriteIds,
  onSelectDrugDetail,
  onCreateNewDrug,
  onToggleFavorite,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DrugCategory | 'all'>('all');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');

  const favSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const verifiedCount = useMemo(() => drugs.filter((d) => d.verified).length, [drugs]);

  const filtered = useMemo(() => {
    let list = drugs;
    if (category !== 'all') {
      list = list.filter((d) => d.category === category);
    }
    if (quickFilter === 'common') {
      list = list.filter((d) => d.isCommon || favSet.has(d.id));
    } else if (quickFilter === 'highAlert') {
      list = list.filter((d) => d.highAlert);
    } else if (quickFilter === 'verified') {
      list = list.filter((d) => d.verified);
    } else if (quickFilter === 'unverified') {
      list = list.filter((d) => !d.verified);
    }
    return searchDrugs(list, query);
  }, [drugs, category, quickFilter, query, favSet]);

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pb-6 pt-3">
      {/* 搜索与新增按钮 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜药名 / 英文 / 缩写 / 拼音首字母..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-8 text-sm focus:border-sky-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onCreateNewDrug}
            className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-sky-600 px-3 text-xs font-bold text-white active:scale-95"
          >
            <Plus className="h-4 w-4" />
            新增
          </button>
        </div>

        {/* 快捷状态过滤 */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {(
            [
              ['all', `全部 (${drugs.length})`],
              ['common', '高频常用'],
              ['highAlert', '高警示药品'],
              ['verified', `已核对 (${verifiedCount})`],
              ['unverified', `待核对 (${drugs.length - verifiedCount})`],
            ] as [QuickFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setQuickFilter(key)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                quickFilter === key
                  ? 'bg-slate-900 text-white dark:bg-sky-600'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 分类横滑筛选 */}
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
              category === 'all'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            全部分类
          </button>
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
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

      {/* 药物卡片列表 */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-14 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900">
            没有符合条件的药物
          </div>
        ) : (
          filtered.map((drug) => {
            const defRecipe = drug.recipes.find((r) => r.isDefault) ?? drug.recipes[0];
            const isFav = favSet.has(drug.id);
            return (
              <div
                key={drug.id}
                onClick={() => onSelectDrugDetail(drug)}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-3.5 transition active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {drug.nameCn}
                      </span>
                      <span className="truncate text-xs text-slate-400">{drug.nameEn}</span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                          CATEGORY_META[drug.category].colorClass
                        }`}
                      >
                        {CATEGORY_META[drug.category].shortLabel}
                      </span>
                      {drug.highAlert && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          高警示
                        </span>
                      )}
                      {drug.route === 'cvc_required' && (
                        <span className="rounded-md bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                          须CVC
                        </span>
                      )}
                      {drug.lightProtection && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                          <Sun className="h-2.5 w-2.5" />
                          避光
                        </span>
                      )}
                      {drug.verified ? (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          已核对
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400 dark:bg-slate-800">
                          参考模板·待核对
                        </span>
                      )}
                    </div>

                    <div className="mt-2 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                      <div className="truncate">
                        <span className="text-slate-400">默认配比：</span>
                        <span className="font-semibold">{defRecipe?.label}</span>
                        {drug.recipes.length > 1 && (
                          <span className="ml-1 text-[11px] text-slate-400">
                            等 {drug.recipes.length} 种
                          </span>
                        )}
                      </div>
                      <div className="truncate">
                        <span className="text-slate-400">参考范围：</span>
                        {drug.doseRange.text}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(drug.id);
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl active:scale-90"
                    aria-label="收藏"
                  >
                    <Star
                      className={`h-4.5 w-4.5 ${
                        isFav
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
