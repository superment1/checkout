document.addEventListener("DOMContentLoaded", async () => {
  const stripe = Stripe(window.publishableKey);
  const form = document.getElementById("payment-form");
  const message = document.getElementById("payment-message");
  const submitBtn = document.getElementById("submit");
  const price = parseInt(window.productPrice || 0);
  const shippingAmount = 490;
  const totalAmount = price + shippingAmount;
  const currency = window.productCurrency;

  const appearance = {
    theme: "stripe",
    variables: {
      borderRadius: "36px",
    },
  };
  const elements = stripe.elements({
    clientSecret: window.clientSecret,
    appearance,
    locale: "en",
  });

  const expressCheckoutElement = elements.create("expressCheckout", {
    buttonType: {
      applePay: "buy",
      googlePay: "buy",
      link: "buy",
    },
    buttonTheme: {
      applePay: "black",
    },
    buttonHeight: 48,
    layout: {
      maxRows: 2,
      maxColumns: 2,
    },
    collectShippingAddress: true,
  });

  expressCheckoutElement.mount("#express-checkout-element");
  expressCheckoutElement.on('ready', () => {
  });
  expressCheckoutElement.on('confirm', async (event) => {
  try {
    const {error} = await stripe.confirmPayment({
      elements,
      clientSecret: window.clientSecret,
      confirmParams: {
        return_url:"https://superment.co/supersleep/sucess/"
      },
    });

    if (error) {
      console.error("Erro ao confirmar pagamento:", error.message);
     } 
    } catch (err) {
      console.error("Erro no handler confirm:", err);
    }
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
  const cardNumber = elements.create('cardNumber', {
    style,
    disableLink: false
  });
  const cardExpiry = elements.create('cardExpiry', { style });
  const cardCvc = elements.create('cardCvc', { style });
  cardNumber.mount('#card-number-element');
  cardExpiry.mount('#card-expiry-element');
  cardCvc.mount('#card-cvc-element');

  // const paymentElement = elements.create('payment', {
  //   fields: {
  //     billingDetails: {
  //       name: 'auto',
  //       email: 'auto',
  //       address: 'auto',
  //     }
  //   }
  // });

  // const price = parseInt(window.productPrice || 0);
  // const shippingAmount = 490;
  
  
  // if (price <= 0) {
  //   console.error("Valor inválido para o produto. Abortando Google Pay.");
  // } else {
  //   const paymentRequest = stripe.paymentRequest({
  //     country: "US",
  //     currency: currency,
  //     total: {
  //       label: "Total",
  //       amount: totalAmount,
  //     },
  //     requestPayerName: true,
  //     requestPayerEmail: true,
  //     requestShipping: true,
  //     shippingOptions: [
  //       {
  //         id: 'us-shipping',
  //         label: 'U.S. Shipping (At most 7 days)',
  //         detail: '',
  //         amount: shippingAmount,
  //       },
  //     ],
  //   });

  //   const smartPayButton = elements.create("paymentRequestButton", {
  //     paymentRequest,
  //     style: {
  //       paymentRequestButton: {
  //         type: "default",
  //         theme: "dark",
  //         borderRadius: "20px",
  //         height: "40px"
  //       }
  //     }
  //   });
  //   const smartPayContainer = document.getElementById("smart-pay-button");

  //   paymentRequest.canMakePayment().then((result) => {
  //     console.log("canMakePayment result:", result);
  //     if (result && (result.googlePay || result.applePay)) {
  //       if (smartPayContainer.children.length === 0) {
  //         smartPayButton.mount("#smart-pay-button");
  //       }
  //       smartPayContainer.style.display = "block";
  //     } else {
  //       smartPayContainer.style.display = "none";
  //     }
  //   });
  //   paymentRequest.on("paymentmethod", async (ev) => {
  //     console.log("Shipping address fornecido pelo Google/Apple Pay:", ev.shippingAddress);
  //     if (!ev.paymentMethod || !ev.paymentMethod.id) {
  //       console.error("paymentMethod ID ausente");
  //       ev.complete("fail");
  //       if (message) message.textContent = "Erro ao processar o pagamento.";
  //       return;
  //     }

  //     const shipping = {
  //       name: ev.payerName || ev.shippingAddress.recipient || "Cliente",
  //       address: {
  //         line1: ev.shippingAddress.addressLine?.[0] || "",
  //         city: ev.shippingAddress.city || "",
  //         state: ev.shippingAddress.region || "",
  //         postal_code: ev.shippingAddress.postalCode || "",
  //         country: ev.shippingAddress.country || "US"
  //       }
  //     };

  //     const email = ev.payerEmail || "";
  //     await fetch("/update-payment-intent", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({
  //         payment_intent_id: window.clientSecret.split("_secret")[0],
  //         email,
  //         shipping
  //       })
  //     });


  //     console.log("Dados do pagamento:");
  //     console.log("Email:", email);
  //     console.log("Nome:", shipping.name);
  //     console.log("Endereço:", shipping.address);

  //     const { error } = await stripe.confirmCardPayment(window.clientSecret, {
  //       payment_method: ev.paymentMethod.id
  //     });

  //     if (error) {
  //       ev.complete("fail");
  //       if (message) message.textContent = error.message;
  //     } else {
  //       ev.complete("success");
  //       window.location.href = "https://superment.co/supersleep/sucess/";
  //     }
  //   });
  // }

  //   paymentRequest.on("paymentmethod", async (ev) => {
  //     if (!ev.paymentMethod || !ev.paymentMethod.id) {
  //       console.error("paymentMethod ID ausente");
  //       ev.complete("fail");
  //       if (message) message.textContent = "Erro ao processar o pagamento.";
  //       return;
  //     }
  //     const email = document.getElementById("email")?.value || "";
  //     const name = document.getElementById("name")?.value || "Cliente";
  //     const shipping = {
  //       name,
  //       address: {
  //         line1: document.getElementById("shippingAddressLine1")?.value || "",
  //         city: document.getElementById("shippingLocality")?.value || "",
  //         state: document.getElementById("shippingAdministrativeArea")?.value || "",
  //         postal_code: document.getElementById("shippingPostalCode")?.value || "",
  //         country: "US"
  //       }
  //     };
  //     console.log("Dados do pagamento:");
  //     console.log("Email:", email);
  //     console.log("Nome:", name);
  //     console.log("Endereço:", shipping.address);

  //     const { error } = await stripe.confirmCardPayment(window.clientSecret, {
  //       payment_method: ev.paymentMethod.id,
  //       shipping,
  //       receipt_email: email,
  //     });

  //     if (error) {
  //       ev.complete("fail");
  //       if (message) message.textContent = error.message;
  //     } else {
  //       ev.complete("success");
  //       window.location.href = "https://superment.co/supersleep/sucess/";
  //     }
  //   });
  // }
//     const smartPayContainer = document.getElementById("smart-pay-button");

//     paymentRequest.canMakePayment().then((result) => {
//       console.log("canMakePayment result:", result);
//       if (result && (result.googlePay || result.applePay)) {
//         if (smartPayContainer.children.length === 0) {
//           smartPayButton.mount("#smart-pay-button");
//         }
//         smartPayContainer.style.display = "block";
//       } else {
//         smartPayContainer.style.display = "none";
//       }
//     });
//     if (!ev.paymentMethod || !ev.paymentMethod.id) {
//       console.error("paymentMethod ID ausente");
//       ev.complete("fail");
//       message.textContent = "Erro ao processar o pagamento.";
//       return;
// }
//     paymentRequest.on("paymentmethod", async (ev) => {
//       const { error } = await stripe.confirmCardPayment(window.clientSecret, {
//         payment_method: ev.paymentMethod.id,
//         shipping: {
//           name: ev.payerName,
//         },
//         receipt_email: ev.payerEmail
//       });

//       if (error) {
//         ev.complete("fail");
//         message.textContent = error.message;
//       } else {
//         ev.complete("success");
//         window.location.href = "https://superment.co/supersleep/sucess/";
//       }
//     });
//   }

  // === Alternância UI ===
  // const cardRadio = document.getElementById("payment-method-card");
  // const googleRadio = document.getElementById("payment-method-google");
  // const googleDetails = document.querySelector(".google-pay-details");

  // function togglePaymentDetails() {
  //   if (cardRadio.checked) {
  //     cardDetails.style.display = "flex";
  //     googleDetails.style.display = "none";
  //   } else {
  //     cardDetails.style.display = "none";
  //     googleDetails.style.display = "block";
  //   }
  // }

  // function updateSubmitButton() {
  //   const message = document.getElementById("payment-message");
  //     if (googleRadio.checked) {
  //     submitBtn.style.display = "none"; 
  //     message.style.display = "block";
  //   } else {
  //     submitBtn.style.display = "block";
  //     submitBtn.classList.remove("btn-google");
  //     submitBtn.textContent = "Pay";
  //     message.style.display = "none";
  //     }
  // }

  // function updateLabelStyles() {
  //   document.querySelectorAll('.payment-label').forEach(label => {
  //     label.classList.remove('selected');
  //   });

  //   const selected = document.querySelector('input[name="payment-method"]:checked');
  //   if (selected) {
  //     selected.closest('label').classList.add('selected');
  //   }
  // }

  // togglePaymentDetails();
  // updateSubmitButton();
  // updateLabelStyles();
  // cardRadio.addEventListener("change", () => {
  //   togglePaymentDetails();
  //   updateSubmitButton();
  //   updateLabelStyles();
  // });
  // googleRadio.addEventListener("change", () => {
  //   togglePaymentDetails();
  //   updateSubmitButton();
  //   updateLabelStyles()
  // });

  // === SUBMIT com Cartão ===
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;

    const shipping = {
      name: document.getElementById("name").value,
      address: {
        line1: document.getElementById("shippingAddressLine1").value,
        city: document.getElementById("shippingLocality").value,
        state: document.getElementById("shippingAdministrativeArea").value,
        postal_code: document.getElementById("shippingPostalCode").value,
        country: "US"
      }
    };
    
    const billing = {
      name: document.getElementById("billing-name")?.value || shipping.name,
      address: {
        line1: document.getElementById("billing-line1")?.value || "",
        line2: document.getElementById("billing-line2")?.value || "",
        city: document.getElementById("billing-city")?.value || "",
        state: document.getElementById("billing-state")?.value || "",
        postal_code: document.getElementById("billing-postal")?.value || "",
        country: document.getElementById("billing-country").value
      }
    };
    console.log("BILLING", billing)

    const { paymentMethod, error: paymentMethodError } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardNumber,
      billing_details: {
        email: email,
        name: billing.name,
        address: billing.address
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
      window.location.href = "https://checkout.superment.co/thanks";
    }
  });

  // PRODUCT
  const overlay = document.getElementById('accordionOverlay');
  const details = document.getElementById('product-details');
  const triggers = document.querySelectorAll('.details-trigger');

  if (window.innerWidth < 769) {
    triggers.forEach(trigger => {
      trigger.addEventListener('click', () => {
        const isOpen = overlay.classList.toggle('show');
        details.classList.toggle('open');

        // Atualiza o texto em todos os botões
        triggers.forEach(btn => {
          btn.textContent = isOpen ? 'Close ▴' : 'View details ▾';
        });
      });
    });

    overlay.addEventListener('click', (e) => {
      if (!details.contains(e.target)) {
        overlay.classList.remove('show');
        details.classList.remove('open');
        triggers.forEach(btn => {
          btn.textContent = 'View details ▾';
        });
      }
    });
  }

  //Shipping

  // === BILLING ===
  const billingCheckbox = document.getElementById("showBillingFields");
  const billingContainer = document.getElementById("groupShipping-billing");
  const billingExtraFields = document.getElementById("billingExtraFields");
  const billingToggleLink = document.getElementById("showMoreFields-billing");
  const billingLine1 = document.getElementById("billing-line1");

  function initializeBillingFields() {
    if (billingCheckbox.checked) {
      billingContainer.style.display = "none";
    }
  }

  function toggleBillingFieldsFromCheckbox() {
    if (billingCheckbox.checked) {
      billingContainer.style.display = "none";
      billingExtraFields.style.display = "none";
      billingToggleLink.style.display = "none";
      billingLine1.classList.remove("expanded");
    } else {
      billingContainer.style.display = "block";
      billingExtraFields.style.display = "none";
      billingToggleLink.style.display = "block";
      billingLine1.classList.remove("expanded");
    }
  }

  function toggleBillingFieldsFromLink(e) {
    e.preventDefault();
    billingExtraFields.style.display = "block";
    billingToggleLink.style.display = "none";
    billingLine1.classList.add("expanded");
    billingLine1.classList.add("expanded")

  }

  billingCheckbox.addEventListener("change", toggleBillingFieldsFromCheckbox);
  billingToggleLink.addEventListener("click", toggleBillingFieldsFromLink);
  initializeBillingFields();


  // === SHIPPING ===
  const shippingToggleLink = document.getElementById("showMoreFields");
  const shippingExtraFields = document.getElementById("extraFields");
  const shippingLine1 = document.getElementById("shippingAddressLine1");

  function expandShippingAddressFields() {
    if (shippingExtraFields && shippingToggleLink) {
      shippingExtraFields.style.display = "block";
      shippingToggleLink.style.display = "none";
      shippingLine1.classList.add("expanded");
    }
  }

  if (shippingToggleLink && shippingExtraFields && shippingLine1) {
    shippingToggleLink.addEventListener("click", (e) => {
      e.preventDefault();
      expandShippingAddressFields();
    });

    shippingLine1.addEventListener("blur", () => {
      if (shippingLine1.value.trim().length > 3) {
        expandShippingAddressFields();
      }
    });
  }

  async function goToCheckout(productId) {
  const res = await fetch(`/get-price-id?product_id=${productId}`);
  const data = await res.json();
  
    if (data.price_id) {
      window.location.href = `/checkout?price_id=${data.price_id}`;
    } else {
      alert("Erro ao obter preço.");
    }
  }
})