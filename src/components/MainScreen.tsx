import { today } from "../data/sample"; // サンプルから固定の日付を読んでいる。デモで色分けが日によって変わらないようにするため。実運用では、今日の日付を使うように変える
import Header from "./Header";
import LotItem from "./LotItem";
import LotSidebar from "./LotSidebar";
import SpaceDetail from "./SpaceDetail";
import { countOverdueSpaces } from "../lib/status";
import type { Allocation, AppData } from "../types";
import { useEffect, useState } from "react";
import { dataSource } from "../data/dataSource";
import styles from "./MainScreen.module.css";

type MainScreenProps = {
  initialData: AppData,
  onReset: () => void,
}
export function MainScreen({ initialData, onReset }: MainScreenProps) {
  // アプリのデータはここだけで持つ。子はpropsで受け取り、変えるときはhandleAssignなどを通して、ここのstateを更新
  const [data, setData] = useState<AppData>(initialData);

  //stateが初期化されたときに延滞がある駐車場を最初の表示にするため
  const [selectedLotId, setSelectedLotId] = useState<string | null>(() => {
    const firstOverdueLot = data.lots.find(lot => countOverdueSpaces(lot.id, data.spaces, data.contracts, data.people, data.fees, data.charges, data.allocations, today) > 0);
    // 駐車場が0件（初めて起動して、まだ登録していないとき）は null
    return firstOverdueLot?.id ?? data.lots[0]?.id ?? null;
  });
  const displayLot = data.lots.find(lot => (
    lot.id === selectedLotId
  ))
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  // 駐車場を変えた時に選んだ区画は前の駐車場になっているので、一旦nullにして選択を外す
  function handleSelectLot(lotId: string) {
    setSelectedLotId(lotId);
    setSelectedSpaceId(null);
  }

  const [saveError, setSaveError] = useState<string | null>(null);
  // useEffectにしているのはdataが変わるたびに、外の保存先と同期するため
  useEffect(() => {
    async function saveData() {
      try {
        await dataSource.save(data);
        setSaveError(null)
      } catch {
        setSaveError('データの保存に失敗しました。')
      }
    }
    void saveData()
  }, [data]);

  function handleAssign(newAllocations: Allocation[]): void {
    setData(prev => ({
      ...prev,
      allocations: [...prev.allocations, ...newAllocations],
    }));
  }

  return (
    <>
      {saveError && <p className="form-error">{saveError}</p>}
      <div className={styles.layout}>
        <Header today={today} onReset={onReset} />
        <LotSidebar selectedLotId={selectedLotId} onSelect={handleSelectLot} lots={data.lots} spaces={data.spaces} contracts={data.contracts} people={data.people} fees={data.fees} charges={data.charges} allocations={data.allocations} today={today} />
        <main className={styles.main}>
          {displayLot ? (
            <LotItem fees={data.fees} charges={data.charges} selectedSpaceId={selectedSpaceId} onSelect={setSelectedSpaceId} key={selectedLotId} lot={displayLot} spaces={data.spaces} contracts={data.contracts} people={data.people} allocations={data.allocations} today={today} />
          ) : (
            <p>駐車場が登録されていません</p>
          )}
          <SpaceDetail selectedSpaceId={selectedSpaceId} onAssign={handleAssign} spaces={data.spaces} contracts={data.contracts} people={data.people} charges={data.charges} allocations={data.allocations} deposits={data.deposits} fees={data.fees} today={today} ></SpaceDetail>
        </main>
      </div>
    </>
  );
}
