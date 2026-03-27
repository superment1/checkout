# gmail_send.py
import os, smtplib, ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SENDER = os.getenv("GMAIL_SENDER")
APP_PASS = os.getenv("APP_GMAIL")

def send_mail_smtp(to, subject, html_body, reply_to=None):
    if not SENDER or not APP_PASS:
        raise RuntimeError("Defina GMAIL_SENDER e APP_GMAIL nas variáveis de ambiente.")

    msg = MIMEMultipart("alternative")
    msg["From"] = SENDER
    msg["To"] = to
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to

    msg.attach(MIMEText("Seu cliente não suporta HTML.", "plain"))
    msg.attach(MIMEText(html_body, "html"))

    ctx = ssl.create_default_context()
    with smtplib.SMTP("smtp.gmail.com", 587) as s:
        s.ehlo()
        s.starttls(context=ctx)
        s.ehlo()
        s.login(SENDER, APP_PASS)
        s.send_message(msg)
        print(f"[SMTP] E-mail enviado → {to}")
        
def send_mail_smtp_with_pdf(to, subject, html_body, pdf_path, reply_to=None):
    if not SENDER or not APP_PASS:
        raise RuntimeError("Defina GMAIL_SENDER e APP_GMAIL.")

    from email.message import EmailMessage
    msg = EmailMessage()
    msg["From"] = SENDER
    msg["To"] = to
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content("Seu cliente não suporta HTML.")
    msg.add_alternative(html_body, subtype="html")

    import os
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF não encontrado: {pdf_path}")
    with open(pdf_path, "rb") as f:
        data = f.read()
    msg.add_attachment(data, maintype="application", subtype="pdf", filename=os.path.basename(pdf_path))

    ctx = ssl.create_default_context()
    with smtplib.SMTP("smtp.gmail.com", 587) as s:
        s.starttls(context=ctx)
        s.login(SENDER, APP_PASS)
        s.send_message(msg)
        print(f"[SMTP] E-mail com PDF enviado → {to}")