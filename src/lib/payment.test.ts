import { describe, expect, it, test } from "vitest";
import type { Allocation, Contract, Fee, OneTimeAllocation, OneTimeCharge, RentAllocation, YearMonth, DueRule } from "../types";
import { paidMonths, dueDate, overdueMonths, overdueCharges, prepaidCount, billedUnpaidItems, currentUnpaidItems, prepayUnpaidItems, billingCutoff, lastBillableMonth } from "./payment";
import { allocate } from "./allocate";

// ===== テスト用データ =====
// 基本の契約
const baseContract: Contract = {
  id: "c1",
  personId: "p1",
  spaceId: "s1",
  startDate: "2026-08-01",
  endDate: null,
  renewalDate: "2027-08-01",
  paidThroughMonth: null,
};
// baseContract（c1）の料金。rent() の初期値と同じ 5,000円 にして、割り当て1件でちょうど払い済みになるようにする
const fees: Fee[] = [
  { id: "f1", contractId: baseContract.id, startMonth: "2026-08", amount: 5000 },
];
// 基本のルール
const rulePrevMonth: DueRule = {
  type: 'prevMonthEnd'
};
const ruleThisMonth: DueRule = {
  type: 'dayOfMonth',
  day: 27,
};
const ruleNextMonth: DueRule = {
  type: 'nextMonthEnd'
};
const ruleThisMonthDay5: DueRule = {
  type: 'dayOfMonth',
  day: 5,
};
const ruleThisMonthDay30: DueRule = {
  type: 'dayOfMonth',
  day: 30,
};
const ruleThisMonthDay15: DueRule = {
  type: 'dayOfMonth',
  day: 15,
};

// 家賃の割り当てを作る（金額を省略すると月額と同じ 5,000円）
function rent(contractId: string, month: YearMonth, amount = 5000): RentAllocation {
  return {
    id: `a-${contractId}-${month}-${amount}`,
    depositId: "d1",
    amount,
    kind: "rent",
    contractId,
    month,
  };
}

// 一時金（仲介手数料・更新料）の割り当てを作る（month を持たない）
function oneTime(chargeId: string): OneTimeAllocation {
  return {
    id: `a-${chargeId}`,
    depositId: "d1",
    amount: 10000,
    kind: "oneTime",
    chargeId,
  };
}

// ===== テスト =====

describe("paidMonths", () => {
  describe("paidThroughMonth（移行時点の支払済み月）", () => {
    it("開始月から paidThroughMonth までを返す", () => {
      const contract: Contract = { ...baseContract, paidThroughMonth: "2026-10" };

      const result = paidMonths(contract, fees, []);

      expect(result).toEqual(new Set(["2026-08", "2026-09", "2026-10"]));
    });

    it("開始日が月の途中でも、その月から含める", () => {
      const contract: Contract = {
        ...baseContract,
        startDate: "2026-08-15",
        paidThroughMonth: "2026-09",
      };

      const result = paidMonths(contract, fees, []);

      expect(result).toEqual(new Set(["2026-08", "2026-09"]));
    });

    it("paidThroughMonth が null で割り当てもなければ空になる", () => {
      const result = paidMonths(baseContract, fees, []);

      expect(result).toEqual(new Set());
    });
  });

  describe("allocations（入金の割り当て）", () => {
    it("rent の割り当ての月が入る", () => {
      const allocations = [rent("c1", "2026-08"), rent("c1", "2026-09")];

      const result = paidMonths(baseContract, fees, allocations);

      expect(result).toEqual(new Set(["2026-08", "2026-09"]));
    });

    it("別の契約の割り当ては入らない", () => {
      const allocations = [rent("c1", "2026-08"), rent("c2", "2026-09")];

      const result = paidMonths(baseContract, fees, allocations);

      expect(result).toEqual(new Set(["2026-08"]));
    });

    it("一時金の割り当ては入らない", () => {
      const allocations: Allocation[] = [
        oneTime("ch1"),
        rent("c1", "2026-08"),
      ];

      const result = paidMonths(baseContract, fees, allocations);

      expect(result).toEqual(new Set(["2026-08"]));
    });

    it("2回に分けて払った月も、合計が月額に届けば1つの月として入る", () => {
      const allocations = [rent("c1", "2026-08", 2000), rent("c1", "2026-08", 3000)];

      const result = paidMonths(baseContract, fees, allocations);

      expect(result).toEqual(new Set(["2026-08"]));
    });

    it("一部だけ払われた月は入らない", () => {
      const allocations = [rent("c1", "2026-08"), rent("c1", "2026-09", 3000)];

      const result = paidMonths(baseContract, fees, allocations);

      expect(result).toEqual(new Set(["2026-08"]));
    });

    it("月額より多く割り当てられた月も払い済みとして入る", () => {
      const allocations = [rent("c1", "2026-08", 6000)];

      const result = paidMonths(baseContract, fees, allocations);

      expect(result).toEqual(new Set(["2026-08"]));
    });

    it("料金が未登録の月は、割り当てがあっても入らない", () => {
      const allocations = [rent("c1", "2026-08")];

      const result = paidMonths(baseContract, [], allocations);

      expect(result).toEqual(new Set());
    });
  });

  it("paidThroughMonth と割り当ての両方を合わせて返す", () => {
    const contract: Contract = { ...baseContract, paidThroughMonth: "2026-09" };
    const allocations = [rent("c1", "2026-09"), rent("c1", "2026-10")];

    const result = paidMonths(contract, fees, allocations);

    expect(result).toEqual(new Set(["2026-08", "2026-09", "2026-10"]));
  });
});


test("支払い日の計算", () => {
  expect(dueDate(rulePrevMonth, '2026-08')).toBe("2026-07-31");
  expect(dueDate(rulePrevMonth, '2027-01')).toBe("2026-12-31");
  expect(dueDate(ruleThisMonth, '2026-08')).toBe("2026-08-27");
  expect(dueDate(ruleThisMonthDay5, '2026-02')).toBe("2026-02-05");
  expect(dueDate(ruleThisMonthDay30, '2026-02')).toBe("2026-02-28");
  expect(dueDate(ruleNextMonth, '2026-11')).toBe("2026-12-31");
  expect(dueDate(ruleNextMonth, '2026-12')).toBe("2027-01-31");
  expect(dueDate(ruleNextMonth, '2027-01')).toBe("2027-02-28");
  expect(dueDate(ruleNextMonth, '2028-01')).toBe("2028-02-29");
});

describe("overdueMonths", () => {
  it("期限を過ぎた未払いの月が入り、まだ期限が来ていない月は入らない", () => {
    // 翌月末ルール: 8月分の期限は 9/30（過ぎた）、9月分は 10/31（まだ）
    const result = overdueMonths(baseContract, fees, ruleNextMonth, [], "2026-10-15");

    expect(result).toEqual(["2026-08"]);
  });

  it("一部だけ払われた月は延滞のまま", () => {
    const allocations = [rent("c1", "2026-08", 3000)];

    const result = overdueMonths(baseContract, fees, ruleNextMonth, allocations, "2026-10-15");

    expect(result).toEqual(["2026-08"]);
  });

  it("すべて支払い済みなら空になる", () => {
    const allocations = [rent("c1", "2026-08")];

    const result = overdueMonths(baseContract, fees, ruleNextMonth, allocations, "2026-10-15");

    expect(result).toEqual([]);
  });

  it("期限当日はまだ延滞にならない", () => {
    // 当月15日ルール: 10月分の期限は今日（10/15）
    const result = overdueMonths(baseContract, fees, ruleThisMonthDay15, [], "2026-10-15");

    expect(result).toEqual(["2026-08", "2026-09"]);
  });

  it("期限の翌日から延滞になる", () => {
    const result = overdueMonths(baseContract, fees, ruleThisMonthDay15, [], "2026-10-16");

    expect(result).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("前月末ルールでは、来月分の期限が今月末に来る", () => {
    // 10月まで支払い済み。今日 11/1 → 11月分（期限 10/31）が延滞
    const contract: Contract = { ...baseContract, paidThroughMonth: "2026-10" };

    const result = overdueMonths(contract, fees, rulePrevMonth, [], "2026-11-01");

    expect(result).toEqual(["2026-11"]);
  });

  it("契約終了後の月は入らない", () => {
    const contract: Contract = { ...baseContract, endDate: "2026-08-31" };

    const result = overdueMonths(contract, fees, ruleNextMonth, [], "2026-12-15");

    expect(result).toEqual(["2026-08"]);
  });

  // 割り当ての有無ではなく、その月の残り（remainingForMonth）で判定する
  // 今日 10/15、当月27日ルール: 8月分の期限 8/27・9月分 9/27 は過ぎた、10月分 10/27 はまだ
  it("0円の月は、割り当てがなくても延滞にならない", () => {
    // 9月だけ 0円（諸事情で未使用）。8月は未払い
    const feesWithZero: Fee[] = [
      { id: "f1", contractId: "c1", startMonth: "2026-08", amount: 5000 },
      { id: "f2", contractId: "c1", startMonth: "2026-09", amount: 0 },
      { id: "f3", contractId: "c1", startMonth: "2026-10", amount: 5000 },
    ];

    const result = overdueMonths(baseContract, feesWithZero, ruleThisMonth, [], "2026-10-15");

    expect(result).toEqual(["2026-08"]);
  });

  it("料金未登録の月は延滞にしない（feeMissing として別に扱う）", () => {
    // 料金は9月からしか登録されていない → 8月は料金未登録（null）。9月は未払い
    const feesFromSep: Fee[] = [
      { id: "f1", contractId: "c1", startMonth: "2026-09", amount: 5000 },
    ];

    const result = overdueMonths(baseContract, feesFromSep, ruleThisMonth, [], "2026-10-15");

    expect(result).toEqual(["2026-09"]);
  });
});

describe("prepaidCount", () => {
  // 前払い = 期限が今月末より後の月で、払い済みの月。期限が今月末までの月は「今の請求分」なので数えない
  describe("当月27日ルール（今日 10/15 → 10月分の期限 10/27 は今の請求分、11月分 11/27 から前払い）", () => {
    it("期限が今月末より後の支払い済みの月を数える（今月分は数えない）", () => {
      const allocations = [rent("c1", "2026-10"), rent("c1", "2026-11"), rent("c1", "2026-12")];

      const result = prepaidCount(baseContract, fees, ruleThisMonth, allocations, "2026-10-15");

      expect(result).toBe(2);
    });

    it("過去と今月の分しかなければ 0", () => {
      const allocations = [rent("c1", "2026-08"), rent("c1", "2026-09"), rent("c1", "2026-10")];

      const result = prepaidCount(baseContract, fees, ruleThisMonth, allocations, "2026-10-15");

      expect(result).toBe(0);
    });

    it("paidThroughMonth による支払い済みも数える", () => {
      const contract: Contract = { ...baseContract, paidThroughMonth: "2026-12" };

      const result = prepaidCount(contract, fees, ruleThisMonth, [], "2026-10-15");

      expect(result).toBe(2);
    });

    it("支払いがなければ 0", () => {
      const result = prepaidCount(baseContract, fees, ruleThisMonth, [], "2026-10-15");

      expect(result).toBe(0);
    });
  });

  it("前月末ルールでは、来月分（期限が今月末ちょうど）は前払いに数えない", () => {
    // 今日 10/15: 11月分の期限 10/31 = 今月末 → 今の請求分。12月分の期限 11/30 → 前払い
    const allocations = [rent("c1", "2026-10"), rent("c1", "2026-11"), rent("c1", "2026-12")];

    const result = prepaidCount(baseContract, fees, rulePrevMonth, allocations, "2026-10-15");

    expect(result).toBe(1);
  });

  it("翌月末ルールでは、今月分（期限が来月末）も前払いに数える", () => {
    // 今日 10/15: 9月分の期限 10/31 → 今の請求分。10月分の期限 11/30 → 前払い
    const allocations = [rent("c1", "2026-09"), rent("c1", "2026-10")];

    const result = prepaidCount(baseContract, fees, ruleNextMonth, allocations, "2026-10-15");

    expect(result).toBe(1);
  });
});

describe("overdueCharges", () => {
  // 期限は発生日の月の家賃と同じ。当月27日ルールなら、8/1 発生の仲介手数料の期限は 8/27
  // 仲介手数料（8/1 発生、5,500円）と、更新料（2027-08-01 発生、まだ先）
  const brokerage: OneTimeCharge = { id: "ch1", contractId: "c1", kind: "brokerage", amount: 5500, date: "2026-08-01" };
  const renewal: OneTimeCharge = { id: "ch2", contractId: "c1", kind: "renewal", amount: 16500, date: "2027-08-01" };
  const otherContract: OneTimeCharge = { id: "ch3", contractId: "c2", kind: "brokerage", amount: 5500, date: "2026-08-01" };

  // 一時金の割り当てを作る
  function pay(chargeId: string, amount: number): OneTimeAllocation {
    return { id: `a-${chargeId}-${amount}`, depositId: "d1", amount, kind: "oneTime", chargeId };
  }

  it("期限を過ぎて残りがある一時金を返す。期限が先のものは入らない", () => {
    const result = overdueCharges(baseContract, [brokerage, renewal], ruleThisMonth, [], "2026-10-15");

    expect(result).toEqual([brokerage]);
  });

  it("期限当日はまだ延滞にならない", () => {
    const result = overdueCharges(baseContract, [brokerage], ruleThisMonth, [], "2026-08-27");

    expect(result).toEqual([]);
  });

  it("期限の翌日から延滞になる", () => {
    const result = overdueCharges(baseContract, [brokerage], ruleThisMonth, [], "2026-08-28");

    expect(result).toEqual([brokerage]);
  });

  it("全額払われていれば入らない", () => {
    const result = overdueCharges(baseContract, [brokerage], ruleThisMonth, [pay("ch1", 5500)], "2026-10-15");

    expect(result).toEqual([]);
  });

  it("一部だけ払われていれば延滞のまま", () => {
    const result = overdueCharges(baseContract, [brokerage], ruleThisMonth, [pay("ch1", 3000)], "2026-10-15");

    expect(result).toEqual([brokerage]);
  });

  it("別の契約の一時金は入らない", () => {
    const result = overdueCharges(baseContract, [brokerage, otherContract], ruleThisMonth, [], "2026-10-15");

    expect(result).toEqual([brokerage]);
  });

  it("前月末ルールでは、発生した月の前月末が期限になる", () => {
    // 8月分の期限は 7/31 → 8/1 発生の仲介手数料は、発生した時点ですでに期限を過ぎている
    const result = overdueCharges(baseContract, [brokerage], rulePrevMonth, [], "2026-08-01");

    expect(result).toEqual([brokerage]);
  });
});

describe("billedUnpaidItems", () => {
  // 今日 10/13、当月27日ルール、8月開始（baseContract）
  // 今の請求分は期限が 10/31 までのもの → 8月分(8/27)・9月分(9/27)・10月分(10/27)。11月分(11/27)は入らない
  const today = "2026-10-13";
  const brokerage: OneTimeCharge = { id: "ch1", contractId: "c1", kind: "brokerage", amount: 5500, date: "2026-08-01" };

  it("今の請求分の未払いを、期限の早い順に、延滞かどうかを付けて返す", () => {
    // 8月分・9月分は払い済み、10月分は 3,000円だけ。仲介手数料は未払い
    const allocations = [rent("c1", "2026-08"), rent("c1", "2026-09"), rent("c1", "2026-10", 3000)];

    const result = billedUnpaidItems(baseContract, [brokerage], fees, ruleThisMonth, allocations, today);

    expect(result).toEqual([
      { kind: "oneTime", chargeId: "ch1", date: "2026-08-01", remaining: 5500, dueDate: "2026-08-27", isOverdue: true },
      { kind: "rent", month: "2026-10", remaining: 2000, dueDate: "2026-10-27", isOverdue: false },
    ]);
  });

  it("全部払われていれば空", () => {
    const allocations = [rent("c1", "2026-08"), rent("c1", "2026-09"), rent("c1", "2026-10")];

    const result = billedUnpaidItems(baseContract, [], fees, ruleThisMonth, allocations, today);

    expect(result).toEqual([]);
  });

  it("料金未登録の月は remaining: null で入る。期限を過ぎていても延滞にはしない", () => {
    // 料金は9月からしか登録されていない → 8月は料金未登録
    const feesFromSep: Fee[] = [{ id: "f1", contractId: "c1", startMonth: "2026-09", amount: 5000 }];
    const allocations = [rent("c1", "2026-09"), rent("c1", "2026-10")];

    const result = billedUnpaidItems(baseContract, [], feesFromSep, ruleThisMonth, allocations, today);

    expect(result).toEqual([
      { kind: "rent", month: "2026-08", remaining: null, dueDate: "2026-08-27", isOverdue: false },
    ]);
  });

  it("前月末ルールでは、期限が今月末の来月分も入る", () => {
    // 10月分まで払い済み。11月分の期限は 10/31 → 今の請求分
    const contract: Contract = { ...baseContract, paidThroughMonth: "2026-10" };

    const result = billedUnpaidItems(contract, [], fees, rulePrevMonth, [], today);

    expect(result).toEqual([
      { kind: "rent", month: "2026-11", remaining: 5000, dueDate: "2026-10-31", isOverdue: false },
    ]);
  });
});

test("今の請求分の線引き（今月末）と、探す範囲の最後の月（来月）", () => {
  expect(billingCutoff("2026-10-13")).toBe("2026-10-31");
  expect(billingCutoff("2026-02-01")).toBe("2026-02-28");
  expect(lastBillableMonth("2026-10-13")).toBe("2026-11");
  expect(lastBillableMonth("2026-12-31")).toBe("2027-01");
});

describe("currentUnpaidItems", () => {
  // 入金の割り当てで、チェックなしのときに充てる範囲。期限が今月末（10/31）までの未払いを、充てる順番（一時金 → 古い月）のまま返す
  // 今日 10/13、9月分まで払い済み（paidThroughMonth）
  const today = "2026-10-13";
  const contract: Contract = { ...baseContract, paidThroughMonth: "2026-09" };

  it("前月末払いでは、来月分（期限が今月末の 10/31）も入る", () => {
    const result = currentUnpaidItems(contract, [], fees, rulePrevMonth, [], today);

    expect(result).toEqual([
      { kind: "rent", month: "2026-10", remaining: 5000 },
      { kind: "rent", month: "2026-11", remaining: 5000 },
    ]);
  });

  it("27日払いでは、来月分（期限 11/27）は入らない", () => {
    const result = currentUnpaidItems(contract, [], fees, ruleThisMonth, [], today);

    expect(result).toEqual([
      { kind: "rent", month: "2026-10", remaining: 5000 },
    ]);
  });

  it("並べ替えずに、一時金を先に返す（期限が月より後の一時金でも先）", () => {
    // 8月分まで払い済み → 9月分（期限 9/27）が未払い。仲介手数料は 10/1 発生（期限 10/27）
    // 期限順なら 9月分が先だが、充てる順番は一時金が先
    const contractAug: Contract = { ...baseContract, paidThroughMonth: "2026-08" };
    const charge: OneTimeCharge = { id: "ch1", contractId: "c1", kind: "brokerage", amount: 5500, date: "2026-10-01" };

    const result = currentUnpaidItems(contractAug, [charge], fees, ruleThisMonth, [], today);

    expect(result).toEqual([
      { kind: "oneTime", chargeId: "ch1", date: "2026-10-01", remaining: 5500 },
      { kind: "rent", month: "2026-09", remaining: 5000 },
      { kind: "rent", month: "2026-10", remaining: 5000 },
    ]);
  });

  it("期限が今月末より後の一時金（来年の更新料）は入らない", () => {
    const renewal: OneTimeCharge = { id: "ch2", contractId: "c1", kind: "renewal", amount: 16500, date: "2027-08-01" };

    const result = currentUnpaidItems(contract, [renewal], fees, ruleThisMonth, [], today);

    expect(result).toEqual([
      { kind: "rent", month: "2026-10", remaining: 5000 },
    ]);
  });
});

describe("prepayUnpaidItems", () => {
  // 前払いのチェックを入れたときの範囲。今の請求分を先に、そのあと先の月の家賃だけ（将来の一時金は入れない）
  // 今日 10/13、9月分まで払い済み（paidThroughMonth）
  const today = "2026-10-13";
  const contract: Contract = { ...baseContract, paidThroughMonth: "2026-09" };
  const renewal2028: OneTimeCharge = { id: "ch-2028", contractId: "c1", kind: "renewal", amount: 10000, date: "2028-10-01" };
  const renewal2027: OneTimeCharge = { id: "ch-2027", contractId: "c1", kind: "renewal", amount: 10000, date: "2027-06-01" };

  // 結果を「月 か 一時金のid」の並びにして、順番を見やすくする
  function order(items: ReturnType<typeof prepayUnpaidItems>) {
    return items.map((item) => (item.kind === "rent" ? item.month : item.chargeId));
  }

  it("遠い将来の更新料は入らず、今月の家賃が先頭になる", () => {
    const result = prepayUnpaidItems(contract, [renewal2028], fees, ruleThisMonth, [], today, 2);

    expect(order(result)).toEqual(["2026-10", "2026-11", "2026-12"]);
  });

  it("範囲内（8か月後）の更新料も入れない", () => {
    const result = prepayUnpaidItems(contract, [renewal2027], fees, ruleThisMonth, [], today, 12);

    expect(result.some((item) => item.kind === "oneTime")).toBe(false);
  });

  it("今の請求分の一時金は、今まで通り家賃より先", () => {
    // 10/1 発生の仲介手数料（期限 10/27）は今の請求分
    const brokerage: OneTimeCharge = { id: "ch-now", contractId: "c1", kind: "brokerage", amount: 5500, date: "2026-10-01" };

    const result = prepayUnpaidItems(contract, [brokerage, renewal2028], fees, ruleThisMonth, [], today, 1);

    expect(order(result)).toEqual(["ch-now", "2026-10", "2026-11"]);
  });

  it("前月末払いでは、来月分は今の請求分として先に入り、そのあと先の月が続く", () => {
    // 10月分まで払い済み。11月分（期限 10/31）は今の請求分、12月分（11/30）・1月分（12/31）は前払い
    const paidOct: Contract = { ...baseContract, paidThroughMonth: "2026-10" };

    const result = prepayUnpaidItems(paidOct, [], fees, rulePrevMonth, [], today, 3);

    expect(order(result)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("先の月の家賃は limitMonths か月先まで", () => {
    const result = prepayUnpaidItems(contract, [], fees, ruleThisMonth, [], today, 2);

    expect(order(result)).toEqual(["2026-10", "2026-11", "2026-12"]);
  });

  it("再現条件：5,000円の入金は、2028年の更新料ではなく今月の家賃に入る", () => {
    const items = prepayUnpaidItems(contract, [renewal2028], fees, ruleThisMonth, [], today, 12);

    const result = allocate(5000, "d1", contract, items, () => "new");

    expect(result.allocations).toEqual([
      { id: "new", depositId: "d1", amount: 5000, kind: "rent", contractId: "c1", month: "2026-10" },
    ]);
    expect(result.leftover).toBe(0);
  });
});
