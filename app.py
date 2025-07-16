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

        return render_template(
            "index.html", 
            price=price,
            product=product,
            publishable_key=PUBLISHABLE_KEY)
    except Exception as e:
        return f"Erro: {str(e)}", 500

@app.route("/create-payment-intent", methods=["POST"])
def create_payment_intent():
    try:
        data = request.get_json()

        amount = data.get("amount", 0)
        currency = data.get("currency", "brl")
        customer_email = data.get("email")
        shipping = data.get("shipping")

        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency=currency,
            receipt_email=customer_email,
            automatic_payment_methods={"enabled": True},
            shipping=shipping 
        )

        return jsonify({"clientSecret": intent.client_secret})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/payment-intent", methods=["POST"])
def create_payment():
    try:
        data = request.get_json()
        amount = data.get("amount")

        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency="brl",
            automatic_payment_methods={"enabled": True},
        )
        return jsonify(clientSecret=intent.client_secret)
    except Exception as e:
        return jsonify(error=str(e)), 500

@app.route("/check-stripe")
def check_stripe():
    try:
        products = stripe.Product.list(limit=10)
        return jsonify({"status": "ok", "products": products.data})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/success')
def success():
    return 'Pagamento realizado com sucesso!'

@app.route('/cancel')
def cancel():
    return 'Pagamento cancelado.'

if __name__ == '__main__':
    app.run(port=5000, debug=True)
