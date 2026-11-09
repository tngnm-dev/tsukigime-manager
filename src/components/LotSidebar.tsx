import type { Allocation, Contract, Fee, ISODate, Lot, OneTimeCharge, Person, Space } from "../types";
import { countOverdueSpaces } from "./../lib/status"
import styles from "./LotSidebar.module.css";
type LotSidebarProps = {
  selectedLotId: string | null,
  onSelect: (lotId: string) => void,
  lots: Lot[],
  spaces: Space[],
  contracts: Contract[],
  people: Person[],
  fees: Fee[],
  charges: OneTimeCharge[],
  allocations: Allocation[],
  today: ISODate;
}

export default function LotSidebar({ selectedLotId, onSelect, lots, spaces, contracts, people, fees, charges, allocations, today }: LotSidebarProps) {
  const lotsWithCount = lots.map(lot => (
    {
      lot,
      count: countOverdueSpaces(lot.id, spaces, contracts, people, fees, charges, allocations, today)
    }));
  const overdueLots = lotsWithCount.filter(item => item.count > 0);
  const noOverdueLots = lotsWithCount.filter(item => item.count === 0);
  return (
    <nav className={styles.sidebar}>
      {overdueLots.length > 0 &&
        <section className={styles.section}>
          <h2>延滞ありの駐車場</h2>
          <ul className={styles.list}>
            {overdueLots.map(item => (
              <li key={item.lot.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.lot.id)}
                  className={`${styles.button} ${selectedLotId === item.lot.id ? styles.selected : ""}`}
                >
                  <span className={styles.name}>{item.lot.name}</span>
                  <span className={styles.badge}>● {item.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      }
      {noOverdueLots.length > 0 &&
        <section className={styles.section}>
          <h2>延滞なしの駐車場</h2>
          <ul className={styles.list}>
            {noOverdueLots.map(item => (
              <li key={item.lot.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.lot.id)}
                  className={`${styles.button} ${selectedLotId === item.lot.id ? styles.selected : ""}`}
                >
                  <span className={styles.name}>{item.lot.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      }
    </nav>
  )
}