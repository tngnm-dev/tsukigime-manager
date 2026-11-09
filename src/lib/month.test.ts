import { expect, test } from "vitest";
import { toYearMonth, addMonths , monthRange ,daysInMonth, monthEndDate } from './month';

test("年月日を年月に変更", () => {
  expect(toYearMonth('2026-10-02')).toBe('2026-10');
});

test("年月をnヶ月分追加する", () => {
  expect(addMonths('2026-07',-3)).toBe('2026-04');
  expect(addMonths('2026-11',2)).toBe('2027-01');
  expect(addMonths('2026-11',15)).toBe('2028-02');
});

test("特定の二つの年月の間の月を配列に格納", () => {
  expect(monthRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  expect(monthRange('2026-12', '2026-11')).toEqual([]);
  expect(monthRange('2026-12', '2026-12')).toEqual(['2026-12']);
});

test("引数の月が何日あるか", () => {
  expect(daysInMonth('2026-01')).toBe(31);
  expect(daysInMonth('2026-04')).toBe(30);
  expect(daysInMonth('2027-02')).toBe(28);
  expect(daysInMonth('2028-02')).toBe(29);
  expect(daysInMonth('2100-02')).toBe(28);
  expect(daysInMonth('2000-02')).toBe(29);
});

test("その月の末日の日付", () => {
  expect(monthEndDate('2026-10')).toBe('2026-10-31');
  expect(monthEndDate('2026-11')).toBe('2026-11-30');
  expect(monthEndDate('2027-02')).toBe('2027-02-28');
  expect(monthEndDate('2028-02')).toBe('2028-02-29');
});
