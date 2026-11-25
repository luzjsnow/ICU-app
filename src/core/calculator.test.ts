import { describe, expect, it } from 'vitest';
import {
  calculateConcentrationSwitch,
  calculateMultiPumpSummary,
  convertDoseUnit,
  doseToRateMlPerHour,
  estimateRemainingTime,
  evaluateDoseSafety,
  rateMlPerHourToDose,
  resolveEffectiveDrugAmount,
} from './calculator';
import type { ActivePumpEntry, DrugRecord } from '../types/drug';

describe('ICU 微量泵核心计算引擎', () => {
  describe('正向与反向换算（固定配比与体重系数配法）', () => {
    it('去甲肾上腺素固定配比：8mg/50mL，体重 70kg，目标 0.2 μg/kg/min -> 5.25 mL/h', () => {
      // 浓度 = 8000 μg / 50 mL = 160 μg/mL
      // 需药量 = 0.2 × 70 × 60 = 840 μg/h -> 840 / 160 = 5.25 mL/h
      const rate = doseToRateMlPerHour({
        dose: 0.2,
        doseUnit: 'ug/kg/min',
        drugAmount: 8,
        amountUnit: 'mg',
        totalVolumeMl: 50,
        weightKg: 70,
      });
      expect(rate).toBeCloseTo(5.25, 6);

      const reverseDose = rateMlPerHourToDose({
        rateMlPerHour: 5.25,
        doseUnit: 'ug/kg/min',
        drugAmount: 8,
        amountUnit: 'mg',
        totalVolumeMl: 50,
        weightKg: 70,
      });
      expect(reverseDose).toBeCloseTo(0.2, 6);
    });

    it('经典 0.3×体重 配法（去甲/肾上腺素）：配至 50mL 时 1 mL/h 恒等于 0.1 μg/kg/min', () => {
      for (const weight of [45, 60, 75, 110]) {
        const drugAmount = resolveEffectiveDrugAmount(
          { mode: 'weight_rule', weightFactor: 0.3 },
          weight
        );
        const dose = rateMlPerHourToDose({
          rateMlPerHour: 1,
          doseUnit: 'ug/kg/min',
          drugAmount,
          amountUnit: 'mg',
          totalVolumeMl: 50,
          weightKg: weight,
        });
        expect(dose).toBeCloseTo(0.1, 6);
      }
    });

    it('经典 3×体重 配法（多巴胺/多巴酚丁胺）：配至 50mL 时 1 mL/h 恒等于 1 μg/kg/min', () => {
      for (const weight of [50, 68, 95]) {
        const drugAmount = resolveEffectiveDrugAmount(
          { mode: 'weight_rule', weightFactor: 3 },
          weight
        );
        const dose = rateMlPerHourToDose({
          rateMlPerHour: 5,
          doseUnit: 'ug/kg/min',
          drugAmount,
          amountUnit: 'mg',
          totalVolumeMl: 50,
          weightKg: weight,
        });
        expect(dose).toBeCloseTo(5, 6);
      }
    });

    it('血管加压素非体重单位：20 U / 50 mL，目标 0.03 U/min -> 4.5 mL/h', () => {
      // 浓度 = 0.4 U/mL；0.03 U/min = 1.8 U/h -> 1.8 / 0.4 = 4.5 mL/h
      const rate = doseToRateMlPerHour({
        dose: 0.03,
        doseUnit: 'U/min',
        drugAmount: 20,
        amountUnit: 'U',
        totalVolumeMl: 50,
        weightKg: 70,
      });
      expect(rate).toBeCloseTo(4.5, 6);
    });

    it('瑞芬太尼 μg 级别配比：2 mg / 50 mL，60 kg，0.1 μg/kg/min -> 9 mL/h', () => {
      // 浓度 = 40 μg/mL；0.1 × 60 × 60 = 360 μg/h -> 360 / 40 = 9 mL/h
      const rate = doseToRateMlPerHour({
        dose: 0.1,
        doseUnit: 'ug/kg/min',
        drugAmount: 2,
        amountUnit: 'mg',
        totalVolumeMl: 50,
        weightKg: 60,
      });
      expect(rate).toBeCloseTo(9, 6);
    });

    it('右美托咪定 μg 配药单位：200 μg / 50 mL，70 kg，0.4 μg/kg/h -> 7 mL/h', () => {
      // 浓度 = 4 μg/mL；0.4 × 70 = 28 μg/h -> 28 / 4 = 7 mL/h
      const rate = doseToRateMlPerHour({
        dose: 0.4,
        doseUnit: 'ug/kg/h',
        drugAmount: 200,
        amountUnit: 'ug',
        totalVolumeMl: 50,
        weightKg: 70,
      });
      expect(rate).toBeCloseTo(7, 6);
    });

    it('丙泊酚原液 1%（500 mg / 50 mL），70 kg，2 mg/kg/h -> 14 mL/h', () => {
      const rate = doseToRateMlPerHour({
        dose: 2,
        doseUnit: 'mg/kg/h',
        drugAmount: 500,
        amountUnit: 'mg',
        totalVolumeMl: 50,
        weightKg: 70,
      });
      expect(rate).toBeCloseTo(14, 6);
    });

    it('单位族不匹配时拒绝计算并返回 null（防 mg 与 U / mmol 混算）', () => {
      const mismatch = doseToRateMlPerHour({
        dose: 10,
        doseUnit: 'U/h',
        drugAmount: 50,
        amountUnit: 'mg',
        totalVolumeMl: 50,
        weightKg: 70,
      });
      expect(mismatch).toBeNull();
    });
  });

  describe('单位换算与安全范围评估', () => {
    it('μg/kg/min 与 μg/min、mg/h 互转精确无误', () => {
      // 70 kg, 0.1 μg/kg/min = 7 μg/min = 0.42 mg/h
      expect(convertDoseUnit(0.1, 'ug/kg/min', 'ug/min', 70)).toBeCloseTo(7, 6);
      expect(convertDoseUnit(0.1, 'ug/kg/min', 'mg/h', 70)).toBeCloseTo(0.42, 6);
    });

    it('即使切换了显示单位，安全阈值依然准确判定超常规与超极量', () => {
      const range = {
        min: 0.05,
        max: 1.0,
        warningMax: 2.0,
        unit: 'ug/kg/min' as const,
        text: '0.05~1.0 μg/kg/min',
      };
      // 70kg 下 105 μg/min = 1.5 μg/kg/min -> high
      expect(evaluateDoseSafety(105, 'ug/min', range, 70).level).toBe('high');
      // 70kg 下 150 μg/min = 2.14 μg/kg/min -> danger
      expect(evaluateDoseSafety(150, 'ug/min', range, 70).level).toBe('danger');
      // 70kg 下 35 μg/min = 0.5 μg/kg/min -> normal
      expect(evaluateDoseSafety(35, 'ug/min', range, 70).level).toBe('normal');
    });
  });

  describe('浓缩换泵与剩余时间估算', () => {
    it('限液患者 2倍/4倍 浓缩换算：剂量严格等效并准确统计 24h 节液量', () => {
      const doubleConc = calculateConcentrationSwitch({
        currentDrugAmount: 8,
        amountUnit: 'mg',
        currentTotalVolumeMl: 50,
        currentRateMlPerHour: 12,
        targetMultiplier: 2,
      });
      expect(doubleConc).not.toBeNull();
      expect(doubleConc!.newDrugAmount).toBe(16);
      expect(doubleConc!.newRateMlPerHour).toBeCloseTo(6, 6);
      expect(doubleConc!.fluidPer24hMl).toBeCloseTo(144, 6);
      expect(doubleConc!.fluidSavedPer24hMl).toBeCloseTo(144, 6);
      expect(doubleConc!.syringeDurationHours).toBeCloseTo(50 / 6, 6);
    });

    it('剩余药液维持时间与完成时刻估算', () => {
      const now = new Date(2026, 10, 25, 22, 0, 0);
      const est = estimateRemainingTime(25, 10, now);
      expect(est).not.toBeNull();
      expect(est!.hoursTotal).toBeCloseTo(2.5, 6);
      expect(est!.durationText).toBe('2 小时 30 分');
      expect(est!.finishTimeText).toBe('次日 00:30');
    });
  });

  describe('多路泵面板：总入液量、NEE 与 VIS 汇总', () => {
    const mockDrugs = new Map<string, DrugRecord>([
      [
        'norepinephrine',
        {
          id: 'norepinephrine',
          nameCn: '去甲肾上腺素',
          nameEn: 'Norepinephrine',
          aliases: [],
          category: 'vasopressor',
          highAlert: true,
          vialSpec: '2mg/1mL',
          defaultDoseUnit: 'ug/kg/min',
          supportedDoseUnits: ['ug/kg/min'],
          doseRange: { min: 0.05, max: 1.0, warningMax: 2.0, unit: 'ug/kg/min', text: '' },
          recipes: [],
          diluents: '',
          route: 'cvc_required',
          routeNote: '',
          lightProtection: true,
          incompatibilities: '',
          clinicalNotes: [],
          neeKey: 'norepinephrine',
          visKey: 'norepinephrine',
        },
      ],
      [
        'vasopressin',
        {
          id: 'vasopressin',
          nameCn: '血管加压素',
          nameEn: 'Vasopressin',
          aliases: [],
          category: 'vasopressor',
          highAlert: true,
          vialSpec: '20U/1mL',
          defaultDoseUnit: 'U/min',
          supportedDoseUnits: ['U/min'],
          doseRange: { min: 0.01, max: 0.04, warningMax: 0.06, unit: 'U/min', text: '' },
          recipes: [],
          diluents: '',
          route: 'cvc_required',
          routeNote: '',
          lightProtection: false,
          incompatibilities: '',
          clinicalNotes: [],
          neeKey: 'vasopressin',
          visKey: 'vasopressin',
        },
      ],
      [
        'dobutamine',
        {
          id: 'dobutamine',
          nameCn: '多巴酚丁胺',
          nameEn: 'Dobutamine',
          aliases: [],
          category: 'vasopressor',
          highAlert: true,
          vialSpec: '20mg/2mL',
          defaultDoseUnit: 'ug/kg/min',
          supportedDoseUnits: ['ug/kg/min'],
          doseRange: { min: 2, max: 20, unit: 'ug/kg/min', text: '' },
          recipes: [],
          diluents: '',
          route: 'cvc_preferred',
          routeNote: '',
          lightProtection: false,
          incompatibilities: '',
          clinicalNotes: [],
          visKey: 'dobutamine',
        },
      ],
    ]);

    it('准确汇总 NE 0.2 μg/kg/min + 加压素 0.03 U/min + 多巴酚丁胺 5 μg/kg/min', () => {
      const weight = 70;
      const pumps: ActivePumpEntry[] = [
        // NE 8mg/50mL @ 5.25 mL/h = 0.2 μg/kg/min
        {
          id: 'p1',
          drugId: 'norepinephrine',
          mode: 'fixed',
          drugAmount: 8,
          amountUnit: 'mg',
          totalVolumeMl: 50,
          rateMlPerHour: 5.25,
          displayDoseUnit: 'ug/kg/min',
        },
        // Vasopressin 20U/50mL @ 4.5 mL/h = 0.03 U/min
        {
          id: 'p2',
          drugId: 'vasopressin',
          mode: 'fixed',
          drugAmount: 20,
          amountUnit: 'U',
          totalVolumeMl: 50,
          rateMlPerHour: 4.5,
          displayDoseUnit: 'U/min',
        },
        // Dobutamine 3*70=210mg/50mL @ 5 mL/h = 5 μg/kg/min
        {
          id: 'p3',
          drugId: 'dobutamine',
          mode: 'weight_rule',
          drugAmount: 210,
          weightFactor: 3,
          amountUnit: 'mg',
          totalVolumeMl: 50,
          rateMlPerHour: 5,
          displayDoseUnit: 'ug/kg/min',
        },
      ];

      const summary = calculateMultiPumpSummary(pumps, mockDrugs, weight);

      expect(summary.activePumpCount).toBe(3);
      expect(summary.totalFluidMlPerHour).toBeCloseTo(14.75, 6);
      expect(summary.totalFluidMlPer24h).toBeCloseTo(354, 6);

      // NEE = 0.2 (NE) + 0.03 * 2.5 (Vasopressin) = 0.275 μg/kg/min
      expect(summary.totalNee).toBeCloseTo(0.275, 6);

      // VIS = 100 * 0.2 (NE=20) + 10000 * (0.03/70) (Vaso≈4.2857) + 5 (Dobu) = 29.2857
      expect(summary.totalVis).toBeCloseTo(20 + (10000 * 0.03) / 70 + 5, 5);
    });
  });
});
