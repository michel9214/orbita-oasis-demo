import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!;
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://intengrando-registro-para-pago-r-pi.vercel.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_SITIOS = new Set(["handroll", "cafe", "fuente"]);
const SITIO_TO_PATH: Record<string, string> = {
  handroll: "/",
  cafe: "/cafe",
  fuente: "/fuente",
};
const VALID_STATUS = new Set(["approved", "failure", "pending"]);
const STATUS_TO_ESTADO: Record<string, string> = {
  approved: "pagado",
  failure: "rechazado",
  pending: "pendiente",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleCreatePreference(body: any) {
  const items = body.items;
  const sitio = VALID_SITIOS.has(body.sitio) ? body.sitio : "handroll";
  const externalRef = body.external_reference ?? crypto.randomUUID();

  if (!items || items.length === 0) {
    return json({ error: "Sin items" }, 400);
  }

  const returnPath = SITIO_TO_PATH[sitio];
  const preference = {
    items: items.map((item: any) => ({
      title: String(item.title).slice(0, 255),
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
      unit_price: Math.max(0, Math.floor(Number(item.unit_price) || 0)),
      currency_id: "CLP",
    })),
    external_reference: externalRef,
    back_urls: {
      success: `${SITE_URL}${returnPath}?status=approved&ref=${externalRef}`,
      failure: `${SITE_URL}${returnPath}?status=failure&ref=${externalRef}`,
      pending: `${SITE_URL}${returnPath}?status=pending&ref=${externalRef}`,
    },
    auto_return: "approved",
    metadata: { sitio, external_reference: externalRef },
  };

  const mpRes = await fetch(
    "https://api.mercadopago.com/checkout/preferences",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preference),
    },
  );

  const mpData = await mpRes.json();

  if (!mpRes.ok) {
    console.error("MP error:", mpData);
    return json({ error: "Error MP", detail: mpData }, 500);
  }

  return json({
    init_point: mpData.init_point,
    preference_id: mpData.id,
    external_reference: externalRef,
  });
}

async function handleMarkPayment(body: any) {
  const ref = String(body.external_reference ?? "").trim();
  const status = String(body.status ?? "").trim();
  const paymentId = body.payment_id ? String(body.payment_id) : null;

  if (!ref) return json({ error: "missing external_reference" }, 400);
  if (!VALID_STATUS.has(status)) return json({ error: "invalid status" }, 400);

  const estado = STATUS_TO_ESTADO[status];
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const patch: Record<string, unknown> = { estado };
  if (paymentId) patch.mp_payment_id = paymentId;

  const { data, error } = await admin
    .from("pedidos")
    .update(patch)
    .eq("mp_external_reference", ref)
    .select("id, estado");

  if (error) {
    console.error("update error:", error);
    return json({ error: "update failed", detail: error.message }, 500);
  }

  return json({ ok: true, updated: data?.length ?? 0, estado });
}

// ── Helpers clientes ──
function getAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

function normEmail(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isValidHash(s: unknown): boolean {
  return typeof s === "string" && /^[a-f0-9]{64}$/i.test(s);
}

const CLIENT_PUBLIC_COLS =
  "id,email,nombre,metodo_pago,telefono,direccion_entrega,direcciones,ultimos4,marca_tarjeta,titular_tarjeta,tipo_tarjeta,emisor_tarjeta,pin_hash,created_at,updated_at";

function sanitizeCliente(c: any) {
  if (!c) return null;
  const { pin_hash, ...rest } = c;
  return rest;
}

async function handleRegisterCustomer(body: any) {
  const email = normEmail(body.email);
  const nombre = String(body.nombre ?? "").trim();
  const pinHash = String(body.pin_hash ?? "").trim();
  const telefono = body.telefono ? String(body.telefono).trim() : null;
  const direccion = body.direccion_entrega ? String(body.direccion_entrega).trim() : null;
  const metodoPago = body.metodo_pago === "whatsapp" ? "whatsapp" : "mercadopago";

  if (!isValidEmail(email)) return json({ error: "invalid email" }, 400);
  if (!nombre || nombre.length < 2) return json({ error: "invalid nombre" }, 400);
  if (!isValidHash(pinHash)) return json({ error: "invalid pin_hash" }, 400);

  const admin = getAdmin();
  const row: Record<string, unknown> = {
    email,
    nombre,
    pin_hash: pinHash,
    metodo_pago: metodoPago,
    telefono,
    direccion_entrega: direccion,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("orbita_clientes")
    .upsert(row, { onConflict: "email" })
    .select(CLIENT_PUBLIC_COLS)
    .maybeSingle();

  if (error) {
    console.error("register error:", error);
    return json({ error: "register failed", detail: error.message }, 500);
  }

  return json({ ok: true, cliente: sanitizeCliente(data) });
}

async function handleLoginCustomer(body: any) {
  const email = normEmail(body.email);
  const pinHash = String(body.pin_hash ?? "").trim();

  if (!isValidEmail(email)) return json({ error: "invalid email" }, 400);
  if (!isValidHash(pinHash)) return json({ error: "invalid pin_hash" }, 400);

  const admin = getAdmin();
  const { data, error } = await admin
    .from("orbita_clientes")
    .select(CLIENT_PUBLIC_COLS)
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("login error:", error);
    return json({ error: "login failed", detail: error.message }, 500);
  }
  if (!data) return json({ ok: false, reason: "not_found" }, 404);
  if (data.pin_hash !== pinHash) return json({ ok: false, reason: "wrong_pin" }, 401);

  return json({ ok: true, cliente: sanitizeCliente(data) });
}

async function handleUpdateCustomer(body: any) {
  const email = normEmail(body.email);
  const pinHash = String(body.pin_hash ?? "").trim();
  const updates = body.updates && typeof body.updates === "object" ? body.updates : {};

  if (!isValidEmail(email)) return json({ error: "invalid email" }, 400);
  if (!isValidHash(pinHash)) return json({ error: "invalid pin_hash" }, 400);

  const allowed: Record<string, unknown> = {};
  const ALLOWED_FIELDS = [
    "nombre",
    "metodo_pago",
    "telefono",
    "direccion_entrega",
    "direcciones",
    "ultimos4",
    "marca_tarjeta",
    "titular_tarjeta",
    "tipo_tarjeta",
    "emisor_tarjeta",
  ];
  for (const k of ALLOWED_FIELDS) {
    if (k in updates) allowed[k] = updates[k] === "" ? null : updates[k];
  }
  allowed.updated_at = new Date().toISOString();

  const admin = getAdmin();

  // Verificar PIN antes de actualizar
  const { data: existing, error: lookupErr } = await admin
    .from("orbita_clientes")
    .select("pin_hash")
    .eq("email", email)
    .maybeSingle();

  if (lookupErr) return json({ error: "lookup failed", detail: lookupErr.message }, 500);
  if (!existing) return json({ ok: false, reason: "not_found" }, 404);
  if (existing.pin_hash !== pinHash) return json({ ok: false, reason: "wrong_pin" }, 401);

  const { data, error } = await admin
    .from("orbita_clientes")
    .update(allowed)
    .eq("email", email)
    .select(CLIENT_PUBLIC_COLS)
    .maybeSingle();

  if (error) return json({ error: "update failed", detail: error.message }, 500);
  return json({ ok: true, cliente: sanitizeCliente(data) });
}

async function handleDeleteCustomer(body: any) {
  const email = normEmail(body.email);
  const pinHash = String(body.pin_hash ?? "").trim();

  if (!isValidEmail(email)) return json({ error: "invalid email" }, 400);
  if (!isValidHash(pinHash)) return json({ error: "invalid pin_hash" }, 400);

  const admin = getAdmin();
  const { data: existing } = await admin
    .from("orbita_clientes")
    .select("pin_hash")
    .eq("email", email)
    .maybeSingle();

  if (!existing) return json({ ok: false, reason: "not_found" }, 404);
  if (existing.pin_hash !== pinHash) return json({ ok: false, reason: "wrong_pin" }, 401);

  const { error } = await admin.from("orbita_clientes").delete().eq("email", email);
  if (error) return json({ error: "delete failed", detail: error.message }, 500);
  return json({ ok: true });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action ?? "create_preference";

    if (action === "create_preference") return handleCreatePreference(body);
    if (action === "mark_payment") return handleMarkPayment(body);
    if (action === "register_customer") return handleRegisterCustomer(body);
    if (action === "login_customer") return handleLoginCustomer(body);
    if (action === "update_customer") return handleUpdateCustomer(body);
    if (action === "delete_customer") return handleDeleteCustomer(body);

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
