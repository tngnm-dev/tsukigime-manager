import type { ISODate, YearMonth } from '../types';
// Date を使うと、タイムゾーンで日付がずれたり、月末の計算がはみ出したりするので、文字列のまま計算している

// '2026-10-02' → '2026-10'
export function toYearMonth(date: ISODate): YearMonth {
  return date.slice(0, 7);
}

export function addMonths(yearMonth: YearMonth, months: number): YearMonth {
  const [yearString, monthString] = yearMonth.split("-");
  const totalMonths = Number(yearString) * 12 + (Number(monthString) - 1) + months; // 年をまたぐ計算（12月 + 1 → 翌年1月）を、繰り上がりを気にせずにできるようにするため
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths % 12 + 1;
  const result = String(year) + "-" + String(month).padStart(2, '0');
  return result;
}

export function monthRange(from: YearMonth, to: YearMonth): YearMonth[] {
  const months: YearMonth[] = [];

  // 月を必ず2桁（0埋め）にしているので、文字列のままでも正しく大小を比べられる
  for (let current = from; current <= to; current = addMonths(current, 1)) {
    months.push(current);
  }
  return months;
}

// システムは2100年まで使われる想定ではないですが、正しい閏年チェックを行っています
export function daysInMonth(yearMonth: YearMonth): number {
  // '2026-10' → '2026' 閏年チェック用
  const year = Number(yearMonth.slice(0, 4));
  const month = yearMonth.slice(5, 7);

  switch (month) {
    case "01":
    case "03":
    case "05":
    case "07":
    case "08":
    case "10":
    case "12":
      return 31;
    case "04":
    case "06":
    case "09":
    case "11":
      return 30;
    case "02":
      if (year % 4 === 0 && year % 100 !== 0) {
        return 29;
      }else if (year % 400 === 0){
        return 29;
      }
      return 28;
    default:
      throw new Error(`不正な月です: ${yearMonth}`);
  };
}

// '2026-02' → '2026-02-28'。その月の末日の日付
export function monthEndDate(yearMonth: YearMonth): ISODate {
  return `${yearMonth}-${daysInMonth(yearMonth)}`;
}
