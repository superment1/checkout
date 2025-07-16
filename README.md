# Flask Stripe Checkout

This project is a simple web application using **Flask** as the backend framework and the **Stripe API** for payment processing. It is designed to provide a secure and modern checkout flow, easily integrated into your website.

> Live demo: [https://checkout.superment.co](https://checkout.superment.co)

## Technologies Used

- [Python 3.11](https://www.python.org/)
- [Flask](https://flask.palletsprojects.com/)
- [Stripe API](https://stripe.com/docs/api)
- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- [Nginx](https://www.nginx.com/)
- [Certbot (Let's Encrypt)](https://certbot.eff.org/)

## Project Structure

├── app.py # Main Flask application
├── requirements.txt # Python dependencies
├── Dockerfile # Docker image definition
├── docker-compose.yml # Docker Compose service configuration
├── passenger_wsgi.py # WSGI entrypoint for Passenger (optional)
├── static/ # Static assets (CSS, JS, images)
├── templates/ # Jinja2 HTML templates
└── README.md # Project documentation

## How to Run Locally

### Clone the repository

git clone git@github.com:superment1/checkout.git
cd checkout

Create a virtual environment and install dependencies

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
Run the Flask application

python app.py
The application will be available at:

http://localhost:5000
