import type { Lot, Space, Person, Contract, Fee, Allocation, DueRule, YearMonth, Deposit, AppData, OneTimeCharge } from '../types';

// =====================================================================
// レイアウト確認用のサンプルデータ（人名・住所はすべて架空）
// 今日 = 2026-10-13 に固定。日付が変わっても色分けが変わらないようにするため
//
// 駐車場ごとの想定（サイドバーの2段表示と色分けを一通り確かめられるようにしている）
//   田中   8区画  延滞1（太郎）           ← 延滞あり
//   鈴木   6区画  延滞1（B-2 の新規契約。仲介手数料も未払い）
//   佐藤  12区画  延滞3（会社の3台まとめ借り含む）← 延滞あり・区画多め
//   高橋   5区画  延滞なし・要確認1      ← 人データが見つからない区画
//   伊藤  10区画  延滞3（1・6・10番に散らばる。うち1人は3か月分） ← 延滞あり・延滞が番号順で離れている
//   渡辺   7区画  延滞なし・前払い多め
//   山本   9区画  ほぼ空き
// サイドバーの「延滞あり」は 田中・鈴木・佐藤・伊藤 の4つ（配列の順番のまま）になるはず
// 下の契約のコメントの「払い済み」には、前月末払いで11月分（期限 10/31）が残っている「支払期限前」の区画も含む
// =====================================================================

export const today = '2026-10-13';

// ----- 小さな作成用関数（同じ形のデータを何十件も手で書かないため） -----
const prevMonthEnd: DueRule = { type: 'prevMonthEnd' };
const day27: DueRule = { type: 'dayOfMonth', day: 27 };
const nextMonthEnd: DueRule = { type: 'nextMonthEnd' };

function lot(no: string, name: string, town: string): Lot {
  return { id: `sampleLot${no}`, name, address: `架空県サンプル市${town}` };
}

// 区画番号の一覧から区画を作る（id は駐車場ごとに一意になるよう lotId を含める）
function spacesOf(lotId: string, numbers: string[]): Space[] {
  return numbers.map((number) => ({ id: `${lotId}-${number}`, lotId, number }));
}

// 1〜n の連番
function range(n: number): string[] {
  return Array.from({ length: n }, (_, i) => String(i + 1));
}

function person(no: string, name: string, dueRule: DueRule = prevMonthEnd): Person {
  return { id: `samplePerson${no}`, name, tel: `000-0000-${no.padStart(4, '0')}`, dueRule };
}

// paidThroughMonth = ツール導入前に「何月分まで払い済みか」
//   '2026-10' → 払い済み / '2026-11' 以降 → 前払い / '2026-09' 以前 → 延滞（前月末ルールの場合）
function contract(no: string, spaceId: string, personNo: string, paidThroughMonth: YearMonth | null, startDate = '2026-04-01'): Contract {
  return {
    id: `sampleContract${no}`,
    personId: `samplePerson${personNo}`,
    spaceId,
    startDate,
    endDate: null,
    renewalDate: '2028-04-01',
    paidThroughMonth,
  };
}

// ----- 駐車場 -----
export const sampleLots: Lot[] = [
  lot('01', '田中駐車場', 'テスト町1-2-3'),
  lot('02', '鈴木駐車場', 'ダミー町4-5-6'),
  lot('03', '佐藤駐車場', 'サンプル町7-8-9'),
  lot('04', '高橋駐車場', 'テスト町10-1'),
  lot('05', '伊藤駐車場', 'ダミー町2-22'),
  lot('06', '渡辺駐車場', 'サンプル町3-33'),
  lot('07', '山本駐車場', 'テスト町4-44'),
];

// ----- 区画 -----
export const sampleSpaces: Space[] = [
  ...spacesOf('sampleLot01', range(8)),
  ...spacesOf('sampleLot02', ['A-1', 'A-2', 'A-3', 'B-1', 'B-2', 'B-3']),
  ...spacesOf('sampleLot03', range(12)),
  ...spacesOf('sampleLot04', range(5)),
  ...spacesOf('sampleLot05', range(10)),
  ...spacesOf('sampleLot06', range(7)),
  ...spacesOf('sampleLot07', range(9)),
];

// ----- 人 -----
export const samplePeople: Person[] = [
  person('01', '延滞サンプル太郎（架空）'),
  person('02', '払い済みサンプル花子（架空）'),
  person('03', '前払いサンプル次郎（架空）'),
  person('04', '架空一郎'),
  person('05', '架空二郎', day27),
  person('06', '架空三子'),
  person('07', '架空四郎', nextMonthEnd),
  person('08', '架空五月'),
  person('09', '架空六太'),
  person('10', '架空七海', day27),
  person('11', '株式会社サンプル運輸（架空）'), // 1社で3区画を借りている
  person('12', '架空八重'),
  person('13', '架空九郎'),
  person('14', '架空十和'),
  person('15', '架空百合', nextMonthEnd),
  person('16', '延滞サンプル三月（架空）'),
  person('17', '架空千里'),
  person('18', '架空万作'),
  person('19', '架空一葉', day27),
  person('20', '架空二葉'),
  person('21', '架空三葉'),
  person('22', '架空四葉'),
  person('23', '新規サンプル五郎（架空）'), // 10月に契約したばかりの新規客
];

// ----- 契約 -----
export const sampleContracts: Contract[] = [
  // 田中（8区画）: 1=延滞 / 2〜5=払い済み / 6=前払い / 7・8=空き
  contract('01', 'sampleLot01-1', '01', '2026-09', '2026-09-01'), // 延滞：10月分（元からのサンプル）
  contract('04', 'sampleLot01-2', '04', '2026-10'),
  contract('05', 'sampleLot01-3', '05', '2026-10'),
  contract('06', 'sampleLot01-4', '06', '2026-10'),
  contract('07', 'sampleLot01-5', '07', '2026-10'),
  contract('08', 'sampleLot01-6', '08', '2026-12'), // 前払い2か月

  // 鈴木（6区画）: A-1=払い済み / A-2=前払い（どちらも割り当てで判定） / B-1・B-3=払い済み / 残り空き
  contract('02', 'sampleLot02-A-1', '02', null, '2026-10-01'), // 元からのサンプル
  contract('03', 'sampleLot02-A-2', '03', null, '2026-10-01'), // 元からのサンプル
  contract('09', 'sampleLot02-B-1', '09', '2026-10'),
  contract('10', 'sampleLot02-B-3', '10', '2026-10'),

  // 佐藤（12区画）: 1〜3=会社の3台（まとめて延滞） / 4〜9=払い済み / 10=前払い / 11・12=空き
  contract('11', 'sampleLot03-1', '11', '2026-09'),
  contract('12', 'sampleLot03-2', '11', '2026-09'),
  contract('13', 'sampleLot03-3', '11', '2026-09'),
  contract('14', 'sampleLot03-4', '12', '2026-10'),
  contract('15', 'sampleLot03-5', '13', '2026-10'),
  contract('16', 'sampleLot03-6', '14', '2026-10'),
  contract('17', 'sampleLot03-7', '15', '2026-10'),
  contract('18', 'sampleLot03-8', '17', '2026-10'),
  contract('19', 'sampleLot03-9', '18', '2026-10'),
  contract('20', 'sampleLot03-10', '19', '2026-11'),

  // 高橋（5区画）: 1・2=払い済み / 3=要確認（人が見つからない） / 4・5=空き
  contract('21', 'sampleLot04-1', '20', '2026-10'),
  contract('22', 'sampleLot04-2', '21', '2026-10'),
  contract('23', 'sampleLot04-3', '99', '2026-10'), // samplePerson99 は存在しない

  // 伊藤（10区画）: 1=延滞3か月 / 2=空き / 3〜5=払い済み / 6=延滞1か月 / 7〜9=空き / 10=延滞1か月
  // 延滞が表の上にまとまらず、離れた行に出るときの見え方を確かめるため
  // 料金は契約の並び順で決まる（sampleFees）ので、契約の件数・順番は変えず spaceId だけを付け替えている
  contract('24', 'sampleLot05-1', '16', '2026-07'), // 延滞：8・9・10月分（月額 6,000円）
  contract('25', 'sampleLot05-6', '22', '2026-09'), // 延滞：10月分（月額 7,000円）
  contract('26', 'sampleLot05-3', '04', '2026-10'), // 架空一郎は田中と伊藤で2区画
  contract('27', 'sampleLot05-4', '06', '2026-10'),
  contract('28', 'sampleLot05-5', '09', '2026-10'),
  contract('29', 'sampleLot05-10', '12', '2026-09'), // 延滞：10月分（月額 6,000円）

  // 渡辺（7区画）: 1〜3=前払い / 4〜6=払い済み / 7=空き
  contract('30', 'sampleLot06-1', '13', '2027-03'), // 前払い5か月
  contract('31', 'sampleLot06-2', '14', '2026-11'),
  contract('32', 'sampleLot06-3', '15', '2026-12'),
  contract('33', 'sampleLot06-4', '17', '2026-10'),
  contract('34', 'sampleLot06-5', '18', '2026-10'),
  contract('35', 'sampleLot06-6', '20', '2026-10'),

  // 山本（9区画）: 1=払い済み / 2〜9=空き
  contract('36', 'sampleLot07-1', '21', '2026-10'),

  // 鈴木 B-2：10月に新規契約。仲介手数料と10月分がどちらも未払い（月額 5,000円）
  contract('37', 'sampleLot02-B-2', '23', null, '2026-10-01'),
];

// ----- 料金（契約ごとに1件） -----
// 田中の太郎だけは元のサンプルどおり 10月から値上げ
const feeAmounts = [5000, 5500, 6000, 7000, 8000];
export const sampleFees: Fee[] = [
  { id: 'sampleFee01', contractId: 'sampleContract01', startMonth: '2026-09', amount: 8000 },
  { id: 'sampleFee01b', contractId: 'sampleContract01', startMonth: '2026-10', amount: 9000 },
  ...sampleContracts
    .filter((c) => c.id !== 'sampleContract01')
    .map((c, i) => ({
      id: `sampleFee-${c.id}`,
      contractId: c.id,
      startMonth: c.startDate.slice(0, 7),
      amount: feeAmounts[i % feeAmounts.length],
    })),
];

// ----- 入金の割り当て（元からのサンプル。鈴木 A-1・A-2 はこれで払い済み／前払いになる） -----
export const sampleAllocations: Allocation[] = [
  { id: 'sampleAllocation01', depositId: 'sampleDeposit01', kind: 'rent', contractId: 'sampleContract01', month: '2026-09', amount: 8000 },
  { id: 'sampleAllocation02', depositId: 'sampleDeposit02', kind: 'rent', contractId: 'sampleContract02', month: '2026-10', amount: 10000 },
  { id: 'sampleAllocation03', depositId: 'sampleDeposit03', kind: 'rent', contractId: 'sampleContract03', month: '2026-10', amount: 10000 },
  { id: 'sampleAllocation04', depositId: 'sampleDeposit03', kind: 'rent', contractId: 'sampleContract03', month: '2026-11', amount: 10000 },
];

// ----- 入金（通帳の明細1行 = 1件） -----
// 01〜03 は既存の割り当て（sampleAllocations）が使っている入金
// 04〜10 は未割り当て。入金の割り当てフォームで試す用
function deposit(no: string, date: string, amount: number, payerName: string, excluded = false): Deposit {
  return {
    id: `sampleDeposit${no}`,
    accountId: 'sampleAccount01',
    date,
    amount,
    direction: 'in',
    payerName,
    excluded,
    importKey: `${date}-${amount}-${no}`,
  };
}

export const sampleDeposits: Deposit[] = [
  deposit('01', '2026-08-28', 8000, 'ｴﾝﾀｲｻﾝﾌﾟﾙ ﾀﾛｳ'),
  deposit('02', '2026-09-29', 10000, 'ﾊﾗｲｽﾞﾐｻﾝﾌﾟﾙ ﾊﾅｺ'),
  deposit('03', '2026-09-30', 20000, 'ﾏｴﾊﾞﾗｲｻﾝﾌﾟﾙ ｼﾞﾛｳ'),
  deposit('04', '2026-10-05', 9000, 'ｴﾝﾀｲｻﾝﾌﾟﾙ ﾀﾛｳ'),         // 田中1番・太郎の10月分（9,000円）とぴったり
  deposit('05', '2026-10-08', 18000, 'ﾖｷﾝｷ'),                  // 伊藤1番の8〜10月分（6,000円×3）とぴったり。名義なし
  deposit('06', '2026-10-09', 7000, 'ﾖｷﾝｷ'),                   // 伊藤6番の10月分（7,000円）とぴったり。名義なし
  deposit('07', '2026-10-10', 18500, 'ｶ)ｻﾝﾌﾟﾙｳﾝﾕ'),            // 佐藤1〜3番の会社3台分の合計（8,000＋5,000＋5,500）
  deposit('08', '2026-10-12', 50000, 'ｵｵﾔ ｻﾝﾌﾟﾙ'),             // 月極と無関係な入金（大家さんから）
  deposit('09', '2026-10-12', 10500, 'ｼﾝｷｻﾝﾌﾟﾙ ｺﾞﾛｳ'),          // 鈴木B-2 の仲介手数料（5,500）＋10月分（5,000）とぴったり
  deposit('10', '2026-10-12', 6000, 'ｶｸｳ ﾔｴ'),                 // 伊藤10番・架空八重の10月分（6,000円）とぴったり
];

// ----- 一時金の請求（仲介手数料・更新料） -----
// 仲介手数料 = 契約開始時の月額 × 1.1（四捨五入）。浮動小数点の誤差を避けるため ×11÷10 で計算する
function brokerage(contractNo: string, monthlyFee: number, date: string): OneTimeCharge {
  return {
    id: `sampleCharge-brokerage-${contractNo}`,
    contractId: `sampleContract${contractNo}`,
    kind: 'brokerage',
    amount: Math.round((monthlyFee * 11) / 10),
    date,
  };
}

export const sampleCharges: OneTimeCharge[] = [
  brokerage('37', 5000, '2026-10-01'), // 鈴木B-2：5,500円。入金09 を割り当てると、仲介手数料 → 10月分 の順に入る
];

export const sampleData: AppData = {
  accounts: [],
  lots: sampleLots,
  spaces: sampleSpaces,
  people: samplePeople,
  payerNames: [],
  contracts: sampleContracts,
  fees: sampleFees,
  vehicles: [],
  deposits: sampleDeposits,
  charges: sampleCharges,
  allocations: sampleAllocations,
  contacts: [],
};