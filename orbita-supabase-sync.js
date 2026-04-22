/**
 * Costos fijos (orbita_config). Con RLS estricto, hace falta sesión Supabase Auth (JWT).
 * Carga: supabase.min.js → orbita-auth.js → este archivo.
 */
(function () {
    var U = (window.orbitaAuth && window.orbitaAuth.url) || "https://bhayzqgzxgzluafjhpdg.supabase.co";
    var K = (window.orbitaAuth && window.orbitaAuth.anonKey) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoYXl6cWd6eGd6bHVhZmpocGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODA2MjEsImV4cCI6MjA5MjQ1NjYyMX0.z2fEdAvskGkKDRlcO_IFRHvZnilLEoLQRrpUNGIJNhM";
    var T = "orbita_config";
    var CLAVES = ["costo_fijo_handroll", "costo_fijo_cafe", "costo_fijo_fuente"];
    var LS_LEGACY = {
        costo_fijo_handroll: "orbita_costo_fijo_handroll",
        costo_fijo_cafe: "orbita_costo_fijo_cafe",
        costo_fijo_fuente: "orbita_costo_fijo_fuente"
    };

    function baseOut() {
        return { costo_fijo_handroll: 0, costo_fijo_cafe: 0, costo_fijo_fuente: 0 };
    }

    function mergeLegacy(out) {
        CLAVES.forEach(function (c) {
            try {
                var ls = localStorage.getItem(LS_LEGACY[c]);
                var v = parseInt(ls || "0", 10);
                if (!isNaN(v) && v > 0 && out[c] === 0) out[c] = v;
            } catch (e) {}
        });
    }

    async function hdr() {
        if (window.orbitaAuth && typeof window.orbitaAuth.restHeaders === "function") {
            return await window.orbitaAuth.restHeaders();
        }
        return { apikey: K, Authorization: "Bearer " + K };
    }

    async function fetchAll() {
        var headers = await hdr();
        var res = await fetch(U + "/rest/v1/" + T + "?select=clave,valor", { headers: headers });
        if (res.status === 401 || res.status === 403) throw new Error("auth");
        if (!res.ok) throw new Error("http_" + res.status);
        var rows = await res.json();
        if (!Array.isArray(rows)) throw new Error("bad_json");
        var out = baseOut();
        rows.forEach(function (r) {
            if (r && r.clave in out) out[r.clave] = Number(r.valor) || 0;
        });
        return out;
    }

    window.orbitaCostosFijos = {
        claveHandroll: "costo_fijo_handroll",
        claveCafe: "costo_fijo_cafe",
        claveFuente: "costo_fijo_fuente",

        leer: async function () {
            try {
                var out = await fetchAll();
                mergeLegacy(out);
                return out;
            } catch (e) {
                var out2 = baseOut();
                mergeLegacy(out2);
                out2._sinTabla = true;
                if (e && e.message === "auth") out2._necesitaLogin = true;
                return out2;
            }
        },

        guardar: async function (clave, valor) {
            var n = Math.max(0, Math.floor(parseInt(String(valor), 10) || 0));
            if (CLAVES.indexOf(clave) === -1) return { ok: false, error: "Clave inválida." };
            var headers = await hdr();
            headers["Content-Type"] = "application/json";
            headers["Prefer"] = "return=minimal";
            var res = await fetch(U + "/rest/v1/" + T + "?clave=eq." + encodeURIComponent(clave), {
                method: "PATCH",
                headers: headers,
                body: JSON.stringify({ valor: n, updated_at: new Date().toISOString() })
            });
            try {
                localStorage.setItem(LS_LEGACY[clave], String(n));
            } catch (err) {}
            if (res.status === 401 || res.status === 403) {
                return { ok: false, error: "Sesión requerida: inicia sesión con el usuario de Supabase (Auth)." };
            }
            if (!res.ok) {
                return {
                    ok: false,
                    error: "No se pudo guardar (código " + res.status + "). Si aplicaste RLS, necesitás estar logueado."
                };
            }
            return { ok: true };
        }
    };
})();
