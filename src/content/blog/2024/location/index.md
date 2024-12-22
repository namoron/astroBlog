---
title: 仮
description: ""
pubDate: "2024-12-22"
---

Google からこんな通知が来ました. 2025/06/09 までにスマホで設定しないとこれまでのロケーション履歴が消えてしまうみたいです. 今月までだったのが延長されたようです.

![notice](./notice.png)

これによると今後は端末にデータが保存され, あくまでバックアップという形でGoogle サーバーに保存されることになります.
実際に設定を変更すると他の端末やWebからはアクセスできなくなりました.

そこで, セルフホスティングで位置情報を保存しブラウザで見ることができるツールを調べたので紹介します.

## <a href="https://owntracks.org/">OwnTracks</a>
OwnTracks はオープンソースプロジェクトの位置情報トラッキングツールです. これを使用することで, スマホアプリから位置情報を自分のサーバーに送ることができます. ネットワークが無いところでもアプリ内にバッファーされるので, 後からサーバーに送信することができます.

Android:<a href="https://play.google.com/store/apps/details?id=org.owntracks.android&hl=ja">OwnTracks</a>, IOS:<a href="https://apps.apple.com/us/app/owntracks/id692424691">OwnTracks</a>

### 使い方
今回はDockerイメージを使用することで簡単にセットアップしました.
recorder と frontend の2つイメージを使用します.
recorder は位置情報を受け取り月ごとのファイルに保存し, frontend は保存された位置情報を表示します.
1.最低限の`docker-compose.yml` を追加.

```yml
services:
  otrecorder:
    image: owntracks/recorder
    ports:
      - 8083:8083
    volumes:
      - ./config:/config
      - ./store:/store
    restart: unless-stopped
    environment:
      - OTR_PORT=0
  owntracks-frontend:
    image: owntracks/frontend
    ports:
      - 80:80
    volumes:
      - ./path/to/custom/config.js:/usr/share/nginx/html/config/config.js
    environment:
      - SERVER_HOST=otrecorder
      - SERVER_PORT=8083
    restart: unless-stopped
volumes:
  store:
  config:

```

3.`docker compose up -d` で起動.

4.スマホアプリでエンドポイントをhttp://localhost:8083/pub にして位置情報を送信.

5.http://localhost:8083 にアクセスすると以下のように表示されます.
![owntracks](./owntrack.png)
<div style="text-align: center;">
http://localhost:8083
</div>

docker-compose.yml を編集することで, より詳細な設定ができます. <a href="https://mqtt.org/">MQTT</a>による通信も可能です.

下図のように直近30日までの位置情報を表示することができます.
![owntracks](./demo-geojson-points.png)
<div style="text-align: center;">
マップで表示される位置情報  (公式リポジトリから引用)
</div>

6.http://localhost にアクセスすると以下のように表示されます.
これで時間指定検索や過去の位置情報を確認することができます.
ただ, 月ごとに大量のrecファイルが作成され, それを読み込んでいるのでデータが増えたときにロードに時間がかかるかもしれないのでDB化したほうがいいかもしれないです.
![owntracks frontend](./screenshot.png)
<div style="text-align: center;">
マップで表示される位置情報  (公式リポジトリから引用)
</div>


参考:

<a ref="https://youtu.be/ZRbkY4zcjnc?si=1PYo_iGa7rak1Qsg">Track Your Location with OwnTracks</a>

公式リポジトリ: <a ref="https://owntracks.org/">OwnTracks</a>

## <a href="https://dawarich.app/">dawarich</a>
![dawarich](./daw.png)
<div style="text-align: center;">
マップ  (公式サイトから引用)
</div>


DawarichはGoogle Timeline の代替として絶賛開発中のプロジェクトです. Owntracsのエンドポイントをこの写真をマッピングできたり, 訪れた国や都市の表示, 旅行の記録などGoogle Timeline と同じような機能を提供しています. しかもかっこいい !
![dawarich](./sta.png)
<div style="text-align: center;">
統計情報  (公式サイトから引用)
</div>

### 使い方
リポジトリをクローンして, `docker-compose up -d` で起動します.
Google Timeline のデータをダウンロードして, そのデータをdawarichにアップロードすることで, これまでの位置情報を表示することができます. やり方はを
<a href="https://dawarich.app/blog/migrating-from-google-location-history-to-dawarich">開発者のブログ</a>
参照してください.
60MBのGoogle Takeout からダウンロードした6年分のReacords.jsonをインポートするのに数日かかりました.
ただ,
http://localhost:3000/sidekiq/
にて処理状況を下のように表示してくれます
![dawarich](./dash.png)
<div style="text-align: center;">
http://localhost:3000
</div>


