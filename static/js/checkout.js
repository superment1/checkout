document.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch("/get-client-secret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payment_intent_id: window.paymentIntentId }),
  });
  try {
    const countryRes = await fetch("/get-country");
    const countryData = await countryRes.json();
    window.USER_COUNTRY = countryData?.country || null;
    console.log("country server:", window.USER_COUNTRY);
  } catch (e) {
    console.error("Erro ao detectar país:", e);
  }
  if (!window.USER_COUNTRY) {
    async function detectClientCountryFallback() {
      const providers = [
        { url: 'https://ipwho.is/', pick: j => j && j.success ? j.country : null },
        { url: 'https://ipinfo.io/json', pick: j => j && j.country ? j.country : null,
          toName: code => ({ BR:'Brazil', US:'United States', CA:'Canada', GB:'United Kingdom', IE:'Ireland' }[code] || code) },
        { url: 'https://get.geojs.io/v1/ip/country.json', pick: j => j && j.name ? j.name : null },
      ];
      for (const p of providers) {
        try {
          const r = await fetch(p.url, { cache: 'no-store' });
          if (!r.ok) continue;
          const j = await r.json();
          let v = p.pick(j);
          if (v && p.toName) v = p.toName(v);
          if (v) return v;
        } catch (_) {}
      }
      const lang = (navigator.language || '').toLowerCase();
      if (lang.includes('pt-br')) return 'Brazil';
      if (lang.startsWith('en-')) return 'United States';
      return null;
    }
    window.USER_COUNTRY = await detectClientCountryFallback();
    console.log('client:', window.USER_COUNTRY);
  }
  function resolveMarket(countryName) {
    const byName = {
      'Brazil':         { cc: 'BR', cur: 'brl', locale: 'pt', sym: 'R$' },
      'United States':  { cc: 'US', cur: 'usd', locale: 'en', sym: 'US$' },
      'Canada':         { cc: 'CA', cur: 'cad', locale: 'en', sym: 'CA$' },
      'United Kingdom': { cc: 'GB', cur: 'gbp', locale: 'en', sym: '£' },
      'Ireland':        { cc: 'IE', cur: 'eur', locale: 'en', sym: '€' },
      'Germany':        { cc: 'DE', cur: 'eur', locale: 'de', sym: '€' },
      'France':         { cc: 'FR', cur: 'eur', locale: 'fr', sym: '€' },
      'Spain':          { cc: 'ES', cur: 'eur', locale: 'es', sym: '€' },
      'Italy':          { cc: 'IT', cur: 'eur', locale: 'it', sym: '€' },
      'Portugal':       { cc: 'PT', cur: 'eur', locale: 'pt', sym: '€' },
    };
    if (countryName && byName[countryName]) return byName[countryName];
    return { cc: 'IE', cur: 'eur', locale: 'en', sym: '€' };
  }

  window.MARKET = resolveMarket(window.USER_COUNTRY);
  (function ensureServerCurrencyMatchesMarket() {
    try {
      const want = (window.MARKET?.cur || '').toLowerCase();
      const have = (window.productCurrency || '').toLowerCase();
      if (!want || !have) return;

      // Se já está certo, não faz nada
      if (want === have) return;

      // Já tem parâmetro currency? então não entra em loop
      const url = new URL(window.location.href);
      if (url.searchParams.get('currency')) return;

      // Peça ao backend para re-renderizar com o price correto
      url.searchParams.set('currency', want);
      // Mantém o price_id atual; o backend usará o product do price para achar o price na moeda desejada
      window.location.replace(url.toString());
    } catch (_) {}
  })();

  const data = await res.json();
  let clientSecret = data.client_secret;
  const PRICE_ID = window.priceId;
  const stripe = Stripe(window.publishableKey);
  const form = document.getElementById("payment-form");
  const message = document.getElementById("payment-message");
  const submitBtn = document.getElementById("submit");

  // const price = parseInt(window.productPrice || 0);
  // const totalAmount = price;

  const totalCents = Number(window.productPrice || 0);
  const currency = (window.MARKET?.cur || window.productCurrency || 'usd').toLowerCase();

  const appearance = {
    theme: "stripe",
    variables: {
      borderRadius: "36px",
    },
  };
  const elements = stripe.elements({
    clientSecret,
    appearance,
    locale: window.MARKET?.locale || "en",
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
    billingAddressRequired: false,
    shippingAddressRequired: true, 
    // allowedShippingCountries: ['US', "BR"], 
    allowedShippingCountries: ['US','BR','CA','GB','IE'],
    shippingRates: [
      {
        id: "free",
        displayName: "Free shipping",
        amount: 0,
        deliveryEstimate: {
          maximum: { unit: "day", value: 7 }
        },
      },
    ],
  });
  window.__paymentInProgress = true;
  try {
    // await stripe.confirmPayment(...)
  } finally {
    window.__paymentInProgress = false;
  }
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

  const sym = (window.MARKET?.sym) || ((currency === 'brl') ? 'R$'
           : (currency === 'usd') ? 'US$'
           : (currency === 'cad') ? 'CA$'
           : (currency === 'gbp') ? '£' : '€');
           

  console.log(' country', window.USER_COUNTRY);
  console.log('currency:', (window.MARKET?.cur || window.productCurrency || 'usd'));

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
  } else {
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
          body: JSON.stringify({ price_id: PRICE_ID })
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
  }
  const pr = stripe.paymentRequest({
    country: (window.MARKET?.cc || 'US'),
    currency: (window.MARKET?.cur || window.productCurrency || 'usd'),
    total: { label: 'Order total', amount: totalCents }, // usa direto o valor do back
  });
  // const pr = stripe.paymentRequest({
  //   country: (window.MARKET?.cc || 'US'),
  //   currency: (window.MARKET?.cur || 'usd'),
  //   total: { label: 'Order total', amount: Math.round((totalAmount || 0) * 100) },
  // });
  
  pr.canMakePayment()
    .then((res) => {
    })
    .catch((err) => console.error('canMakePayment error:', err));

  expressCheckoutElement.mount("#express-checkout-element");
  expressCheckoutElement.on('ready', (ev) => {
  const methods = ev?.availablePaymentMethods || {};
  const hasWallet = !!(methods.applePay || methods.googlePay || methods.link);

  const wrap = document.getElementById('express-wrap');
  if (hasWallet) {
    // revela
    wrap.style.opacity = '1';
    wrap.style.height = 'auto';
    wrap.style.overflow = 'visible';
  } else {
    // wrap.remove();
  }
});
  expressCheckoutElement.on('confirm', async (event) => {
    try {
      const {error} = await stripe.confirmPayment({
        elements,
        clientSecret: clientSecret,
        confirmParams: {
          return_url:"https://checkout.superment.co/thanks",
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
        country: window.MARKET?.cc || "US"
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
          country: document.getElementById("billing-country")?.value || (window.MARKET?.cc || "US")
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
  const OLD_PRICE_CENTS = {
    // Super Natural Sleep — 1 Bottle
    'prod_SbKYsQrxStW8wB': {
      usd: 6000,   
      brl: 36000,  
      eur: 6000,  
      gbp: 5000,   
      cad: 8500 
    },

    // Sleep — 3 Bottles (exemplo)
    'prod_SbKa8ag01A2TGX': {
      usd: 18000,
      brl: 98000,
      eur: 18000,
      gbp: 14900,
      cad: 26500
    },

    // Sleep — 6 Bottles (exemplo)
    'prod_SbKaRuJpDVBEzx': {
      usd: 36000,
      brl: 199900,
      eur: 32500,
      gbp: 29000,
      cad: 51000
    }
  };
  (function setOldPrice(){
    const pid = window.productId;
    const cur = (window.MARKET?.cur || window.productCurrency || 'usd').toLowerCase();
    const cents = OLD_PRICE_CENTS[pid]?.[cur];

    if (typeof cents !== 'number') return;

    const sym =
      cur === 'brl' ? 'R$' :
      cur === 'cad' ? 'CA$' :
      cur === 'gbp' ? '£' :
      cur === 'eur' ? '€' : 'US$';

    const text = `${sym} ${(cents/100).toFixed(2)}`;

    document.querySelectorAll('.price-old').forEach(el => {
      el.textContent = text;
    });
  })();
  // const OLD_PRICE_CENTS_BY_ID = {
  //   'prod_SbKYsQrxStW8wB':  6000, 
  //   'prod_SbKa8ag01A2TGX':  18000,   
  //   'prod_SbKaRuJpDVBEzx':  36000, 
  // };
  // (function setOldPrice(){
  //   const cents = OLD_PRICE_CENTS_BY_ID[window.productId];
  //   if (typeof cents !== 'number') return;

  //   const sym = (window.productCurrency || '').toLowerCase() === 'brl' ? 'R$' : 'US$';
  //   const text = `${sym} ${(cents/100).toFixed(2)}`;

  //   document.querySelectorAll('.price-old').forEach(el => {
  //     el.textContent = text;
  //   });
  // })();

  // === QUANTITY (mínimo) ===
  const TARGET_PRODUCT_IDS = [
    "prod_SbKYsQrxStW8wB",
    "prod_T2jNgj5cCjXcvG"
  ];
  const qtyWrapper = document.querySelectorAll('#qty-wrapper, #qty-wrapper-accordion'); 

  if (TARGET_PRODUCT_IDS.includes(window.productId) && qtyWrapper.length) {
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
              couponInput.focus();
              couponInput.classList.add("focused");
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
  const testimonials = {};

    const sleepTestimonials  = [
      {
        name: "LIGIANI G., 44",
        location: "Boston, MA",
        text: "This is amazing. I take it and I’m out like a rock. Best sleep I’ve had in a long time."
      },
      {
        name: "BRUNA R., 38",
        location: "New York, NY",
        text: "I’m honestly loving it. I fall asleep so fast now. That never used to happen. One capsule is all I need, and I’m finally getting real sleep."
      },
      {
        name: "ELISEU C., 40",
        location: "Fort Lauderdale, FL",
        text: "I never had trouble falling asleep, but I always woke up at night to pee. Now I sleep straight through, and I feel way more rested during the day."
      },
      {
        name: "DANIELLE A., 37",
        location: "Los Angeles, CA",
        text: "I took two the first night and it completely knocked me out. I didn’t expect it to work so well, but it really does."
      },
      {
        name: "NUALA O., 35",
        location: "Miami, FL",
        text: "I used to be up until 5, sometimes 10 in the morning. Now I’m asleep by 9 or 10 p.m. No grogginess, just real sleep."
      }
    ]
    const relaxTestimonials  = [
      {
        name: "LIGIANI G., 44",
        location: "Boston, MA",
        text: "I used to arrive very stressed from work and still I couldn't rest… Now I'm finally able to relax and sleep again."
      },
      {
        name: "BRUNA R., 38",
        location: "New York, NY",
        text: "I just started but already feel less pain in my legs, which also helped me to rest at night."
      },
      {
        name: "ELISEU C., 40",
        location: "Fort Lauderdale, FL",
        text: "I used to wake up at night to pee and then couldn’t fall back asleep. Now I sleep through and have way more energy in the day."
      },
      {
        name: "DANIELLE A., 37",
        location: "Los Angeles, CA",
        text: "I feel less worried now and not snapping so much at my relatives. Honestly more calm overall."
      },
      {
        name: "NUALA O., 35",
        location: "Miami, FL",
        text: "I wasn’t expecting much, but I’m sleeping better and waking up with more energy."
      }
    ]
  
  const sleepIds = [
    "prod_SbKa8ag01A2TGX",
    "prod_SbKaRuJpDVBEzx",
    "prod_SbKYsQrxStW8wB",
  ];
  const relaxIds = [
    "prod_T2jNgj5cCjXcvG",
    "prod_T2jOmiPYB2SrZd",
    "prod_T2jPp4I1S0cfol",
  ];

  for (let i = 0; i < sleepIds.length; i++) testimonials[sleepIds[i]] = sleepTestimonials;
  for (let i = 0; i < relaxIds.length; i++) testimonials[relaxIds[i]] = relaxTestimonials;

  const DEFAULT_ID = "prod_SbKYsQrxStW8wB";

  function updateLogo() {
    const theme = getCurrentTheme();              
    const srcByTheme = {
      sleep:   '/static/img/sleep-logo1.webp',
      relax:   '/static/img/relax-logo1.webp',
      default: '/static/img/sleep-logo1.webp'
    };
    document.querySelectorAll('.logo-superment').forEach((el) => {
      el.setAttribute('data-product', theme);
      el.style.backgroundImage = `url("${srcByTheme[theme] || srcByTheme.default}")`;
    });
  }
  function getCurrentTestimonials() {
    const id = window.productId || document.documentElement.dataset.product || DEFAULT_ID;
    let list = testimonials[id] || testimonials[DEFAULT_ID] || [];
    if (!Array.isArray(list)) list = [];
    return list;
  }
  const NAME_COLOR = {
    default: '#222',
    sleep:   '#fff',
    relax:   '#370F1E',
  };
  const VERIFIED_COLORS = {
    default: { bg: '#4DBCB6', fg: '#fff' },
    sleep:   { bg: '#fff', fg: '#0C69FC' },
    relax:   { bg: '#fff', fg: '#370F1E' },
  };
  VERIFIED_NAME_COLORS ={
    default: '#0C69FC',
    sleep:   '#0C69FC',
    relax:   '#370F1E',
  }
  function verifiedSVG(theme){    
    const c = VERIFIED_COLORS[theme] || VERIFIED_COLORS.default;
    return `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="${c.bg}">
      <path d="M5.26674 9.08511C5.26674 6.94071 6.97818 5.18825 9.12198 5.13748L12.522 5.05696C14.8222 5.00248 16.6914 6.89999 16.6024 9.19912C16.5195 11.3406 14.7594 13.0338 12.6164 13.0338H9.21547C7.03465 13.0338 5.26674 11.2659 5.26674 9.08511Z" fill="${c.bg}"/>
      <path d="M18.8948 10.9421C18.6347 10.4426 18.6347 9.84938 18.8948 9.34985L19.3683 8.44707C19.8132 7.60152 19.4724 6.55564 18.6164 6.13157L17.7032 5.68148C17.1985 5.43172 16.8499 4.9504 16.7666 4.39364L16.6209 3.38419C16.4831 2.43978 15.5933 1.79456 14.6515 1.95326L13.6472 2.12497C13.0905 2.22124 12.5259 2.03652 12.133 1.63326L11.4202 0.904784C10.7541 0.220541 9.65363 0.220541 8.98759 0.904784L8.27473 1.63326C7.88188 2.03652 7.31731 2.22124 6.76055 2.12497L5.7563 1.95326C4.81449 1.79456 3.92471 2.43978 3.78682 3.38419L3.63853 4.39364C3.55787 4.9504 3.20925 5.43172 2.70452 5.68148L1.79133 6.13157C0.935373 6.55564 0.594552 7.60152 1.03944 8.44707L1.51295 9.34985C1.77312 9.84938 1.77312 10.4426 1.51295 10.9421L1.03944 11.8449C0.594552 12.6904 0.935373 13.7363 1.79133 14.1604L2.70452 14.6105C3.20925 14.8602 3.55787 15.3415 3.63853 15.8983L3.78682 16.9078C3.92471 17.8522 4.81449 18.4974 5.7563 18.3387L6.76055 18.167C7.31731 18.0707 7.88188 18.2554 8.27473 18.6587L8.98759 19.3872C9.65363 20.0714 10.7541 20.0714 11.4202 19.3872L12.133 18.6587C12.5259 18.2554 13.0905 18.0707 13.6472 18.167L14.6515 18.3387C15.5933 18.4974 16.4831 17.8522 16.6209 16.9078L16.7666 15.8983C16.8499 15.3415 17.1985 14.8602 17.7032 14.6105L18.6164 14.1604C19.4724 13.7363 19.8132 12.6904 19.3683 11.8449L18.8948 10.9421ZM15.7468 7.31534C13.8323 9.42103 10.4732 12.9482 9.38977 13.03C9.37412 13.0312 9.35972 13.0338 9.34403 13.0338C8.20709 13.0338 6.54201 10.4842 5.64703 8.957C5.50133 8.70724 5.58459 8.38983 5.83175 8.24414C6.07891 8.09844 6.39892 8.1817 6.54461 8.42886C7.59829 10.224 8.5635 11.8449 9.34403 11.9995C9.91466 12.1126 12.7548 9.05847 14.9767 6.61548C15.1718 6.40214 15.4996 6.38654 15.713 6.58166C15.9263 6.77419 15.9419 7.1046 15.7468 7.31534Z" fill="${c.fg}"/>
    </svg>
    `
  }
  function cardHTML(dep, isDesktop, theme) {
    var locClass = isDesktop ? ' class="state"' : '';
    var textClass = isDesktop ? 'depoiments-desk' : 'depoiments';
    var nameStyle = ' style="color:' + (NAME_COLOR[theme] || NAME_COLOR.default) + ';"';
    var verifieldStyle  = ' style="color:' + (VERIFIED_NAME_COLORS[theme] || NAME_COLOR.default) + ';"';
    
    return (
        '<div class="dep">' +
        '<div class="title-dep">' +
          '<h1' + nameStyle + '>' + dep.name + '</h1>' +
          verifiedSVG(theme) + 
          '<p' + verifieldStyle +'>Verified Customer</p>' +
        '</div>' +
        '<p' + locClass + '>' + dep.location + '</p>' +
        '<span class="' + textClass + '">' + dep.text + '</span>' +
      '</div>'
    );
  }
  function rebuildMobile(list) {
    var theme = getCurrentTheme();
    var containers = document.querySelectorAll(".testimonials");
    for (let c = 0; c < containers.length; c++) {
      var container = containers[c];
      var satisfaction = container.querySelector(".satisfaction");
      var real = container.querySelector(".real");
      var existing = container.querySelectorAll(".dep");
      for (let i = 0; i < existing.length; i++) existing[i].remove();
      for (let j = 0; j < list.length; j++) {
        container.insertAdjacentHTML("beforeend", cardHTML(list[j], false, theme));
      }
      if (satisfaction && container.firstElementChild !== satisfaction) {
        container.insertBefore(satisfaction, container.firstChild);
      }
      if (real) container.appendChild(real);
    }
  }
  function rebuildDesktop(list) {
    var theme = getCurrentTheme();
    var tracks = document.querySelectorAll(".testimonials-desktop .dep-track");
    for (let t = 0; t < tracks.length; t++) {
      var track = tracks[t];
      track.innerHTML = "";
      for (let k = 0; k < list.length; k++) {
        track.insertAdjacentHTML("beforeend", cardHTML(list[k], true, theme ));
      }
    }
  }

  function applyTestimonialsBoth() {
    try {
      var list = getCurrentTestimonials();
      if (!list.length) {
        console.warn("[apply] lista vazia — nada a fazer");
        return;
      }
      rebuildMobile(list);
      rebuildDesktop(list);
    } catch (e) {
      console.error("[apply] erro:", e);
    }
  }
  const ThemeById = {};
  sleepIds.forEach(id => ThemeById[id] = "sleep");
  relaxIds.forEach(id => ThemeById[id] = "relax");

  function getCurrentProductId() {
    return window.productId || document.documentElement.dataset.product || DEFAULT_ID;
  }
  function getCurrentTheme() {
    const id = getCurrentProductId();
    return ThemeById[id] || "default";
  }
  function applyThemeFromProduct() {
    document.documentElement.setAttribute("data-theme", getCurrentTheme());
    updateLogo(getCurrentProductId());
  }

  applyThemeFromProduct();  
  applyTestimonialsBoth();

    const marqueeTexts = {
      "prod_SbKYsQrxStW8wB": [
        "Made in the USA",
        "Clean, natural, no fillers",
        "Save up to 57%",
        "Up to 120-day money-back guarantee",
        "Real reviews rated 4.9/5.0",
        "Free U.S shipping"
      ],
      "prod_SbKa8ag01A2TGX": [
        "Made in the USA",
        "Clean, natural, no fillers",
        "Save up to 57%",
        "Up to 120-day money-back guarantee",
        "Real reviews rated 4.9/5.0",
        "Free U.S shipping"
      ],
      "prod_SbKaRuJpDVBEzx": [
        "Made in the USA",
        "Clean, natural, no fillers",
        "Save up to 57%",
        "Up to 120-day money-back guarantee",
        "Real reviews rated 4.9/5.0",
        "Free U.S shipping"
      ],
      "prod_T2jNgj5cCjXcvG": [
        'Save 14%',
        'Free Shipping',
        '120-Day Money-Back Guarantee',
        '100% Plant-Based',
        'Science-Backed',
        'Non-Sedative',
        'Non-Habit Forming',
        'Caffeine-Free',
        'Gluten, Soy & Dairy-Free',
        'Made in the USA',
        'GMP-Certified Facility',
      ],
      "prod_T2jOmiPYB2SrZd": [
        'Save 14%',
        'Free Shipping',
        '120-Day Money-Back Guarantee',
        '100% Plant-Based',
        'Science-Backed',
        'Non-Sedative',
        'Non-Habit Forming',
        'Caffeine-Free',
        'Gluten, Soy & Dairy-Free',
        'Made in the USA',
        'GMP-Certified Facility',
      ],
      "prod_T2jPp4I1S0cfol": [
        'Save 14%',
        'Free Shipping',
        '120-Day Money-Back Guarantee',
        '100% Plant-Based',
        'Science-Backed',
        'Non-Sedative',
        'Non-Habit Forming',
        'Caffeine-Free',
        'Gluten, Soy & Dairy-Free',
        'Made in the USA',
        'GMP-Certified Facility',
      ]
    };

  function buildMarqueeLine(items) {
    return `<p>${items.map(t => `${t} <span class="espacada">|</span>`).join(" ")}</p>`;
  }
  function restart(el){
    el.style.animation = 'none';
    void el.offsetHeight;   // reflow
    el.style.animation = ''; 
  }
  async function applyMarquee(){
    const id = window.productId || document.documentElement.dataset.product;
    const texts = marqueeTexts[id] || marqueeTexts["prod_SbKYsQrxStW8wB"]; 
    const wrapper = document.querySelector(".scroll-text-wrapper");
    if (!wrapper) return;
    try { if (document.fonts?.ready) await document.fonts.ready; } catch {}
    const line = buildMarqueeLine(texts);
    wrapper.innerHTML = line + line;
    const pxPerSecond = 60;
    const halfWidth = wrapper.scrollWidth / 2;   // metade do total
    if (halfWidth > 0){
      const dur = Math.max(halfWidth / pxPerSecond, 10); // mínimo 10s
      wrapper.style.animationDuration = `${dur}s`;
    }
    restart(wrapper);
  }
  applyMarquee();
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
    const wantedCurrency = (window.MARKET?.cur || 'usd'); // 'brl','usd','eur','gbp','cad'
    const res = await fetch(`/get-price-id?product_id=${productId}&currency=${wantedCurrency}`);
    const data = await res.json();

    if (data.price_id) {
      window.location.href = `/checkout?price_id=${data.price_id}`;
    } else {
      alert("Erro ao obter preço.");
    }
  }
  // async function goToCheckout(productId) {
  // const res = await fetch(`/get-price-id?product_id=${productId}`);
  // const data = await res.json();
  
  //   if (data.price_id) {
  //     window.location.href = `/checkout?price_id=${data.price_id}`;
  //   } else {
  //     alert("Erro ao obter preço.");
  //   }
  // }
})