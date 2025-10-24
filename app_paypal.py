# app_paypal.py (ou dentro do seu app.py)
import os, base64, requests
from flask import Blueprint, request, jsonify
from dotenv import load_dotenv

load_dotenv()

paypal_bp = Blueprint("paypal", __name__)
PAYPAL_CLIENT = os.getenv("PAYPAL_CLIENT_ID")
PAYPAL_SECRET = os.getenv("PAYPAL_SECRET")
PAYPAL_ENV = os.getenv("PAYPAL_ENV", "sandbox")  # 'live' para produção
BASE = "https://api-m.paypal.com" if PAYPAL_ENV == "live" else "https://api-m.sandbox.paypal.com"

def _assert_env():
    missing = [k for k,v in {
        "PAYPAL_CLIENT_ID": PAYPAL_CLIENT,
        "PAYPAL_SECRET": PAYPAL_SECRET
    }.items() if not v]
    if missing:
        raise RuntimeError(f"Variáveis ausentes: {', '.join(missing)}")
    
def _get_access_token():
    _assert_env()
    auth = base64.b64encode(f"{PAYPAL_CLIENT}:{PAYPAL_SECRET}".encode()).decode()
    r = requests.post(
        f"{BASE}/v1/oauth2/token",
        headers={"Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded"},
        data={"grant_type": "client_credentials"},
        timeout=30,
    )
    if not r.ok:
        # Retorna JSON com erro de OAuth para o front logar
        return None, {"status": r.status_code, "body": r.text}
    return r.json()["access_token"], None

@paypal_bp.post("/api/paypal/order")
def create_order():
    try:
        data = request.get_json(silent=True) or {}
        currency = data.get("currency", "US")
        value = data.get("value", "48.00")
        description = data.get("description", "")

        token, err = _get_access_token()
        if err:
            return jsonify({"error": "oauth_failed", **err}), 502

        r = requests.post(
            f"{BASE}/v2/checkout/orders",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={
                "intent": "CAPTURE",
                "purchase_units": [{
                    "amount": {"currency_code": currency, "value": value},
                    "description": description
                }]
            },
            timeout=30,
        )
        content_type = r.headers.get("content-type","")
        payload = r.json() if content_type.startswith("application/json") else {"raw": r.text}
        if not r.ok or "id" not in payload:
            return jsonify({"error":"create_order_failed","status":r.status_code,"payload":payload}), 502
        return jsonify({"id": payload["id"]})
    except Exception as e:
        return jsonify({"error":"server_exception","message":str(e)}), 500

@paypal_bp.post("/api/paypal/capture/<order_id>")
def capture_order(order_id):
    try:
        token, err = _get_access_token()
        if err:
            return jsonify({"error": "oauth_failed", **err}), 502

        r = requests.post(
            f"{BASE}/v2/checkout/orders/{order_id}/capture",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        content_type = r.headers.get("content-type","")
        payload = r.json() if content_type.startswith("application/json") else {"raw": r.text}
        if not r.ok:
            return jsonify({"error":"capture_failed","status":r.status_code,"payload":payload}), 502
        return jsonify(payload)
    except Exception as e:
        return jsonify({"error":"server_exception","message":str(e)}), 500