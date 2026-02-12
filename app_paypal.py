# app_paypal.py (ou dentro do seu app.py)
import os, requests
from flask import Blueprint, render_template, jsonify, request


paypal_bp = Blueprint("paypal", __name__, template_folder="templates")

PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID")
PAYPAL_SECRET = os.getenv("PAYPAL_SECRET")
PAYPAL_ENV = os.getenv("PAYPAL_ENV", "sandbox")
PAYPAL_BASE = "https://api-m.paypal.com" if PAYPAL_ENV == "live" else "https://api-m.sandbox.paypal.com"


def get_paypal_token():
    resp = requests.post(
        f"{PAYPAL_BASE}/v1/oauth2/token",
        auth=(PAYPAL_CLIENT_ID, PAYPAL_SECRET),
        data={"grant_type": "client_credentials"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]

@paypal_bp.get("/checkout/paypal")
def checkout_paypal():
    return render_template(
        "checkout_paypal.html",
        PAYPAL_CLIENT_ID=PAYPAL_CLIENT_ID,
        PAYPAL_ENV=PAYPAL_ENV
    )

@paypal_bp.post("/api/paypal/create-order-client")
def create_order_client():
    body = request.get_json() or {}
    currency = body.get("currency")
    value = body.get("value")
    description = body.get("description")

    token = get_paypal_token()

    resp = requests.post(
        f"{PAYPAL_BASE}/v2/checkout/orders",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "amount": {
                        "currency_code": currency,
                        "value": value,
                    },
                    "description": description,
                }
            ],
        },
        timeout=30,
    )

    if not resp.ok:
        return jsonify({"error": "create_order_failed", "status": resp.status_code, "body": resp.text}), 502

    return jsonify(resp.json())


@paypal_bp.post("/api/paypal/capture/<order_id>")
def capture_order(order_id):
    token = get_paypal_token()

    resp = requests.post(
        f"{PAYPAL_BASE}/v2/checkout/orders/{order_id}/capture",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={},
        timeout=30,
    )

    if not resp.ok:
        return jsonify({"error": "capture_failed", "status": resp.status_code, "body": resp.text}), 502

    return jsonify(resp.json())


# import os, base64, requests
# from flask import Blueprint, request, jsonify
# # from dotenv import load_dotenv

# # load_dotenv()

# paypal_bp = Blueprint("paypal", __name__)
# PAYPAL_CLIENT = os.getenv("PAYPAL_CLIENT_ID")
# PAYPAL_SECRET = os.getenv("PAYPAL_SECRET")
# PAYPAL_ENV = os.getenv("PAYPAL_ENV", "sandbox")  # 'live' para produção
# BASE = "https://api-m.paypal.com" if PAYPAL_ENV == "live" else "https://api-m.sandbox.paypal.com"

# def _assert_env():
#     missing = [k for k,v in {
#         "PAYPAL_CLIENT_ID": PAYPAL_CLIENT,
#         "PAYPAL_SECRET": PAYPAL_SECRET
#     }.items() if not v]
#     if missing:
#         raise RuntimeError(f"Variáveis ausentes: {', '.join(missing)}")
    
# def _get_access_token():
#     _assert_env()
#     auth = base64.b64encode(f"{PAYPAL_CLIENT}:{PAYPAL_SECRET}".encode()).decode()
#     r = requests.post(
#         f"{BASE}/v1/oauth2/token",
#         headers={"Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded"},
#         data={"grant_type": "client_credentials"},
#         timeout=30,
#     )
#     if not r.ok:
#         return None, {"status": r.status_code, "body": r.text}
#     return r.json()["access_token"], None



# @paypal_bp.post("/api/paypal/order")
# def create_order():
#     try:
#         data = request.get_json(silent=True) or {}
#         currency = data.get("currency", "USD")
#         value = data.get("value", "48.00")
#         description = data.get("description", "")

#         token, err = _get_access_token()
#         if err:
#             return jsonify({"error": "oauth_failed", **err}), 502

#         r = requests.post(
#             f"{BASE}/v2/checkout/orders",
#             headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
#             json={
#                 "intent": "CAPTURE",
#                 "purchase_units": [{
#                     "amount": {"currency_code": currency, "value": value},
#                     "description": description
#                 }]
#             },
#             timeout=30,
#         )
#         content_type = r.headers.get("content-type","")
#         payload = r.json() if content_type.startswith("application/json") else {"raw": r.text}
#         if not r.ok or "id" not in payload:
#             return jsonify({"error":"create_order_failed","status":r.status_code,"payload":payload}), 502
#         return jsonify({"id": payload["id"]})
#     except Exception as e:
#         return jsonify({"error":"server_exception","message":str(e)}), 500

# @paypal_bp.post("/api/paypal/capture/<order_id>")
# def capture_order(order_id):
#     try:
#         token, err = _get_access_token()
#         if err:
#             return jsonify({"error": "oauth_failed", **err}), 502

#         r = requests.post(
#             f"{BASE}/v2/checkout/orders/{order_id}/capture",
#             headers={"Authorization": f"Bearer {token}"},
#             timeout=30,
#         )
#         content_type = r.headers.get("content-type","")
#         payload = r.json() if content_type.startswith("application/json") else {"raw": r.text}
#         if not r.ok:
#             return jsonify({"error":"capture_failed","status":r.status_code,"payload":payload}), 502
#         return jsonify(payload)
#     except Exception as e:
#         return jsonify({"error":"server_exception","message":str(e)}), 500
    

# @paypal_bp.get("/api/paypal/order/<order_id>")
# def get_order(order_id):
#     try:
#         token, err = _get_access_token()
#         if err:
#             return jsonify({"error": "oauth_failed", **err}), 502

#         resp = requests.get(
#             f"{BASE}/v2/checkout/orders/{order_id}",
#             headers={
#                 "Authorization": f"Bearer {token}",
#                 "Content-Type": "application/json",
#             },
#             timeout=30,
#         )

#         content_type = resp.headers.get("content-type", "")
#         payload = resp.json() if content_type.startswith("application/json") else {"raw": resp.text}

#         if not resp.ok:
#             return jsonify({
#                 "error": "get_order_failed",
#                 "status": resp.status_code,
#                 "payload": payload
#             }), 502

#         return jsonify(payload)
#     except Exception as e:
#         return jsonify({"error": "server_exception", "message": str(e)}), 500


