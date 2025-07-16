document.addEventListener("DOMContentLoaded", async () => {
  const stripe = Stripe(window.publishableKey);

  const form = document.getElementById("payment-form");
  const message = document.getElementById("payment-message");
  const cardElement = document.getElementById("card-element");

  const elements = stripe.elements();
  const card = elements.create("card");
  card.mount("#card-element");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = {
      amount: 500, 
      email: document.getElementById("email").value,
      shipping: {
        name: document.getElementById("name").value,
        address: {
          line1: document.getElementById("shippingAddressLine1").value,
          city: document.getElementById("shippingLocality").value,
          state: document.getElementById("shippingAdministrativeArea").value,
          country: "BR",
          postal_code: document.getElementById("shippingPostalCode").value
        }
      }
    };

    const response = await fetch("/payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    });

    const { clientSecret } = await response.json();

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card,
        billing_details: {
          name: formData.shipping.name,
          email: formData.email
        }
      },
      shipping: formData.shipping
    });

    if (error) {
      message.textContent = error.message;
    } else if (paymentIntent.status === "succeeded") {
      message.textContent = " Pagamento realizado com sucesso!";
    }
  });
});
