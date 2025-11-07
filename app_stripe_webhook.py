# app_stripe_webhook.py (versão SMTP only)
import os
import stripe
import smtplib, ssl
from flask import Blueprint, request, jsonify, abort
from email.message import EmailMessage

stripe_bp = Blueprint("stripe_bp", __name__)

# ==== Stripe env ====
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

DEBUG = os.getenv("STRIPE_DEBUG", "0") in ("1", "true", "True")
if DEBUG:
    print("[DEBUG] STRIPE_SECRET_KEY set?", bool(stripe.api_key))
    if stripe.api_key:
        print("[DEBUG] STRIPE_SECRET_KEY prefix:", stripe.api_key[:7])
    print("[DEBUG] WEBHOOK_SECRET set?", bool(WEBHOOK_SECRET))
    if WEBHOOK_SECRET:
        print("[DEBUG] WEBHOOK_SECRET prefix:", WEBHOOK_SECRET[:6])

# ==== Email env ====
SENDER_EMAIL = os.getenv("GMAIL_SENDER")  
APP_PASSWORD = os.getenv("APP_GMAIL")              

def _send_mail_smtp_with_pdf(to_email: str, subject: str, html_body: str, pdf_path: str, reply_to: str | None = None):
    if not SENDER_EMAIL or not APP_PASSWORD:
        raise RuntimeError("Defina as variáveis de ambiente GMAIL_SENDER e APP_GMAIL.")

    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF não encontrado: {pdf_path}")

    msg = EmailMessage()
    msg["From"] = SENDER_EMAIL
    msg["To"] = to_email
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    # corpo (plain + html)
    msg.set_content("Seu cliente de e-mail não suporta HTML.")
    msg.add_alternative(html_body, subtype="html")

    # anexo PDF
    with open(pdf_path, "rb") as f:
        data = f.read()
    msg.add_attachment(data, maintype="application", subtype="pdf", filename=os.path.basename(pdf_path))

    ctx = ssl.create_default_context()
    with smtplib.SMTP("smtp.gmail.com", 587) as s:
        s.ehlo()
        s.starttls(context=ctx)
        s.ehlo()
        s.login(SENDER_EMAIL, APP_PASSWORD)
        s.send_message(msg)

    print(f"[SMTP] E-mail com PDF enviado → {to_email}")

def send_pdf(to_email: str):
    html = """
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <h2>Pagamento confirmado </h2>
      <p>Obrigado pela compra na <b>Superment</b>.</p>
      <p>Seu material segue em anexo.</p>
    </div>
    """
    pdf_path = os.path.join(os.path.dirname(__file__), "static", "teste.pdf")
    _send_mail_smtp_with_pdf(
        to_email=to_email,
        subject="Seu produto Superment",
        html_body=html,
        pdf_path=pdf_path,
        reply_to="superhelp@superment.co",
    )

# Webhook Stripe

@stripe_bp.post("/stripe/webhook")
def stripe_webhook():
    try:
        payload_text = request.get_data(as_text=True)
        sig = request.headers.get("Stripe-Signature", "")
        try:
            event = stripe.Webhook.construct_event(payload_text, sig, WEBHOOK_SECRET)
        except stripe.error.SignatureVerificationError as e:
            print("[WEBHOOK] Signature error:", repr(e), flush=True)
            return abort(400)
        except Exception as e:
            print("[WEBHOOK] Parse error:", repr(e), flush=True)
            return abort(400)

        etype = event.get("type")
        print("[WEBHOOK] Evento:", etype, flush=True)
                    #PRODUTO RELAX DEVE SER ACEITO PARA ENVIO DO EMAIL
        PRODUCTS_ALLOWED = {
            "prod_SgGRuiyYsEVyCF",
            "prod_AbCdEf12345",
            # "prod_T2jNgj5cCjXcvG"
        }
        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            email = (
                (session.get("customer_details") or {}).get("email")
                or session.get("customer_email")
            )
            if not email and session.get("customer"):
                try:
                    customer = stripe.Customer.retrieve(session["customer"])
                    email = customer.get("email")
                except Exception as e:
                    print("Erro ao buscar e-mail do customer:", e)

            try:
                line_items = stripe.checkout.Session.list_line_items(session["id"])

                should_send = False
                matched_products = []

                for item in line_items["data"]:
                    product_id = item["price"]["product"]
                    desc = item.get("description")
                    qty = item.get("quantity")
                    total = (item.get("amount_total") or 0) / 100.0
                    print(f"Item: {desc} | product_id={product_id} | qty={qty} | total={total}")

                    if product_id in PRODUCTS_ALLOWED:
                        print(f"{product_id} é VÁLIDO para envio de e-mail")
                        should_send = True
                        matched_products.append(product_id)
                    else:
                        print(f" {product_id} NÃO é válido — e-mail não será enviado")
                if should_send:
                    if email:
                        try:
                            send_pdf(email)
                            print(f" E-mail enviado para {email} | products={matched_products}")
                        except Exception as e:
                            print(f" Falha ao enviar e-mail: {e}")
                    else:
                        print(" Nenhum e-mail encontrado no checkout. Não foi possível enviar.")
                else:
                    print("Nenhum product_id permitido encontrado. E-mail NÃO enviado.")
            except Exception as e:
                print("Erro ao listar produtos:", e)
        elif etype == "payment_intent.succeeded":

            pi = event["data"]["object"]
            email = (
                pi.get("receipt_email")
                or ((pi.get("charges", {}).get("data") or [{}])[0]
                    .get("billing_details") or {}).get("email")
            )
            if not email and pi.get("latest_charge"):
                try:
                    ch = stripe.Charge.retrieve(pi["latest_charge"])
                    email = (ch.get("billing_details") or {}).get("email") or email
                except Exception as e:
                    print("[WEBHOOK] retrieve charge falhou:", repr(e), flush=True)
                    
            md = pi.get("metadata") or {}
            product_id = md.get("product_id")
            price_id   = md.get("price_id")

            print("[WEBHOOK] PI metadata:", {"product_id": product_id, "price_id": price_id, "email": email}, flush=True)

            if product_id in PRODUCTS_ALLOWED and email:
                send_pdf(email)
                print(f"[WEBHOOK] SENT via PI: {email} product={product_id}", flush=True)
            else:
                print("[WEBHOOK] SKIP PI:", {"email": bool(email), "product_id": product_id}, flush=True)

        else:
            # ignore outros tipos
            pass

        return jsonify({"ok": True})
    except Exception as e:

        print("[WEBHOOK] Erro inesperado (evitando 500):", repr(e))
        return "", 200
