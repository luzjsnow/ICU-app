import { describe, expect, it } from 'vitest';
import { BUILTIN_ICU_DRUGS } from './icuDrugs';
import {
  doseToRateMlPerHour,
  rateMlPerHourToDose,
  resolveEffectiveDrugAmount,
} from '../core/calculator';

describe('内置 ICU 泵注药物库数据完整性与换算自检', () => {
  it('内置药物数量应达到 50 种以上且 ID 唯一', () => {
    expect(BUILTIN_ICU_DRUGS.length).toBeGreaterThanOrEqual(50);
    const ids = new Set(BUILTIN_ICU_DRUGS.map((d) => d.id));
    expect(ids.size).toBe(BUILTIN_ICU_DRUGS.length);
  });

  it('每一种药物的所有配比方案与支持的给药单位均可正确双向换算且可逆', () => {
    const testWeight = 65;

    for (const drug of BUILTIN_ICU_DRUGS) {
      expect(drug.recipes.length, `${drug.nameCn} 至少需 1 个配比`).toBeGreaterThan(0);
      expect(drug.supportedDoseUnits).toContain(drug.defaultDoseUnit);
      expect(drug.doseRange.min).toBeGreaterThan(0);
      expect(drug.doseRange.max).toBeGreaterThanOrEqual(drug.doseRange.min);

      for (const recipe of drug.recipes) {
        const effectiveAmount = resolveEffectiveDrugAmount(recipe, testWeight);
        expect(effectiveAmount, `${drug.nameCn} - ${recipe.label}`).toBeGreaterThan(0);
        expect(recipe.totalVolumeMl).toBeGreaterThan(0);

        const targetDose = (drug.doseRange.min + drug.doseRange.max) / 2;
        const rate = doseToRateMlPerHour({
          dose: targetDose,
          doseUnit: drug.doseRange.unit,
          drugAmount: effectiveAmount,
          amountUnit: recipe.amountUnit,
          totalVolumeMl: recipe.totalVolumeMl,
          weightKg: testWeight,
        });

        expect(rate, `${drug.nameCn} (${recipe.label}) 正算泵速不应为空`).not.toBeNull();
        expect(rate!).toBeGreaterThan(0);

        const reverse = rateMlPerHourToDose({
          rateMlPerHour: rate!,
          doseUnit: drug.doseRange.unit,
          drugAmount: effectiveAmount,
          amountUnit: recipe.amountUnit,
          totalVolumeMl: recipe.totalVolumeMl,
          weightKg: testWeight,
        });

        expect(reverse, `${drug.nameCn} (${recipe.label}) 反算剂量应与原目标一致`).toBeCloseTo(
          targetDose,
          5
        );
      }
    }
  });
});
