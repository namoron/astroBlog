---
title: CPU温度をメールで知らせる
description: "Lorem ipsum dolor sit amet"
pubDate: "2023-12-27"
---

### きっかけ

最近,ラックマウントサーバー(PowerEdgeR720xd)を手に入れて家で運用し始めました.ですが,ファンのノイズが割りとうるさいです.

そこでファンの速度を 10 %に下げてみたのですが,今度は CPU 温度が上がって熱暴走したらどうしよ？となり,温度が設定を超えたらメールを送るプログラムを作りました.

### メールを送信する

メールの送信部分はこちらを参考にしました. [Python でのメール送信](https://zenn.dev/shimakaze_soft/articles/9601818a95309c)

どうやら Gmail はセキュリティの関係で,パスワード認証ではなく,OAuth2.0 を使う必要があるようでこちらも参考にしました.[Python でメール(gmail)を送信できない場合の解決法](https://www.gocca.work/python-mailerror/)

### CPU 温度を取得する

温度は,`lm-sensors`というツールで `sensors`コマンドを使って取得しました.
[lm-sensors](https://kaworu.jpn.org/ubuntu/lm-sensors)

### プログラムの実行

`crontab`を使って,1 時間に一回定期的に実行するようにしました.

```bash
# crontab -e
0 */1 * * * python3 /root/cpuTemperature/cpu.py
```

### ソースコード

```python
import ssl
import subprocess
import time
from smtplib import SMTP_SSL

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

TEMP_THRESHOLD = 70

def get_cpu_temperature():
    # シェルコマンドを実行
    result = subprocess.run(["sensors | grep 'Package id 0' | awk '{print $4}' | cut -c 2-3"], stdout=subprocess.PIPE, shell=True)
    # 結果を文字列として取得、整数値に変換
    temp = int(result.stdout.strip())
    return temp

def create_mail_message_mime(from_email, to_email, message, subject, filepath=None, filename=""):
    # MIMETextを作成
    msg = MIMEMultipart()
    msg['Subject'] = subject
    msg['From'] = from_email
    msg['To'] = to_email
    msg.attach(MIMEText(message, 'plain', 'utf-8'))
    return msg

def send_email(msg):
    account = "             @gmail.com"  # 自分のメールアドレス
    password = "                  "   # 生成されたパスワード

    host = 'smtp.gmail.com'
    port = 465

    context = ssl.create_default_context()
    server = SMTP_SSL(host, port, context=context)

    server.login(account, password)

    server.send_message(msg)

    server.quit()

def main():
    temp = get_cpu_temperature()
    if temp >= TEMP_THRESHOLD:
        # メールの送り主
        from_email = "                          "

        # メール送信先
        to_email = "                             "

        subject = "[警告!]サーバーの温度異常"
        message = f"自宅サーバーのCPU温度が{temp}度です."

        # MIME形式の作成
        mime = create_mail_message_mime(from_email, to_email, message, subject)

        # メールの送信
        send_email(mime)

if __name__ == "__main__":
    main()
```

### メールに来るお知らせ

<!-- <div align="center">
  <img src="/2023/cpuTemp/mail.jpg" alt="" />
  <p>メールに来るお知らせ(デモ)</p>
</div> -->

![blog placeholder](./mail.jpg)

### まとめ

いい感じに動きました"👍"
