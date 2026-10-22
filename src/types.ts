// 旅行データのスキーマ。実データはこの型に沿って src/data/trip.ts に書く。
// 時刻はすべて現地時刻（JST/KSTはともに+09:00）で "YYYY-MM-DDTHH:mm" 形式。

export type Currency = 'KRW' | 'JPY';

export type CategoryId =
  | 'food'
  | 'transport'
  | 'shopping'
  | 'sightseeing'
  | 'cafe'
  | 'lodging'
  | 'fee'
  | 'friend'
  | 'other';

export type MoveMode = 'flight' | 'train' | 'subway' | 'bus' | 'taxi' | 'walk';

/** お金の置き場所。現金・プリペイド（WOWPASS / T-money）・カード */
export interface Wallet {
  id: string;
  name: string;
  currency: Currency;
  /** card は残高を持たず、利用額だけ集計する */
  kind: 'cash' | 'prepaid' | 'card';
}

/** 引き出し・両替・チャージなど、財布から財布へのお金の移動（支出ではない） */
export interface Transfer {
  id: string;
  /** 省略すると「出発前」扱い */
  at?: string;
  /** 省略すると外部から。そのときの出どころの表示名（「銀行口座」「キャッシュバック」など） */
  from?: string;
  source?: string;
  to: string;
  /** from 側から出た額（from の通貨）。同じ通貨なら省略可 */
  sent?: number;
  /** to 側に入った額（to の通貨） */
  received: number;
  placeId?: string;
  note?: string;
  /** キャッシュバックなどのおまけの入金。お金の流れにだけ出し、旅程には出さない */
  cashback?: boolean;
}

/** 地図上の地点 */
export interface Place {
  id: string;
  /** 表示名。地名は日本語、正式名称が英語のもの（ブランド・ホテル名など）は英語のまま */
  name: string;
  /** 英語名（現地の案内表示・地図アプリで通じる表記） */
  nameEn: string;
  /** 韓国語名（ハングル） */
  nameKo: string;
  lat: number;
  lng: number;
  area?: string;
}

/** ある地点での滞在 */
export interface Visit {
  id: string;
  placeId: string;
  arrive: string;
  depart: string;
  /** 到着・出発時刻が未確定で、推定値を入れている */
  estimated?: boolean;
  note?: string;
  /** 1〜5 の満足度 */
  rating?: number;
  /** public/photos/ 以下のファイル名など */
  photos?: string[];
}

/** 鉄道の1区間：OSM の路線（route relation）と、乗った駅・降りた駅（韓国語の駅名） */
export interface RailLeg {
  relation: number;
  from: string;
  to: string;
}

/** 駅・停留所の表示名 */
export interface Station {
  name: string;
  nameKo: string;
}

/** 地点間の移動 */
export interface Move {
  id: string;
  from: string; // placeId
  to: string; // placeId
  depart: string;
  arrive: string;
  mode: MoveMode;
  /** 路線名・便名など */
  line?: string;
  /** 公共交通の乗車駅 → （乗換駅）→ 降車駅。旅程に表示する */
  stations?: Station[];
  /** 出発・到着時刻が未確定で、推定値を入れている */
  estimated?: boolean;
  /** 鉄道で移動した場合の乗車区間（乗り換えごとに1つ）。経路生成スクリプトが線路の形を使う */
  rail?: RailLeg[];
  /** バス・タクシーで経由した地点（停留所など）。経路生成スクリプトがこの順に道路をたどる */
  via?: [number, number][];
  /**
   * GPSログなどの実経路 [lat, lng][]。最優先で使う。
   * 無ければ scripts/build-paths.ts が生成した経路（線路・道路沿い）、それも無ければ直線。
   */
  path?: [number, number][];
}

/** 支出1件 */
export interface Expense {
  id: string;
  at: string;
  amount: number;
  currency: Currency;
  category: CategoryId;
  item: string;
  /** 支払った財布の id（wallets） */
  payment?: string;
  /** 旅行前に予約・支払い済み（航空券・ホテルなど） */
  prepaid?: boolean;
  /** 金額が未確定で、仮の値を入れている */
  estimated?: boolean;
  /** 交通系ICの乗車〜下車のように、時間幅がある支払いの終了時刻 */
  endAt?: string;
  /** どこで使ったか（地図・タイムラインと紐づく） */
  placeId?: string;
  /** 交通費など移動に紐づく支出 */
  moveId?: string;
  memo?: string;
}

export interface Trip {
  title: string;
  subtitle?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  /** 1通貨単位あたりの円換算レート */
  fx: Record<Currency, number>;
  /** 旅で使ったアプリ（記念に記録） */
  apps?: { name: string; note: string }[];
  wallets: Wallet[];
  transfers: Transfer[];
  places: Place[];
  visits: Visit[];
  moves: Move[];
  expenses: Expense[];
}
