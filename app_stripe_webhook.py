# app_stripe_webhook.py (versão SMTP only)
import os
import stripe
import smtplib, ssl
from flask import Blueprint, request, jsonify, abort
from email.message import EmailMessage
import base64
import requests
import traceback

stripe_bp = Blueprint("stripe_bp", __name__)

# ==== Stripe env ====
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

CARTROVER_USER = os.getenv("CARTROVER_API_USER")
CARTROVER_KEY = os.getenv("CARTROVER_API_KEY")
CARTROVER_BASE = os.getenv("CARTROVER_BASE_URL", "https://api.cartrover.com/v1").rstrip("/")

PRODUCT_ITEM_MAP = {
    "prod_SgGRuiyYsEVyCF": {
        "sku": "SLEEP_TEST",
        "qty": 1,
    },  
    "prod_AbCdEf12345":    {
        "sku": "SLEEP_TEST",
        "qty": 3,
    },     
    "prod_SbKYsQrxStW8wB":    {
        "sku": "SPRSLP",
        "qty": 1,
    },    
    "prod_SbKa8ag01A2TGX":    {
        "sku": "SPRSLP",
        "qty": 3,
    },    
    "prod_SbKaRuJpDVBEzx":    {
        "sku": "SPRSLP",
        "qty": 6,
    },   
    "prod_T2jNgj5cCjXcvG":    {
        "sku": "SPRRLX",
        "qty": 1,
    },    
    "prod_T2jOmiPYB2SrZd":    {
        "sku": "SPRRLX",
        "qty": 3,
    },    
    "prod_T2jPp4I1S0cfol":    {
        "sku": "SPRRLX",
        "qty": 6,
    },   
}

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

def send_order_to_cartrover(order_payload: dict):
    """Envia o pedido diretamente ao CartRover."""
    if not CARTROVER_USER or not CARTROVER_KEY:
        print("[CARTROVER] Falha: credenciais ausentes.")
        return None

    url = f"{CARTROVER_BASE}/cart/orders/cartrover"
    auth_string = f"{CARTROVER_USER}:{CARTROVER_KEY}"
    auth_header = base64.b64encode(auth_string.encode()).decode()

    headers = {
        "Authorization": f"Basic {auth_header}",
        "Content-Type": "application/json",
    }
    try:
        resp = requests.post(url, headers=headers, json=order_payload, timeout=15)
        print(f"[CARTROVER] POST {url} → status={resp.status_code}")
        print(f"[CARTROVER] Response: {resp.text}")
        return resp
    except Exception as e:
        print(f"[CARTROVER] Erro ao enviar pedido: {e}")
        return None

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
            # "prod_SgGRuiyYsEVyCF",
            "prod_AbCdEf12345",
            # "prod_T2jNgj5cCjXcvG"
        }
 

        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]            

            try:
                line_items = stripe.checkout.Session.list_line_items(session["id"])
            except Exception as e:
                print(f"[WEBHOOK] Erro ao listar line_items: {e}")
                line_items = {"data": []}

            try:
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

                should_send = False
                matched_products = []

                for item in line_items["data"]:
                    product_id = item["price"]["product"]
                    desc = item.get("description")
                    qty = item.get("quantity")
                    total = (item.get("amount_total") or 0) / 100.0
                    print(f"Item: {desc} | product_id={product_id} | qty={qty} | total={total}")

                    if product_id in PRODUCTS_ALLOWED:
                        should_send = True
                        matched_products.append(product_id)

                if should_send and email:
                    send_pdf(email)
                    print(f"[WEBHOOK] E-mail enviado para {email} | products={matched_products}")
                else:
                    print("[WEBHOOK] Nenhum produto permitido encontrado — e-mail não enviado.")
            except Exception as e:
                print(f"[WEBHOOK] Falha ao processar e-mail: {e}")        
        
        elif etype == "payment_intent.succeeded":
            pi = event["data"]["object"]
            email = (
                pi.get("receipt_email")
                or ((pi.get("charges", {}).get("data") or [{}])[0]
                    .get("billing_details") or {}).get("email")
            )
            charge = None
            charges_list = (pi.get("charges") or {}).get("data") or []
            if charges_list:
                charge = charges_list[0]

            if not charge and pi.get("latest_charge"):
                try:
                    charge = stripe.Charge.retrieve(pi["latest_charge"])
                except Exception as e:
                    print("[WEBHOOK] retrieve charge falhou:", repr(e), flush=True)
                    charge = {}

            billing = (charge.get("billing_details") or {}) if charge else {}
            if not email:
                email = (billing.get("email") or email)
                    
            md = pi.get("metadata") or {}
            product_id = md.get("product_id")
            price_id   = md.get("price_id")

            print("[WEBHOOK] PI metadata:", {"product_id": product_id, "price_id": price_id, "email": email}, flush=True)
            try:
                items = []
                i = 1
                while md.get(f"item_{i}_sku"):
                    items.append({
                        "item": md.get(f"item_{i}_sku"),
                        "quantity": int(md.get(f"item_{i}_qty", 1)),
                    })
                    i += 1

                ship = (charge.get("shipping") or {}) if charge else {}
                addr = (ship.get("address") or {})
                billing = (charge.get("billing_details") or {}) if charge else {}

                raw_name = (
                    ship.get("name")
                    or billing.get("name")
                    or (email.split("@")[0] if email else None)
                )
                ship_company = raw_name or "Cliente Superment"
                #NEW
                if not items:
                    base = PRODUCT_ITEM_MAP.get(product_id)
                    if base:
                        items = [{
                            "item": base["sku"],
                            "quantity": base["qty"],
                        }]
                    else:
                        items = [{
                            "item": product_id or "UNKNOWN",
                            "quantity": 1,
                        }]

                order_payload = {
                    "cust_ref": pi["id"],
                    "ship_company": ship_company,
                    "ship_address_1": addr.get("line1"),
                    "ship_address_2": addr.get("line2"),
                    "ship_city": addr.get("city"),
                    "ship_state": addr.get("state"),
                    "ship_zip": addr.get("postal_code"),
                    "ship_country": addr.get("country"),
                    "ship_is_billing": True,
                    "items": items,
                }

                print("[WEBHOOK] order_payload montado:", order_payload, flush=True)
                send_order_to_cartrover(order_payload)

            except Exception as e:
                print(f"[WEBHOOK] Falha ao criar pedido CartRover a partir do PI: {e}")
                traceback.print_exc()

            if product_id in PRODUCTS_ALLOWED and email:
                send_pdf(email)
                print(f"[WEBHOOK] SENT via PI: {email} product={product_id}", flush=True)
            else:
                print("[WEBHOOK] SKIP PI:", {"email": bool(email), "product_id": product_id}, flush=True)
        else:
            pass
        return jsonify({"ok": True})
    except Exception as e:
        print("[WEBHOOK] Erro inesperado (evitando 500):", repr(e))
        return "", 200
