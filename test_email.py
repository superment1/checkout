import os
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

sender_email = os.getenv("GMAIL_SENDER")
app_password = os.getenv("APP_GMAIL")

receiver_email = input("Digite o e-mail de destino para o teste: ")

msg = MIMEMultipart("alternative")
msg["Subject"] = "Teste de envio - Superhelp"
msg["From"] = sender_email
msg["To"] = receiver_email

html = """
<html>
  <body>
    <h2>Teste de envio concluído com sucesso!</h2>
    <p>Este e-mail foi enviado via <b>SMTP Gmail</b> pela conta superhelp@superment.co.</p>
  </body>
</html>
"""

msg.attach(MIMEText(html, "html"))

context = ssl.create_default_context()
with smtplib.SMTP("smtp.gmail.com", 587) as server:
    server.starttls(context=context)
    server.login(sender_email, app_password)
    server.send_message(msg)

print(f" E-mail enviado de {sender_email} para {receiver_email}")
