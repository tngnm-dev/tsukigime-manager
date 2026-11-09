import type { AppData } from "../types";
import { sampleData } from "./sample";

// 保存先の形。公開版は localStorage だけだが、本番では NAS に保存する予定なので、画面側は保存先の種類を知らずに読み書きできるようにしている
export type DataSource = {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
};

//保存データの形が変わったとき、古いデータと区別するためにv〇を記載
const STORAGE_KEY = 'tsukigime-manager:v3';

function isAppData(value: unknown): value is AppData {
  if (typeof value !== 'object' || value === null) return false;
  const keys = ['lots', 'spaces', 'people', 'contracts', 'fees', 'deposits', 'charges', 'allocations'] as const;
  return keys.every(key => Array.isArray((value as Record<string, unknown>)[key]));
}
export const localStorageDataSource: DataSource = {
  // localStorage はすぐ読み書きできるが、NAS などに保存先を変えると待ち時間が出る。
  // 呼び出す側を直さずに済むように今からPromiseを返す形にそろえている
  async load() {
    try {
      const jsonText = localStorage.getItem(STORAGE_KEY);

      // 初めてデモを開いたとき用
      if (jsonText === null) {
        return sampleData
      }
      const parsed: unknown = JSON.parse(jsonText);
      //データが壊れているときにサンプルへ切り替えると、次の自動保存で本物のデータがサンプルで上書きされてしまう。エラーにして知らせる
      if (!isAppData(parsed)) {
        throw new Error('保存データの形式が正しくありません');
      }
      return parsed;

    } catch (error: unknown) {
      console.error(error);
      throw error;
    }
  },
  async save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error: unknown) {
      console.error(error);
      throw error;
    }
  },
};

// 保存先を選ぶのはここだけ。NAS 版を作ったら、ここを差し替える
export const dataSource: DataSource = localStorageDataSource;
