import type { DueRule, ISODate, OneTimeCharge, YearMonth } from "../types";
import type { SpaceCellStatus, SpaceStatusResult } from "./status";
import type { DueItem } from "./dues";

// 表示用の文言をまとめたファイル。判定（status.ts など）と見せ方を分けて、文言を変えたいときはここだけ直せばいいようにしている
// 状態や一時金の種類が増えたとき、名前を書き忘れると型エラーになるのでRecordを使用
export const statusLabels: Record<SpaceCellStatus, string> = {
  vacant: '未契約',
  feeMissing: '料金を登録してください',
  overdue: '延滞あり',
  prepaid: '前払い',
  due: '支払期限前',
  paid: '支払済み',
  unknown: '要確認'
};
export const chargeKindLabels: Record<OneTimeCharge['kind'], string> = {
  brokerage: '仲介手数料',
  renewal: '更新料'
};

// 一覧の表のセル用。狭いので「何が」だけを短く出す。金額と期限は詳細パネルで出す
// due（期限前）は支払状況のバッジで分かるので、ここでは何も出さない（「—」）
export function paymentDetail(result: SpaceStatusResult): string {
  switch (result.status) {
    case 'overdue': {
      // 月と一時金を1つの配列に入れてからつなぐ。どちらかが空でも「、」が余らない
      const labels = [
        ...result.overdue.map(shortMonthLabel),
        ...result.overdueChargeList.map((charge) => chargeKindLabels[charge.kind]),
      ];
      return `${labels.join('、')} 未払い`;
    }
    case 'feeMissing':
      return '料金が未登録の月があります';
    case 'prepaid':
      return `${result.prepaid}か月分 前払い`;
    case 'unknown':
      return '契約者情報を確認してください';
    default:
      return '—';
  }
}

// 詳細パネル用。表のセルより広いので、「—」の代わりに文章で伝える
export function paymentDetailLong(result: SpaceStatusResult): string {
  switch (result.status) {
    case 'vacant':
      return 'この区画は未契約です';
    case 'paid':
      return '未払いはありません';
    default:
      return paymentDetail(result);
  }
}


export function formatDueRule(rule: DueRule): string {
  switch (rule.type) {
    case 'prevMonthEnd': return '当月分を前月末までに';
    case 'dayOfMonth': return `当月分を当月${rule.day}日までに`;
    case 'nextMonthEnd': return '当月分を翌月末までに';
    default: {
      // 新しいルールを追加したときの検知用
      const unreachable: never = rule;
      console.error('未対応の支払いルールがあります。format.tsのformatDueRuleを参照', unreachable);
      return '不明（要確認）';
    }
  }
}

// 延滞が1年を超えることはほぼないので、表のセルに収まる短さを優先している
export function convertOverdueMonths(months: YearMonth[]): string {
  return months.map(shortMonthLabel).join("、");
}
// '2026-09' → '9月分'
export function shortMonthLabel(month: YearMonth): string {
  return `${Number(month.slice(5, 7))}月分`;
}
// '2026-10' → '2026年10月分'。先の月まで並べると年をまたぐので、いつも年を付ける
export function formatMonthLabel(month: YearMonth): string {
  return `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月分`;
}
// '2026-09-27' → '9/27'。区画詳細の期限の表示用（今月末までの期限しか出さないので年は省く）
export function shortDateLabel(date: ISODate): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}
// 未払いの項目の名前。家賃は '2026年9月分'、一時金は '仲介手数料' など
export function dueItemLabel(item: DueItem, charges: OneTimeCharge[]): string {
  if (item.kind === 'rent') return formatMonthLabel(item.month);
  const charge = charges.find((c) => c.id === item.chargeId);
  return charge ? chargeKindLabels[charge.kind] : '一時金';
}
