import type { ISODate, Lot, Space, Contract, Person, Allocation, Fee, OneTimeCharge } from '../types';
import SpaceCell from './SpaceCell';
import styles from './LotItem.module.css';
type LotItemProps = {
  lot: Lot,
  onSelect: (SpaceId: string) => void,
  selectedSpaceId: string | null,
  spaces: Space[],
  contracts: Contract[],
  people: Person[],
  allocations: Allocation[],
  fees: Fee[],
  charges: OneTimeCharge[],
  today: ISODate;
};

export default function LotItem({ lot, onSelect, selectedSpaceId, spaces, contracts, people, allocations, fees, charges, today }: LotItemProps) {
  return (
    <section className={styles.lotDetail}>
      <div className={styles.heading}>
        <h2>{lot.name}</h2>
        <p>{lot.address}</p>
      </div>
      <p className={styles.hint}>区画番号を選択すると詳細を表示します。</p>
      <div className={styles.scroll}>
      <table className={styles.table}>
        <caption className="visually-hidden">{lot.name}の区画一覧</caption>
        <thead><tr>
          <th scope="col">区画番号</th>
          <th scope="col">契約者</th>
          <th scope="col" className={styles.rent}>賃料</th>
          <th scope="col">支払状況</th>
          <th scope="col">支払詳細</th>
        </tr></thead>
        <tbody>
        {spaces.filter(space => (lot.id === space.lotId)).map(space => (
          <SpaceCell fees={fees} charges={charges} key={space.id} onSelect={onSelect} selectedSpaceId={selectedSpaceId} space={space} contracts={contracts} people={people} allocations={allocations} today={today} />
        ))}
        </tbody>
      </table>
      </div>
    </section>
  )
}
