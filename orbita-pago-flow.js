(function () {
  const SUPABASE_URL = "https://bhayzqgzxgzluafjhpdg.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoYXl6cWd6eGd6bHVhZmpocGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODA2MjEsImV4cCI6MjA5MjQ1NjYyMX0.z2fEdAvskGkKDRlcO_IFRHvZnilLEoLQRrpUNGIJNhM";
  const MP_EDGE_URL = SUPABASE_URL + "/functions/v1/hyper-worker";
  const TABLA_PEDIDOS = "pedidos";

  function headers(extra = {}) {
    return {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  async function insertarPedido(pedidoBody) {
    try {
      const res = await fetch(
        SUPABASE_URL + "/rest/v1/" + TABLA_PEDIDOS,
        {
          method: "POST",
          headers: headers({ Prefer: "return=minimal" }),
          body: JSON.stringify(pedidoBody),
        },
      );
      return res.ok;
    } catch (e) {
      console.error("insertarPedido falló:", e);
      return false;
    }
  }

  function abrirBannerResena() {
    const banner = document.getElementById("banner-resena");
    const link = document.getElementById("banner-resena-link");
    if (banner) {
      if (link) link.href = (window.LINK_RESENA || "resenas.html");
      banner.classList.add("open");
    }
  }

  function toast(msg, tipo = "info") {
    const bg = tipo === "error" ? "#c1121f" : tipo === "success" ? "#25d366" : "#333";
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.cssText =
      "position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;" +
      "background:" + bg + ";color:#fff;padding:12px 20px;border-radius:12px;" +
      "font-family:'DM Sans',sans-serif;font-size:0.9rem;font-weight:600;" +
      "box-shadow:0 8px 24px rgba(0,0,0,0.4);max-width:90vw;text-align:center;";
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity 0.4s";
      el.style.opacity = "0";
    }, 3000);
    setTimeout(() => el.remove(), 3500);
  }

  async function iniciarPagoMP(opts) {
    const { sitio, items, pedidoBody, onError } = opts;
    try {
      const res = await fetch(MP_EDGE_URL, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          action: "create_preference",
          sitio,
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.init_point) {
        console.error("MP pref error:", data);
        if (onError) onError(data);
        return false;
      }

      const enriched = {
        ...pedidoBody,
        sitio,
        estado: "pendiente",
        mp_preference_id: data.preference_id || null,
        mp_external_reference: data.external_reference || null,
      };
      await insertarPedido(enriched);

      try {
        localStorage.setItem(
          "orbita_pago_pendiente",
          JSON.stringify({
            ref: data.external_reference,
            sitio,
            ts: Date.now(),
          }),
        );
      } catch (e) {}

      window.location.href = data.init_point;
      return true;
    } catch (e) {
      console.error("iniciarPagoMP falló:", e);
      if (onError) onError(e);
      return false;
    }
  }

  async function marcarPago(ref, status) {
    try {
      const res = await fetch(MP_EDGE_URL, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          action: "mark_payment",
          external_reference: ref,
          status,
          payment_id: new URLSearchParams(window.location.search).get("payment_id") || null,
        }),
      });
      return res.ok;
    } catch (e) {
      console.error("marcarPago falló:", e);
      return false;
    }
  }

  function limpiarUrl() {
    try {
      const url = new URL(window.location.href);
      ["status", "ref", "payment_id", "collection_id", "collection_status",
       "external_reference", "preference_id", "merchant_order_id", "processing_mode",
       "merchant_account_id", "site_id"].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ""));
    } catch (e) {}
  }

  async function detectarRetorno() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status") || params.get("collection_status");
    const ref = params.get("ref") || params.get("external_reference");

    if (!status || !ref) return null;

    const normalized =
      status === "approved" ? "approved"
      : status === "rejected" || status === "failure" ? "failure"
      : status === "in_process" || status === "pending" ? "pending"
      : null;

    if (!normalized) return null;

    await marcarPago(ref, normalized);

    if (normalized === "approved") {
      toast("¡Pago recibido! Gracias por tu pedido 🎉", "success");
      setTimeout(abrirBannerResena, 1500);
    } else if (normalized === "failure") {
      toast("El pago fue rechazado. Podés intentar de nuevo o pedir por WhatsApp.", "error");
    } else {
      toast("Tu pago está pendiente. Te avisamos cuando se confirme.", "info");
    }

    try { localStorage.removeItem("orbita_pago_pendiente"); } catch (e) {}
    limpiarUrl();
    return normalized;
  }

  async function registrarWhatsapp(opts) {
    const { sitio, pedidoBody, wspNumber, mensaje } = opts;
    window.open(
      "https://wa.me/" + wspNumber + "?text=" + encodeURIComponent(mensaje),
      "_blank",
    );

    const enriched = {
      ...pedidoBody,
      sitio,
      estado: "whatsapp",
    };
    await insertarPedido(enriched);

    setTimeout(abrirBannerResena, 800);
  }

  window.orbitaPagoFlow = {
    iniciarPagoMP,
    detectarRetorno,
    registrarWhatsapp,
    abrirBannerResena,
    toast,
    SUPABASE_URL,
    SUPABASE_KEY,
    MP_EDGE_URL,
  };
})();
