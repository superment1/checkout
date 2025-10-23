const PAYPAL_BUTTONS = {
    'prod_SbKYsQrxStW8wB':'YJAWJ6NEGSBGQ',
    'prod_SbKa8ag01A2TGX': '',
    'prod_SbKaRuJpDVBEzxX': '',
    // RELAX
    'prod_T2jNgj5cCjXcvG': 'SGA95XWHDEZ5Y',
};

export function renderPayPalButton(productId) {
  const container = '#paypal-container';
  const buttonId = PAYPAL_BUTTONS[productId];
  const el = document.querySelector(container);

  if (!el) {
    console.error('Container PayPal não encontrado:', container);
    return;
  }
  el.innerHTML = '';

  if (!buttonId) {
    console.warn(`Nenhum botão PayPal configurado para o produto: ${productId}`);
    return;
  }

  try {
    paypal.HostedButtons({ hostedButtonId: buttonId }).render(container);
    console.log(` PayPal renderizado (${productId}) com ID ${buttonId}`);
  } catch (err) {
    console.error('Erro ao renderizar PayPal:', err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const productId = window.productId || null;

  if (!productId) {
    console.warn(" productId não definido em window.");
    return;
  }

  // Garante que o SDK do PayPal foi carregado
  const checkInterval = setInterval(() => {
    if (window.paypal && typeof window.paypal.HostedButtons === 'function') {
      clearInterval(checkInterval);
      renderPayPalButton(productId);
    }
  }, 200);
});