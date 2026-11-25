import type { DrugRecord } from '../types/drug';
import { ICU_DRUGS_PART_1 } from './drugsPart1';
import { ICU_DRUGS_PART_2 } from './drugsPart2';

export const BUILTIN_ICU_DRUGS: DrugRecord[] = [...ICU_DRUGS_PART_1, ...ICU_DRUGS_PART_2];

/**
 * 合并内置药物库与用户本地编辑/新增/核对/删除状态
 */
export function buildEffectiveDrugList(
  overrides: Record<string, DrugRecord>,
  verifiedIds: string[],
  deletedIds: string[]
): DrugRecord[] {
  const verifiedSet = new Set(verifiedIds);
  const deletedSet = new Set(deletedIds);

  const result: DrugRecord[] = [];
  const seen = new Set<string>();

  for (const baseDrug of BUILTIN_ICU_DRUGS) {
    if (deletedSet.has(baseDrug.id)) continue;
    const merged = overrides[baseDrug.id] ?? baseDrug;
    result.push({
      ...merged,
      verified: verifiedSet.has(baseDrug.id) || Boolean(merged.verified),
    });
    seen.add(baseDrug.id);
  }

  for (const [id, customDrug] of Object.entries(overrides)) {
    if (seen.has(id) || deletedSet.has(id)) continue;
    result.push({
      ...customDrug,
      custom: true,
      verified: verifiedSet.has(id) || Boolean(customDrug.verified),
    });
  }

  return result;
}

/**
 * 支持中文通用名、英文名、常用别名、商品名、拼音首字母的极速搜索
 */
export function searchDrugs(drugs: DrugRecord[], query: string): DrugRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return drugs;

  return drugs.filter((d) => {
    if (d.nameCn.toLowerCase().includes(q)) return true;
    if (d.nameEn.toLowerCase().includes(q)) return true;
    if (d.aliases.some((alias) => alias.toLowerCase().includes(q))) return true;
    if (d.vialSpec.toLowerCase().includes(q)) return true;
    return false;
  });
}
