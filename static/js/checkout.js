
document.addEventListener("DOMContentLoaded", async () => {
  const stripe = Stripe(window.publishableKey);
  const form = document.getElementById("payment-form");
  const message = document.getElementById("payment-message");
  const submitBtn = document.getElementById("submit");

  const elements = stripe.elements({
    clientSecret: window.clientSecret,
    appearance: {
      theme: 'none',
      variables: {
        colorPrimary: '#000000',
        colorBackground: '#ffffff',
        colorText: '#333333',
        borderRadius: '8px',
        fontFamily: 'Inter, sans-serif',
      },
    },
  });

  const style = {
    base: {
      fontSize: '16px',
      color: '#333',
      backgroundColor: '#fff',
      border: '1px solid #ccc',
      padding: '12px',
      borderRadius: '8px',
      '::placeholder': {
        color: '#999',
      },
    },
    invalid: {
      color: '#fa755a',
      iconColor: '#fa755a',
    },
  };

  // === Cartão ===
  const cardDetails = document.querySelector(".card-details");
  cardDetails.style.display = "block";
  const cardNumber = elements.create('cardNumber', { style });
  const cardExpiry = elements.create('cardExpiry', { style });
  const cardCvc = elements.create('cardCvc', { style });
  cardNumber.mount('#card-number-element');
  cardExpiry.mount('#card-expiry-element');
  cardCvc.mount('#card-cvc-element');

  // === Google Pay ===

  const paymentRequest = stripe.paymentRequest({
    country: "BR",
    currency: "brl",
    total: {
      label: "Total",
      amount: 5000, // valor em centavos (ex: R$ 50,00)
    },
    requestPayerName: true,
    requestPayerEmail: true,
    requestShipping: false,
  });

  const googlePayButton = elements.create("paymentRequestButton", {
    paymentRequest,
    style: {
      paymentRequestButton: {
        type: "default",
        theme: "dark",
        height: "40px"
      }
    }
  });

  paymentRequest.canMakePayment().then((result) => {
    console.log("canMakePayment result:", result);
    if (result) {
      googlePayButton.mount("#google-pay-button");
    } else {
      document.querySelector(".google-pay-details").style.display = "none";
    }

  });

  paymentRequest.on("paymentmethod", async (ev) => {
    const { error } = await stripe.confirmCardPayment(window.clientSecret, {
      payment_method: ev.paymentMethod.id,
      shipping: {
        name: ev.payerName,
      },
      receipt_email: ev.payerEmail
    });

    if (error) {
      ev.complete("fail");
      message.textContent = error.message;
    } else {
      ev.complete("success");
      window.location.href = "https://superment.co/supersleep/sucess/";
    }
  });

  // === Alternância UI ===
  const cardRadio = document.getElementById("payment-method-card");
  const googleRadio = document.getElementById("payment-method-google");
  const googleDetails = document.querySelector(".google-pay-details");

  function togglePaymentDetails() {
    if (cardRadio.checked) {
      cardDetails.style.display = "flex";
      googleDetails.style.display = "none";
    } else {
      cardDetails.style.display = "none";
      googleDetails.style.display = "block";
    }
  }

  function updateSubmitButton() {
    const message = document.getElementById("payment-message");
      if (googleRadio.checked) {
      submitBtn.style.display = "none"; 
      message.style.display = "block";
    } else {
      submitBtn.style.display = "block";
      submitBtn.classList.remove("btn-google");
      submitBtn.textContent = "Pagar";
      message.style.display = "none";
      }
  }

  togglePaymentDetails();
  updateSubmitButton();
  cardRadio.addEventListener("change", () => {
    togglePaymentDetails();
    updateSubmitButton();
  });
  googleRadio.addEventListener("change", () => {
    togglePaymentDetails();
    updateSubmitButton();
  });

  // === SUBMIT com Cartão ===
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (googleRadio.checked) {
      // Google Pay não precisa de submit manual
      message.textContent = "Finalize o pagamento com o botão do Google acima.";
      return;
    }

    const email = document.getElementById("email").value;
    const shipping = {
      name: document.getElementById("name").value,
      address: {
        line1: document.getElementById("shippingAddressLine1").value,
        city: document.getElementById("shippingLocality").value,
        state: document.getElementById("shippingAdministrativeArea").value,
        postal_code: document.getElementById("shippingPostalCode").value,
        country: "BR"
      }
    };

    const { paymentMethod, error: paymentMethodError } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardNumber,
      billing_details: {
        email: email,
        name: shipping.name,
        address: shipping.address
      }
    });

    if (paymentMethodError) {
      message.textContent = paymentMethodError.message;
      return;
    }

    const { error: confirmError } = await stripe.confirmCardPayment(window.clientSecret, {
      payment_method: paymentMethod.id,
      receipt_email: email,
      shipping: shipping
    });

    if (confirmError) {
      message.textContent = confirmError.message;
    } else {
      window.location.href = "https://superment.co/supersleep/sucess/";
    }
  });
  // PRODUCT
    const toggle = document.getElementById('details-toggle');
    const details = document.getElementById('product-details');

    if (window.innerWidth < 769) {
      toggle.addEventListener('click', () => {
        details.classList.toggle('open');
        toggle.textContent = details.classList.contains('open')
          ? 'Esconder detalhes ▴'
          : 'Detalhes ▾';
      });
    }
  
  //Shipping

  const toggleLink = document.getElementById("showMoreFields");
  const extraFields = document.getElementById("extraFields");
  const addressLine1 = document.getElementById("shippingAddressLine1");

  
  function expandAddressFields() {
    if (extraFields && toggleLink) {
      extraFields.style.display = "block";
      toggleLink.style.display = "none";
      addressLine1.classList.add("expanded");
    }
  }
  if (toggleLink && extraFields && addressLine1) {
    // Ao clicar no link
    toggleLink.addEventListener("click", (e) => {
      e.preventDefault();
      expandAddressFields();
    });

    // Ao sair do input (blur)
    addressLine1.addEventListener("blur", () => {
      if (addressLine1.value.trim().length > 3) {
        expandAddressFields();
      }
    });
  }
});

