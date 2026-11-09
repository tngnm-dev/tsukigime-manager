import type { ISODate, Space, Contract, Person, Allocation, Fee, OneTimeCharge } from '../types';
import { feeForMonth } from '../lib/billing';
import { toYearMonth } from '../lib/month';
import { getSpaceStatus } from '../lib/status';
import { statusLabels, paymentDetail } from '../lib/format'
import styles from './SpaceCell.module.css';
import paymentDetailStyles from '../styles/paymentDetail.module.css';
type SpaceCellProps = {
  space: Space,
  onSelect: (SpaceId: string) => void,
  selectedSpaceId: string | null,
  contracts: Contract[],
  people: Person[]
  allocations: Allocation[],
  fees: Fee[],
  charges: OneTimeCharge[],
  today: ISODate
};

export default function SpaceCell({ space, onSelect, selectedSpaceId, contracts, people, allocations, fees, charges, today }: SpaceCellProps) {
  const result = getSpaceStatus(space, contracts, people, fees, charges, allocations, today);
  const { person, status } = result;
  const contract = contracts.find(contract => contract.spaceId === space.id);
  const rent = contract ? feeForMonth(fees, contract.id, toYearMonth(today)) : null;
  const isSelected = selectedSpaceId === space.id;

  return (
    <tr className={isSelected ? `${styles.row} ${styles.selected}` : styles.row}>
      <th scope="row">
        <div className={styles.numberGroup}>
          <button type="button" onClick={() => onSelect(space.id)} className={styles.number}>
            {space.number}
          </button>
          <span className={styles.selectionLabel}>{isSelected ? '選択中' : ''}</span>
        </div>
      </th>
      <td className={styles.person}>{status === 'vacant' ? '—' : person?.name ?? '契約者データなし'}</td>
      <td className={styles.rent}>{rent !== null ? `${rent.toLocaleString("ja-JP")}円` : contract ? "未設定" : "—"}</td>
      <td><span className={`${styles.status} ${styles[status]}`}>{statusLabels[status]}</span></td>
      <td className={status === 'overdue' ? `${paymentDetailStyles.detail} ${paymentDetailStyles.overdue}` : paymentDetailStyles.detail}>
        {paymentDetail(result)}
      </td>
    </tr>
  );
}
