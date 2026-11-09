import { describe, expect, it } from 'vitest';
import type { Allocation, Contract, Fee, OneTimeCharge } from '../types';
import { unpaidItems } from './dues';

const contract: Contract = {
  id: 'c1',
  personId: 'p1',
  spaceId: 's1',
  startDate: '2026-08-01',
  endDate: null,
  renewalDate: '2028-08-01',
  paidThroughMonth: null,
};

const fees: Fee[] = [
  { id: 'f1', contractId: 'c1', startMonth: '2026-08', amount: 5000 },
];

const charge: OneTimeCharge = {
  id: 'charge1',
  contractId: 'c1',
  kind: 'brokerage',
  amount: 10000,
  date: '2026-08-01',
};

describe('unpaidItems', () => {
  it('一時金の一部だけが払われている場合、残りの金額で入る', () => {
    const allocations: Allocation[] = [
      { id: 'a1', depositId: 'd1', kind: 'oneTime', chargeId: charge.id, amount: 4000 },
    ];

    const result = unpaidItems(
      { ...contract, paidThroughMonth: '2026-08' }, [charge], fees, allocations, '2026-08',
    );

    expect(result).toEqual([
      { kind: 'oneTime', chargeId: 'charge1', date: '2026-08-01', remaining: 6000 },
    ]);
  });

  it('一時金が全額払われている場合、入らない', () => {
    const allocations: Allocation[] = [
      { id: 'a1', depositId: 'd1', kind: 'oneTime', chargeId: charge.id, amount: 10000 },
    ];

    const result = unpaidItems(
      { ...contract, paidThroughMonth: '2026-08' }, [charge], fees, allocations, '2026-08',
    );

    expect(result).toEqual([]);
  });

  it('一時金が2件ある場合、dateの古い順に並ぶ', () => {
    const laterCharge: OneTimeCharge = {
      ...charge, id: 'charge2', kind: 'renewal', date: '2026-10-01',
    };

    const result = unpaidItems(
      { ...contract, paidThroughMonth: '2026-10' },
      [laterCharge, charge], fees, [], '2026-10',
    );

    expect(result).toEqual([
      { kind: 'oneTime', chargeId: 'charge1', date: '2026-08-01', remaining: 10000 },
      { kind: 'oneTime', chargeId: 'charge2', date: '2026-10-01', remaining: 10000 },
    ]);
  });

  it('paidThroughMonthまでの月は入らない', () => {
    const result = unpaidItems(
      { ...contract, paidThroughMonth: '2026-09' }, [], fees, [], '2026-10',
    );

    expect(result).toEqual([
      { kind: 'rent', month: '2026-10', remaining: 5000 },
    ]);
  });

  it('家賃が一部だけ払われている月は、残りの金額で入る', () => {
    const allocations: Allocation[] = [
      { id: 'a1', depositId: 'd1', kind: 'rent', contractId: 'c1', month: '2026-08', amount: 2000 },
    ];

    const result = unpaidItems(contract, [], fees, allocations, '2026-08');

    expect(result).toEqual([
      { kind: 'rent', month: '2026-08', remaining: 3000 },
    ]);
  });

  it('一時金と家賃が両方ある場合、家賃より日付が新しくても一時金が先に並ぶ', () => {
    const laterCharge: OneTimeCharge = { ...charge, date: '2026-08-15' };

    const result = unpaidItems(contract, [laterCharge], fees, [], '2026-08');

    expect(result).toEqual([
      { kind: 'oneTime', chargeId: 'charge1', date: '2026-08-15', remaining: 10000 },
      { kind: 'rent', month: '2026-08', remaining: 5000 },
    ]);
  });

  it('料金が未登録の月はremaining: nullで残る', () => {
    const result = unpaidItems(contract, [], [], [], '2026-08');

    expect(result).toEqual([
      { kind: 'rent', month: '2026-08', remaining: null },
    ]);
  });
});
