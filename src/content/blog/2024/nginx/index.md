---
title: Flaskで作ったアプリを限定公開した
description: "Lorem ipsum dolor sit amet"
pubDate: "2024-05-08"
---

### [日記アプリ](https://namorz.com/work/2023/flaskdiary/)を自宅のサーバーでホスティングするまでのおはなし.

## 概要

インターネット → nginx → Gunicorn → Flask のようにしました.

Gunicorn と Flask の実行は Docker で行い nginx だけコンテナ外で回しています.

Flask の認証だけでは不安なので Cloudflare Access の認証を追加
これはめっちゃ簡単に設定できた.(ドメイン登録が必要)
![](./cloud.jpg)

nginx で listens しているローカルホストのポート番号へhttps://diary.namorz.com からリバースプロキシをする設定をしました

### ディレクトリツリー

```
.
├── apps
│ ├── auth
│ ├── crud
│ ├── diary
│ ├── images
│ │ ├── 1
│ │ ├── 2
│ │ └── .ignore
│ ├── static
│ │ ├── css
│ │ │ ├── bootstrap.min.css
│ │ │ └── style.css
│ │ └── js
│ ├── templates
│ ├── app.py
│ └── config.py
├── .env
├── .gitignore
├── cloudflared.deb
├── docker-compose.yml
├── dockerfile
├── local.sqlite
└── requirements.txt
```

apps が 日記のメインです.

### dockerfile

```dockerfile
FROM python:3.10.12
# 時刻設定
RUN cp /usr/share/zoneinfo/Asia/Tokyo /etc/localtime
WORKDIR /app
COPY requirements.txt ./
RUN apt-get update -y
RUN apt-get upgrade -y
RUN pip install --upgrade pip
RUN pip install --upgrade setuptools
RUN pip install -r requirements.txt
COPY . .
CMD ["flask", "run"]
```

### docker-compose.yml

```dockerfile
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

volumes:
  socket:

```

#### /etc/nginx/nginx.conf

```nginx
user  nginx;
worker_processes  auto;

error_log  /var/log/nginx/error.log notice;
pid        /var/run/nginx.pid;


events {
    worker_connections  1024;
}


http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile        on;
    #tcp_nopush     on;

    keepalive_timeout  65;

    #gzip  on;

    include /etc/nginx/conf.d/*.conf;


server {
    <!-- 画像アップロードのサイズ拡張 -->
    client_max_body_size 20M;
    listen 8080;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:9876/;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Prefix /;
    }
}

}
```
