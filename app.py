import os
from flask import Flask, render_template, redirect, request, jsonify, send_from_directory
import stripe
from dotenv import load_dotenv
from flask_cors import CORS
from auth import require_api_key

load_dotenv()
app = Flask(__name__)
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY")
DOMAIN = os.getenv("DOMAIN", "http://localhost:5000")
MAPS_API_KEY = os.getenv("MAPS_API_KEY")

CORS(app, resources={r"/*": {"origins": [
    "https://superment.co",
    "https://www.superment.co",
    "https://checkout.superment.co"
    ]}})

# @app.route('/')
# def index():
#     return render_template(
#         'teste.html',
#         # publishable_key=PUBLISHABLE_KEY,
#         # maps_key=MAPS_API_KEY,
#         # google_maps_key=os.getenv("MAPS_API_KEY")
#         # product=None,
#         # price=None
#     )

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
    
    price_id = request.args.get("price_id")
    if not price_id:
        return "price_id missing", 400
    try:
        price = stripe.Price.retrieve(price_id)
        product = stripe.Product.retrieve(price.product)

        intent = stripe.PaymentIntent.create(
            amount=price.unit_amount,
            currency=price.currency,
            automatic_payment_methods={"enabled": True},
            metadata={
                "authorized": "true",
                "product_id": product.id,
                "price_id": price.id   
            } 
        )
        return render_template(
            "index.html", 
            price=price,
            product=product,
            publishable_key=PUBLISHABLE_KEY,
            maps_key=MAPS_API_KEY,
            payment_intent_id=intent.id
        )
    except Exception as e:
        return jsonify({"error": "Erro interno. Tente novamente mais tarde."}), 500
    
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
    product_id = request.args.get("product_id").strip()
    if not product_id:
        return jsonify({"error": "product_id is required"}), 400
    try:
        prices = stripe.Price.list(product=product_id, active=True, limit=1)
        if not prices.data:
            return jsonify({"error": "No active prices found"}), 404

        price = prices.data[0]
        return jsonify({
            "price_id": price.id,
            "unit_amount": price.unit_amount,
            "currency": price.currency
        })
    except Exception as e:
        return "Erro interno. Tente novamente mais tarde.", 500

@app.route("/payment-intent", methods=["POST"])
def create_payment():
    try:
        data = request.get_json()
        price_id = data.get("price_id")
        email = data.get("email")
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
            metadata={"authorized": "true"}
        )
        return jsonify(clientSecret=intent.client_secret)
    except Exception as e:
        return jsonify({"error": "Erro interno. Tente novamente mais tarde."}), 500

@app.route("/update-payment-intent", methods=["POST"])
def update_payment_intent():
    try:
        data = request.get_json(silent=True) or {}
        price_id = data.get("price_id")

        if not price_id:
            return jsonify({"error": "price_id is required"}), 400

        price = stripe.Price.retrieve(price_id)
        amount = price.unit_amount
        currency = price.currency

        pi = stripe.PaymentIntent.create(
            amount=amount,
            currency=currency,
            automatic_payment_methods={"enabled": True},
            metadata={"base_amount": str(amount)}
        )

        return jsonify(client_secret=pi.client_secret, payment_intent_id=pi.id), 200
    except Exception as e:
        app.logger.exception("update-payment-intent failed")
        return jsonify({"error": "Erro interno. Tente novamente mais tarde."}), 500

# @app.route("/update-payment-intent", methods=["POST"])
# def update_payment_intent():
#     try:
#         data = request.get_json()
#         intent_id = data.get("payment_intent_id")
#         email = data.get("email")
#         shipping = data.get("shipping")

#         intent = stripe.PaymentIntent.modify(
#             intent_id,
#             receipt_email=email,
#             shipping=shipping
#         )
#         return jsonify(success=True)
#     except Exception as e:
#         return jsonify({"error": "Erro interno. Tente novamente mais tarde."}), 500
    
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
    app.run(port=5001, debug=False)
