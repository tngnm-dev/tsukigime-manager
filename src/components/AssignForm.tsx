import { useId, useState } from "react";
import type { Allocation, Contract, Deposit, DueRule, Fee, ISODate, OneTimeCharge } from "../types";
import { chargeKindLabels, dueItemLabel, formatMonthLabel } from "../lib/format";
import { allocate, amountsUpTo, depositRemaining, parseAmount } from "../lib/allocate";
import styles from "./AssignForm.module.css";
import { currentUnpaidItems, prepayUnpaidItems } from "../lib/payment";

type AssignFormProps = {
  onAssign: (allocations: Allocation[]) => void,
  charges: OneTimeCharge[],
  contract: Contract,
  dueRule: DueRule,
  allocations: Allocation[],
  deposits: Deposit[],
  fees: Fee[],
  today: ISODate,
};

// 前払いにするとき、何か月先の家賃まで流し込むか（一時金は入れない）。これを超えた分は「余り」にして、ユーザーにも余りとして知らせる
const PREPAY_LIMIT_MONTHS = 12;

export default function AssignForm({ onAssign, contract, dueRule, charges, allocations, deposits, fees, today }: AssignFormProps) {
  const formId = useId();
  const [selectedDepositId, setSelectedDepositId] = useState('');
  // ふだんは今の請求分（期限が今月末まで）だけに充てる。チェックしたときだけ、期限がそれより先の月（前払い）にも入れる
  // → 余りが残るので、会社がまとめて払った入金を別の区画にも割り当てられる
  const [includePrepay, setIncludePrepay] = useState(false);
  // この区画に充てる金額（入力欄の中身なので文字列）。会社がまとめて払った入金を、区画ごとに分けて充てるため
  const [amountText, setAmountText] = useState('');

  // ===== 計算（stateを使わず、毎回ここで出す） =====
  const selectableDeposits = deposits.filter(d =>
    !d.excluded && d.direction === 'in' && depositRemaining(d, allocations) > 0
  );
  const selectedDeposit = selectableDeposits.find(d => d.id === selectedDepositId);
  const rest = selectedDeposit ? depositRemaining(selectedDeposit, allocations) : 0;

  const items = includePrepay
    ? prepayUnpaidItems(contract, charges, fees, dueRule, allocations, today, PREPAY_LIMIT_MONTHS)
    : currentUnpaidItems(contract, charges, fees, dueRule, allocations, today);
  // プレビューは画面に出すだけで保存しないので、idはダミー
  const amount = selectedDeposit ? parseAmount(amountText, rest) : null;
  const preview = selectedDeposit && amount !== null
    ? allocate(amount, selectedDeposit.id, contract, items, () => '')
    : null;
  // 割り当てたあと、この入金に残る額（入力した金額のうち使わなかった分も含む）
  const depositRestAfter = preview
    ? rest - preview.allocations.reduce((sum, a) => sum + a.amount, 0)
    : rest;
  // 入金の残りで払い切れる項目までのボタンだけ出す。前払いのチェックを入れると12か月分並んで、押せないボタンばかりになるため
  // 1件目も払い切れないときはボタンが出ないが、金額の欄には残り全額が入っているので、そのまま一部だけ充てられる
  const amountButtons = amountsUpTo(items).filter(({ total }) => total <= rest);

  // 割り当て1件ぶんの表示名（仲介手数料 / 2026年10月分 など）
  function labelOf(allocation: Allocation): string {
    switch (allocation.kind) {
      case 'rent':
        return formatMonthLabel(allocation.month);
      case 'oneTime': {
        const charge = charges.find(c => c.id === allocation.chargeId);
        return charge ? chargeKindLabels[charge.kind] : '一時金';
      }
      case 'other':
        return 'その他';
    }
  }

  // 入金を選んだら、金額の欄にその入金の残り全額を入れる。effect ではなく、選んだ操作と一緒に変える
  function handleSelectDeposit(depositId: string) {
    setSelectedDepositId(depositId);
    const deposit = selectableDeposits.find(d => d.id === depositId);
    setAmountText(deposit ? String(depositRemaining(deposit, allocations)) : '');
  }

  function handleSubmit() {
    if (!selectedDeposit || amount === null) return;
    // submitするときだけ、本物のidで計算し直す
    const result = allocate(amount, selectedDeposit.id, contract, items, () => crypto.randomUUID());
    onAssign(result.allocations);
    setSelectedDepositId('');
    setAmountText('');
    setIncludePrepay(false);
  }

  const canSubmit = preview !== null && preview.allocations.length > 0;

  return (
    <div className={styles.form}>
      <div className={styles.field}>
        <label htmlFor={`${formId}-deposit`}>入金</label>
        <select id={`${formId}-deposit`} value={selectedDepositId} onChange={e => handleSelectDeposit(e.target.value)}>
          <option value="">選んでください</option>
          {selectableDeposits.map(d => {
            const remaining = depositRemaining(d, allocations);
            return (
              <option key={d.id} value={d.id}>
                {d.date} {d.payerName} {remaining < d.amount ? '残り ' : ''}{remaining.toLocaleString('ja-JP')}円
              </option>
            );
          })}
        </select>
      </div>
      {selectedDeposit && (
        <div className={`${styles.field} ${styles.amountField}`}>
          <label htmlFor={`${formId}-amount`}>この区画に充てる金額</label>
          <div className={styles.amountInput}>
            <input
              id={`${formId}-amount`}
              type="text"
              inputMode="numeric"
              value={amountText}
              onChange={e => setAmountText(e.target.value)}
              aria-invalid={amount === null}
              aria-describedby={`${formId}-amount-hint${amount === null ? ` ${formId}-amount-error` : ''}`}
            />
            <span>円</span>
          </div>
          <p id={`${formId}-amount-hint`} className={styles.amountHint}>
            入金の残り：{rest.toLocaleString('ja-JP')}円
          </p>
          {amountButtons.length > 0 && (
            <div className={styles.amountChoices}>
              <p className={styles.amountHint}>支払う範囲から金額を選ぶ</p>
              <ul className={styles.amountButtons} aria-label="金額をボタンで入れる">
                {amountButtons.map(({ item, total }) => (
                  <li key={item.kind === 'rent' ? item.month : item.chargeId}>
                    <button type="button" aria-pressed={amount === total} onClick={() => setAmountText(String(total))}>
                      <span>{dueItemLabel(item, charges)}まで</span>
                      <span className={styles.choiceAmount}>{total.toLocaleString('ja-JP')}円</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {amount === null && (
            <p id={`${formId}-amount-error`} className={styles.error}>
              1円以上、入金の残り（{rest.toLocaleString('ja-JP')}円）以下の金額を、半角の数字で入れてください。
            </p>
          )}
        </div>
      )}
      <label className={styles.check}>
        <input type="checkbox" checked={includePrepay} onChange={e => setIncludePrepay(e.target.checked)} />
        前払いとして先の月にも入れる（最大{PREPAY_LIMIT_MONTHS}か月）
      </label>

      {preview !== null && (
        <>
          {preview.allocations.length > 0 ? (
            <dl className={styles.summary}>
              {preview.allocations.map((a, i) => {
                // items と allocations は同じ順番に並んでいる（allocate が先頭から順に入れるため）
                const item = items[i];
                const isPartial = item.remaining !== null && a.amount < item.remaining;
                return (
                  <div key={i}>
                    <dt>{labelOf(a)}</dt>
                    <dd>{a.amount.toLocaleString('ja-JP')}円{isPartial ? '（一部）' : ''}</dd>
                  </div>
                );
              })}
            </dl>
          ) : (
            <p className={styles.note}>
              {preview.stoppedByMissingFee
                ? '一番古い未払いの月の料金が未登録のため、割り当てられません。'
                : includePrepay
                  ? '未払いの請求がありません。'
                  : '今月末までに支払う分の未払いはありません。前払いにする場合はチェックを入れてください。'}
            </p>
          )}
          {preview.allocations.length > 0 && preview.stoppedByMissingFee && (
            <p className={styles.error}>料金が未登録の月があるため、その手前までを割り当てます。</p>
          )}
          {preview.allocations.length > 0 && depositRestAfter > 0 && (
            <p className={styles.note}>
              この入金の残りは {depositRestAfter.toLocaleString('ja-JP')}円 です。残りは別の区画に割り当てられます。
              {preview.leftover > 0 && !includePrepay && 'この区画の前払いにする場合はチェックを入れてください。'}
            </p>
          )}
        </>
      )}

      <button className={styles.submit} type="button" disabled={!canSubmit} onClick={handleSubmit}>
        割り当てる
      </button>
    </div>
  )
}
