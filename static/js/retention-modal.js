(function () {
    const cfg = { cooldownMs: 2000, disableEsc: false };
    let lastShownAt = 0;
    let focusPrev = null;
    let __rm_lastY = window.scrollY, __rm_lastT = Date.now(); // p/ detectar scroll rápido pra cima
    let __rm_backArmed = false; // controle pro back do mobile
    try {
        history.pushState({ rmSentinel: 1 }, '', location.href);
        __rm_backArmed = true;
        } catch {}

        window.addEventListener('popstate', (e) => {
        if (!__rm_backArmed || paymentInProgress()) return;
        openModal();
        try { history.pushState({ rmSentinel: 1 }, '', location.href); } catch {}
        });
        window.addEventListener('scroll', () => {
        const now = Date.now();
        const y   = window.scrollY;
        const dy  = __rm_lastY - y;     
        const dt  = now - __rm_lastT || 1;
        if (dy > 180 && dt < 250 && !paymentInProgress() && canShowNow()) {
            openModal();
        }
        __rm_lastY = y;
        __rm_lastT = now;
    }, { passive: true });  
    
    const $ = (sel, root = document) => root.querySelector(sel);

    function copyToClipboard(text) {
        if (!text) return Promise.resolve(false);
        if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => fallback());
        }
        return Promise.resolve(fallback());
        function fallback() {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
        }
    }
    function lockScroll(yes) { document.documentElement.classList.toggle('overflow-hidden', !!yes); }
    function dispatch(el, name) { el.dispatchEvent(new CustomEvent(name, { bubbles: true })); }
    function paymentInProgress() { return !!window.__paymentInProgress; }
    function canShowNow() { return Date.now() - lastShownAt >= cfg.cooldownMs; }

    function openModal() {
        const overlay = $('#retention-modal');
        if (!overlay || overlay.classList.contains('is-open')) return;
        if (paymentInProgress() || !canShowNow()) return;

        overlay.hidden = false;
        overlay.classList.add('is-open');

        const dialog = $('.rm-dialog', overlay);
        focusPrev = document.activeElement;
        dialog?.focus();
        lockScroll(true);
        lastShownAt = Date.now();
        dispatch(overlay, 'open');
    }

    function closeModal() {
        const overlay = $('#retention-modal');
        if (!overlay) return;
        overlay.classList.remove('is-open');
        overlay.hidden = true;
        lockScroll(false);
        if (focusPrev && typeof focusPrev.focus === 'function') focusPrev.focus();
        dispatch(overlay, 'close');
    }

    // ---- TRIGGER: exit-intent robusto ----
    function onExitIntentMouse(e) {
        const nearTop = e.clientY <= 10;              
        const trulyLeft = !e.relatedTarget && !e.toElement; 
        if (nearTop || trulyLeft) openModal();
    }
    function bindExitIntent() {
        document.addEventListener('mouseout', onExitIntentMouse);
        document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') openModal();
        });
    }

    function bindUI() {
        const overlay = $('#retention-modal');
        if (!overlay) return;

        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
        $('.rm-close', overlay)?.addEventListener('click', closeModal);
        $('#rm-secondary', overlay)?.addEventListener('click', closeModal);

        const primaryBtn = $('#rm-primary', overlay);
        const toast = $('#rm-copied', overlay);
        primaryBtn?.addEventListener('click', async (e) => {
        const text = (e.currentTarget?.textContent || '').trim();
        if (text) {
            const ok = await copyToClipboard(text);
            if (ok && toast) { toast.hidden = false; setTimeout(() => toast.hidden = true, 1200); }
        }
        try {
            if (typeof window.applyCoupon === 'function') {
            const code = primaryBtn?.dataset?.coupon || (text.match(/[A-Z0-9]{4,}/)?.[0]) || 'SLEEP20';
            await window.applyCoupon(code);
            }
        } catch (err) { console.error('Falha ao aplicar cupom:', err); }
        dispatch(overlay, 'primary');
        closeModal();
        });

        document.addEventListener('keydown', (e) => {
        if (cfg.disableEsc) return;
        if (e.key === 'Escape') closeModal();
        });
    }

    function init() {
        const overlay = $('#retention-modal');
        if (!overlay) return;

        if (window.__RetentionModalBound) return;
        window.__RetentionModalBound = true;

        bindUI();
        bindExitIntent();
    }

    window.RetentionModal = { open: openModal, close: closeModal, init };
    document.addEventListener('DOMContentLoaded', init);
})();