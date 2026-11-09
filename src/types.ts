// 基本の型
// 日付と月は文字列で持つ（JSONにそのまま保存でき、比較も文字列のままでできる）
// 中身はどちらもstringなので取り違えても型エラーにならない。それでも名前を分けて、読んで区別できるようにしている
export type ISODate = string;   // '2026-10-02'
export type YearMonth = string; // '2026-10'
export type Yen = number;       // 円なので整数。日割りや仲介手数料も、計算したら整数に丸める

// アカウント関連
export type BankType = 'bankA' | 'bankB'; // CSVパーサの切り替えに使うが、github公開verではCSV取り込みは未実装。公開用に銀行名は伏せている

export type Account = {
  id: string;
  bank: BankType;
  label: string; // '〇〇信金 本店 普通' など
};

// 駐車場
export type Lot = {
  id: string;
  name: string;    // '〇〇駐車場'
  address: string; // '埼玉県 A市 B町 123-45'など
};
// 区画
export type Space = {
  id: string;
  lotId: string;
  number: string; // 連番で生成するが、'A-1' のような番号にも備えてstringに
};

// 人と契約
// 支払日のルール
export type DueRule =
  | { type: 'prevMonthEnd' }              // 前月末までに当月分
  | { type: 'dayOfMonth'; day: number }   // 当月◯日まで
  | { type: 'nextMonthEnd' };             // 翌月末まで

export type Person = {
  id: string;
  name: string;
  tel: string;
  dueRule: DueRule;
};

export type PayerName = {
  id: string;
  name: string;            // 明細上の振込名義（カナ）
  personId: string | null; // nullは月極と無関係な名義で使用 → 次回突合から自動で対象外
};

export type Contract = {
  id: string;
  personId: string;
  spaceId: string;
  startDate: ISODate;
  endDate: ISODate | null;                // null = 継続中
  renewalDate: ISODate;                   // 次の更新日。更新料の請求を作る目安
  paidThroughMonth: YearMonth | null;     // このツールを導入前に、何年何月まで払っていたのか。nullは導入後に契約した人
};

// 契約者ごとの料金履歴。Contractに持たせていないのは、値上げしても過去の月の料金が変わらないようにするため
export type Fee = {
  id: string;
  contractId: string;
  startMonth: YearMonth; // この月からこの金額
  amount: Yen;
};

// 契約者の車両情報。現状、使用や用意していないが今後使う可能性があるため、型だけ用意
export type Vehicle = {
  id: string;
  contractId: string;
  plate: string;
  model: string;
};

// 入金
export type Deposit = {
  id: string;
  accountId: string;
  date: ISODate;
  amount: Yen;
  direction: 'in' | 'out';
  payerName: string;
  excluded: boolean; // 月極と関係ない入金として、ユーザーが対象外にしたもの。人の判断は計算で出せないので保存する
  importKey: string; // 同じCSVを二度取り込んだときの重複検出用
};
// 一時金の請求
export type OneTimeCharge = {
  id: string;
  contractId: string;
  kind: 'brokerage' | 'renewal';   // 仲介手数料 / 更新料
  amount: Yen;                     // 仲介手数料は契約したときの月額 × 1.1 だが、あとで値上げされても変わらないように計算せずに保存
  date: ISODate;                   // 発生日（契約開始日・更新日）
};

// 割り当て
// 入金の中に「何に使ったか」を持たせないのは、1件の入金を複数の請求に分けたり、1つの請求を複数の入金で払ったりできるようにするため
// 前者は仲介手数料+日割り月極。後者は金額が足りずに後日入金が確認されたパターンなど(ex 9000に対して7000+2000)
type AllocationBase = {
  id: string;
  depositId: string;
  amount: Yen;
};
// oneTime が contractId ではなく chargeId を持つのは、同じ契約に一時金（2年ごとの更新料など）が何件あっても、どれに払ったかを1つに決めるため
export type Allocation =
  | (AllocationBase & { kind: 'rent'; contractId: string; month: YearMonth })  // 駐車場の賃料
  | (AllocationBase & { kind: 'oneTime'; chargeId: string })                   // 一時金
  | (AllocationBase & { kind: 'other'; personId: string });                    // その他

export type AllocationKind = Allocation['kind'];
export type RentAllocation = Extract<Allocation, { kind: 'rent' }>;
export type OneTimeAllocation = Extract<Allocation, { kind: 'oneTime' }>;

export type Contact = {
  id: string;
  personId: string;
  date: ISODate;
  method: 'tel' | 'visit' | 'other';
  note: string;
};

// 全体（dataSource が読み書きする形）
export type AppData = {
  accounts: Account[];
  lots: Lot[];
  spaces: Space[];
  people: Person[];
  payerNames: PayerName[];
  contracts: Contract[];
  fees: Fee[];
  vehicles: Vehicle[];
  deposits: Deposit[];
  charges: OneTimeCharge[];
  allocations: Allocation[];
  contacts: Contact[];
};
