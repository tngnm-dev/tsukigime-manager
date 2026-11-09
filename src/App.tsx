import { Fragment, useEffect, useState } from "react";
import { MainScreen } from "./components/MainScreen";
import type { AppData } from "./types";
import { dataSource } from "./data/dataSource";
import { sampleData } from "./data/sample";

// ユニオン型にしているのは、読み込み中なのにdataがあるような、あり得ない組み合わせにならないように
type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: AppData };

export function App() {
  const [loadStatus, setLoadStatus] = useState<LoadState>({ status: 'loading' });

  //サンプルデータに初期化した際にkeyが変わるので、state(選択中の駐車場・区画など)を初期化するための処理
  const [resetKey, setResetKey] = useState(0);

  function handleReset() {
    setLoadStatus({ status: 'ready', data: sampleData });
    setResetKey(k => k + 1);
  }

  useEffect(() => {
    let ignore = false; //StrictModeの2回実行などで読み込みが終わる前にこのeffectが片付けられたら、古い結果でstateを更新しないようにする
    async function loadData() {
      try {
        const loaded = await dataSource.load();
        if (!ignore) setLoadStatus({ status: 'ready', data: loaded });
      } catch (error) {
        const reason = error instanceof Error ? error.message : '不明なエラー';
        if (!ignore) setLoadStatus({ status: 'error', message: `データが読み込めませんでした（${reason}）` });
      }
    }
    void loadData();
    return () => { ignore = true; };
  }, []);
  
  return (
    <Fragment>
      {loadStatus.status === 'loading' ? (
        <p>読み込み中です</p>
      ) : null}
      {loadStatus.status === 'error' ? (
        <div>
          <p>{loadStatus.message}</p>
          <button type="button" onClick={() => {
            if (window.confirm('保存されていたデータは上書きされ、元に戻せません。サンプルデータで始めますか？')) {
              handleReset();
            }
          }}>サンプルデータで始める</button>
        </div>
      ) : null}
      {loadStatus.status === 'ready' ? (
        <MainScreen key={resetKey} initialData={loadStatus.data} onReset={handleReset} />
      ) : null}
    </Fragment>
  );
}
