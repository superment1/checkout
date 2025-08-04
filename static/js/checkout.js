document.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch("/get-client-secret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payment_intent_id: window.paymentIntentId })
  });
  const data = await res.json();
  let clientSecret = data.client_secret;

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
    clientSecret,
    appearance,
    locale: "en",
  });

  const expressCheckoutElement = elements.create("expressCheckout", {
    buttonType: {
      applePay: "plain",
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

   function isDesktop() {
    const desktopInput = document.getElementById("coupon-code-desktop");
    return desktopInput && desktopInput.offsetParent !== null;
  }

  function getId(base) {
    return isDesktop() ? `${base}-desktop` : base;
  }
  function $(id) {
    return document.getElementById(getId(id));
  }

  const couponInput = $("coupon-code");
  const applyButton = $("apply-coupon");
  const messageBox = $("coupon-message");
  const btnSpinner = applyButton.querySelector(".btn-spinner");
  const btnLabel = applyButton.querySelector(".btn-label");
  const discountValue = $("discount-value");
  const cancelButton = $("cancel-coupon");
  const couponIcon = $("coupon-valid-icon");
  const totalPriceElement = document.getElementById("total-price");
  const titlePriceDesk = document.getElementById("title-price-desk")
  const totalPriceDesk = document.getElementById("total-price-desk")  
  const titlePriceMobile = document.getElementById("title-price-mobile")
  const discountAmount = $("discount-amount");
  let totalText = totalPriceElement.textContent.trim();
  let totalNumber = parseFloat(totalText.replace(/[^0-9.]/g, ''));
  const originalTotal = totalNumber;
  const originalClientSecret = clientSecret

  couponInput.addEventListener("focus", () => {
    couponInput.classList.add("focused");
  });

  couponInput.addEventListener("input", () => {
    if (couponInput.value.trim()) {
      applyButton.style.display = "inline-block";
      btnLabel.style.display = "inline-block";
      btnSpinner.style.display = "none";
    } else {
      btnLabel.style.display = "none";
    }
  });
  cancelButton.addEventListener("click", () => {
    couponInput.disabled = false;
    couponInput.value = "";
    couponInput.placeholder = "Enter your coupon code";
    cancelButton.style.display = "none";
    discountValue.textContent = "";
    btnLabel.style.display = "inline-block";
    couponIcon.style.display = "none"
    discountAmount.style.display = "none";
    totalPriceElement.textContent = `US$ ${originalTotal.toFixed(2)}`;
    titlePriceDesk.textContent = `US$ ${originalTotal.toFixed(2)}`;
    titlePriceMobile.textContent = `US$ ${originalTotal.toFixed(2)}`;
    totalPriceDesk.textContent = `US$ ${originalTotal.toFixed(2)}`;

    elements.update({ clientSecret: originalClientSecret });
  });
  applyButton.addEventListener("click", async () => {
    const code = couponInput.value.trim();
    messageBox.textContent = ""; 
    messageBox.style.color = ""; 
    if (!code) {
      messageBox.textContent = "Please enter a coupon code.";
      messageBox.style.color = "red";
      return;
    }
    btnLabel.style.display = "none";
    btnSpinner.style.display = "inline-block";

    try {
      const paymentIntentId = clientSecret.split("_secret")[0];

      const response = await fetch("/validate-coupon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ coupon: code, payment_intent_id: paymentIntentId })
      });

      const result = await response.json();

      if (!response.ok) {
        messageBox.textContent = result.error || "Invalid coupon.";
        messageBox.style.color = "red";
        btnSpinner.style.display = "none";

        return;
      }
      const discount = result.discount;
      const newClientSecret = result.new_client_secret;

      couponInput.placeholder = code;
      couponInput.disabled = true;
      cancelButton.style.display = "inline-block"; 
      couponInput.classList.remove("focused");
      discountValue.style.display = "inline"; 
      discountValue.textContent = `${result.discount}% discount`;
      btnSpinner.style.display = "none";
      couponIcon.style.display = "block"
      const discountedPrice = (totalNumber * (1 - discount / 100)).toFixed(2);
      totalPriceElement.textContent = `US$ ${discountedPrice}`; 
      titlePriceDesk.textContent = `US$ ${discountedPrice}`;
      titlePriceMobile.textContent = `US$ ${discountedPrice}`;
      totalPriceDesk.textContent = `US$ ${discountedPrice}`;
      const amountOff = (totalNumber - discountedPrice).toFixed(2);
      discountAmount.style.display = "inline";
      discountAmount.textContent = `-US$ ${amountOff}`;
      clientSecret = newClientSecret;
      window.paymentIntentId = result.paymentIntentId;
      elements.update({ clientSecret: newClientSecret });

    } catch (err) {
      console.error("Erro ao validar cupom:", err);
      alert("Erro na validação do cupom.");
      btnLabel.style.display = "inline-block";
    }
  });

  expressCheckoutElement.mount("#express-checkout-element");
  expressCheckoutElement.on('ready', () => {
  });
  expressCheckoutElement.on('confirm', async (event) => {
  try {
    const {error} = await stripe.confirmPayment({
      elements,
      clientSecret: clientSecret,
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
    
    let billing;
    if (billingCheckbox.checked) {
      // usa o endereço de entrega como billing
      billing = {
        name: shipping.name,
        address: { ...shipping.address }
      };
    } else {
      billing = {
        name: document.getElementById("billing-name")?.value || shipping.name,
        address: {
          line1: document.getElementById("billing-line1")?.value,
          line2: document.getElementById("billing-line2")?.value,
          city: document.getElementById("billing-city")?.value,
          state: document.getElementById("billing-state")?.value,
          postal_code: document.getElementById("billing-postal")?.value,
          country: document.getElementById("billing-country")?.value
        }
      };
    }
    // const billing = {
    //   name: document.getElementById("billing-name")?.value || shipping.name,
    //   address: {
    //     line1: document.getElementById("billing-line1")?.value || "",
    //     line2: document.getElementById("billing-line2")?.value || "",
    //     city: document.getElementById("billing-city")?.value || "",
    //     state: document.getElementById("billing-state")?.value || "",
    //     postal_code: document.getElementById("billing-postal")?.value || "",
    //     country: document.getElementById("billing-country").value
    //   }
    // };
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
    const { error: confirmError } = await stripe.confirmCardPayment(clientSecret, {
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
  const arrowUpSvg = `
    <svg width="10" height="6" viewBox="0 0 10 6" xmlns="http://www.w3.org/2000/svg" style="display:inline; vertical-align:middle; margin-left:4px">
      <path d="M1 5L5 1L9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  const arrowDownSvg = `
    <svg width="10" height="6" viewBox="0 0 10 6" xmlns="http://www.w3.org/2000/svg" style="display:inline; vertical-align:middle; margin-left:4px">
      <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  if (window.innerWidth < 769) {
    triggers.forEach(trigger => {
      trigger.addEventListener('click', () => {
        const isOpen = overlay.classList.toggle('show');
        details.classList.toggle('open');

        triggers.forEach(btn => {
          const isHeader = btn.closest('header');
          const isProductSummary = btn.closest('.product-summary');
          if (isOpen) {
            btn.innerHTML = isHeader
              ? `Close ${arrowUpSvg}`
              : `Close ${arrowUpSvg}`;
          } else {
            btn.innerHTML = isHeader
              ? `View details ${arrowDownSvg}`
              : `Add code ${arrowDownSvg}`;
          }
        });
      });
    });

    overlay.addEventListener('click', (e) => {
      if (!details.contains(e.target)) {
        overlay.classList.remove('show');
        details.classList.remove('open');
        triggers.forEach(btn => {
        const isHeader = btn.closest('header');
        const isProductSummary = btn.closest('.product-summary');

        btn.innerHTML = isHeader
          ? `View details ${arrowDownSvg}`
          : `Add code ${arrowDownSvg}`;
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
  
  function updateBillingRequiredFields(enabled) {
    const billingFields = [
      document.getElementById("billing-name"),
      document.getElementById("billing-country"),
      document.getElementById("billing-line1"),
      document.getElementById("billing-city"),
      document.getElementById("billing-state"),
      document.getElementById("billing-postal"),
    ];

    billingFields.forEach(field => {
      if (field) field.required = enabled;
    });
  }
  function initializeBillingFields() {
    if (billingCheckbox.checked) {
      billingContainer.style.display = "none";
      updateBillingRequiredFields(false);
    } else {
      updateBillingRequiredFields(true);
    }
  }

  function toggleBillingFieldsFromCheckbox() {
    if (billingCheckbox.checked) {
      billingContainer.style.display = "none";
      billingExtraFields.style.display = "none";
      billingToggleLink.style.display = "none";
      billingLine1.classList.remove("expanded");
      updateBillingRequiredFields(false)
    } else {
      billingContainer.style.display = "block";
      billingExtraFields.style.display = "none";
      billingToggleLink.style.display = "block";
      billingLine1.classList.remove("expanded");
      updateBillingRequiredFields(true);
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

  shippingLine1.addEventListener('focus', () => {
    shippingLine1.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
  });
  
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