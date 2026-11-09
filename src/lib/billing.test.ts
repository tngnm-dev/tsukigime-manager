import { expect, test } from "vitest";
import type { Fee, Contract } from '../types';
import { feeForMonth, prorate, usedDaysInMonth, chargeForMonth ,chargeForPerson } from './billing';

// ↓ テスト用のデータ（このファイルの全テストで共通）
const fees: Fee[] = [
  { id: 'f1', contractId: 'c1', startMonth: '2024-04', amount: 8000 },
  { id: 'f2', contractId: 'c1', startMonth: '2026-04', amount: 9000 }, // 値上げ
  { id: 'f3', contractId: 'c2', startMonth: '2025-01', amount: 7000 }, // 別の契約
];
const contracts: Contract[] = [
  {
    id: "c1",
    personId: "p1",
    spaceId: "s1",
    startDate: "2024-04-01",
    endDate: null,
    renewalDate: "2027-04-01",
    paidThroughMonth: "2026-10",
  },
  {
    id: "c2",
    personId: "p2",
    spaceId: "s2",
    startDate: "2025-01-15",
    endDate: null,
    renewalDate: "2027-01-15",
    paidThroughMonth: "2026-09",
  },
  {
    id: "c3",
    personId: "p3",
    spaceId: "s3",
    startDate: "2025-06-01",
    endDate: "2026-09-30",
    renewalDate: "2026-06-01",
    paidThroughMonth: null,
  },
];

test("値上げ前の月は、前の料金を返す。別の契約の料金は混ざらない。契約開始前の月は null を返す", () => {
  expect(feeForMonth(fees, 'c1', '2025-10')).toBe(8000);
  expect(feeForMonth(fees, 'c2', '2025-10')).toBe(7000);
  expect(feeForMonth(fees, 'c1', '2026-10')).toBe(9000);
  expect(feeForMonth(fees, 'c1', '2020-10')).toBe(null);
});

test("日割り(切り上げ)", () => {
  expect(prorate(8000, 12, 31)).toBe(3097);
  expect(prorate(8000, 15, 30)).toBe(4000);
});

test("その月に使った日数", () => {
  expect(usedDaysInMonth('2025-10-15', '2027-12-31', '2025-12')).toBe(31);
  expect(usedDaysInMonth('2025-10-15', '2027-12-31', '2024-12')).toBe(0);
  expect(usedDaysInMonth('2025-10-15', '2027-12-31', '2028-12')).toBe(0);
  expect(usedDaysInMonth('2026-10-20', null, '2026-10')).toBe(12);
  expect(usedDaysInMonth('2025-04-01', '2026-10-10', '2026-10')).toBe(10);
  expect(usedDaysInMonth('2026-10-05', '2026-10-24', '2026-10')).toBe(20);
});

test("その月支払う金額", () => {
  expect(chargeForMonth(contracts[0], fees, "2026-10")).toBe(9000);
  expect(chargeForMonth(contracts[2], fees, "2026-10")).toBe(0); // 契約終了後

  expect(chargeForMonth(contracts[1], fees, "2025-01")).toBe(3839); // 15日〜31日の17日分
  expect(chargeForMonth(contracts[0], fees, "2020-10")).toBe(0); // 契約開始前
});

test("契約が2つある人の合計", () => {
  const c4: Contract = {
    ...contracts[0],
    id: "c4",
    personId: "p1",
    spaceId: "s4",
  };

  const additionalFee: Fee = {
    id: "f4",
    contractId: "c4",
    startMonth: "2026-04",
    amount: 5000,
  };

  expect(
    chargeForPerson(
      "p1",
      [...contracts, c4],
      [...fees, additionalFee],
      "2026-10"
    )
  ).toBe(14000); // c1の9000円 + c4の5000円
});

test("ほかの人の契約が混ざらない", () => {
  expect(
    chargeForPerson("p2", contracts, fees, "2026-10")
  ).toBe(7000);
});

test("契約期間中に料金の登録がなければnull", () => {
  const missingFeeContract: Contract = {
    ...contracts[0],
    id: "c5",
    personId: "p3",
    spaceId: "s5",
  };

  expect(
    chargeForPerson(
      "p3",
      [...contracts, missingFeeContract],
      fees,
      "2026-10"
    )
  ).toBeNull(); // c5の料金が未登録
});

test("契約が1つもない人は0", () => {
  expect(
    chargeForPerson("p99", contracts, fees, "2026-10")
  ).toBe(0);
});