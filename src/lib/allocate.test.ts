import { describe, expect, it } from 'vitest';
import type { Allocation, Contract, Deposit } from '../types';
import type { DueItem } from './dues';
import { allocate, amountsUpTo, depositRemaining, parseAmount } from './allocate';

const contract: Contract = {
  id: 'c1', personId: 'p1', spaceId: 's1',
  startDate: '2026-08-01', endDate: null,
  renewalDate: '2028-08-01', paidThroughMonth: null,
};

function createIdGenerator() {
  let id = 0;
  return () => `a${++id}`;
}

describe('allocate', () => {
  it('ちょうど使い切る場合、最後の1件は一部だけ入りleftoverは0になる', () => {
    const items: DueItem[] = [
      { kind: 'rent', month: '2026-08', remaining: 5000 },
      { kind: 'rent', month: '2026-09', remaining: 5000 },
      { kind: 'rent', month: '2026-10', remaining: 5000 },
    ];

    expect(allocate(7000, 'd1', contract, items, createIdGenerator())).toEqual({
      allocations: [
        { id: 'a1', depositId: 'd1', amount: 5000, kind: 'rent', contractId: 'c1', month: '2026-08' },
        { id: 'a2', depositId: 'd1', amount: 2000, kind: 'rent', contractId: 'c1', month: '2026-09' },
      ],
      leftover: 0,
      stoppedByMissingFee: false,
    });
  });

  it('全部埋めても余る場合、余った金額がleftoverに残る', () => {
    const items: DueItem[] = [
      { kind: 'rent', month: '2026-08', remaining: 5000 },
      { kind: 'rent', month: '2026-09', remaining: 3000 },
    ];

    expect(allocate(10000, 'd1', contract, items, createIdGenerator())).toEqual({
      allocations: [
        { id: 'a1', depositId: 'd1', amount: 5000, kind: 'rent', contractId: 'c1', month: '2026-08' },
        { id: 'a2', depositId: 'd1', amount: 3000, kind: 'rent', contractId: 'c1', month: '2026-09' },
      ],
      leftover: 2000,
      stoppedByMissingFee: false,
    });
  });

  it('お金が残ったままnullに当たると、後続に割り当てずstoppedByMissingFeeがtrueになる', () => {
    const items: DueItem[] = [
      { kind: 'rent', month: '2026-08', remaining: 5000 },
      { kind: 'rent', month: '2026-09', remaining: null },
      { kind: 'rent', month: '2026-10', remaining: 5000 },
    ];

    expect(allocate(7000, 'd1', contract, items, createIdGenerator())).toEqual({
      allocations: [
        { id: 'a1', depositId: 'd1', amount: 5000, kind: 'rent', contractId: 'c1', month: '2026-08' },
      ],
      leftover: 2000,
      stoppedByMissingFee: true,
    });
  });

  it('ちょうど使い切ったところで次がnullでもstoppedByMissingFeeはfalseになる', () => {
    const items: DueItem[] = [
      { kind: 'rent', month: '2026-08', remaining: 5000 },
      { kind: 'rent', month: '2026-09', remaining: null },
    ];

    expect(allocate(5000, 'd1', contract, items, createIdGenerator())).toEqual({
      allocations: [
        { id: 'a1', depositId: 'd1', amount: 5000, kind: 'rent', contractId: 'c1', month: '2026-08' },
      ],
      leftover: 0,
      stoppedByMissingFee: false,
    });
  });

  it('一時金と家賃が混ざっている場合、それぞれ正しいkindと参照先を持つ', () => {
    const items: DueItem[] = [
      { kind: 'oneTime', chargeId: 'charge1', date: '2026-08-01', remaining: 10000 },
      { kind: 'rent', month: '2026-08', remaining: 5000 },
    ];

    expect(allocate(15000, 'd1', contract, items, createIdGenerator())).toEqual({
      allocations: [
        { id: 'a1', depositId: 'd1', amount: 10000, kind: 'oneTime', chargeId: 'charge1' },
        { id: 'a2', depositId: 'd1', amount: 5000, kind: 'rent', contractId: 'c1', month: '2026-08' },
      ],
      leftover: 0,
      stoppedByMissingFee: false,
    });
  });
});

describe('depositRemaining', () => {
  it('すでに一部が割り当て済みの入金は残額を返し、別の入金の割り当ては含めない', () => {
    const deposit: Deposit = {
      id: 'd1', accountId: 'account1', date: '2026-08-01',
      amount: 10000, direction: 'in', payerName: 'タナカ',
      excluded: false, importKey: 'import1',
    };
    const allocations: Allocation[] = [
      { id: 'a1', depositId: 'd1', amount: 3000, kind: 'rent', contractId: 'c1', month: '2026-08' },
      { id: 'a2', depositId: 'd1', amount: 2000, kind: 'oneTime', chargeId: 'charge1' },
      { id: 'a3', depositId: 'd2', amount: 4000, kind: 'rent', contractId: 'c1', month: '2026-09' },
    ];

    expect(depositRemaining(deposit, allocations)).toBe(5000);
  });
});

describe('parseAmount', () => {
  // max は選んだ入金の残り（18,500円）
  const max = 18500;

  it('数字だけの文字列は、その金額になる', () => {
    expect(parseAmount('8000', max)).toBe(8000);
  });

  it('前後の空白は取る', () => {
    expect(parseAmount(' 8000 ', max)).toBe(8000);
  });

  it('全角の数字とカンマ付きは使えない（半角の数字だけ）', () => {
    expect(parseAmount('８０００', max)).toBeNull();
    expect(parseAmount('8,000', max)).toBeNull();
  });

  it('入金の残りちょうどは使える', () => {
    expect(parseAmount('18500', max)).toBe(18500);
  });

  it('入金の残りより大きい金額は使えない', () => {
    expect(parseAmount('18501', max)).toBeNull();
  });

  it('0円と空は使えない', () => {
    expect(parseAmount('0', max)).toBeNull();
    expect(parseAmount('', max)).toBeNull();
    expect(parseAmount('   ', max)).toBeNull();
  });

  it('マイナス・小数・文字は使えない', () => {
    expect(parseAmount('-1', max)).toBeNull();
    expect(parseAmount('8000.5', max)).toBeNull();
    expect(parseAmount('abc', max)).toBeNull();
    expect(parseAmount('8000円', max)).toBeNull();
  });
});

describe('amountsUpTo', () => {
  it('充てる順番のまま、その項目までの合計を返す', () => {
    // 鈴木 B-2 の形：仲介手数料 5,500円 → 10月分 5,000円 → 11月分 5,000円
    const items: DueItem[] = [
      { kind: 'oneTime', chargeId: 'ch1', date: '2026-10-01', remaining: 5500 },
      { kind: 'rent', month: '2026-10', remaining: 5000 },
      { kind: 'rent', month: '2026-11', remaining: 5000 },
    ];

    expect(amountsUpTo(items).map(a => a.total)).toEqual([5500, 10500, 15500]);
  });

  it('一部だけ払われている月は、残りの額で足す', () => {
    const items: DueItem[] = [
      { kind: 'rent', month: '2026-10', remaining: 2500 },
      { kind: 'rent', month: '2026-11', remaining: 5000 },
    ];

    expect(amountsUpTo(items).map(a => a.total)).toEqual([2500, 7500]);
  });

  it('料金未登録の月で止める（allocate もそこで止まるため）', () => {
    const items: DueItem[] = [
      { kind: 'rent', month: '2026-09', remaining: 5000 },
      { kind: 'rent', month: '2026-10', remaining: null },
      { kind: 'rent', month: '2026-11', remaining: 5000 },
    ];

    expect(amountsUpTo(items).map(a => a.total)).toEqual([5000]);
  });

  it('未払いがなければ空', () => {
    expect(amountsUpTo([])).toEqual([]);
  });
});
