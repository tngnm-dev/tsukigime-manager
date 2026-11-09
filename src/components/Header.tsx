import type {  ISODate } from "../types";
import styles from "./Header.module.css";
type HeaderProps = { 
  today: ISODate,
  onReset: () => void,
};

export default function Header({ today , onReset }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <h1>月極マネージャー</h1>
        <button className={styles.reset} type="button" onClick={() => {
          if (!window.confirm('操作した内容がすべて消えます。サンプルデータに戻しますか？')) {
            return;
          }
          onReset()
        }}>サンプルデータに戻す</button>
      </div>
      {/* デモは「今日」を固定しているので、いつ開いても同じ表示になることを画面でも伝える */}
      <p className={styles.todayText}>デモの基準日：{today}</p>
    </header>
  )
}
