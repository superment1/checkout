(function () {
    const RD_CONTAINER_ID = "formulario-checkout-ea4341fed34534484b7c";

    function getCheckoutEmailField() {
        return document.querySelector("#email");
    }

    function getEmailFromForm(form) {
        const emailField =
        form.querySelector("input[id*='email']") ||
        form.querySelector("input[type='email']");
        return emailField ? emailField.value.trim() : "";
    }
    function closeRdModal() {
    const modal = document.getElementById("rd-modal");
    const bg = document.getElementById("rd-modal-bg");
    if (modal) modal.classList.remove("active");
    if (bg) bg.classList.remove("active");
    }
    function setEmailPlaceholder(form) {
        const emailField =
        form.querySelector("input[name='email']") ||
        form.querySelector("input[type='email']");
        if (emailField && !emailField.dataset.placeholderSet) {
        emailField.setAttribute("placeholder", "email@example.com");
        emailField.style.fontSize = "28px";
        emailField.dataset.placeholderSet = "1";
        
        }
    }
    function injectHiddenFields(form) {
        const urlParams = new URLSearchParams(window.location.search);

        const productIdFromUrl    = urlParams.get("product_id");
        const productIdFromWindow = window.productId;
        const productIdFromDom    =
            document.documentElement.dataset.product ||
            document.body.dataset.product;

        const productNameFromDom =
            document.documentElement.dataset.productName ||
            document.body.dataset.productName;

        const productId = productIdFromUrl || productIdFromWindow || productIdFromDom;
        const productName = productNameFromDom || "";

        console.log("[RD-SYNC] productId resolvido:", {
            productIdFromUrl,
            productIdFromWindow,
            productIdFromDom,
            usado: productId,
            productName,
        });

        if (!productId) return;

        if (form.querySelector('input[name="cf_produto_de_interesse"]')) {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = "cf_produto_de_interesse"
            input.value = productId;
            form.appendChild(input);
            console.log("[RD-SYNC] Campo hidden adicionado: cf_produto_de_interesse =", productId);
        }
   
        if (productName && !form.querySelector('input[name="cf_nome_produto"]')) {
            const input2 = document.createElement("input");
            input2.type = "hidden";
            input2.name = "cf_nome_produto"; 
            input2.value = productName;
            form.appendChild(input2);
            console.log("[RD-SYNC] Campo hidden adicionado: cf_nome_produto =", productName);
        }
    }

    function attachSubmitListenerToRdForm() {
        const container = document.getElementById(RD_CONTAINER_ID);
        if (!container) {
        console.warn("[RD-SYNC] container RD não encontrado ainda");
        return;
        }

        const form = container.querySelector("form");
        if (!form) {
        console.warn("[RD-SYNC] form RD ainda não está no DOM");
        return;
        }
        const label = document.querySelector('label[for="rd-email_field-mi3e4icz"]');
        if (label) {
            label.textContent = label.textContent.replace("*", "").trim();
        }
        setEmailPlaceholder(form);
        injectHiddenFields(form);
        if (form.dataset.rdSyncAttached === "1") {
        return;
        }
        form.dataset.rdSyncAttached = "1";

        form.addEventListener("submit", function () {
            setTimeout(function () {
                const email = getEmailFromForm(form);
                if (!email) {
                console.warn("[RD-SYNC] e-mail não encontrado no form RD");
                return;
                }
                console.log("[RD-SYNC] Email capturado do RD:", email);
                localStorage.setItem("customer_email", email);
                localStorage.setItem("cf_produto_de_interesse", productId);
                localStorage.setItem("cf_produto_name", productName);

                const checkoutEmailField = getCheckoutEmailField();
                if (checkoutEmailField) {
                checkoutEmailField.value = email;
                checkoutEmailField.dispatchEvent(new Event("input"));
                }
                closeRdModal();
            }, 100);
        });
    }

    function waitForRdForm() {
        let attempts = 0;
        const maxAttempts = 20;
        const interval = setInterval(function () {
        attempts += 1;

        // AQUI 
        // attachSubmitListenerToRdForm();
        
        const container = document.getElementById(RD_CONTAINER_ID);
        const form = container && container.querySelector("form");

        if ((form && form.dataset.rdSyncAttached === "1") || attempts >= maxAttempts) {
            clearInterval(interval);
        }
        }, 500);
    }

    document.addEventListener("DOMContentLoaded", function () {
        const savedEmail = localStorage.getItem("customer_email");
        const checkoutEmailField = getCheckoutEmailField();
        if (savedEmail && checkoutEmailField) {
        checkoutEmailField.value = savedEmail;
        checkoutEmailField.dispatchEvent(new Event("input"));
        }

        waitForRdForm();
    });
})();
