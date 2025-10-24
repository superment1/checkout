(function () {
  const API_BASE = window.API_BASE || "";
  const el = document.getElementById("paypal-button");
  if (!el) {
    console.error("paypal-button element not found");
    return;
  }
  function getCurrentAmount() {
    // tente pegar do total “final” na página (ajuste/adicione seletores se precisar)
    const candidates = [
      document.getElementById("total-due-price"),       // desktop
      document.getElementById("total-price"),           // mobile / accordion
      document.getElementById("total-due-price-mobile") // mobile topo
    ].filter(Boolean);
    for (const node of candidates) {
      const raw = (node.textContent || node.innerText || "").trim();
      if (raw) {
        // remove tudo que não é dígito, vírgula ou ponto; depois usa vírgula como decimal
        const normalized = raw
          .replace(/[^\d.,-]/g, "") // remove R$, espaços, etc
          .replace(/\.(?=\d{3}\b)/g, "") // remove separador de milhar com ponto (ex: 1.234,56)
          .replace(",", "."); // vírgula -> ponto decimal
        const num = parseFloat(normalized);
        if (!isNaN(num) && num > 0) return num;
      }
    }

    // fallback: dataset original do container
    const fallback = el.dataset.value || "0.00";
    const n = parseFloat(String(fallback).replace(",", "."));
    return isNaN(n) ? 0 : n;
  }
  const currency = (el.dataset.currency || "US").toUpperCase();
  const description = el.dataset.description || "";

  paypal.Buttons({
    style: {
      borderRadius: 25,
      zIndex: 0,
      maxWidth: 380
    },
    createOrder() {
      const amount = getCurrentAmount();
      const value = amount.toFixed(2);
      return fetch(`${API_BASE}/api/paypal/order`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ currency, value, description })
      })
      .then(async (res) => {
        const text = await res.text();
        if (!res.ok) {
          console.error('create order failed:', res.status, text);
          throw new Error('create order failed');
        }
        const data = JSON.parse(text);
        return data.id;
      });
    },

    onApprove({ orderID }) {
      return fetch(`${API_BASE}/api/paypal/capture/${orderID}`, { method: 'POST' })
        .then(async (res) => {
          const text = await res.text();
          if (!res.ok) {
            console.error('capture failed:', res.status, text);
            throw new Error('capture failed');
          }
          const data = JSON.parse(text);
          window.location.href = '/thanks';
        });
    },

    onError(err) {
      console.error('PayPal error', err);
      alert('Falha no PayPal. Tente novamente.');
    }
  }).render('#paypal-button');
})();
