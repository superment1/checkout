import os
from flask import Flask, render_template, redirect, request, jsonify
import stripe
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY")
DOMAIN = os.getenv("DOMAIN", "http://localhost:5000")

@app.route('/')
def index():
    return render_template(
        'teste.html',
        publishable_key=PUBLISHABLE_KEY,
        product=None,
        price=None
    )

@app.route("/checkout")
def checkout():
    price_id = request.args.get("price_id")
    if not price_id:
        return "price_id missing", 400
    try:
        price = stripe.Price.retrieve(price_id)
        product = stripe.Product.retrieve(price.product)

        # Criação imediata do PaymentIntent
        intent = stripe.PaymentIntent.create(
            amount=price.unit_amount,
            currency=price.currency,
            automatic_payment_methods={"enabled": True}
        )
        print(f"[DEBUG] AQUI client_secret gerado: {intent.client_secret}")
        return render_template(
            "index.html", 
            price=price,
            product=product,
            publishable_key=PUBLISHABLE_KEY,
            client_secret=intent.client_secret
        )
    except Exception as e:
        return f"Erro: {str(e)}", 500

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

@app.route("/pay", methods=["POST"])
def pay():
    data = request.json
    payment_method_id = data.get("paymentMethodId")

    intent = stripe.PaymentIntent.create(
        amount=5000,
        currency="brl",
        payment_method=payment_method_id,
        confirmation_method="manual",
        confirm=True,
    )

    return jsonify({"status": intent.status})
    
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


@app.route("/payment-intent", methods=["POST"])
def create_payment():
    try:
        data = request.get_json()
        amount = data.get("amount")
        email = data.get("email")
        shipping = data.get("shipping")        

        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency="brl",
            receipt_email=email,
            shipping=shipping,
            automatic_payment_methods={"enabled": True},
        )
        return jsonify(clientSecret=intent.client_secret)
    except Exception as e:
        return jsonify(error=str(e)), 500

@app.route('/success')
def success():
    return 'Pagamento realizado com sucesso!'

@app.route('/cancel')
def cancel():
    return 'Pagamento cancelado.'



if __name__ == '__main__':
    app.run(port=5000, debug=True)
