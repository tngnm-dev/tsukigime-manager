import type { ISODate, Yen, Fee, Contract, YearMonth } from '../types';
import { toYearMonth, daysInMonth } from './month';

// 新しい順に並べて先頭を取っているのは、対象月より前に始まった料金のうち、一番新しいもの（＝その月に有効な料金）を選ぶ
export function feeForMonth(fees: Fee[], contractId: string, targetMonth: YearMonth): Yen | null {
  const amount = fees
    .filter((fee) =>
      fee.contractId === contractId &&
      fee.startMonth <= targetMonth
    )
    .toSorted((a, b) =>
      b.startMonth.localeCompare(a.startMonth)
    )[0]?.amount ?? null; //0ではなくnullを返すようにしてるのは、諸事情で未使用だった月(0円)と料金を登録し忘れた月(null)を区別したいため

  return amount;
}

// 日割り計算。切り上げにしているのはユーザーの現在の業務がそうなっているので
// 浮動小数点の問題で途中で割らず、最後に切り上げる
export function prorate(monthlyFee: Yen, usedDays: number, totalDays: number): Yen {
  return Math.ceil((monthlyFee * usedDays) / totalDays);
}

// 当月内で契約から終了だったパターンも網羅。 '2026-10-05' → '2026-10-29'
export function usedDaysInMonth(startDate: ISODate, endDate: ISODate | null, targetMonth: YearMonth): number {
  if (toYearMonth(startDate) > targetMonth || (endDate !== null && toYearMonth(endDate) < targetMonth)) {
    return 0;
  }
  const firstDay =
    toYearMonth(startDate) === targetMonth
      ? Number(startDate.slice(8, 10))
      : 1;
  const lastDay =
    endDate !== null && toYearMonth(endDate) === targetMonth
      ? Number(endDate.slice(8, 10))
      : daysInMonth(targetMonth);

  return lastDay - firstDay + 1;
}

// ある月の料金。料金を探す前から(usedDays === 0)としているのは、契約期間の外の月を料金の未登録と間違えないためです。
export function chargeForMonth(contract: Contract, fees: Fee[], targetMonth: YearMonth): Yen | null {
  const usedDays = usedDaysInMonth(contract.startDate, contract.endDate, targetMonth);
  if (usedDays === 0) {
    return 0;
  }
  const totalDays = daysInMonth(targetMonth);
  const monthlyFee = feeForMonth(fees, contract.id, targetMonth);
  if (monthlyFee === null) {
    return null;
  }
  return prorate(monthlyFee, usedDays, totalDays);
}

// この関数は、1人の契約者が借りている区画の、その月の料金の合計。1人で複数の区画を借りている人がいるため
// 1区画でも料金が分からなければ、合計を出すと少なく見えてしまうので、合計も null にする
export function chargeForPerson(personId: string, contracts: Contract[], fees: Fee[], targetMonth: YearMonth): Yen | null {
  const charges = contracts
    .filter((contract) =>
      personId === contract.personId
    ).map((contract) =>
      chargeForMonth(contract, fees, targetMonth));

  if (charges.some((charge) => charge === null)) {
    return null;
  }
  
  return charges.reduce<Yen>(
    // 上の some で null がないことは確認済み。?? 0 は型を合わせるためだけ
    (sum, charge) => sum + (charge ?? 0),
    0
  );
}