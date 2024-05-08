---
title: Flaskで作ったアプリを限定公開
description: "Lorem ipsum dolor sit amet"
pubDate: "2024-05-08"
---

### [日記アプリ](https://namorz.com/work/2023/flaskdiary/)を自宅のサーバーでホスティングするまでのおはなし.

インターネット → nginx → Gunicorn → Flask のようにしました.

Gunicorn と Flask の実行は Docker で行い nginx だけコンテナ外で回しています.

```docker:docker-compose.yml
version: "3"
services:
  app:
    container_name: app
    image: python:3.11
    build: .
    ports:
      - 9876:9876
    volumes:
      - ./apps:/apps
      - socket:/tmp
    command: gunicorn -w 4 -b 0.0.0.0:9876 "apps.app:create_app()"
    restart: always
    tty: true

  nginx:
    image: nginx:latest
    build:
      context: .
      dockerfile: dockerfile.nginx
    ports:
      - "8081:8081"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/nginx/nginx.conf
      - socket:/tmp
    restart: always
volumes:
  socket:

```

Cloudflare Access を使って認証をかけて自分以外見れないようにした.
http\://localhost:(nginx で listens しているポート番号)へhttps://diary.namorz.com から転送する設定をしました
