import os
from flask import Flask, render_template, redirect, request, jsonify, send_from_directory
import stripe
from dotenv import load_dotenv
from flask_cors import CORS

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

@app.route('/')
def index():
    return render_template(
        'teste.html',
        publishable_key=PUBLISHABLE_KEY,
        maps_key=MAPS_API_KEY,
        product=None,
        price=None
    )

@app.route('/manifest.json')
def manifest():
    return send_from_directory('.', 'manifest.json', mimetype='application/manifest+json')

@app.route("/checkout")
def checkout():
    price_id = request.args.get("price_id")
    if not price_id:
        return "price_id missing", 400
    try:
        price = stripe.Price.retrieve(price_id)
        product = stripe.Product.retrieve(price.product)
        intent = stripe.PaymentIntent.create(
            amount=price.unit_amount + 490,
            currency=price.currency,
            automatic_payment_methods={"enabled": True}
        )
        return render_template(
            "index.html", 
            price=price,
            product=product,
            publishable_key=PUBLISHABLE_KEY,
            maps_key=MAPS_API_KEY,
            client_secret=intent.client_secret
        )
    except Exception as e:
        return f"Erro: {str(e)}", 500
@app.route("/products", methods=["GET"])
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
        return jsonify({"error": str(e)}), 500

@app.route("/check-stripe")
def check_stripe():
    try:
        prices = stripe.Price.list(
            limit=20,
            expand=["data.product"]
        )
        return jsonify(prices)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/get-price-id")
def get_price_id():
    product_id = request.args.get("product_id")
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
        return jsonify({"error": str(e)}), 500

# @app.route("/pay", methods=["POST"])
# def pay():
#     data = request.json
#     payment_method_id = data.get("paymentMethodId")

#     intent = stripe.PaymentIntent.create(
#         amount=amount,
#         currency=price.currency,
#         payment_method=payment_method_id,
#         confirmation_method="manual",
#         confirm=True,
#     )

#     return jsonify({"status": intent.status})
    



@app.route("/payment-intent", methods=["POST"])
def create_payment():
    try:
        data = request.get_json()
        amount = data.get("amount")
        email = data.get("email")
        shipping = data.get("shipping")        

        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency=price.currency,
            receipt_email=email,
            shipping=shipping,
            automatic_payment_methods={"enabled": True},
        )
        return jsonify(clientSecret=intent.client_secret)
    except Exception as e:
        return jsonify(error=str(e)), 500

@app.route("/update-payment-intent", methods=["POST"])
def update_payment_intent():
    try:
        data = request.get_json()
        intent_id = data.get("payment_intent_id")
        email = data.get("email")
        shipping = data.get("shipping")

        intent = stripe.PaymentIntent.modify(
            intent_id,
            receipt_email=email,
            shipping=shipping
        )
        return jsonify(success=True)
    except Exception as e:
        return jsonify(error=str(e)), 500

@app.route('/thanks')
def thanks():
    return render_template('thanks.html')

@app.route('/cancel')
def cancel():
    return 'Pagamento cancelado.'



if __name__ == '__main__':
    app.run(port=5001, debug=True)
