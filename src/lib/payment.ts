import type { ISODate, Contract, Allocation, YearMonth, RentAllocation, DueRule, Fee, OneTimeCharge } from '../types';
import { remainingForCharge, remainingForMonth, unpaidItems } from './dues';
import type { DueItem } from './dues';
import { toYearMonth, monthRange, addMonths, daysInMonth, monthEndDate } from './month';

// 駐車場料金の払い済み・延滞・前払い
// 払い済みの月を集める。調べるのは「割り当てがある月」と「paidThroughMonth まで」だけ（前払いはどこまで先か分からないので、全部の月は調べられない)
export function paidMonths(contract: Contract, fees: Fee[], allocations: Allocation[]): Set<YearMonth> {
  const rentAllocations = allocations.filter((a): a is RentAllocation => {
    return a.kind === "rent"
      && a.contractId === contract.id
  });
  const setMonths = new Set<YearMonth>();
  rentAllocations
    .filter((a) => {
      // 残りが 0 以下なら払い済み（多めに割り当てた月も含める）。null（料金未登録）は払い済みにしない
      const remaining = remainingForMonth(contract, fees, allocations, a.month);
      return remaining !== null && remaining <= 0;
    })
    .forEach((a) => {
      setMonths.add(a.month);
    });

  // 導入前の支払いは割り当てとして記録されていないので、契約開始月〜paidThroughMonth はそのまま払い済みにする
  const from = toYearMonth(contract.startDate);
  const to = contract.paidThroughMonth;
  if (to !== null) {
    monthRange(from, to).forEach((m) => {
      setMonths.add(m);
    });
  }

  return setMonths;
}

// 「今の請求分」の線引き。期限がこの日（今月末）までのものを今の請求分（延滞・期限前の未払い）、より後のものを前払い・まだ請求していない分とする
// status.ts の判定・前払いの数・区画詳細の一覧で同じ線を使うため、ここ1か所で決める
export function billingCutoff(today: ISODate): ISODate {
  return monthEndDate(toYearMonth(today));
}

// 今の請求分を探す範囲の最後の月（来月）。期限が今月末までに来る月は、どの支払いルールでも来月までに収まる（前月末払いの来月分が最も先）
export function lastBillableMonth(today: ISODate): YearMonth {
  return addMonths(toYearMonth(today), 1);
}

export function dueDate(rule: DueRule, month: YearMonth): ISODate {
  switch (rule.type) {
    case 'prevMonthEnd':
      return monthEndDate(addMonths(month, -1));
    case 'dayOfMonth':
      return rule.day > daysInMonth(month) //指定日がその月にない（2月30日など）ときは、月末を期限にする
        ? monthEndDate(month)
        : `${month}-${String(rule.day).padStart(2, '0')}`;
    case 'nextMonthEnd':
      return monthEndDate(addMonths(month, 1));
    default: {
      const _exhaustive: never = rule;
      throw new Error(`不明なルール: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
export function overdueMonths(contract: Contract, fees: Fee[], rule: DueRule, allocations: Allocation[], today: ISODate,): YearMonth[] {
  //支払い期限が今日より前なのに、まだ残りがある月
  let rangeEnd = lastBillableMonth(today);
  if (contract.endDate !== null) {
    // 契約が終わった後の月には請求がないので、終了月までにする
    const endMonth = toYearMonth(contract.endDate);
    rangeEnd = rangeEnd < endMonth ? rangeEnd : endMonth;
  }
  return monthRange(toYearMonth(contract.startDate), rangeEnd)
    .filter((m) => dueDate(rule, m) < today) //期限の当日はまだ延滞にしない
    .filter((m) => {
      const remaining = remainingForMonth(contract, fees, allocations, m);
      return remaining !== null && remaining > 0; //null（料金未登録）は延滞にせずfeeMissingで扱う。0以下は払い済みか0円の月
    });
}

// 延滞している一時金（仲介手数料・更新料）
// 期限は、発生日の月の家賃と同じにする（仲介手数料は最初の月の家賃と一緒に払うことが多いので）
export function overdueCharges(contract: Contract, charges: OneTimeCharge[], rule: DueRule, allocations: Allocation[], today: ISODate): OneTimeCharge[] {
  return charges
    .filter((charge) => charge.contractId === contract.id)
    .filter((charge) => dueDate(rule, toYearMonth(charge.date)) < today) //期限の当日はまだ延滞にしない
    .filter((charge) => remainingForCharge(charge, allocations) > 0);
}

export function prepaidCount(contract: Contract, fees: Fee[], rule: DueRule, allocations: Allocation[], today: ISODate): number {
  //「期限が今月末より後の月で、支払い済みになっている月」の数を返す
  const paid = paidMonths(contract, fees, allocations);
  const cutoff = billingCutoff(today);
  return [...paid].filter((m) => dueDate(rule, m) > cutoff).length;
}

// 今の請求分（期限が今月末まで）の未払いを、期限と延滞かどうかを付けて返す。区画詳細で1件ずつ金額と期限を見せるため
// 期限の線引きは status.ts と同じ。一時金の期限は発生日の月の家賃と同じ
export type BilledItem = DueItem & { dueDate: ISODate; isOverdue: boolean };

export function billedUnpaidItems(contract: Contract, charges: OneTimeCharge[], fees: Fee[], rule: DueRule, allocations: Allocation[], today: ISODate): BilledItem[] {
  const cutoff = billingCutoff(today);
  return unpaidItems(contract, charges, fees, allocations, lastBillableMonth(today))
    .map((item): BilledItem => {
      const due = item.kind === 'rent'
        ? dueDate(rule, item.month)
        : dueDate(rule, toYearMonth(item.date));
      // 延滞の判定は overdueMonths・overdueCharges とそろえる。料金未登録（null）の月は延滞にせず「料金未登録」として出す
      const isOverdue = item.remaining !== null && item.remaining > 0 && due < today; //期限の当日はまだ延滞にしない
      return { ...item, dueDate: due, isOverdue };
    })
    .filter((item) => item.dueDate <= cutoff)
    // 連絡するときに古いものから伝えられるよう、期限の早い順に並べる
    .toSorted((a, b) => a.dueDate.localeCompare(b.dueDate));
}

// 入金の割り当て（前払いのチェックなし）で充てる範囲。期限が今月末までの未払い
// 並べ替えないのは、unpaidItems の順番（一時金 → 古い月）がそのまま充てる順番になるため
export function currentUnpaidItems(contract: Contract, charges: OneTimeCharge[], fees: Fee[], rule: DueRule, allocations: Allocation[], today: ISODate): DueItem[] {
  const cutoff = billingCutoff(today);
  return unpaidItems(contract, charges, fees, allocations, lastBillableMonth(today))
    .filter((item) =>
      item.kind === 'rent'
        ? dueDate(rule, item.month) <= cutoff
        : dueDate(rule, toYearMonth(item.date)) <= cutoff
    );
}

// 前払いのチェックを入れたときの範囲。今の請求分を先に、そのあと先の月の家賃だけ（将来の一時金は入れない）
export function prepayUnpaidItems(contract: Contract, charges: OneTimeCharge[], fees: Fee[], rule: DueRule, allocations: Allocation[], today: ISODate, limitMonths: number): DueItem[] {
  const cutoff = billingCutoff(today);
  const current = currentUnpaidItems(contract, charges, fees, rule, allocations, today);
  const futureRent = unpaidItems(contract, charges, fees, allocations, addMonths(toYearMonth(today), limitMonths))
    .filter((item) => item.kind === 'rent')
    .filter((item) => dueDate(rule, item.month) > cutoff);
  return [...current, ...futureRent];
}