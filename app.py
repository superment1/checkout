import os
from flask import Flask, render_template, redirect, request, jsonify, send_from_directory
import stripe
from dotenv import load_dotenv
import re
from flask_cors import CORS
from auth import require_api_key
import ipaddress, requests
from app_paypal import paypal_bp
from app_stripe_webhook import stripe_bp
import re

# STRIPE N8N
ATTR_KEYS = ["utm_id", 
             "utm_source", 
             "utm_medium", 
             "utm_campaign", 
             "utm_content", 
             "utm_term", 
             "vid_id", 
             "sck", 
             "currency"]

def _clean_meta(v, max_len=120):
    if not v:
        return ""
    v = str(v).strip()
    v = re.sub(r"[^a-zA-Z0-9_\-.:@/ ]", "", v)
    return v[:max_len]
def _get_meta_from_args(args):
    meta = {}
    for k in ATTR_KEYS:
        val = _clean_meta(args.get(k))
        if val:
            meta[k] = val
    return meta


load_dotenv()
app = Flask(__name__)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY") 
PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY")
BASE_URL = os.getenv("BASE_URL", "http://localhost:5003")
MAPS_API_KEY = os.getenv("MAPS_API_KEY", "")
ENV_NAME = os.getenv("ENV_NAME", "development")
PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID")

regex_superment = re.compile(r"^https://([a-z0-9-]+\.)*superment\.co$")

CORS(app, resources={
    r"/get-price-id":          {"origins": [regex_superment]},
    r"/create-payment-intent": {"origins": [regex_superment]},
}, supports_credentials=False)

app.register_blueprint(paypal_bp)
app.register_blueprint(stripe_bp)

def _client_ip():
    xff = request.headers.get("X-Forwarded-For", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.remote_addr or ""

def _infer_currency_from_country(country_name: str) -> str:
    m = {
        "Brazil": "brl",
        "United States": "usd",
        "Canada": "cad",
        "United Kingdom": "gbp",
        "Ireland": "eur",
        "Germany": "eur",
        "France": "eur",
        "Spain": "eur",
        "Italy": "eur",
        "Portugal": "eur",
    }
    return m.get(country_name or "", "").lower() or "usd"

@app.route("/get-country")
def get_country():
    ip = _client_ip()
    try:
        ip_obj = ipaddress.ip_address(ip)
        if ip_obj.is_private or ip_obj.is_loopback:
            return jsonify({"country": None, "ip": ip, "dev": True})
        r = requests.get(f"https://ipapi.co/{ip}/json/", timeout=4)
        if r.ok and r.headers.get("Content-Type", "").startswith("application/json"):
            data = r.json()
            return jsonify({"country": data.get("country_name"), "ip": ip})
        else:
            return jsonify({"country": None, "ip": ip, "error": f"ipapi status {r.status_code}"}), 200
    except Exception as e:
        return jsonify({"country": None, "ip": ip, "error": str(e)}), 200

# cors_origins = os.getenv("CORS_ALLOWED_ORIGINS")
    # if cors_origins:
    #     origins = [o.strip() for o in cors_origins.split(",") if o.strip()]
    # else:
    #     origins = ["http://localhost:5003", "http://localhost:3000", BASE_URL]
    # CORS(app, resources={
    #     r"/*": {
    #         "origins": [
    #             r"https://.*\.superment\.co",
    #             "https://superment.co"        
    #         ]
    #     }
    # })

@app.get("/config")
def get_public_config():
    return jsonify({
        "publishableKey": PUBLISHABLE_KEY,
        "mapsApiKey": MAPS_API_KEY,
        "env": ENV_NAME,
        "baseUrl": BASE_URL,
        "paypalClientId": PAYPAL_CLIENT_ID,
    })

@app.route("/")
def home():
    return "Checkout API is running", 200

@app.route('/manifest.json')
def manifest():
    return send_from_directory('.', 'manifest.json', mimetype='application/manifest+json')

@app.route("/get-client-secret", methods=["POST"])
def get_client_secret():
    try:
        data = request.get_json()
        payment_intent_id = data.get("payment_intent_id")
        if not payment_intent_id:
            return jsonify({"error": "payment_intent_id is required"}), 400
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        if not intent.metadata.get("authorized") == "true":
            return jsonify({"error": "Unauthorized PaymentIntent"}), 403
        return jsonify({
            "client_secret": intent.client_secret
        })
    except Exception as e:
        return jsonify({"error": "Erro interno. Tente novamente mais tarde."}), 500

@app.route("/checkout")
def checkout():
    price_id   = request.args.get("price_id")
    product_id = request.args.get("product_id")  
    want_cur   = (request.args.get("currency") or "").lower() 
    try:       
        attr_meta = _get_meta_from_args(request.args)

        if not want_cur or want_cur not in {"usd","brl","eur","gbp","cad"}:
            ip = _client_ip()
            try:
                ip_obj = ipaddress.ip_address(ip)
                if not (ip_obj.is_private or ip_obj.is_loopback):
                    r = requests.get(f"https://ipapi.co/{ip}/json/", timeout=3)
                    if r.ok and r.headers.get("Content-Type","").startswith("application/json"):
                        want_cur = _infer_currency_from_country(r.json().get("country_name"))
            except Exception:
                pass
            if not want_cur:
                want_cur = "usd"
        chosen_price = None

        if price_id:
            p = stripe.Price.retrieve(price_id, expand=["product"])
            prod_id = p.product.id if hasattr(p.product, "id") else p.product

            prices = stripe.Price.list(product=prod_id, active=True, limit=100)
            for q in prices.auto_paging_iter():
                if q.currency.lower() == want_cur:
                    chosen_price = q
                    break

            if not chosen_price:
                chosen_price = p

            product_id = prod_id
        else:
            if not product_id:
                return "price_id or product_id required", 400
            prices = stripe.Price.list(product=product_id, active=True, limit=100)
            for q in prices.auto_paging_iter():
                if q.currency.lower() == want_cur:
                    chosen_price = q
                    break
            if not chosen_price:
                if not prices.data:
                    return "no active prices", 404
                chosen_price = prices.data[0]

        if isinstance(chosen_price.product, str):
            product = stripe.Product.retrieve(chosen_price.product)
        else:
            product = chosen_price.product 

        amount_for_view   = chosen_price.unit_amount
        currency_for_view = chosen_price.currency.lower()

        co = getattr(chosen_price, "currency_options", None) or {}
        if want_cur and currency_for_view != want_cur and want_cur in co:
            amount_for_view   = co[want_cur].get("unit_amount", amount_for_view)
            currency_for_view = want_cur

        intent = stripe.PaymentIntent.create(
            amount=chosen_price.unit_amount,
            currency=chosen_price.currency,
            automatic_payment_methods={"enabled": True},
            metadata={
                "authorized": "true",
                "product_id": product.id,
                "price_id": chosen_price.id,
                **attr_meta, 
            }
        )        
        # print("METADATA ENVIADA:", intent.metadata, flush=True)
        return render_template(
            "index.html",
            price=chosen_price,
            product=product,
            publishable_key=PUBLISHABLE_KEY,
            maps_key=MAPS_API_KEY,
            payment_intent_id=intent.id,
            product_amount=amount_for_view,      
            product_currency=currency_for_view,
            PAYPAL_CLIENT_ID=PAYPAL_CLIENT_ID,
        )
    except Exception:
        app.logger.exception("checkout failed")
        return jsonify({"error": "Erro interno. Tente novamente mais tarde."}), 500
    

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def _clean(v, max_len=120):
    if not v:
        return ""
    v = str(v).strip()
    return v[:max_len]

@app.post("/api/checkout/update-intent")
def update_intent():
    data = request.get_json(force=True)
    pi_id = data["payment_intent_id"]

    email   = _clean(data.get("email"), 120).lower()
    name    = _clean(data.get("name"), 120)
    phone   = _clean(data.get("phone"), 20)
    address1 = _clean(data.get("address1"), 120)
    address2 = _clean(data.get("address2"), 120)
    city    = _clean(data.get("city"), 80)
    state   = _clean(data.get("state"), 40)
    zipc    = _clean(data.get("zip"), 20)
    country = _clean(data.get("country"), 2).upper()
    stripe.PaymentIntent.modify(
        pi_id,
        receipt_email=email if email else None,
        metadata={
            "email": email,
            "name": name,
            "phone": phone,
            "address1": address1,
            "address2": address2, 
            "city":city,
            "state": state,
            "zip" : zipc,
            "country": country,
        }
    )
    return jsonify({"ok": True})


@app.route("/products", methods=["GET"])
@require_api_key()
def list_products():
    try:
        limit = int(request.args.get("limit", 10)) 
        active = request.args.get("active")  

        params = {"limit": limit}
        if active is not None:
            params["active"] = active.lower() == "true"

        products = stripe.Product.list(**params)
        return jsonify(products)
    except Exception as e:
        return "Erro interno. Tente novamente mais tarde.", 500

@app.get("/health")
def health():
     return {"ok": True, "env": os.getenv("ENV_NAME", "unknown")}, 200

@app.route("/check-stripe")
@require_api_key()
def check_stripe():
    try:
        prices = stripe.Price.list(
            limit=20,
            expand=["data.product"]
        )
        return jsonify(prices)
    except Exception as e:
        return "Erro interno. Tente novamente mais tarde.", 500

@app.route("/get-price-id")
def get_price_id():
    product_id = (request.args.get("product_id") or "").strip()
    want_currency = (request.args.get("currency") or "").strip().lower()
    if not product_id:
        return jsonify({"error": "product_id is required"}), 400
    try:
        
        prices = stripe.Price.list(product=product_id, active=True, limit=100, expand=["data.product"])
        if not prices.data:
            return jsonify({"error": "No active prices found"}), 404
        chosen = None
        if want_currency:
            for p in prices.auto_paging_iter():
                if p.active and p.currency.lower() == want_currency:
                    chosen = p
                    break
        # fallback: primeiro ativo
        if not chosen:
            chosen = prices.data[0]

        return jsonify({
            "price_id": chosen.id,
            "unit_amount": chosen.unit_amount,
            "currency": chosen.currency,
            "product_id": chosen.product.id if hasattr(chosen, "product") and hasattr(chosen.product, "id") else chosen.product
        })
    
        # price = prices.data[0]
        # return jsonify({
        #     "price_id": price.id,
        #     "unit_amount": price.unit_amount,
        #     "currency": price.currency
        # })
    except Exception as e:
        app.logger.exception("get_price_id failed")
        return jsonify({"error": "Erro interno. Tente novamente mais tarde."}), 500


@app.route("/payment-intent", methods=["POST"])
def create_payment():
    try:

        data = request.get_json()
        price_id = data.get("price_id")
        email = data.get("email")
        phone = data.get("phone")
        shipping = data.get("shipping")

        if not price_id:
            return jsonify({"error": "price_id is required"}), 400
         
        price = stripe.Price.retrieve(price_id)
        amount = price.unit_amount
        currency = price.currency
        
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency = currency,
            receipt_email=email,
            shipping=shipping,
            automatic_payment_methods={"enabled": True},
            metadata={
                "authorized": "true",  
                "phone": phone,
                }
        )
        return jsonify(clientSecret=intent.client_secret)
    except Exception as e:
        return jsonify({"error": "Erro interno. Tente novamente mais tarde."}), 500

@app.route("/update-payment-intent", methods=["POST"])
def update_payment_intent():
    try:
        data = request.get_json(silent=True) or {}
        price_id = data.get("price_id")
        phone = (data.get("phone"))

        if not price_id:
            return jsonify({"error": "price_id is required"}), 400

        price = stripe.Price.retrieve(price_id)
        amount = price.unit_amount
        currency = price.currency

        pi = stripe.PaymentIntent.create(
            amount=amount,
            currency=currency,
            automatic_payment_methods={"enabled": True},
            metadata={
                "base_amount": str(amount),
                "price_id": price_id,    
                "product_id": price.product if isinstance(price.product, str) else price.product.get("id", ""),
                "phone": phone,
                }
        )

        return jsonify(client_secret=pi.client_secret, payment_intent_id=pi.id), 200
    except Exception as e:
        app.logger.exception("update-payment-intent failed")
        return jsonify({"error": "Erro interno. Tente novamente mais tarde."}), 500
    
@app.route("/validate-coupon", methods=["POST"])
def validate_coupon():
    try:
        data = request.get_json()
        coupon = data.get("coupon")
        payment_intent_id = data.get("payment_intent_id")
        email = data.get("email")

        if not coupon:
            return jsonify({"error": "Coupon is required"}), 400
        if not payment_intent_id:
            return jsonify({"error": "PaymentIntent ID is required"}), 400

        promo_codes = stripe.PromotionCode.list(code=coupon, active=True, limit=1)
        if not promo_codes.data:
            return jsonify({"error": "Invalid or inactive coupon"}), 404

        promo = promo_codes.data[0]
        coupon_data = promo.coupon
        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        original_amount = payment_intent.amount
        if coupon_data.get("percent_off"):
            discount_percent = coupon_data["percent_off"]
            discounted_amount = int(round(original_amount * (1 - discount_percent / 100)))
            discount_type = "percent"
            discount_value = discount_percent
        elif coupon_data.get("amount_off"):
            amount_off = coupon_data["amount_off"]
            discounted_amount = max(0, original_amount - amount_off)
            discount_type = "amount"
            discount_value = amount_off
        else:
            return jsonify({"error": "Coupon has no discount value"}), 400

        updated_intent = stripe.PaymentIntent.modify(
            payment_intent_id,
            receipt_email=email,
            amount=discounted_amount
        )
        return jsonify({
            "success": True,
            "promotion_code_id": promo.id,
            "discount_type": discount_type,
            "discount": discount_value,
            "new_client_secret": updated_intent.client_secret,
            "payment_intent_id": payment_intent_id
        })
    except Exception as e:
        return jsonify({"error": "Erro interno. Tente novamente mais tarde."}), 500

@app.post("/update-quantity")
def update_quantity():
    try:
        data = request.get_json() or {}
        pi_id = data.get("payment_intent_id")
        quantity = int(data.get("quantity", 1))
        email = data.get("email")

        if not pi_id:
            return jsonify({"success": False, "error": "payment_intent_id is required"}), 400
        if quantity < 1:
            quantity = 1

        pi = stripe.PaymentIntent.retrieve(pi_id)

        price_id = pi.metadata.get("price_id")
        if not price_id:
            return jsonify({"success": False, "error": "price_id missing in metadata"}), 400

        price = stripe.Price.retrieve(price_id)
        unit_cents = int(price["unit_amount"])
        currency = price["currency"]

        subtotal = unit_cents * quantity

        coupon_type = pi.metadata.get("coupon_type")
        if coupon_type == "percent":
            percent = int(pi.metadata.get("coupon_percent", "0") or 0)
            discounted = int(round(subtotal * (1 - percent / 100)))
        elif coupon_type == "amount":
            amount_off = int(pi.metadata.get("coupon_amount_off", "0") or 0)
            discounted = max(0, subtotal - amount_off)
        else:
            discounted = subtotal

        new_amount = max(0, discounted)

        updated = stripe.PaymentIntent.modify(
            pi_id,
            amount=new_amount,
            receipt_email=email,
            currency=currency,
            metadata={**pi.metadata, "quantity": str(quantity)}
        )

        return jsonify({"success": True, "amount": updated.amount})
    except Exception:
        return jsonify({"success": False, "error": "Erro interno. Tente novamente mais tarde."}), 500


@app.route("/list-coupons", methods=["GET"])
@require_api_key()
def list_coupons():
    try:
        coupons = stripe.Coupon.list(limit=20)
        return jsonify(coupons)
    except Exception as e:
        return jsonify({"error": "Erro interno. Tente novamente mais tarde."}), 500
    
@app.route('/thanks')
def thanks():
    return render_template('thanks.html')

@app.route('/cancel')
def cancel():
    return 'Pagamento cancelado.'
if __name__ == '__main__':
    app.run(port=5003, debug=False)
