import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Calculator,
  Layers,
  Moon,
  Settings,
  Sun,
} from 'lucide-react';
import type { ActivePumpEntry, DrugRecord, PersistedAppState } from './types/drug';
import { buildEffectiveDrugList } from './data/icuDrugs';
import {
  doseToRateMlPerHour,
  resolveEffectiveDrugAmount,
} from './core/calculator';
import {
  DEFAULT_APP_STATE,
  loadPersistedState,
  savePersistedState,
} from './utils/storageBridge';
import { CalculatorView } from './components/CalculatorView';
import { MultiPumpView } from './components/MultiPumpView';
import { DrugLibraryView } from './components/DrugLibraryView';
import { SettingsView } from './components/SettingsView';
import { DrugPickerModal } from './components/DrugPickerModal';
import { DrugDetailModal } from './components/DrugDetailModal';

type AppTab = 'calc' | 'multipump' | 'library' | 'settings';

export const App: React.FC = () => {
  const [state, setState] = useState<PersistedAppState>(() => loadPersistedState());
  const [tab, setTab] = useState<AppTab>('calc');
  const [pickerMode, setPickerMode] = useState<'none' | 'calc' | 'multipump'>('none');
  const [detailDrug, setDetailDrug] = useState<DrugRecord | null>(null);
  const [creatingDrug, setCreatingDrug] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  // 同步暗黑主题到 html 根节点
  useEffect(() => {
    const root = document.documentElement;
    if (state.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [state.theme]);

  // 节流持久化到本地 localStorage / iOS Scriptable FileManager
  useEffect(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      savePersistedState(state);
    }, 200);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [state]);

  const drugs = useMemo(
    () =>
      buildEffectiveDrugList(
        state.drugOverrides,
        state.verifiedDrugIds,
        state.deletedDrugIds
      ),
    [state.drugOverrides, state.verifiedDrugIds, state.deletedDrugIds]
  );

  const drugMap = useMemo(() => new Map(drugs.map((d) => [d.id, d])), [drugs]);

  const currentDrug = useMemo(() => {
    if (state.lastSelectedDrugId && drugMap.has(state.lastSelectedDrugId)) {
      return drugMap.get(state.lastSelectedDrugId)!;
    }
    return drugs[0];
  }, [state.lastSelectedDrugId, drugMap, drugs]);

  const handleImportStateJson = useCallback(
    (jsonText: string) => {
      try {
        const parsed = JSON.parse(jsonText) as Partial<PersistedAppState>;
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          (!parsed.drugOverrides && !parsed.verifiedDrugIds && !parsed.favoriteDrugIds)
        ) {
          showToast('文件格式不匹配，请选择由本工具导出的 JSON 备份');
          return;
        }
        setState((prev) => ({
          ...prev,
          favoriteDrugIds: Array.isArray(parsed.favoriteDrugIds)
            ? parsed.favoriteDrugIds
            : prev.favoriteDrugIds,
          verifiedDrugIds: Array.isArray(parsed.verifiedDrugIds)
            ? Array.from(new Set([...prev.verifiedDrugIds, ...parsed.verifiedDrugIds]))
            : prev.verifiedDrugIds,
          drugOverrides:
            parsed.drugOverrides && typeof parsed.drugOverrides === 'object'
              ? { ...prev.drugOverrides, ...parsed.drugOverrides }
              : prev.drugOverrides,
          deletedDrugIds: Array.isArray(parsed.deletedDrugIds)
            ? parsed.deletedDrugIds
            : prev.deletedDrugIds,
        }));
        showToast('科室药库备份导入成功');
      } catch {
        showToast('JSON 解析失败，请确认文件未损坏');
      }
    },
    [showToast]
  );

  // 注册 iOS Scriptable 原生 DocumentPicker 导入回调
  useEffect(() => {
    window.__ICU_ON_IMPORT_JSON__ = (jsonText: string) => {
      handleImportStateJson(jsonText);
    };
    return () => {
      delete window.__ICU_ON_IMPORT_JSON__;
    };
  }, [handleImportStateJson]);

  const toggleFavorite = useCallback((drugId: string) => {
    setState((prev) => {
      const exists = prev.favoriteDrugIds.includes(drugId);
      return {
        ...prev,
        favoriteDrugIds: exists
          ? prev.favoriteDrugIds.filter((id) => id !== drugId)
          : [...prev.favoriteDrugIds, drugId],
      };
    });
  }, []);

  const toggleVerified = useCallback(
    (drugId: string) => {
      setState((prev) => {
        const exists = prev.verifiedDrugIds.includes(drugId);
        const nextIds = exists
          ? prev.verifiedDrugIds.filter((id) => id !== drugId)
          : [...prev.verifiedDrugIds, drugId];
        return { ...prev, verifiedDrugIds: nextIds };
      });
      setDetailDrug((curr) =>
        curr && curr.id === drugId ? { ...curr, verified: !curr.verified } : curr
      );
      showToast('已更新本科室核对状态');
    },
    [showToast]
  );

  const handleSaveDrug = useCallback(
    (updated: DrugRecord) => {
      setState((prev) => ({
        ...prev,
        drugOverrides: { ...prev.drugOverrides, [updated.id]: updated },
        verifiedDrugIds: Array.from(new Set([...prev.verifiedDrugIds, updated.id])),
      }));
      setDetailDrug(updated);
      showToast(`已保存「${updated.nameCn}」为本科室配置`);
    },
    [showToast]
  );

  const handleDeleteCustomDrug = useCallback(
    (drugId: string) => {
      setState((prev) => {
        const nextOverrides = { ...prev.drugOverrides };
        delete nextOverrides[drugId];
        return {
          ...prev,
          drugOverrides: nextOverrides,
          verifiedDrugIds: prev.verifiedDrugIds.filter((id) => id !== drugId),
          favoriteDrugIds: prev.favoriteDrugIds.filter((id) => id !== drugId),
        };
      });
      showToast('已删除自定义药物');
    },
    [showToast]
  );

  const handleAddToMultiPump = useCallback(
    (entry: Omit<ActivePumpEntry, 'id'>) => {
      const id = `pump_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setState((prev) => ({
        ...prev,
        activePumps: [...prev.activePumps, { ...entry, id }],
      }));
      const name = drugMap.get(entry.drugId)?.nameCn ?? '药物';
      showToast(`已将「${name}」加入多路泵面板`);
    },
    [drugMap, showToast]
  );

  const handleQuickAddDrugToMultiPump = useCallback(
    (drug: DrugRecord) => {
      const rec = drug.recipes.find((r) => r.isDefault) ?? drug.recipes[0];
      const effectiveAmount = resolveEffectiveDrugAmount(rec, state.weightKg);
      const startRate =
        doseToRateMlPerHour({
          dose: drug.doseRange.min,
          doseUnit: drug.doseRange.unit,
          drugAmount: effectiveAmount,
          amountUnit: rec.amountUnit,
          totalVolumeMl: rec.totalVolumeMl,
          weightKg: state.weightKg,
        }) ?? 2;

      handleAddToMultiPump({
        drugId: drug.id,
        recipeId: rec.id,
        mode: rec.mode,
        drugAmount: effectiveAmount,
        weightFactor: rec.weightFactor,
        amountUnit: rec.amountUnit,
        totalVolumeMl: rec.totalVolumeMl,
        rateMlPerHour: Math.max(0.1, Math.round(startRate * 100) / 100),
        displayDoseUnit: drug.defaultDoseUnit,
        remainingMl: rec.totalVolumeMl,
      });
    },
    [state.weightKg, handleAddToMultiPump]
  );

  const activePumpCount = state.activePumps.filter((p) => p.rateMlPerHour > 0).length;

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* 顶部应用导航条 */}
      <header className="safe-top sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 px-4 pb-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-2xl items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-600 text-white shadow-xs">
              <Activity className="h-4.5 w-4.5" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
                ICU 泵助手
              </h1>
              <p className="text-[10px] font-medium text-slate-400">
                离线微量泵配比 · 双向调速 · {drugs.length} 种药
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setState((prev) => ({
                ...prev,
                theme: prev.theme === 'dark' ? 'light' : 'dark',
              }))
            }
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 active:scale-90 dark:bg-slate-800 dark:text-amber-300"
            aria-label="切换日间/夜班模式"
          >
            {state.theme === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </button>
        </div>
      </header>

      {/* 首次使用临床安全提醒条 */}
      {!state.disclaimerAccepted && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-200">
          <div className="mx-auto flex max-w-2xl items-start justify-between gap-3">
            <div className="flex items-start gap-2 leading-relaxed">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                <strong>临床安全提示：</strong>
                本工具预置参数仅作离线参考，不替代医嘱核对与说明书。开泵前请务必核对药品浓度、规格及患者体重。
              </span>
            </div>
            <button
              type="button"
              onClick={() => setState((prev) => ({ ...prev, disclaimerAccepted: true }))}
              className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white"
            >
              已知晓
            </button>
          </div>
        </div>
      )}

      {/* 主滚动内容区 */}
      <main className="flex-1 overflow-y-auto">
        {tab === 'calc' && currentDrug && (
          <CalculatorView
            drug={currentDrug}
            weightKg={state.weightKg}
            isFavorite={state.favoriteDrugIds.includes(currentDrug.id)}
            onWeightChange={(w) => setState((prev) => ({ ...prev, weightKg: w }))}
            onOpenDrugPicker={() => setPickerMode('calc')}
            onToggleFavorite={toggleFavorite}
            onOpenDrugDetail={(d) => setDetailDrug(d)}
            onAddToMultiPump={handleAddToMultiPump}
            onNotify={showToast}
          />
        )}

        {tab === 'multipump' && (
          <MultiPumpView
            pumps={state.activePumps}
            drugMap={drugMap}
            weightKg={state.weightKg}
            onWeightChange={(w) => setState((prev) => ({ ...prev, weightKg: w }))}
            onAddPumpClick={() => setPickerMode('multipump')}
            onUpdatePump={(id, patch) =>
              setState((prev) => ({
                ...prev,
                activePumps: prev.activePumps.map((p) => (p.id === id ? { ...p, ...patch } : p)),
              }))
            }
            onRemovePump={(id) =>
              setState((prev) => ({
                ...prev,
                activePumps: prev.activePumps.filter((p) => p.id !== id),
              }))
            }
            onClearAll={() => {
              setState((prev) => ({ ...prev, activePumps: [] }));
              showToast('已清空多路泵面板');
            }}
            onInspectInCalculator={(drug) => {
              setState((prev) => ({ ...prev, lastSelectedDrugId: drug.id }));
              setTab('calc');
            }}
            onNotify={showToast}
          />
        )}

        {tab === 'library' && (
          <DrugLibraryView
            drugs={drugs}
            favoriteIds={state.favoriteDrugIds}
            onSelectDrugDetail={(d) => setDetailDrug(d)}
            onCreateNewDrug={() => setCreatingDrug(true)}
            onToggleFavorite={toggleFavorite}
          />
        )}

        {tab === 'settings' && (
          <SettingsView
            state={state}
            drugs={drugs}
            onToggleTheme={() =>
              setState((prev) => ({
                ...prev,
                theme: prev.theme === 'dark' ? 'light' : 'dark',
              }))
            }
            onImportStateJson={handleImportStateJson}
            onResetCustomDrugs={() => {
              setState((prev) => ({
                ...prev,
                drugOverrides: {},
                verifiedDrugIds: [],
                deletedDrugIds: [],
                favoriteDrugIds: DEFAULT_APP_STATE.favoriteDrugIds,
              }));
              showToast('已恢复出厂默认药库');
            }}
            onNotify={showToast}
          />
        )}
      </main>

      {/* 底部四标签导航栏 */}
      <nav className="safe-bottom sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto grid max-w-2xl grid-cols-4 pt-1.5">
          {[
            { id: 'calc' as const, label: '泵速换算', icon: Calculator },
            {
              id: 'multipump' as const,
              label: '多泵面板',
              icon: Layers,
              badge: activePumpCount,
            },
            { id: 'library' as const, label: '药库速查', icon: BookOpen },
            { id: 'settings' as const, label: '设置备份', icon: Settings },
          ].map(({ id, label, icon: Icon, badge }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-semibold transition ${
                  active
                    ? 'text-sky-600 dark:text-sky-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {badge !== undefined && badge > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 font-mono text-[10px] font-bold text-white">
                      {badge}
                    </span>
                  )}
                </div>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* 选药弹窗 */}
      <DrugPickerModal
        open={pickerMode !== 'none'}
        drugs={drugs}
        favoriteIds={state.favoriteDrugIds}
        selectedDrugId={pickerMode === 'calc' ? currentDrug?.id : undefined}
        title={pickerMode === 'multipump' ? '添加一路微泵到面板' : '选择 ICU 泵注药物'}
        onSelect={(drug) => {
          if (pickerMode === 'multipump') {
            handleQuickAddDrugToMultiPump(drug);
          } else {
            setState((prev) => ({ ...prev, lastSelectedDrugId: drug.id }));
          }
        }}
        onToggleFavorite={toggleFavorite}
        onClose={() => setPickerMode('none')}
      />

      {/* 药品详情与自定义编辑弹窗 */}
      <DrugDetailModal
        drug={detailDrug}
        isCreating={creatingDrug}
        onClose={() => {
          setDetailDrug(null);
          setCreatingDrug(false);
        }}
        onUseInCalculator={(drug) => {
          setState((prev) => ({ ...prev, lastSelectedDrugId: drug.id }));
          setTab('calc');
        }}
        onToggleVerified={toggleVerified}
        onSaveDrug={handleSaveDrug}
        onDeleteDrug={handleDeleteCustomDrug}
      />

      {/* 轻提示 Toast */}
      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-xs font-semibold text-white shadow-lg dark:bg-sky-600">
          {toast}
        </div>
      )}
    </div>
  );
};

export default App;
