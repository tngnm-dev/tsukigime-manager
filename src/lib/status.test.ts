import { describe, expect, it } from "vitest";
import type { Allocation, Contract, DueRule, Fee, OneTimeAllocation, OneTimeCharge, Person, RentAllocation, Space, YearMonth } from "../types";
import { getSpaceStatus, countOverdueSpaces } from "./status";

// ===== テスト用データ =====
// 今日は 2026-10-13、全員「前月末までに当月分」のルール
// → 10月分の期限は 9/30（過ぎている）、11月分の期限は 10/31（今月末。まだ）、12月分の期限は 11/30（今月末より後）
// → 今の請求分（期限が今月末まで）は 10月分と11月分。12月分から前払い
const today = "2026-10-13";
const rule: DueRule = { type: "prevMonthEnd" };

function space(id: string): Space {
  return { id, lotId: "lot1", number: id };
}

function person(id: string, dueRule: DueRule = rule): Person {
  return { id, name: `${id}さん`, tel: "000-0000-0000", dueRule };
}

function contract(id: string, spaceId: string, personId: string, startDate: string, paidThroughMonth: YearMonth | null = null): Contract {
  return { id, personId, spaceId, startDate, endDate: null, renewalDate: "2028-01-01", paidThroughMonth };
}

// 金額を省略すると月額と同じ 5,000円
function rent(contractId: string, month: YearMonth, amount = 5000): RentAllocation {
  return { id: `a-${contractId}-${month}`, depositId: "d1", amount, kind: "rent", contractId, month };
}

// 区画ごとに1パターン。全部を同じ配列に入れて、spaceId で正しい契約を拾えるかも確かめる
const people: Person[] = [
  person("p-overdue"), person("p-multi"), person("p-prepaid"), person("p-paid"),
  person("p-due"), person("p-both"), person("p-partial"), person("p-fee-missing"),
];

const contracts: Contract[] = [
  // 人が見つからない契約（p-missing は people にいない）
  contract("c-unknown", "s-unknown", "p-missing", "2026-09-01"),
  // 9月分まで払い済み → 10月分が延滞
  contract("c-overdue", "s-overdue", "p-overdue", "2026-09-01", "2026-09"),
  // 8月開始で一度も払っていない → 8・9・10月分が延滞
  contract("c-multi", "s-multi", "p-multi", "2026-08-01"),
  // 10月開始、10・11・12月分を割り当て済み → 前払い1か月（12月分）
  contract("c-prepaid", "s-prepaid", "p-prepaid", "2026-10-01"),
  // 10月開始、10・11月分（今の請求分）を割り当て済み → 払い済み
  contract("c-paid", "s-paid", "p-paid", "2026-10-01"),
  // 10月開始、10月分だけ割り当て済み → 11月分が期限前の未払い（due）
  contract("c-due", "s-due", "p-due", "2026-10-01"),
  // 9月開始、9月分が未払いなのに 10〜12月分は払い済み → 延滞と前払いが同時
  contract("c-both", "s-both", "p-both", "2026-09-01"),
  // 10月開始、10月分は 3,000円 だけ割り当て済み（月額 5,000円）→ 一部払いなので延滞
  contract("c-partial", "s-partial", "p-partial", "2026-10-01"),
  // 10月開始、料金を登録していない → feeMissing（料金未登録の月は延滞に入れない）
  contract("c-fee-missing", "s-fee-missing", "p-fee-missing", "2026-10-01"),
];

// c-fee-missing 以外の全契約、開始月から月 5,000円（rent() の初期値と同じなので、割り当て1件でちょうど払い済みになる）
const fees: Fee[] = contracts
  .filter((c) => c.id !== "c-fee-missing")
  .map((c) => ({
    id: `f-${c.id}`,
    contractId: c.id,
    startMonth: c.startDate.slice(0, 7),
    amount: 5000,
  }));

const allocations: Allocation[] = [
  rent("c-prepaid", "2026-10"),
  rent("c-prepaid", "2026-11"),
  rent("c-prepaid", "2026-12"),
  rent("c-paid", "2026-10"),
  rent("c-paid", "2026-11"),
  rent("c-due", "2026-10"),
  rent("c-both", "2026-10"),
  rent("c-both", "2026-11"),
  rent("c-both", "2026-12"),
  rent("c-partial", "2026-10", 3000),
];

// 一時金のテストはまだないので空
const charges: OneTimeCharge[] = [];

function statusOf(spaceId: string) {
  return getSpaceStatus(space(spaceId), contracts, people, fees, charges, allocations, today);
}

// ===== テスト =====
describe("getSpaceStatus", () => {
  it("契約がない区画は vacant", () => {
    const result = statusOf("s-vacant");
    expect(result.status).toBe("vacant");
    expect(result.overdue).toEqual([]);
    expect(result.prepaid).toBe(0);
  });

  it("契約はあるが人が見つからない区画は unknown（延滞は判定できないので空）", () => {
    const result = statusOf("s-unknown");
    expect(result.status).toBe("unknown");
    expect(result.overdue).toEqual([]);
  });

  it("今の請求分に料金未登録の月がある区画は feeMissing（延滞より先に出す）", () => {
    const result = statusOf("s-fee-missing");
    expect(result.status).toBe("feeMissing");
    // 料金未登録の月は延滞に入れない（料金を登録すれば、未払いなら延滞になる）
    expect(result.overdue).toEqual([]);
  });

  it("期限を過ぎた未払いの月がある区画は overdue", () => {
    const result = statusOf("s-overdue");
    expect(result.status).toBe("overdue");
    expect(result.overdue).toEqual(["2026-10"]);
  });

  it("延滞が複数月あるときは、古い月から順に全部返す", () => {
    const result = statusOf("s-multi");
    expect(result.status).toBe("overdue");
    expect(result.overdue).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("期限前の未払いの月がある区画は due（前月末ルールの来月分）", () => {
    const result = statusOf("s-due");
    expect(result.status).toBe("due");
    expect(result.overdue).toEqual([]);
    expect(result.prepaid).toBe(0);
  });

  it("期限が今月末より後の月まで払っている区画は prepaid", () => {
    const result = statusOf("s-prepaid");
    expect(result.status).toBe("prepaid");
    expect(result.overdue).toEqual([]);
    expect(result.prepaid).toBe(1);
  });

  it("今の請求分を払い終えていて、前払いがない区画は paid", () => {
    const result = statusOf("s-paid");
    expect(result.status).toBe("paid");
    expect(result.overdue).toEqual([]);
    expect(result.prepaid).toBe(0);
  });

  it("延滞と前払いが同時にあるときは overdue を優先する", () => {
    const result = statusOf("s-both");
    expect(result.status).toBe("overdue");
    expect(result.overdue).toEqual(["2026-09"]);
    expect(result.prepaid).toBe(1);
  });

  it("月額の一部だけ払われた月は延滞として扱う", () => {
    const result = statusOf("s-partial");
    expect(result.status).toBe("overdue");
    expect(result.overdue).toEqual(["2026-10"]);
  });
});

// 「未払いなのに支払済みと出る」不具合の再発防止。毎月27日払い・今日 10/13（10月分の期限前）
describe("getSpaceStatus（当月27日ルール）", () => {
  const rule27: DueRule = { type: "dayOfMonth", day: 27 };
  const p27 = person("p-27", rule27);
  const c27 = contract("c-27", "s-27", "p-27", "2026-10-01");
  const fees27: Fee[] = [{ id: "f-27", contractId: "c-27", startMonth: "2026-10", amount: 5000 }];

  function statusOf27(allocations27: Allocation[], today27: string) {
    return getSpaceStatus(space("s-27"), [c27], [p27], fees27, [], allocations27, today27);
  }

  it("入金がなく、10月分の期限（10/27）前なら due（paid にしない）", () => {
    const result = statusOf27([], "2026-10-13");
    expect(result.status).toBe("due");
    expect(result.overdue).toEqual([]);
  });

  it("10月分を払えば paid（11月分の期限 11/27 は今月末より後なので、まだ請求していない）", () => {
    const result = statusOf27([rent("c-27", "2026-10")], "2026-10-13");
    expect(result.status).toBe("paid");
  });

  it("期限の翌日（10/28）を過ぎても入金がなければ overdue", () => {
    const result = statusOf27([], "2026-10-28");
    expect(result.status).toBe("overdue");
    expect(result.overdue).toEqual(["2026-10"]);
  });

  it("11月分まで払っていれば prepaid", () => {
    const result = statusOf27([rent("c-27", "2026-10"), rent("c-27", "2026-11")], "2026-10-13");
    expect(result.status).toBe("prepaid");
    expect(result.prepaid).toBe(1);
  });
});

describe("countOverdueSpaces", () => {
  const spaces: Space[] = [
    // 延滞区画なし（期限前の未払い・前払い・払い済み）
    { id: "s-paid", lotId: "lot-001", number: "1" },
    { id: "s-prepaid", lotId: "lot-001", number: "2" },
    { id: "s-due", lotId: "lot-001", number: "3" },

    // 延滞区画が3つ
    { id: "s-overdue", lotId: "lot-002", number: "1" },
    { id: "s-multi", lotId: "lot-002", number: "2" },
    { id: "s-both", lotId: "lot-002", number: "3" },

    // 契約なし・人が不明・料金未登録
    { id: "s-vacant", lotId: "lot-003", number: "1" },
    { id: "s-unknown", lotId: "lot-003", number: "2" },
    { id: "s-fee-missing", lotId: "lot-003", number: "3" },
  ];

  function countOf(lotId: string) {
    return countOverdueSpaces(
      lotId, spaces, contracts, people, fees, charges, allocations, today,
    );
  }

  it("延滞区画がない駐車場は0を返す（期限前の未払いは延滞に数えない）", () => {
    expect(countOf("lot-001")).toBe(0);
  });

  it("延滞月数ではなく、延滞している区画数を返す", () => {
    expect(countOf("lot-002")).toBe(3);
  });

  it("未契約・人が不明・料金未登録の区画は数えない（料金未登録は延滞の月があっても feeMissing を優先するため）", () => {
    expect(countOf("lot-003")).toBe(0);
  });

  it("区画がない駐車場は0を返す", () => {
    expect(countOf("lot-missing")).toBe(0);
  });
});

// 一時金（仲介手数料・更新料）も延滞・期限前の未払いに含める
// 期限は発生日の月の家賃と同じ。毎月27日払い・今日 10/13
describe("getSpaceStatus（一時金）", () => {
  const rule27: DueRule = { type: "dayOfMonth", day: 27 };
  const pc = person("p-charge", rule27);
  const todayC = "2026-10-13";

  // 9月開始：仲介手数料（9/1 発生）の期限は 9/27 → 過ぎている
  const cSep = contract("c-sep", "s-charge", "p-charge", "2026-09-01");
  const feesSep: Fee[] = [{ id: "f-sep", contractId: "c-sep", startMonth: "2026-09", amount: 5000 }];
  const brokerageSep: OneTimeCharge = { id: "ch-sep", contractId: "c-sep", kind: "brokerage", amount: 5500, date: "2026-09-01" };
  const rentPaidSep = [rent("c-sep", "2026-09"), rent("c-sep", "2026-10")];

  // 10月開始：仲介手数料（10/1 発生）の期限は 10/27 → まだ
  const cOct = contract("c-oct", "s-charge", "p-charge", "2026-10-01");
  const feesOct: Fee[] = [{ id: "f-oct", contractId: "c-oct", startMonth: "2026-10", amount: 5000 }];
  const brokerageOct: OneTimeCharge = { id: "ch-oct", contractId: "c-oct", kind: "brokerage", amount: 5500, date: "2026-10-01" };
  const rentPaidOct = [rent("c-oct", "2026-10")];

  // 一時金の割り当てを作る
  function pay(chargeId: string, amount: number): OneTimeAllocation {
    return { id: `a-${chargeId}-${amount}`, depositId: "d1", amount, kind: "oneTime", chargeId };
  }

  function statusWith(c: Contract, f: Fee[], ch: OneTimeCharge[], a: Allocation[]) {
    return getSpaceStatus(space("s-charge"), [c], [pc], f, ch, a, todayC);
  }

  it("家賃は払い済みで、仲介手数料だけ期限を過ぎて未払い → overdue", () => {
    const result = statusWith(cSep, feesSep, [brokerageSep], rentPaidSep);
    expect(result.status).toBe("overdue");
    // 延滞の月（家賃）はない。一時金の延滞は月の配列には入らない
    expect(result.overdue).toEqual([]);
  });

  it("仲介手数料が一部だけ払われていても、期限を過ぎていれば overdue", () => {
    const result = statusWith(cSep, feesSep, [brokerageSep], [...rentPaidSep, pay("ch-sep", 3000)]);
    expect(result.status).toBe("overdue");
  });

  it("家賃は払い済みで、仲介手数料だけ期限前で未払い → due", () => {
    const result = statusWith(cOct, feesOct, [brokerageOct], rentPaidOct);
    expect(result.status).toBe("due");
  });

  it("家賃も仲介手数料も払い済み → paid", () => {
    const result = statusWith(cOct, feesOct, [brokerageOct], [...rentPaidOct, pay("ch-oct", 5500)]);
    expect(result.status).toBe("paid");
  });

  it("期限が今月末より後の一時金（来年の更新料）は、未払いでも見ない → paid", () => {
    const renewal: OneTimeCharge = { id: "ch-renewal", contractId: "c-oct", kind: "renewal", amount: 16500, date: "2027-10-01" };
    const result = statusWith(cOct, feesOct, [renewal], rentPaidOct);
    expect(result.status).toBe("paid");
  });

  it("別の契約の一時金は見ない", () => {
    const other: OneTimeCharge = { id: "ch-other", contractId: "c-other", kind: "brokerage", amount: 5500, date: "2026-09-01" };
    const result = statusWith(cOct, feesOct, [other], rentPaidOct);
    expect(result.status).toBe("paid");
  });

  it("仲介手数料だけが延滞している区画も、延滞の区画数に数える", () => {
    const spacesC: Space[] = [{ id: "s-charge", lotId: "lot-c", number: "1" }];
    const count = countOverdueSpaces("lot-c", spacesC, [cSep], [pc], feesSep, [brokerageSep], rentPaidSep, todayC);
    expect(count).toBe(1);
  });
});
