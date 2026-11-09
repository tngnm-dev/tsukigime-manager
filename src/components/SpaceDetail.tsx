import type { ISODate, Space, Contract, Person, Allocation, Deposit, Fee, OneTimeCharge } from '../types';
import { getSpaceStatus } from '../lib/status';
import { billedUnpaidItems, dueDate } from '../lib/payment';
import { toYearMonth } from '../lib/month';
import { statusLabels, formatDueRule, paymentDetailLong, dueItemLabel, shortDateLabel } from '../lib/format'
import AssignForm from './AssignForm';
import styles from './SpaceDetail.module.css';
import paymentDetailStyles from '../styles/paymentDetail.module.css';

type SpaceDetailProps = {
  selectedSpaceId: string | null,
  onAssign: (allocations: Allocation[]) => void,
  spaces: Space[],
  contracts: Contract[],
  people: Person[],
  charges: OneTimeCharge[],
  allocations: Allocation[],
  deposits: Deposit[],
  fees: Fee[],
  today: ISODate
};

export default function SpaceDetail({ selectedSpaceId, onAssign, spaces, contracts, people, charges, allocations, deposits, fees, today }: SpaceDetailProps) {
  const space = spaces.find(space => (
    space.id === selectedSpaceId
  ))
  if (space === undefined) return (
    <aside className={`${styles.detail} ${styles.empty}`}>
      <p>区画詳細</p>
      <span>一覧から区画番号を選択してください</span>
    </aside>
  );
  const result = getSpaceStatus(space, contracts, people, fees, charges, allocations, today);
  const { person, status } = result;
  const contract = contracts.find(contract => contract.spaceId === space.id);
  // 支払詳細に1件ずつ出す、今の請求分の未払い（延滞・期限前・料金未登録）
  const unpaid = contract && person
    ? billedUnpaidItems(contract, charges, fees, person.dueRule, allocations, today)
    : [];

  return (
    <aside className={styles.detail}>
      <div className={styles.heading}>
        <span className={styles.number}>区画 {space.number}</span>
        <h2 id="space-detail-title">{status === 'vacant' ? '未契約' : person?.name ?? '契約者情報なし'}</h2>
        <p>{statusLabels[status]}</p>
      </div>
      <div className={styles.content}>
        <dl className={styles.fields}>
          <div>
            <dt>電話番号</dt>
            <dd>{person?.tel ?? '—'}</dd>
          </div>
          <div>
            <dt>支払状況</dt>
            <dd>{statusLabels[status]}</dd>
          </div>
        </dl>
        <dl className={styles.fields}>
          <div>
            <dt>契約者の支払いルール</dt>
            <dd>{person ? formatDueRule(person.dueRule) : '—'}</dd>
          </div>
          <div>
            <dt>今月分の期限</dt>
            <dd>{person ? dueDate(person.dueRule, toYearMonth(today)).replaceAll('-', '/') : '—'}</dd>
          </div>
        </dl>
        <dl className={styles.fields}>
          <div>
            <dt>契約開始日</dt>
            <dd>{contract?.startDate.replaceAll('-', '/') ?? '—'}</dd>
          </div>
          <div>
            <dt>更新日</dt>
            <dd>{contract?.renewalDate.replaceAll('-', '/') ?? '—'}</dd>
          </div>
        </dl>
        <dl className={`${styles.fields} ${styles.fieldsWide}`}>
          <div>
            <dt>支払詳細</dt>
            {unpaid.length > 0 ? (
              <dd className={paymentDetailStyles.detail}>
                {/* 連絡するときに「何が・いくら・いつまで」を伝えられるよう、1件ずつ並べる。延滞は色だけでなく「（延滞）」の文字でも伝える */}
                <ul className={styles.unpaidList}>
                  {unpaid.map((item) => (
                    <li key={item.kind === 'rent' ? item.month : item.chargeId} className={item.isOverdue ? paymentDetailStyles.overdue : undefined}>
                      <span>{dueItemLabel(item, charges)}</span>
                      <span className={styles.unpaidAmount}>{item.remaining === null ? '料金未登録' : `${item.remaining.toLocaleString('ja-JP')}円`}</span>
                      <span>期限 {shortDateLabel(item.dueDate)}{item.isOverdue ? '（延滞）' : ''}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            ) : (
              <dd className={status === 'overdue' ? `${paymentDetailStyles.detail} ${paymentDetailStyles.overdue}` : paymentDetailStyles.detail}>
                {paymentDetailLong(result)}
              </dd>
            )}
          </div>
        </dl>
        {contract && person ? (
          <section className={styles.assignment}>
            <h3 id="assignment-title">入金の割り当て</h3>
            <AssignForm key={space.id} onAssign={onAssign} contract={contract} dueRule={person.dueRule} charges={charges} allocations={allocations} deposits={deposits} fees={fees} today={today} />
          </section>
        ) : null}
      </div>
    </aside>
  );
}
