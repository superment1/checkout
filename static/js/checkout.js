document.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch("/get-client-secret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payment_intent_id: window.paymentIntentId })
  });
  const data = await res.json();
  let clientSecret = data.client_secret;
  const PRICE_ID = window.priceId;
  const stripe = Stripe(window.publishableKey);
  const form = document.getElementById("payment-form");
  const message = document.getElementById("payment-message");
  const submitBtn = document.getElementById("submit");
  const price = parseInt(window.productPrice || 0);
  const totalAmount = price;
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
  const refreshBtn = document.getElementById('refresh-btn');

  refreshBtn.addEventListener('click', () => {
    refreshBtn.disabled = true;
     window.location.reload();  
  });
  const modal = document.getElementById("expired-modal");
  let timeLeft = 7*60; 
  const countdownEl = document.getElementById("countdown");

  function openModal() {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }
  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  modal.addEventListener("click", e => {
    if (e.target.dataset.close !== undefined) closeModal();
  });
  function updateTimer() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    if (timeLeft > 0) {
      timeLeft--;
    } else {
      clearInterval(timerInterval);
      countdownEl.textContent = "00:00";
      openModal();
    }
  }
  updateTimer();
  const timerInterval = setInterval(updateTimer, 1000);

  const expressCheckoutElement = elements.create("expressCheckout", {
    buttonType: {
      applePay: "plain",
      googlePay: "buy",
      link: "buy",
    },
    buttonTheme: {
      applePay: "black",
    },
    buttonHeight: 42,
    layout: {
      maxRows: 2,
      maxColumns: 2,
    },
    emailRequired: true,
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

  function getPriceTargets() {
    return [
      document.getElementById('total-price'),
      document.getElementById('title-price-mobile'),
      document.getElementById('total-due-price'), 
      document.getElementById('total-due-price-mobile'), 
      document.querySelector('.product-row-mobile .product-price'),
      document.querySelector('.product-row .product-price'),
    ].filter(Boolean);
  }

  function setPriceText(text) {
    getPriceTargets().forEach(el => { el.textContent = text; });
  }
  function readCurrentTotal() {
    const el = getPriceTargets()[0];
    if (!el) return 0;
    const n = parseFloat((el.textContent || '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  const sym = (window.productCurrency || '').toLowerCase() === 'brl' ? 'R$' : 'US$';

  const pick = (base) => {
    const desk = document.getElementById(`${base}-desktop`);
    const acc  = document.getElementById(`${base}-accordion`);
    const mob  = document.getElementById(base);
    if (isDesktop()) return desk || acc || mob || null;   
    return acc || mob || desk || null;                
  };

  const couponInput = pick("coupon-code");
  const applyButton = pick("apply-coupon");
  const messageBox = pick("coupon-message");
  const btnSpinner = applyButton ? applyButton.querySelector(".btn-spinner") : null;
  const btnLabel   = applyButton ? applyButton.querySelector(".btn-label")   : null;
  const discountValue = pick("discount-value");
  const cancelButton = pick("cancel-coupon");
  const couponIcon = pick("coupon-valid-icon");
  const discountAmount = pick("discount-amount");

  if (!couponInput || !applyButton || !messageBox) {
    console.warn("Coupon UI incompleta para este layout.");
    return;
  }
  let totalNumber = readCurrentTotal();
  const originalTotal = totalNumber;
  const originalClientSecret = clientSecret

  couponInput && couponInput.addEventListener("focus", () => {
    couponInput.classList.add("focused");
  });

  couponInput && couponInput.addEventListener("input", () => {
    if (couponInput.value.trim()) {
      applyButton.style.display = "inline-block";
      btnLabel.style.display = "inline-block";
      btnSpinner.style.display = "none";
    } else {
      btnLabel.style.display = "none";
    }
  });
  cancelButton && cancelButton.addEventListener("click", async () => {
    couponInput.disabled = false;
    couponInput.value = "";
    couponInput.placeholder = "Enter your coupon code";
    cancelButton.style.display = "none";
    discountValue.textContent = "";
    discountValue.style.display = "none";
    btnLabel.style.display = "inline-block";
    couponIcon.style.display = "none"
    discountAmount.style.display = "none";
    applyButton.style.display = "none";

    setPriceText(`${sym} ${originalTotal.toFixed(2)}`);

    try {
      const r = await fetch("/update-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price_id: PRICE_ID }) // agora a variável existe
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "reset failed");

      clientSecret = data.client_secret;
      window.paymentIntentId = data.payment_intent_id;
      elements.update({ clientSecret });
    } catch (e) {
      console.error("Erro ao resetar PaymentIntent:", e);
      clientSecret = originalClientSecret;
      elements.update({ clientSecret });
      window.paymentIntentId = clientSecret.split("_secret")[0];
    }
    couponInput.blur();
  });
  applyButton && applyButton.addEventListener("click", async () => {
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
      discountValue.style.display = "flex"; 
      discountValue.textContent = `${result.discount}% discount`;
      btnSpinner.style.display = "none";
      couponIcon.style.display = "block"
      const before = readCurrentTotal();
      const discounted = +(before * (1 - discount / 100)).toFixed(2);
      setPriceText(`${sym} ${discounted.toFixed(2)}`);
      const amountOff = (before - discounted).toFixed(2);

      discountAmount.style.display = "inline";
      discountAmount.textContent = `-${sym} ${amountOff}`;
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
        return_url:"https://checkout.superment.co/thanks",
        receipt_email: email,
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

  const OLD_PRICE_CENTS_BY_ID = {
    'prod_SbKYsQrxStW8wB':  6000, 
    'prod_SbKa8ag01A2TGX':  18000,   
    'prod_SbKaRuJpDVBEzx':  36000, 
  };
  (function setOldPrice(){
    const cents = OLD_PRICE_CENTS_BY_ID[window.productId];
    if (typeof cents !== 'number') return;

    const sym = (window.productCurrency || '').toLowerCase() === 'brl' ? 'R$' : 'US$';
    const text = `${sym} ${(cents/100).toFixed(2)}`;

    document.querySelectorAll('.price-old').forEach(el => {
      el.textContent = text;
    });
  })();

  // === QUANTITY (mínimo) ===
  const TARGET_PRODUCT_ID = 'prod_SbKYsQrxStW8wB';
  const qtyWrapper = document.querySelectorAll('#qty-wrapper, #qty-wrapper-accordion'); 
  if (window.productId === TARGET_PRODUCT_ID && qtyWrapper.length) {
    qtyWrapper.forEach(w => w.style.setProperty('display', 'flex', 'important'));
    const unitCents = parseInt(window.productPrice || 0, 10);
    let qty = 1;

    function syncInputs() {
      qtyWrapper.forEach(w => {
        const input = w.querySelector('#qty');
        if (input) input.value = String(qty);
      });
    }
    function setQty(newQty) {
      qty = Math.max(1, newQty);
      syncInputs();
      recalcAndSyncPI();
    }
    
    qtyWrapper.forEach(w => {
      const qtyInput = w.querySelector('#qty');
      const qtyMinus = w.querySelector('#qty-minus');
      const qtyPlus  = w.querySelector('#qty-plus');

      qtyMinus?.addEventListener('click', () => setQty(qty - 1));
      qtyPlus?.addEventListener('click',  () => setQty(qty + 1));
      qtyInput?.addEventListener('input', () => {
        const n = parseInt(qtyInput.value || '1', 10);
        setQty(Number.isFinite(n) && n > 0 ? n : 1);
      });
    });
    syncInputs();

    async function recalcAndSyncPI() {
      try {
        const paymentIntentId = clientSecret.split("_secret")[0];

        const res = await fetch("/update-quantity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_intent_id: paymentIntentId, quantity: qty })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          console.warn("Falha ao atualizar PI:", data.error || "Erro");
          return;
        }
        const totalCents = parseInt(data.amount, 10);
        const dollars = (totalCents / 100).toFixed(2);

        const sym = (window.productCurrency || '').toLowerCase() === 'brl' ? 'R$' : 'US$';
        setPriceText(`${sym} ${dollars}`);
        if (window.paymentRequest) {
          window.paymentRequest.update({
            total: { label: 'Order total', amount: totalCents }
          });
        }
      } catch (e) {
        console.error("Erro ao sincronizar quantidade:", e);
      }
    }
  }

  // PRODUCT
  const overlay = document.getElementById('accordionOverlay');
  const details = document.getElementById('product-details');
  const triggers = document.querySelectorAll('.details-trigger');
  const arrowUpSvg = `
    <svg width="10" height="6" viewBox="0 0 10 6" xmlns="http://www.w3.org/2000/svg" style="display:inline; vertical-align:middle; margin-left:4px">
      <path d="M1 5L5 1L9 5" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  const arrowDownSvg = `
    <svg width="10" height="6" viewBox="0 0 10 6" xmlns="http://www.w3.org/2000/svg" style="display:inline; vertical-align:middle; margin-left:4px">
      <path d="M1 1L5 5L9 1" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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
              ? `Close <span class="close-icon">X</span>`
              : `Close <span class="close-icon">X</span>`;
          } else {
            btn.innerHTML = isHeader
              ? `Details ${arrowDownSvg}`
              : `Add your discount code ${arrowDownSvg}`;
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
          ? `Details ${arrowDownSvg}`
          : `Add your discount code ${arrowDownSvg}`;
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