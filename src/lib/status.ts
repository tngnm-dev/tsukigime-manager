import type { ISODate, Space, Contract, Person, Allocation, YearMonth, Fee, OneTimeCharge } from '../types';
import { billingCutoff, dueDate, lastBillableMonth, overdueCharges, overdueMonths, prepaidCount } from '../lib/payment'
import { remainingForCharge, remainingForMonth } from './dues';
import { monthRange, toYearMonth } from './month';

export type SpaceCellStatus = 'vacant' | 'unknown' | 'feeMissing' | 'overdue' | 'due' | 'prepaid' | 'paid';
export type SpaceStatusResult = {
  person: Person | undefined;
  status: SpaceCellStatus;
  overdue: YearMonth[];
  overdueChargeList: OneTimeCharge[],
  prepaid: number;
};

export function getSpaceStatus(space: Space, contracts: Contract[], people: Person[], fees: Fee[], charges: OneTimeCharge[], allocations: Allocation[], today: ISODate): SpaceStatusResult {
  // 1区画に契約1件の前提。入れ替わりに対応するには、終了していない契約を探す必要がある
  const contract = contracts.find(
    contract => contract.spaceId === space.id
  );
  const person = contract
    ? people.find(person => person.id === contract.personId)
    : undefined
  // personが見つからない場合でも画面全体の動きを止めないようにしている

  const overdue: YearMonth[] =
    contract && person?.dueRule !== undefined
      ? overdueMonths(contract, fees, person.dueRule, allocations, today)
      : [];
  const prepaid =
    contract && person
      ? prepaidCount(contract, fees, person.dueRule, allocations, today)
      : 0;
  const contractCharges = contract
    ? charges.filter(
      charge => charge.contractId === contract.id
    )
    : [];
  const overdueChargeList =
    contract && person
      ? overdueCharges(contract, contractCharges, person.dueRule, allocations, today)
      : [];
  const cutoff = billingCutoff(today);
  const remainings = contract && person
    ? monthRange(toYearMonth(contract.startDate), lastBillableMonth(today))
      .filter((m) => dueDate(person.dueRule, m) <= cutoff)
      .map((m) => remainingForMonth(contract, fees, allocations, m))
    : [];
  const hasFeeMissing = remainings.some((r) => r === null);
  const hasChargeRemaining =
    contract && person
      ? contractCharges
        .filter((charge) => dueDate(person.dueRule, toYearMonth(charge.date)) <= cutoff)
        .some((charge) => remainingForCharge(charge, allocations) > 0)
      : false;
  const hasRemaining = remainings.some(r => r !== null && r > 0);
  let status: SpaceCellStatus;

  // 上から順に判定する。契約や契約者がないと延滞・前払いを判断できないので、vacant・unknown が先。延滞と前払いが同時にあるときは、先に対応すべき延滞を出す。期限前の未払いは前払いより先
  // 延滞・期限前の未払いには一時金も含む
  if (!contract) {
    status = 'vacant';
  } else if (!person) {
    status = 'unknown';
  } else if (hasFeeMissing) {
    /* remainingForMonthがnullになるとき、請求中の月に料金未登録の月がある */
    /* 料金未登録は延滞より先（こちらの入力ミスなので先に直してもらう） */
    status = 'feeMissing';
  } else if (overdue.length > 0 || overdueChargeList.length > 0) {
    status = 'overdue';
  } else if (hasChargeRemaining || hasRemaining) {
    status = 'due';
  } else if (prepaid > 0) {
    status = 'prepaid';
  } else {
    status = 'paid';
  }
  return { person, status, overdue, overdueChargeList, prepaid };
}

// 延滞している区画の数（月の数ではない）。サイドバーで、対応が必要な区画がいくつあるかを見せるため
export function countOverdueSpaces(lotId: string, spaces: Space[], contracts: Contract[], people: Person[], fees: Fee[], charges: OneTimeCharge[], allocations: Allocation[], today: ISODate): number {
  const lotSpaces = spaces.filter(space => space.lotId === lotId);
  const overdueSpaces = lotSpaces.filter(space =>
    getSpaceStatus(space, contracts, people, fees, charges, allocations, today).status === 'overdue'
  );
  return overdueSpaces.length
}