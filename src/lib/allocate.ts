import type { Deposit, Allocation, Yen, Contract } from '../types';
import type { DueItem } from './dues';

// 入金を、未払いの請求に先頭から流し込んで、割り当てを作るファイル

export type AllocateResult = {
  allocations: Allocation[];
  leftover: Yen;                 // 余りの扱い（別の区画に回す・前払いにするなど）はユーザーが決めるので、そのまま返す
  stoppedByMissingFee: boolean;  // 料金が未登録の月で止まったか
};

//割り当てから分かるので、保存するとずれるので毎回計算している
export function depositRemaining(deposit: Deposit, allocations: Allocation[]): Yen {
  const total = allocations
    .filter(a => a.depositId === deposit.id)
    .reduce((sum, a) => sum + a.amount, 0);

  return deposit.amount - total
}

export function allocate(amount: Yen, depositId: string, contract: Contract, items: DueItem[], newId: () => string,): AllocateResult {
  let rest = amount;
  let stoppedByMissingFee = false;
  const allocations: Allocation[] = [];

  for (const item of items) {
    //nullより先に置いているのは、使い切ったあとに料金未登録の月があっても止まった扱いにしないため
    if (rest === 0) break

    // 料金が分からない月を飛ばすと、その月が未払いのまま先の月が埋まってしまうので止める
    if (item.remaining === null) {
      stoppedByMissingFee = true
      break
    }

    const pay = Math.min(rest, item.remaining);
    rest = rest - pay;

    // id を作る関数を外から受け取るのは、テストで結果を比べられるようにするため。プレビューではダミーを渡し、確定するときだけ本物のidを作る
    const base = {
      id: newId(),
      depositId,
      amount: pay
    };
    let allocation: Allocation;

    switch (item.kind) {
      case 'rent':
        allocation = {
          ...base,
          kind: 'rent',
          contractId: contract.id,
          month: item.month,
        };
        break;

      case 'oneTime':
        allocation = {
          ...base,
          kind: 'oneTime',
          chargeId: item.chargeId,
        };
        break;
    }
    allocations.push(allocation)
  }
  return { allocations, leftover: rest, stoppedByMissingFee }
}

// AssignFormの金額の入力欄に打たれた文字列を、充てる金額にする。使えない入力なら null
// 入力欄の中身は数字を打っても文字列で届くので、計算に使う直前にここで確かめる
// ふだんは金額のボタンで入れるので、手で打つのはイレギュラーなときだけ。受け付けるのは半角の数字だけ
export function parseAmount(text: string, max: Yen): Yen | null {
  const trimmed = text.trim();

  // 半角の数字だけでなければ使えない
  if (!/^[0-9]+$/.test(trimmed)) return null;

  const amount = Number(trimmed);
  if (amount < 1 || amount > max) return null;
  return amount;
}

// 金額のボタン用。「この項目まで払い終わる」合計額を、充てる順番のまま返す
// 入金は先頭から順に充てるので、1件ずつの額ではなく、それまでの合計がその項目まで払い終わる額になる
// 料金未登録の月ではallocateが止まるので、そこから先は出さない
export function amountsUpTo(items: DueItem[]): { item: DueItem; total: Yen }[] {
  const result: { item: DueItem; total: Yen }[] = [];
  let total = 0;
  for (const item of items) {
    if (item.remaining === null) break;
    total += item.remaining;
    result.push({ item, total });
  }
  return result;
}