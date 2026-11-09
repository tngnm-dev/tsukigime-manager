import type { Allocation, Contract, Fee, ISODate, OneTimeAllocation, OneTimeCharge, RentAllocation, YearMonth, Yen } from '../types';
import { chargeForMonth } from './billing';
import { toYearMonth, monthRange } from './month';

// 未払いの請求を、入金を流し込む順番に並べるファイル
// 保存はせず、計算のたびに作る型なので、保存データの型をまとめたtypes.tsではなくここに置く
export type DueItem =
  | { kind: 'oneTime'; chargeId: string; date: ISODate; remaining: Yen }
  | { kind: 'rent'; month: YearMonth; remaining: Yen | null };

export function remainingForCharge(charge: OneTimeCharge, allocations: Allocation[]): Yen {
  const chargeAllocations = allocations.filter((a): a is OneTimeAllocation => {
    return a.kind === 'oneTime' && a.chargeId === charge.id
  })
  const total = chargeAllocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  return charge.amount - total
}

export function remainingForMonth(contract: Contract, fees: Fee[], allocations: Allocation[], month: YearMonth): Yen | null {
  // 導入前に払い済みの月は残り0。導入前の月は料金を登録していないことも多いので、料金を調べる前に返して、未登録の null にならないようにする
  if (contract.paidThroughMonth !== null && month <= contract.paidThroughMonth) return 0;
  const amount = chargeForMonth(contract, fees, month);
  if (amount === null) return null;

  const rentAllocations = allocations.filter((a): a is RentAllocation => {
    return a.kind === 'rent' && a.contractId === contract.id && a.month === month
  })
  const total = rentAllocations.reduce((sum, allocation) => sum + allocation.amount, 0);

  return amount - total;
}

export function unpaidItems(contract: Contract, charges: OneTimeCharge[], fees: Fee[], allocations: Allocation[], throughMonth: YearMonth): DueItem[] {
  // 一時金（仲介手数料・更新料）は駐車場代より先に充てるため、この順番で記載
  const oneTimeItems = charges
    .filter(charge => charge.contractId === contract.id)
    .filter(charge => remainingForCharge(charge, allocations) > 0)
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .map((charge): DueItem => ({
      kind: 'oneTime',
      chargeId: charge.id,
      date: charge.date,
      remaining: remainingForCharge(charge, allocations),
    }));

  let rangeEnd = throughMonth;
  if (contract.endDate !== null) {
    const endMonth = toYearMonth(contract.endDate);
    rangeEnd = rangeEnd < endMonth ? rangeEnd : endMonth;
  }

  const rentItems = monthRange(toYearMonth(contract.startDate), rangeEnd)
    .map((month): DueItem => ({
      kind: 'rent',
      month,
      remaining: remainingForMonth(contract, fees, allocations, month),
    }))
    .filter(item => item.remaining === null || item.remaining > 0); //nullの月を捨てると、その月を飛ばして次の月にお金が入ってしまうのでこの形

  return [...oneTimeItems, ...rentItems];
}