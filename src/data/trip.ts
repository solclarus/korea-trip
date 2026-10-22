import type { Trip } from '../types';

// 実データ（スクリーンショット・本人の申告から）
//   - 飛行機：RS706 / ZG46 の実績時刻・ターミナル・座席
//   - お金：ATM引き出し、WOWPASS の全明細（残高 ₩2,142 と一致）、T-money の全乗車履歴（残高 ₩6,750 と一致）
//   - 両替：仁川で ¥20,000 → ₩158,730（計算上 ₩158,738、端数 ₩8 は受け取れず）、10/15 22:08 に ¥20,000 → WOWPASS ₩167,684（チャージ後残高 ₩173,289 と一致）
//   - 仁川で、空港鉄道のきっぷ（領収書：15:38 発行・現金 ₩5,950）→ 弘大入口乗り換えで合井へ
//   - レシート3枚（10/16）：新村のバー 02:15、EDIYA 国立古宮博物館店 16:26（どちらも WOWPASS 明細と一致）、
//     新林のサムギョプサル 22:19（友人の支払いなので支出には含めない。場所と出来事だけ記録）
//   - 写真：エムブロトンカツ新村店の外観、緑の支線バス、西大門刑務所歴史館のチケット（10/16 14:51・大人2名）、
//     夕方の光化門、夜の清渓川、ドェボンの盛り合わせ
//   - 10/16 午後：景福宮 → 南へ歩いて清渓川 → 乙支路入口から2号線で新林（本人の申告。T-money 18:29〜19:10 の乗車）
//   - WOWPASS アプリの「グルメ旅行」（10/15）：ミョンヒョンマン カンジャンケジャン（양화로 45・₩44,800・★5「Good」）、
//     GS25 梨泰院ヒル店（₩4,000・★5）。合井 → 梨泰院の移動（T-money 18:27〜18:54）は推定
//   - 塩パンの店（10/16）：写真 IMG_1924 の撮影位置（16:15:52・誤差 約14m）。店名は未確認
//   - 帰りのリムジンバス 6017（新林の8番乗り場 → 仁川空港、T-money ₩17,000）
//   - 現地で使ったアプリ：WOWPASS、NAVER マップ
//   - 宿：1泊目 HOTEL LaNuit（新村〜梨大の間）、2泊目 HOTEL YAJA（新林。正確な位置は未確定）。どちらも友人が予約
//   - 韓国での支払いは、ここに記録したもので全部（本人確認済み）
// 未確定：estimated: true（時刻は推定 / 金額は仮）。
export const trip: Trip = {
  title: 'ソウル 2泊3日',
  subtitle: '入力途中',
  startDate: '2026-10-15',
  endDate: '2026-10-17',
  // 両替実績から算出：¥40,000 → ₩158,730（仁川の両替所・端数 ₩8 は受け取れず）+ ₩167,684（WOWPASS へのチャージ）
  fx: { JPY: 1, KRW: 40000 / (158730 + 167684) },

  apps: [
    { name: 'WOWPASS', note: '両替・チャージ、支払い、T-money（交通カード）として' },
    { name: 'NAVER Map', note: '地図と乗り換え案内（네이버 지도）' },
  ],

  wallets: [
    { id: 'cash-jpy', name: '現金（円）', currency: 'JPY', kind: 'cash' },
    { id: 'cash-krw', name: '現金（ウォン）', currency: 'KRW', kind: 'cash' },
    { id: 'wowpass', name: 'WOWPASS', currency: 'KRW', kind: 'prepaid' },
    { id: 'tmoney', name: 'T-money', currency: 'KRW', kind: 'prepaid' },
    { id: 'card', name: 'クレジットカード', currency: 'JPY', kind: 'card' },
  ],

  transfers: [
    { id: 't1', source: '銀行口座', to: 'cash-jpy', received: 40000, note: '日本でATMから引き出し' },
    { id: 't2', at: '2026-10-15T14:50', from: 'cash-jpy', sent: 20000, to: 'cash-krw', received: 158730, placeId: 'icn-t2', note: '両替（₩793.69 / ¥100 で ₩158,738。端数の ₩8 は受け取れず・時刻は推定）' },
    { id: 't2b', at: '2026-10-15T15:00', from: 'cash-krw', to: 'wowpass', received: 150000, placeId: 'icn-t2', note: 'WOWPASS を発行して現金 ₩150,000 をチャージ（時刻は推定）' },
    { id: 't3', at: '2026-10-15T16:48', from: 'wowpass', to: 'tmoney', received: 20000, placeId: 'hapjeong', note: 'T-moneyにチャージ（手数料 ₩500 は別計上）' },
    { id: 't4', at: '2026-10-15T18:29', source: 'キャッシュバック', to: 'wowpass', received: 5, note: 'レビュー投稿キャッシュバック（カンジャンケジャンのレビュー）' },
    { id: 't5', at: '2026-10-15T22:08', from: 'cash-jpy', sent: 20000, to: 'wowpass', received: 167684, note: '¥20,000 を WOWPASS に残高チャージ（₩838.42 / ¥100）。チャージ後の残高 ₩173,289' },
    { id: 't6', at: '2026-10-15T22:10', source: 'キャッシュバック', to: 'wowpass', received: 838, note: '招待・両替キャッシュバック' },
    { id: 't7', at: '2026-10-16T13:39', source: 'キャッシュバック', to: 'wowpass', received: 115, note: 'レビュー投稿キャッシュバック（4件）' },
    { id: 't8', at: '2026-10-16T20:53', from: 'wowpass', to: 'tmoney', received: 10000, note: 'T-moneyにチャージ（手数料 ₩500 は別計上）' },
  ],

  places: [
    { id: 'nrt-t1', name: '成田空港 第1ターミナル', nameEn: 'Narita Airport Terminal 1', nameKo: '나리타공항 제1터미널', lat: 35.7647, lng: 140.3864, area: '千葉' },
    { id: 'icn-t2', name: '仁川空港 第2ターミナル', nameEn: 'Incheon Airport Terminal 2', nameKo: '인천공항 제2터미널', lat: 37.469, lng: 126.4337, area: '仁川' },
    { id: 'icn-t1', name: '仁川空港 第1ターミナル', nameEn: 'Incheon Airport Terminal 1', nameKo: '인천공항 제1터미널', lat: 37.4492, lng: 126.4508, area: '仁川' },
    { id: 'hapjeong', name: '合井', nameEn: 'Hapjeong', nameKo: '합정', lat: 37.5496, lng: 126.9139, area: '麻浦' },
    { id: 'myunghyunman', name: 'ミョンヒョンマン カンジャンケジャン食べ放題', nameEn: 'Myunghyunman Soy Sauce Crab Unlimited Refill', nameKo: '명현만 간장게장 무한리필', lat: 37.55024, lng: 126.91396, area: '麻浦' },
    { id: 'gs25-itaewon-hill', name: 'GS25 梨泰院ヒル店（位置は仮）', nameEn: 'GS25 Itaewon Hill Branch', nameKo: 'GS25 이태원힐점', lat: 37.5345, lng: 126.9946, area: '龍山（未確定）' },
    { id: 'rest-sinchon', name: 'バー「レスト」（新村）', nameEn: 'Rest (Sinchon)', nameKo: '레스트', lat: 37.55844, lng: 126.93643, area: '西大門' },
    { id: 'mbro-sinchon', name: 'エムブロトンカツ 新村店', nameEn: 'Mbro Donkatsu (Sinchon)', nameKo: '엠브로돈까스 신촌점', lat: 37.55789, lng: 126.93826, area: '西大門' },
    { id: 'seodaemun-prison', name: '西大門刑務所歴史館', nameEn: 'Seodaemun Prison History Hall', nameKo: '서대문형무소역사관', lat: 37.57454, lng: 126.95632, area: '西大門' },
    { id: 'gyeongbok', name: '景福宮', nameEn: 'Gyeongbokgung Palace', nameKo: '경복궁', lat: 37.5796, lng: 126.977, area: '鍾路' },
    { id: 'cheonggye', name: '清渓川（清渓広場）', nameEn: 'Cheonggyecheon Stream', nameKo: '청계천', lat: 37.5694, lng: 126.9787, area: '鍾路' },
    { id: 'saltbread-seochon', name: '塩パンの店（西村）', nameEn: 'Salt bread shop (Seochon)', nameKo: '소금빵 가게 (서촌)', lat: 37.576544, lng: 126.972678, area: '鍾路（景福宮駅そば）' },
    { id: 'ediya-museum', name: 'EDIYA COFFEE 国立古宮博物館店', nameEn: 'EDIYA Coffee, National Palace Museum', nameKo: '이디야커피 국립고궁박물관점', lat: 37.57657, lng: 126.97497, area: '鍾路' },
    { id: 'dwaebong-sillim', name: 'ドェボンサムギョプサル 新林店', nameEn: 'Dwaebong Samgyeopsal (Sillim)', nameKo: '돼봉삼겹살 신림점', lat: 37.4846, lng: 126.9285, area: '冠岳' },
    { id: 'hotel-lanuit', name: 'Hotel LaNuit', nameEn: 'Hotel LaNuit', nameKo: '라뉘호텔', lat: 37.55358, lng: 126.93606, area: '麻浦' },
    { id: 'hotel-yaja', name: 'HOTEL YAJA 新林（位置は仮）', nameEn: 'HOTEL YAJA (Sillim)', nameKo: '호텔 야자 신림', lat: 37.4838, lng: 126.9305, area: '冠岳（未確定）' },
    { id: 'sillim-bus', name: '新林（空港リムジンバス 8番乗り場）', nameEn: 'Sillim Airport Bus Stop 8', nameKo: '신림 공항버스 8번 승강장', lat: 37.4846, lng: 126.9293, area: '冠岳（位置はおおよそ）' },
  ],

  visits: [
    // Day 1
    { id: 'v1', placeId: 'nrt-t1', arrive: '2026-10-15T10:00', depart: '2026-10-15T11:46', estimated: true, note: '南ウイング・43番ゲートから出発。' },
    { id: 'v2', placeId: 'icn-t2', arrive: '2026-10-15T14:28', depart: '2026-10-15T15:45', estimated: true, note: '8分遅れで到着（285番ゲート・ターンテーブル17）。¥20,000 を両替して WOWPASS を作り、空港鉄道のきっぷを現金で購入。' },
    { id: 'v2b', placeId: 'hapjeong', arrive: '2026-10-15T16:45', depart: '2026-10-15T17:00', estimated: true, note: '弘大入口で2号線に乗り換えて到着。駅で T-money にチャージ。' },
    { id: 'v2c', placeId: 'myunghyunman', arrive: '2026-10-15T17:05', depart: '2026-10-15T18:25', estimated: true, rating: 5, note: '合井駅そば（양화로 45）のカンジャンケジャン食べ放題。レビューは「Good」。' },
    { id: 'v2d', placeId: 'gs25-itaewon-hill', arrive: '2026-10-15T19:30', depart: '2026-10-15T19:45', estimated: true, rating: 5, note: '梨泰院のコンビニ。正確な位置は未確定。' },
    // Day 2
    { id: 'v6', placeId: 'rest-sinchon', arrive: '2026-10-16T00:30', depart: '2026-10-16T02:20', estimated: true, note: '新村・延世路のバー（3階）。ハイボールを18杯。' },
    { id: 'v6h', placeId: 'hotel-lanuit', arrive: '2026-10-16T02:30', depart: '2026-10-16T12:30', estimated: true, note: '1泊目（友人が予約）。' },
    { id: 'v6a', placeId: 'mbro-sinchon', arrive: '2026-10-16T12:45', depart: '2026-10-16T14:00', estimated: true, note: '新村・名物通りのトンカツ店でお昼。' },
    { id: 'v6b', placeId: 'seodaemun-prison', arrive: '2026-10-16T14:30', depart: '2026-10-16T15:45', estimated: true, note: '大人2名のチケット（14:51 発券・₩6,000）は友人が払ってくれた。' },
    { id: 'v6c', placeId: 'saltbread-seochon', arrive: '2026-10-16T16:10', depart: '2026-10-16T16:18', estimated: true, note: '景福宮の西側・西村の韓屋風の小さな店で塩パン。店名は未確認。' },
    { id: 'v7', placeId: 'ediya-museum', arrive: '2026-10-16T16:25', depart: '2026-10-16T16:45', estimated: true, note: '国立古宮博物館（景福宮の隣）の中のカフェ。自分は ICED Caffe Mocha、友人の分の ICED Americano もまとめて払った。' },
    { id: 'v7a', placeId: 'gyeongbok', arrive: '2026-10-16T16:45', depart: '2026-10-16T17:45', estimated: true, note: '夕焼けの光化門。' },
    { id: 'v7b', placeId: 'cheonggye', arrive: '2026-10-16T18:00', depart: '2026-10-16T18:20', estimated: true, note: '景福宮から南へ歩いて清渓川へ。ライトアップされた夜の清渓川。' },
    { id: 'v8', placeId: 'dwaebong-sillim', arrive: '2026-10-16T19:15', depart: '2026-10-16T22:25', estimated: true, note: '新林駅の近く（位置はおおよそ）。友人がごちそうしてくれた（自分の支払いなし）。ドェボン盛り合わせとチャミスル・テラ。' },
    { id: 'v8h', placeId: 'hotel-yaja', arrive: '2026-10-16T22:35', depart: '2026-10-17T08:45', estimated: true, note: '2泊目・新林（友人が予約）。正確な位置は未確定。' },
    // Day 3
    { id: 'v3', placeId: 'sillim-bus', arrive: '2026-10-17T09:00', depart: '2026-10-17T09:13', estimated: true, note: '8番乗り場から空港リムジンバスに乗車。' },
    { id: 'v4', placeId: 'icn-t1', arrive: '2026-10-17T10:30', depart: '2026-10-17T12:55', estimated: true, note: '110番ゲートから出発。' },
    { id: 'v5', placeId: 'nrt-t1', arrive: '2026-10-17T15:26', depart: '2026-10-17T16:00', estimated: true, note: '4分早く到着（北ウイング・22番ゲート）。ただいま。' },
  ],

  moves: [
    { id: 'm1', from: 'nrt-t1', to: 'icn-t2', depart: '2026-10-15T11:46', arrive: '2026-10-15T14:28', mode: 'flight', line: 'エアソウル RS706・座席 28A' },
    { id: 'm1b', from: 'icn-t2', to: 'hapjeong', depart: '2026-10-15T15:45', arrive: '2026-10-15T16:45', mode: 'train', line: '空港鉄道 AREX（一般）→ 弘大入口 → 2号線', estimated: true,
      rail: [{ relation: 7919000, from: '인천공항2터미널', to: '홍대입구' }, { relation: 4729409, from: '홍대입구', to: '합정' }] },
    { id: 'm1c', from: 'hapjeong', to: 'myunghyunman', depart: '2026-10-15T17:00', arrive: '2026-10-15T17:05', mode: 'walk', estimated: true },
    { id: 'm1d', from: 'myunghyunman', to: 'gs25-itaewon-hill', depart: '2026-10-15T18:27', arrive: '2026-10-15T19:00', mode: 'subway', line: '6号線？（合井 → 梨泰院・路線は推定。下車は 18:54）', estimated: true },
    { id: 'm2h', from: 'rest-sinchon', to: 'hotel-lanuit', depart: '2026-10-16T02:20', arrive: '2026-10-16T02:30', mode: 'walk', estimated: true },
    { id: 'm2i', from: 'hotel-lanuit', to: 'mbro-sinchon', depart: '2026-10-16T12:30', arrive: '2026-10-16T12:45', mode: 'walk', estimated: true },
    { id: 'm3a', from: 'mbro-sinchon', to: 'seodaemun-prison', depart: '2026-10-16T14:00', arrive: '2026-10-16T14:30', mode: 'bus', line: '緑の支線バス（番号不明）', estimated: true },
    { id: 'm3b', from: 'seodaemun-prison', to: 'saltbread-seochon', depart: '2026-10-16T15:45', arrive: '2026-10-16T16:10', mode: 'walk', line: '西大門刑務所から景福宮まで歩いて', estimated: true },
    { id: 'm3c', from: 'saltbread-seochon', to: 'ediya-museum', depart: '2026-10-16T16:18', arrive: '2026-10-16T16:25', mode: 'walk', estimated: true },
    { id: 'm4', from: 'gyeongbok', to: 'cheonggye', depart: '2026-10-16T17:45', arrive: '2026-10-16T18:00', mode: 'walk', estimated: true },
    { id: 'm5', from: 'cheonggye', to: 'dwaebong-sillim', depart: '2026-10-16T18:20', arrive: '2026-10-16T19:15', mode: 'subway', line: '2号線（乙支路入口 → 新林）', estimated: true,
      rail: [{ relation: 4729409, from: '을지로입구', to: '신림' }] },
    { id: 'm5h', from: 'dwaebong-sillim', to: 'hotel-yaja', depart: '2026-10-16T22:25', arrive: '2026-10-16T22:35', mode: 'walk', estimated: true },
    { id: 'm5i', from: 'hotel-yaja', to: 'sillim-bus', depart: '2026-10-17T08:45', arrive: '2026-10-17T09:00', mode: 'walk', estimated: true },
    { id: 'm2', from: 'sillim-bus', to: 'icn-t1', depart: '2026-10-17T09:13', arrive: '2026-10-17T10:30', mode: 'bus', line: '空港リムジンバス 6017・新林8番乗り場から', estimated: true,
      // 6017 の停留所（新林以降・公式の停車順）と経由地：ロッテ百貨店冠岳店 → 新大方駅 → 九老デジタル団地駅 → ボラメ駅 → 空軍ホテル → オリンピック大路 → 仁川国際空港高速道路
      via: [[37.49033, 126.92493], [37.48773, 126.9136], [37.48534, 126.90681], [37.49972, 126.91972], [37.51016, 126.92363]] },
    { id: 'm3', from: 'icn-t1', to: 'nrt-t1', depart: '2026-10-17T12:55', arrive: '2026-10-17T15:26', mode: 'flight', line: 'ZIPAIR ZG46・座席 57A' },
  ],

  expenses: [
    // 事前払い（金額は仮）。ホテルは友人が予約したので、情報が届くまで記録しない
    { id: 'p1', at: '2026-10-15T11:46', amount: 20000, currency: 'JPY', category: 'transport', item: '航空券 エアソウル', payment: 'card', prepaid: true, estimated: true, moveId: 'm1' },
    { id: 'p3', at: '2026-10-17T12:55', amount: 18000, currency: 'JPY', category: 'transport', item: '航空券 ZIPAIR', payment: 'card', prepaid: true, estimated: true, moveId: 'm3' },

    // Day 1（WOWPASS / T-money の明細）
    { id: 'w1', at: '2026-10-15T15:00', amount: 6000, currency: 'KRW', category: 'fee', item: 'WOWPASS カード発行手数料', payment: 'wowpass', placeId: 'icn-t2' },
    { id: 'a1', at: '2026-10-15T15:38', amount: 5450, currency: 'KRW', category: 'transport', item: '空港鉄道 きっぷ（仁川空港T2 → ソウル駅）', payment: 'cash-krw', moveId: 'm1b', memo: '領収書あり。弘大入口で降りて2号線で合井へ' },
    { id: 'a2', at: '2026-10-15T15:38', amount: 500, currency: 'KRW', category: 'fee', item: 'きっぷの保証金', payment: 'cash-krw', moveId: 'm1b', memo: '駅の払い戻し機で返金されていれば不要' },
    { id: 'w2', at: '2026-10-15T16:48', amount: 500, currency: 'KRW', category: 'fee', item: 'T-moneyチャージ手数料', payment: 'wowpass', placeId: 'hapjeong' },
    { id: 'w3', at: '2026-10-15T18:23', amount: 44800, currency: 'KRW', category: 'food', item: 'カンジャンケジャン食べ放題', payment: 'wowpass', placeId: 'myunghyunman' },
    { id: 'r1', at: '2026-10-15T18:27', endAt: '2026-10-15T18:54', amount: 1550, currency: 'KRW', category: 'transport', item: '地下鉄', payment: 'tmoney', moveId: 'm1d', memo: '乗車 18:27 → 下車 18:54' },
    { id: 'w4', at: '2026-10-15T19:40', amount: 4000, currency: 'KRW', category: 'shopping', item: 'GS25', payment: 'wowpass', placeId: 'gs25-itaewon-hill' },
    { id: 'r2', at: '2026-10-15T19:50', endAt: '2026-10-15T20:14', amount: 1550, currency: 'KRW', category: 'transport', item: '地下鉄・バス', payment: 'tmoney' },
    { id: 'w5', at: '2026-10-15T21:12', amount: 69100, currency: 'KRW', category: 'other', item: '支払い（明細の分類は「一般」）', payment: 'wowpass' },

    // Day 2
    { id: 'w6', at: '2026-10-16T02:15', amount: 112000, currency: 'KRW', category: 'food', item: 'バー「レスト」', payment: 'wowpass', placeId: 'rest-sinchon',
      memo: 'ベルズハイボール ₩5,000×18 = ₩90,000・基本ショット ₩7,000×2 = ₩14,000・「☆りこ」₩8,000（レシートあり）' },
    { id: 'w7', at: '2026-10-16T13:23', amount: 29900, currency: 'KRW', category: 'food', item: 'エムブロトンカツ', payment: 'wowpass', placeId: 'mbro-sinchon',
      memo: '13:18 に ₩25,900 で決済 → 取消して ₩29,900 で再決済' },
    { id: 'r3', at: '2026-10-16T14:12', endAt: '2026-10-16T14:23', amount: 1500, currency: 'KRW', category: 'transport', item: 'バス', payment: 'tmoney', moveId: 'm3a', memo: '乗車 14:12 → 下車 14:23。₩1,500 はバス運賃' },
    { id: 'w8', at: '2026-10-16T16:16', amount: 12000, currency: 'KRW', category: 'food', item: '塩パン', payment: 'wowpass', placeId: 'saltbread-seochon' },
    // 1回の決済 ₩7,700 を自分の分と友人の分に分けて記録
    { id: 'w9', at: '2026-10-16T16:26', amount: 4500, currency: 'KRW', category: 'cafe', item: 'ICED Caffe Mocha (L)', payment: 'wowpass', placeId: 'ediya-museum',
      memo: 'EDIYA COFFEE（レシートあり・決済は ₩7,700 で1回）' },
    { id: 'w9b', at: '2026-10-16T16:26', amount: 3200, currency: 'KRW', category: 'friend', item: 'ICED Americano (L)（友人の分）', payment: 'wowpass', placeId: 'ediya-museum',
      memo: 'EDIYA COFFEE（レシートあり・決済は ₩7,700 で1回）' },
    { id: 'r4', at: '2026-10-16T18:29', endAt: '2026-10-16T19:10', amount: 1650, currency: 'KRW', category: 'transport', item: '地下鉄', payment: 'tmoney', moveId: 'm5', memo: '乗車 ₩1,550 + 下車時の追加 ₩100（乗車 18:29 → 下車 19:10）' },
    { id: 'w10', at: '2026-10-16T20:53', amount: 500, currency: 'KRW', category: 'fee', item: 'T-moneyチャージ手数料', payment: 'wowpass' },

    // Day 3
    { id: 'r5', at: '2026-10-17T09:13', amount: 17000, currency: 'KRW', category: 'transport', item: '空港リムジンバス', payment: 'tmoney', moveId: 'm2' },
  ],
};
