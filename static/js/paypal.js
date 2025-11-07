(function () {
  const html   = document.documentElement;
  const mount  = document.getElementById("paypal-button");
  if (!mount) { console.error("paypal-button element not found"); return; }

  const productId   = (html.dataset.product || "").trim();
  const rawCurrency = (html.dataset.currency || "USD").trim().toUpperCase();
  const CURRENCY_MAP = { BR: "BRL", US: "USD" };
  const currency = CURRENCY_MAP[rawCurrency] || rawCurrency;

  const clientId = mount.dataset.clientId || window.PAYPAL_CLIENT_ID || "";
  if (!clientId) { console.error("[PayPal] Missing client_id"); return; }
 
  // Mapa produto -> Hosted Button ID (preencha os seus)
  const HOSTED_BUTTONS = {
    "prod_T2jNgj5cCjXcvG": "SGA95XWHDEZ5Y", // USD RELAX
    "prod_SgGRuiyYsEVyCF": "ZZNTFYZWN9FYE", // BRL TESTE
  };
  const hostedButtonId = HOSTED_BUTTONS[productId];
  if (!hostedButtonId) { console.error(`[PayPal] Sem botão para productId=${productId}`); return; }

  // Logs para confirmar tudo
  console.log("[PayPal] productId:", productId);
  console.log("[PayPal] currency (page):", rawCurrency, "→ usado:", currency);
  console.log("[PayPal] hostedButtonId:", hostedButtonId);
  console.log("[PayPal] clientId (ENV):", clientId.slice(0, 8) + "...");

  // Evita script duplicado
  if (document.querySelector('script[data-paypal-sdk]')) {
    console.warn("[PayPal] SDK já carregado, abortando novo load");
    return;
  }

  const sdkUrl =
    `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}` +
    `&components=hosted-buttons&disable-funding=venmo&currency=${encodeURIComponent(currency)}`;

  const script = document.createElement("script");
  script.src = sdkUrl;
  script.async = true;
  script.dataset.paypalSdk = "1";

  script.onload = () => {
    const containerId = `paypal-container-${hostedButtonId}`;
    const container = document.createElement("div");
    container.id = containerId;
    mount.replaceChildren(container);
    console.log(`[PayPal] Render: ${hostedButtonId} (${currency})`);
    paypal.HostedButtons({ hostedButtonId }).render(`#${containerId}`);
  };

  script.onerror = (e) => console.error("[PayPal] Falha ao carregar SDK:", e);
  document.head.appendChild(script);
})();



// (function () {
//   const html = document.documentElement;
//   const API_BASE = window.API_BASE || "";
//   const el = document.getElementById("paypal-button");
//   if (!el) {
//     console.error("paypal-button element not found");
//     return;
//   }
//   const productId = html.dataset.product;

//    const hostedButtonsMap = {
//     "prod_T2jNgj5cCjXcvG": "SGA95XWHDEZ5Y", // USD RELAX
//     "prod_SgGRuiyYsEVyCF": "ZZNTFYZWN9FYE", // BRL TESTE
    
//   };

//   function getCurrentAmount() {
//     const candidates = [
//       document.getElementById("total-due-price"),     
//       document.getElementById("total-price"),    
//       document.getElementById("total-due-price-mobile") 
//     ].filter(Boolean);
//     for (const node of candidates) {
//       const raw = (node.textContent || node.innerText || "").trim();
//       if (raw) {
//         const normalized = raw
//           .replace(/[^\d.,-]/g, "") 
//           .replace(/\.(?=\d{3}\b)/g, "")
//           .replace(",", "."); 
//         const num = parseFloat(normalized);
//         if (!isNaN(num) && num > 0) return num;
//       }
//     }

//     const fallback = el.dataset.value || "0.00";
//     const n = parseFloat(String(fallback).replace(",", "."));
//     return isNaN(n) ? 0 : n;
//   }
//   const currency = (el.dataset.currency || "USD").toUpperCase();
//   const description = el.dataset.description || "";

//   paypal.Buttons({
//     style: {
//       borderRadius: 25,
//       zIndex: 0,
//       maxWidth: 380
//     },
//     createOrder() {
//       const amount = getCurrentAmount();
//       const value = amount.toFixed(2);
//       return fetch(`${API_BASE}/api/paypal/order`, {
//         method: 'POST',
//         headers: {'Content-Type': 'application/json'},
//         body: JSON.stringify({ currency, value, description })
//       })
//       .then(async (res) => {
//         const text = await res.text();
//         if (!res.ok) {
//           console.error('create order failed:', res.status, text);
//           throw new Error('create order failed');
//         }
//         const data = JSON.parse(text);
//         return data.id;
//       });
//     },

//     onApprove({ orderID }) {
//       return fetch(`${API_BASE}/api/paypal/capture/${orderID}`, { method: 'POST' })
//         .then(async (res) => {
//           const text = await res.text();
//           if (!res.ok) {
//             console.error('capture failed:', res.status, text);
//             throw new Error('capture failed');
//           }
//           const data = JSON.parse(text);
//           window.location.href = '/thanks';
//         });
//     },

//     onError(err) {
//       console.error('PayPal error', err);
//       alert('Falha no PayPal. Tente novamente.');
//     }
//   }).render('#paypal-button');
// })();
