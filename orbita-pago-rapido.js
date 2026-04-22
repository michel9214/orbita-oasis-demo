// ORBITA PAGO RÁPIDO - Sistema de pago optimizado para Orbita
// Versión corregida: IDs unificados en HTML y JS

window.OrbitaPagoRapido = {
    estado: {
        modo: 'nuevo',
        cliente: null,
        step: 1,
        total: 0,
        items: [],
        local: '',
        wspNumber: '',
        mpEdgeUrl: ''
    },

    async init(localConfig) {
        this.estado.local = localConfig.local;
        this.estado.wspNumber = localConfig.wspNumber;
        this.estado.mpEdgeUrl = localConfig.mpEdgeUrl;
        await this.cargarClienteGuardado();
        this.setupUI();
    },

    _getUsuarios() {
        try {
            const raw = localStorage.getItem('orbita_usuarios');
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    },

    _saveUsuarios(map) {
        try { localStorage.setItem('orbita_usuarios', JSON.stringify(map)); } catch (e) {}
    },

    _getUsuarioPorEmail(email) {
        if (!email) return null;
        const map = this._getUsuarios();
        return map[email.toLowerCase().trim()] || null;
    },

    _setSesionActiva(email) {
        try {
            if (email) localStorage.setItem('orbita_cliente_activo', email.toLowerCase().trim());
            else localStorage.removeItem('orbita_cliente_activo');
        } catch (e) {}
    },

    async cargarClienteGuardado() {
        try {
            // Migración 1: si existe orbita_cliente_global viejo, moverlo al map nuevo
            const legacy = localStorage.getItem('orbita_cliente_global');
            if (legacy) {
                const c = JSON.parse(legacy);
                if (c && c.email) {
                    // Migración PIN plano → hash
                    if (c.pin && !c.pin_hash) {
                        c.pin_hash = await this.hashPin(c.pin, c.email);
                        delete c.pin;
                    }
                    // Migración PCI: borrar tarjeta con datos sensibles
                    if (c.tarjeta_datos) {
                        c.ultimos4 = c.tarjeta_datos.ultimos4 || c.ultimos4 || null;
                        c.marca_tarjeta = c.tarjeta_datos.marca || c.marca_tarjeta || null;
                        delete c.tarjeta_datos;
                    }
                    const map = this._getUsuarios();
                    map[c.email.toLowerCase().trim()] = c;
                    this._saveUsuarios(map);
                    this._setSesionActiva(c.email);
                }
                localStorage.removeItem('orbita_cliente_global');
            }

            // Leer sesión activa del map
            const emailActivo = localStorage.getItem('orbita_cliente_activo');
            if (!emailActivo) return;
            const c = this._getUsuarioPorEmail(emailActivo);
            if (!c) { this._setSesionActiva(null); return; }
            this.estado.cliente = c;
            this.estado.modo = 'registrado';
        } catch (e) {}
    },

    async hashPin(pin, email) {
        const salt = (email || '').toLowerCase().trim() + '|orbita_pin_v1';
        const data = new TextEncoder().encode(String(pin) + ':' + salt);
        const buf = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    guardarCliente(cliente) {
        try {
            const emailKey = (cliente.email || '').toLowerCase().trim();
            if (!emailKey) return;
            const map = this._getUsuarios();
            map[emailKey] = cliente;
            this._saveUsuarios(map);
            this._setSesionActiva(emailKey);
            this.estado.cliente = cliente;
            this.estado.modo = 'registrado';
        } catch (e) {
            console.error('Error guardando cliente:', e);
        }
    },

    setupUI() {
        this.crearEstructuraHTML();
        this.actualizarUI();
    },

    crearEstructuraHTML() {
        if (document.getElementById('orbita-pago-rapido-container')) return;

        const container = document.createElement('div');
        container.id = 'orbita-pago-rapido-container';
        container.innerHTML = `
            <!-- Modal principal (registro / perfil / beneficios) -->
            <div class="modal-overlay" id="modal-pago-rapido">
                <div class="modal">

                    <!-- Vista: Beneficios (para no registrados) -->
                    <div id="vista-beneficios" style="display:none;">
                        <div class="modal-title">⚡ PAGO RÁPIDO ÓRBITA</div>
                        <p class="modal-sub">Registráte y pagá en 1 solo click en los 3 locales.</p>
                        <div style="background:linear-gradient(135deg,rgba(255,77,0,0.1),rgba(0,158,227,0.06));padding:20px;border-radius:12px;margin:16px 0;text-align:center;">
                            <div style="font-size:2rem;margin-bottom:8px;">⚡</div>
                            <div style="font-weight:700;font-size:1.1rem;color:var(--fire);margin-bottom:4px;">Pagá en 1 Segundo</div>
                            <div style="font-size:0.85rem;color:var(--muted);">Guardá tus datos y usá tu PIN para compras futuras</div>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
                            <div style="display:flex;align-items:center;gap:10px;">
                                <span style="font-size:1.2rem;">⚡</span>
                                <div><div style="font-weight:600;font-size:0.9rem;">Pago en 1 Click</div><div style="font-size:0.78rem;color:var(--muted);">Solo ingresá tu PIN</div></div>
                            </div>
                            <div style="display:flex;align-items:center;gap:10px;">
                                <span style="font-size:1.2rem;">🔒</span>
                                <div><div style="font-weight:600;font-size:0.9rem;">Datos Seguros</div><div style="font-size:0.78rem;color:var(--muted);">Guardados localmente en tu dispositivo</div></div>
                            </div>
                            <div style="display:flex;align-items:center;gap:10px;">
                                <span style="font-size:1.2rem;">🍣</span>
                                <div><div style="font-weight:600;font-size:0.9rem;">Válido en los 3 Locales</div><div style="font-size:0.78rem;color:var(--muted);">Hand Roll, Café y Fuente de Soda</div></div>
                            </div>
                        </div>
                        <button class="btn-modal btn-fire" id="btn-crear-cuenta">CREAR CUENTA</button>
                        <button class="btn-modal btn-gray" id="btn-iniciar-sesion" style="background:#1a1a1a;border:1px solid var(--fire);color:var(--fire);">INICIAR SESIÓN</button>
                        <button class="btn-modal btn-gray" onclick="OrbitaPagoRapido.cerrarModal()">Cancelar</button>
                    </div>

                    <!-- Vista: Iniciar sesión -->
                    <div id="vista-login" style="display:none;">
                        <div class="modal-title">INICIAR SESIÓN</div>
                        <p class="modal-sub">Ingresá con tu email y PIN de 4 dígitos.</p>

                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="login-email" placeholder="tu@email.com" autocomplete="email">
                        </div>
                        <div class="form-group">
                            <label>PIN de 4 dígitos</label>
                            <input type="password" id="login-pin" placeholder="****" maxlength="4" inputmode="numeric"
                                style="letter-spacing:10px;font-size:1.8rem;text-align:center;">
                        </div>

                        <p class="modal-error" id="login-error"></p>

                        <button class="btn-modal btn-fire" id="btn-confirmar-login">INGRESAR</button>
                        <button class="btn-modal btn-gray" onclick="OrbitaPagoRapido.mostrarBeneficios()">Volver</button>
                    </div>

                    <!-- Vista: Registro -->
                    <div id="vista-registro" style="display:none;">
                        <div class="modal-title">REGISTRARME</div>
                        <p class="modal-sub">Guardá tus datos una vez y la próxima pagás con PIN.</p>

                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="reg-email" placeholder="tu@email.com" autocomplete="email">
                        </div>
                        <div class="form-group">
                            <label>Nombre completo</label>
                            <input type="text" id="reg-nombre" placeholder="Tu nombre" autocomplete="name">
                        </div>
                        <div class="form-group">
                            <label>Teléfono <span style="color:var(--muted);font-size:0.7em;">(opcional)</span></label>
                            <input type="tel" id="reg-telefono" placeholder="+56 9 1234 5678" autocomplete="tel">
                        </div>
                        <div class="form-group">
                            <label>Dirección de entrega <span style="color:var(--muted);font-size:0.7em;">(opcional)</span></label>
                            <input type="text" id="reg-direccion" placeholder="Calle 123, depto 4B" autocomplete="street-address">
                        </div>
                        <div class="form-group">
                            <label>Método de pago preferido</label>
                            <div class="metodo-grid">
                                <label class="metodo-opt">
                                    <input type="radio" name="reg-metodo" value="mercadopago" checked>
                                    💳 MercadoPago
                                </label>
                                <label class="metodo-opt">
                                    <input type="radio" name="reg-metodo" value="whatsapp">
                                    💬 WhatsApp
                                </label>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>PIN de 4 dígitos <span style="color:var(--muted);font-size:0.7em;">(para pago rápido)</span></label>
                            <input type="password" id="reg-pin" placeholder="****" maxlength="4" inputmode="numeric"
                                style="letter-spacing:10px;font-size:1.8rem;text-align:center;">
                        </div>

                        <div class="form-group" id="reg-tarjeta-section" style="display:none;">
                            <p style="font-size:0.8rem;color:var(--muted);margin:0;">La tarjeta se ingresa al pagar en MercadoPago. Por seguridad, no guardamos los datos en este dispositivo.</p>
                        </div>

                        <div class="form-group">
                            <label style="display:flex;align-items:flex-start;gap:8px;font-size:0.8rem;line-height:1.4;text-transform:none;letter-spacing:0;">
                                <input type="checkbox" id="reg-terminos" style="margin-top:2px;accent-color:var(--fire);">
                                <span>Acepto los <a href="privacidad.html" target="_blank" style="color:var(--fire);">Términos y Condiciones</a>
                                y la <a href="privacidad.html" target="_blank" style="color:var(--fire);">Política de Privacidad</a>.</span>
                            </label>
                        </div>

                        <p class="modal-error" id="reg-error"></p>

                        <button class="btn-modal btn-fire" id="btn-guardar-registro">GUARDAR Y CONTINUAR</button>
                        <button class="btn-modal btn-gray" onclick="OrbitaPagoRapido.mostrarBeneficios()">Volver</button>
                    </div>

                    <!-- Vista: Perfil -->
                    <div id="vista-perfil" style="display:none;">
                        <div class="modal-title">MI PERFIL ÓRBITA</div>

                        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px;">
                            <div id="perfil-nombre" style="font-weight:700;font-size:1.05rem;margin-bottom:2px;"></div>
                            <div id="perfil-email" style="font-size:0.85rem;color:var(--muted);"></div>
                            <div id="perfil-telefono" style="font-size:0.85rem;color:var(--muted);margin-top:2px;"></div>
                            <div id="perfil-direccion" style="font-size:0.85rem;color:var(--muted);margin-top:2px;"></div>
                            <div id="perfil-metodo" style="font-size:0.82rem;margin-top:6px;"></div>
                        </div>

                        <!-- Tarjeta visual -->
                        <div class="form-group">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                <label style="margin:0;">Tus tarjetas</label>
                                <button class="btn-perfil-link" onclick="OrbitaPagoRapido.mostrarEditarTarjeta()">Editar</button>
                            </div>
                            <div id="perfil-tarjeta-container"></div>
                        </div>

                        <div class="form-group">
                            <label>Método de pago preferido</label>
                            <div class="metodo-grid">
                                <label class="metodo-opt">
                                    <input type="radio" name="perfil-metodo" value="mercadopago" id="rdo-perfil-mp">
                                    💳 MercadoPago
                                </label>
                                <label class="metodo-opt">
                                    <input type="radio" name="perfil-metodo" value="whatsapp" id="rdo-perfil-wsp">
                                    💬 WhatsApp
                                </label>
                            </div>
                        </div>

                        <div class="form-group">
                            <label style="font-size:0.85rem;color:var(--text);text-transform:none;letter-spacing:0;">Exportar mis datos (Ley 19.496)</label>
                            <div style="display:flex;gap:8px;margin-top:6px;">
                                <button class="btn-modal btn-gray" style="flex:1;font-size:0.8rem;" onclick="OrbitaPagoRapido.descargarDatosJSON()">Descargar JSON</button>
                                <button class="btn-modal btn-gray" style="flex:1;font-size:0.8rem;" onclick="OrbitaPagoRapido.descargarDatosPDF()">Imprimir PDF</button>
                            </div>
                        </div>

                        <div class="form-group">
                            <label style="font-size:0.85rem;color:#ff4444;text-transform:none;letter-spacing:0;">Eliminar cuenta</label>
                            <button class="btn-modal" style="background:#1a0505;border:1px solid #3a0808;color:#ff4444;font-size:0.82rem;" onclick="OrbitaPagoRapido.eliminarCuentaCompleta()">ELIMINAR MI CUENTA</button>
                        </div>

                        <button class="btn-modal btn-fire" onclick="OrbitaPagoRapido.guardarPerfil()">GUARDAR</button>
                        <button class="btn-modal" style="background:#1a0505;border:1px solid #3a0808;color:#ff4444;" onclick="OrbitaPagoRapido.cerrarSesion()">Cerrar sesión</button>
                        <button class="btn-modal btn-gray" onclick="OrbitaPagoRapido.cerrarModal()">Cerrar</button>
                    </div>

                    <!-- Vista: Editar Tarjeta Virtual -->
                    <div id="vista-editar-tarjeta" style="display:none;">
                        <div class="modal-title">TARJETA VIRTUAL</div>
                        <p class="modal-sub">Solo se guardan datos no sensibles para identificar tu tarjeta.</p>

                        <div class="form-group">
                            <label>Titular</label>
                            <input type="text" id="tarjeta-titular" placeholder="NOMBRE COMO FIGURA EN LA TARJETA" style="text-transform:uppercase;" autocomplete="cc-name">
                        </div>
                        <div class="form-group">
                            <label>Marca</label>
                            <select id="tarjeta-marca" style="width:100%;padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:'DM Sans',sans-serif;">
                                <option value="">Elegí una</option>
                                <option value="Visa">Visa</option>
                                <option value="Mastercard">Mastercard</option>
                                <option value="American Express">American Express</option>
                                <option value="Otra">Otra</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Tipo</label>
                            <select id="tarjeta-tipo" style="width:100%;padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:'DM Sans',sans-serif;">
                                <option value="">Elegí una</option>
                                <option value="credito">Crédito</option>
                                <option value="debito">Débito</option>
                                <option value="prepago">Prepago</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Últimos 4 dígitos</label>
                            <input type="text" id="tarjeta-ultimos4" placeholder="1234" maxlength="4" inputmode="numeric"
                                style="letter-spacing:6px;font-size:1.4rem;text-align:center;" autocomplete="off">
                        </div>
                        <div class="form-group">
                            <label>Emisor <span style="color:var(--muted);font-size:0.7em;">(opcional)</span></label>
                            <input type="text" id="tarjeta-emisor" placeholder="Ej: Mercado Pago Emisora SA" autocomplete="off">
                        </div>

                        <p class="modal-error" id="tarjeta-error"></p>

                        <button class="btn-modal btn-fire" onclick="OrbitaPagoRapido.guardarTarjeta()">GUARDAR TARJETA</button>
                        <button class="btn-modal" style="background:#1a0505;border:1px solid #3a0808;color:#ff4444;" onclick="OrbitaPagoRapido.eliminarTarjeta()">ELIMINAR TARJETA</button>
                        <button class="btn-modal btn-gray" onclick="OrbitaPagoRapido.abrirPerfil()">Volver</button>
                    </div>

                </div>
            </div>

            <!-- Modal validación PIN -->
            <div class="modal-overlay" id="modal-pin-validacion">
                <div class="modal">
                    <div class="modal-title">⚡ PAGO RÁPIDO</div>
                    <p class="modal-sub">Ingresá tu PIN para confirmar el pago de $<span id="pin-total">0</span></p>
                    <div class="form-group">
                        <label>PIN de 4 dígitos</label>
                        <input type="password" id="pin-input-validacion" placeholder="****" maxlength="4" inputmode="numeric"
                            style="letter-spacing:10px;font-size:1.8rem;text-align:center;">
                    </div>
                    <p class="modal-error" id="pin-error-validacion"></p>
                    <button class="btn-modal btn-rayo" id="btn-confirmar-pin">⚡ CONFIRMAR PAGO</button>
                    <button class="btn-modal btn-gray" onclick="OrbitaPagoRapido.cerrarModalPin()">Cancelar</button>
                </div>
            </div>

            <!-- Toast -->
            <div id="orbita-pago-toast" style="display:none;position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--card);border:1px solid var(--fire);color:var(--text);padding:12px 22px;border-radius:50px;font-size:0.88rem;font-weight:600;z-index:9999;box-shadow:0 4px 24px rgba(0,0,0,0.6);white-space:nowrap;max-width:90vw;text-align:center;"></div>
        `;

        document.body.appendChild(container);
        this.agregarEstilos();
        this.setupEventListeners();
    },

    agregarEstilos() {
        if (document.getElementById('orbita-pago-rapido-styles')) return;
        const styles = document.createElement('style');
        styles.id = 'orbita-pago-rapido-styles';
        styles.textContent = `
            .metodo-grid { display:flex; gap:8px; margin-bottom:4px; }
            .metodo-opt {
                flex:1; background:var(--surface); border:1.5px solid var(--border);
                border-radius:12px; padding:12px 8px; cursor:pointer;
                display:flex; align-items:center; gap:8px; font-size:0.88rem;
                font-weight:600; transition:all 0.2s;
            }
            .metodo-opt input { accent-color:var(--fire); }
            .metodo-opt:has(input:checked) { border-color:var(--fire); background:rgba(255,77,0,0.07); }
            .modal-error {
                color:#ff4444; font-size:0.82rem; margin-bottom:10px;
                display:none; padding:8px 12px; background:rgba(255,68,68,0.08);
                border-radius:8px; border:1px solid rgba(255,68,68,0.2);
            }
            #orbita-bienvenida {
                display:none; align-items:center; justify-content:space-between;
                background:rgba(37,211,102,0.06); border:1px solid rgba(37,211,102,0.25);
                border-radius:12px; padding:12px 16px; margin-bottom:14px;
                font-size:0.9rem;
            }
            #orbita-bienvenida strong { color:var(--green); }
            .btn-perfil-link {
                background:none; border:none; cursor:pointer; color:var(--fire);
                font-size:0.78rem; font-weight:700; letter-spacing:1px; text-transform:uppercase;
            }
            .one-click-box {
                display:none; background:linear-gradient(135deg,rgba(255,77,0,0.08),rgba(0,158,227,0.06));
                border:1px solid rgba(255,77,0,0.3); border-radius:16px; padding:20px;
                margin-bottom:16px; text-align:center;
            }
        `;
        document.head.appendChild(styles);
    },

    setupEventListeners() {
        // Botón guardar registro
        const btnGuardar = document.getElementById('btn-guardar-registro');
        if (btnGuardar) btnGuardar.addEventListener('click', () => this.handleGuardar());

        // Botón crear cuenta
        const btnCrear = document.getElementById('btn-crear-cuenta');
        if (btnCrear) btnCrear.addEventListener('click', () => this.mostrarRegistro());

        // Botón iniciar sesión
        const btnLogin = document.getElementById('btn-iniciar-sesion');
        if (btnLogin) btnLogin.addEventListener('click', () => this.mostrarLogin());

        // Botón confirmar login
        const btnConfirmarLogin = document.getElementById('btn-confirmar-login');
        if (btnConfirmarLogin) btnConfirmarLogin.addEventListener('click', () => this.handleLogin());

        // Enter en login PIN
        const loginPin = document.getElementById('login-pin');
        if (loginPin) loginPin.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleLogin(); });

        // Botón confirmar PIN
        const btnPin = document.getElementById('btn-confirmar-pin');
        if (btnPin) btnPin.addEventListener('click', () => this.confirmarPagoConPin());

        // Cerrar al hacer click fuera
        const modalPago = document.getElementById('modal-pago-rapido');
        if (modalPago) modalPago.addEventListener('click', (e) => { if (e.target === modalPago) this.cerrarModal(); });

        const modalPin = document.getElementById('modal-pin-validacion');
        if (modalPin) modalPin.addEventListener('click', (e) => { if (e.target === modalPin) this.cerrarModalPin(); });

        // Enter en PIN para confirmar
        const pinInput = document.getElementById('pin-input-validacion');
        if (pinInput) pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.confirmarPagoConPin(); });

        // Mostrar aviso "la tarjeta se ingresa al pagar" solo si eligió MercadoPago
        document.querySelectorAll('input[name="reg-metodo"]').forEach(r => {
            r.addEventListener('change', () => {
                const sec = document.getElementById('reg-tarjeta-section');
                if (sec) sec.style.display = r.value === 'mercadopago' && r.checked ? '' : 'none';
            });
        });
    },

    actualizarUI() {
        this.mostrarPerfilFlotante();
        this.mostrarBotonPagoRapido();
    },

    mostrarPerfilFlotante() {
        const existing = document.getElementById('perfil-flotante-container');
        if (existing) existing.remove();

        const estaRegistrado = !!this.estado.cliente;

        const chipStyle = "background:rgba(30,30,30,0.95);color:var(--muted);padding:7px 13px;border-radius:20px;font-size:0.78rem;font-weight:600;cursor:pointer;border:1px solid var(--border);white-space:nowrap;";
        const chipPrimary = "background:var(--fire,#ff4d00);color:#fff;padding:7px 13px;border-radius:20px;font-size:0.78rem;font-weight:700;cursor:pointer;border:1px solid var(--fire,#ff4d00);white-space:nowrap;";

        const html = `
            <div id="perfil-flotante-container" style="position:fixed;top:16px;right:16px;display:flex;align-items:center;gap:8px;z-index:1001;">
                ${!estaRegistrado ? `<span id="perfil-login" style="${chipPrimary}">Iniciar sesión</span>` : ''}
                ${!estaRegistrado ? `<span id="perfil-texto" style="${chipStyle}">Registrarme</span>` : ''}
                <div id="perfil-flotante" style="background:${estaRegistrado ? 'linear-gradient(135deg,var(--fire),#e03a00)' : '#2a2a2a'};color:white;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:${estaRegistrado ? '1.3rem' : '1.1rem'};font-weight:bold;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.4);font-family:'Bebas Neue',sans-serif;">
                    ${estaRegistrado ? this.estado.cliente.nombre.charAt(0).toUpperCase() : '?'}
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        setTimeout(() => {
            const perfil = document.getElementById('perfil-flotante');
            const texto = document.getElementById('perfil-texto');
            const login = document.getElementById('perfil-login');
            if (perfil) {
                perfil.addEventListener('click', () => estaRegistrado ? this.abrirPerfil() : this.mostrarBeneficios());
            }
            if (texto) {
                texto.addEventListener('click', () => this.mostrarRegistro());
            }
            if (login) {
                login.addEventListener('click', () => this.mostrarLogin());
            }
        }, 50);
    },

    mostrarBotonPagoRapido() {
        const existing = document.getElementById('btn-pago-rapido-principal');
        if (existing) existing.remove();

        const orderBox = document.querySelector('.order-box');
        if (!orderBox) return;

        const estaRegistrado = !!this.estado.cliente;
        const totalStr = this.estado.total > 0 ? ` · $${this.estado.total.toLocaleString('es-CL')}` : '';

        const html = `<button id="btn-pago-rapido-principal" class="btn-rayo" style="width:100%;margin-top:10px;padding:16px;border:none;border-radius:50px;font-family:'Bebas Neue',sans-serif;font-size:1.3rem;letter-spacing:2px;cursor:pointer;background:linear-gradient(135deg,#FFD700,#FFA500,#FF6347);color:#000;font-weight:800;border:2px solid #FFD700;animation:rayo-pulse 2s infinite;">
            ${estaRegistrado ? `⚡ PAGO RÁPIDO${totalStr} ⚡` : `⚡ REGISTRARME${totalStr}`}
        </button>`;

        const btnWsp = orderBox.querySelector('.btn-wsp');
        if (btnWsp) btnWsp.insertAdjacentHTML('beforebegin', html);
        else orderBox.insertAdjacentHTML('beforeend', html);

        setTimeout(() => {
            const btn = document.getElementById('btn-pago-rapido-principal');
            if (btn) btn.addEventListener('click', () => estaRegistrado ? this.pagarRapido() : this.mostrarBeneficios());
        }, 50);
    },

    // ── ABRIR VISTAS ──

    mostrarBeneficios() {
        this._mostrarVista('vista-beneficios');
        document.getElementById('modal-pago-rapido').classList.add('open');
    },

    mostrarRegistro() {
        // Limpiar form
        ['reg-email','reg-nombre','reg-telefono','reg-direccion','reg-pin'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const terminos = document.getElementById('reg-terminos');
        if (terminos) terminos.checked = false;
        const err = document.getElementById('reg-error');
        if (err) err.style.display = 'none';
        this._mostrarVista('vista-registro');
        document.getElementById('modal-pago-rapido').classList.add('open');
    },

    abrirPerfil() {
        if (!this.estado.cliente) { this.mostrarBeneficios(); return; }
        const c = this.estado.cliente;
        document.getElementById('perfil-nombre').textContent = c.nombre;
        document.getElementById('perfil-email').textContent = c.email;
        const elTel = document.getElementById('perfil-telefono');
        if (elTel) elTel.textContent = c.telefono ? '📞 ' + c.telefono : '';
        const elDir = document.getElementById('perfil-direccion');
        if (elDir) elDir.textContent = c.direccion_entrega ? '📍 ' + c.direccion_entrega : '';
        document.getElementById('perfil-metodo').textContent = c.metodo_pago === 'mercadopago' ? '💳 MercadoPago' : '💬 WhatsApp';
        const mp = document.getElementById('rdo-perfil-mp');
        const wsp = document.getElementById('rdo-perfil-wsp');
        if (mp) mp.checked = c.metodo_pago !== 'whatsapp';
        if (wsp) wsp.checked = c.metodo_pago === 'whatsapp';

        this.renderTarjetaVisual();
        this._mostrarVista('vista-perfil');
        document.getElementById('modal-pago-rapido').classList.add('open');
    },

    renderTarjetaVisual() {
        const c = this.estado.cliente || {};
        const cont = document.getElementById('perfil-tarjeta-container');
        if (!cont) return;
        if (!c.ultimos4) {
            cont.innerHTML = `
                <div style="background:linear-gradient(135deg,#2a2a2a,#1a1a1a);border:1px dashed var(--border);border-radius:16px;padding:28px 20px;text-align:center;color:var(--muted);font-size:0.88rem;">
                    No hay tarjeta guardada.<br>
                    <span style="font-size:0.78rem;">Tocá "Editar" para agregar una.</span>
                </div>`;
            return;
        }
        const logo = c.marca_tarjeta === 'Visa'
            ? `<span style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:#1a1f71;background:#fff;padding:2px 10px;border-radius:4px;letter-spacing:1px;">VISA</span>`
            : c.marca_tarjeta === 'Mastercard'
            ? `<span style="display:inline-flex;align-items:center;"><span style="display:inline-block;width:20px;height:20px;background:#eb001b;border-radius:50%;"></span><span style="display:inline-block;width:20px;height:20px;background:#f79e1b;border-radius:50%;margin-left:-8px;"></span></span>`
            : c.marca_tarjeta === 'American Express'
            ? `<span style="font-family:'DM Sans',sans-serif;font-size:0.75rem;color:#fff;background:#016fd0;padding:4px 10px;border-radius:3px;font-weight:800;">AMEX</span>`
            : `<span style="font-family:'DM Sans',sans-serif;font-size:0.8rem;color:#fff;background:#555;padding:4px 10px;border-radius:4px;">TARJETA</span>`;
        const tipoLabel = c.tipo_tarjeta === 'credito' ? 'Crédito'
            : c.tipo_tarjeta === 'debito' ? 'Débito'
            : c.tipo_tarjeta === 'prepago' ? 'Prepago' : '';
        const emisor = (c.emisor_tarjeta || 'TARJETA').toUpperCase();
        const titular = (c.titular_tarjeta || c.nombre || '').toUpperCase();
        cont.innerHTML = `
            <div style="background:linear-gradient(135deg,#d8d8d8,#a8a8a8);border-radius:16px;padding:20px;color:#1a1a1a;font-family:'DM Sans',sans-serif;box-shadow:0 6px 16px rgba(0,0,0,0.3);position:relative;min-height:130px;">
                <div style="font-size:0.72rem;font-weight:700;letter-spacing:1px;margin-bottom:24px;">${this._esc(emisor)}</div>
                <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;">
                    <div style="flex:1;">
                        <div style="font-size:0.72rem;color:#333;">**** ${this._esc(c.ultimos4)}</div>
                        <div style="font-size:0.78rem;font-weight:700;margin-top:4px;">${this._esc(titular)}</div>
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
                        ${logo}
                        ${tipoLabel ? `<span style="font-size:0.68rem;color:#333;background:rgba(255,255,255,0.6);padding:2px 6px;border-radius:3px;font-weight:600;">${tipoLabel}</span>` : ''}
                    </div>
                </div>
            </div>`;
    },

    _esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    mostrarEditarTarjeta() {
        const c = this.estado.cliente || {};
        document.getElementById('tarjeta-titular').value = c.titular_tarjeta || c.nombre || '';
        document.getElementById('tarjeta-marca').value = c.marca_tarjeta || '';
        document.getElementById('tarjeta-tipo').value = c.tipo_tarjeta || '';
        document.getElementById('tarjeta-ultimos4').value = c.ultimos4 || '';
        document.getElementById('tarjeta-emisor').value = c.emisor_tarjeta || '';
        const err = document.getElementById('tarjeta-error');
        if (err) err.style.display = 'none';
        this._mostrarVista('vista-editar-tarjeta');
        document.getElementById('modal-pago-rapido').classList.add('open');
    },

    guardarTarjeta() {
        const c = this.estado.cliente;
        if (!c) { this.mostrarBeneficios(); return; }
        const titular = document.getElementById('tarjeta-titular').value.trim().toUpperCase();
        const marca = document.getElementById('tarjeta-marca').value;
        const tipo = document.getElementById('tarjeta-tipo').value;
        const ultimos4 = document.getElementById('tarjeta-ultimos4').value.trim();
        const emisor = document.getElementById('tarjeta-emisor').value.trim();
        const errEl = document.getElementById('tarjeta-error');
        errEl.style.display = 'none';

        if (!titular) { errEl.textContent = 'Ingresá el titular.'; errEl.style.display = 'block'; return; }
        if (!marca) { errEl.textContent = 'Elegí la marca.'; errEl.style.display = 'block'; return; }
        if (!tipo) { errEl.textContent = 'Elegí el tipo de tarjeta.'; errEl.style.display = 'block'; return; }
        if (!/^\d{4}$/.test(ultimos4)) { errEl.textContent = 'Los últimos 4 dígitos deben ser 4 números.'; errEl.style.display = 'block'; return; }

        c.titular_tarjeta = titular;
        c.marca_tarjeta = marca;
        c.tipo_tarjeta = tipo;
        c.ultimos4 = ultimos4;
        c.emisor_tarjeta = emisor || null;

        this.guardarCliente(c);
        this.mostrarToast('Tarjeta guardada ✓');
        this.abrirPerfil();
    },

    eliminarTarjeta() {
        const c = this.estado.cliente;
        if (!c) return;
        if (!confirm('¿Eliminar la tarjeta guardada?')) return;
        delete c.titular_tarjeta;
        delete c.marca_tarjeta;
        delete c.tipo_tarjeta;
        delete c.ultimos4;
        delete c.emisor_tarjeta;
        this.guardarCliente(c);
        this.mostrarToast('Tarjeta eliminada ✓');
        this.abrirPerfil();
    },

    _mostrarVista(idVisible) {
        ['vista-beneficios','vista-registro','vista-login','vista-perfil','vista-editar-tarjeta'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = id === idVisible ? 'block' : 'none';
        });
    },

    mostrarLogin() {
        ['login-email','login-pin'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const err = document.getElementById('login-error');
        if (err) err.style.display = 'none';
        this._mostrarVista('vista-login');
        document.getElementById('modal-pago-rapido').classList.add('open');
    },

    async handleLogin() {
        const email = document.getElementById('login-email').value.trim().toLowerCase();
        const pin = document.getElementById('login-pin').value.trim();
        const errEl = document.getElementById('login-error');
        errEl.style.display = 'none';

        if (!email || !email.includes('@')) {
            errEl.textContent = 'Ingresá un email válido.';
            errEl.style.display = 'block';
            return;
        }
        if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
            errEl.textContent = 'El PIN debe tener 4 dígitos numéricos.';
            errEl.style.display = 'block';
            return;
        }

        const usuario = this._getUsuarioPorEmail(email);
        if (!usuario) {
            errEl.textContent = 'No hay una cuenta con ese email en este dispositivo. Crea una cuenta primero.';
            errEl.style.display = 'block';
            return;
        }

        const hash = await this.hashPin(pin, email);
        if (hash !== usuario.pin_hash) {
            errEl.textContent = 'PIN incorrecto.';
            errEl.style.display = 'block';
            return;
        }

        this.estado.cliente = usuario;
        this.estado.modo = 'registrado';
        this._setSesionActiva(email);

        this.cerrarModal();
        this.mostrarToast(`¡Hola de nuevo, ${this.estado.cliente.nombre.split(' ')[0]}!`);
        setTimeout(() => this.actualizarUI(), 200);
    },

    cerrarModal() {
        document.getElementById('modal-pago-rapido').classList.remove('open');
    },

    // ── GUARDAR REGISTRO ──
    handleGuardar() {
        const email = document.getElementById('reg-email').value.trim().toLowerCase();
        const nombre = document.getElementById('reg-nombre').value.trim();
        const telefono = document.getElementById('reg-telefono')?.value.trim() || '';
        const direccion = document.getElementById('reg-direccion')?.value.trim() || '';
        const pin = document.getElementById('reg-pin').value.trim();
        const metodo = document.querySelector('input[name="reg-metodo"]:checked')?.value || 'mercadopago';
        const errEl = document.getElementById('reg-error');
        errEl.style.display = 'none';

        if (!email || !email.includes('@')) { errEl.textContent = 'Ingresá un email válido.'; errEl.style.display = 'block'; return; }
        if (!nombre) { errEl.textContent = 'Ingresá tu nombre.'; errEl.style.display = 'block'; return; }
        if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) { errEl.textContent = 'El PIN debe tener 4 dígitos numéricos.'; errEl.style.display = 'block'; return; }

        const terminos = document.getElementById('reg-terminos');
        if (!terminos?.checked) { errEl.textContent = 'Debés aceptar los Términos y Condiciones.'; errEl.style.display = 'block'; return; }

        const btn = document.getElementById('btn-guardar-registro');
        btn.disabled = true;
        btn.textContent = 'Guardando...';

        (async () => {
            const pin_hash = await this.hashPin(pin, email);
            const cliente = {
                nombre,
                email,
                telefono: telefono || null,
                direccion_entrega: direccion || null,
                metodo_pago: metodo,
                pin_hash,
                creado: new Date().toISOString()
            };

            this.guardarCliente(cliente);
            this.cerrarModal();
            this.mostrarToast(`¡Listo, ${nombre.split(' ')[0]}! Datos guardados ✓`);
            setTimeout(() => this.actualizarUI(), 300);
            btn.disabled = false;
            btn.textContent = 'GUARDAR Y CONTINUAR';
        })();
    },

    guardarPerfil() {
        const metodo = document.querySelector('input[name="perfil-metodo"]:checked')?.value;
        if (this.estado.cliente && metodo) {
            this.estado.cliente.metodo_pago = metodo;
            this.guardarCliente(this.estado.cliente);
        }
        this.cerrarModal();
        this.actualizarUI();
        this.mostrarToast('Perfil actualizado ✓');
    },

    cerrarSesion() {
        // Mantener la cuenta guardada en 'orbita_usuarios', solo desactivar la sesión
        this._setSesionActiva(null);
        this.estado.cliente = null;
        this.estado.modo = 'nuevo';
        this.cerrarModal();
        this.actualizarUI();
        this.mostrarToast('Sesión cerrada. Puedes volver a entrar con tu email y PIN.');
    },

    // ── PAGO RÁPIDO ──
    pagarRapido() {
        if (!this.estado.cliente) { this.mostrarBeneficios(); return; }
        if (this.estado.total === 0) { this.mostrarToast('Agregá productos al pedido primero'); return; }

        const nombreInput = document.getElementById('input-nombre');
        if (nombreInput && !nombreInput.value.trim()) {
            this.mostrarToast('Completá tu nombre');
            nombreInput.focus();
            return;
        }

        const horaInput = document.getElementById('input-hora');
        if (horaInput && horaInput.style.display !== 'none' && !horaInput.value) {
            this.mostrarToast('Elegí hora de retiro');
            horaInput.focus();
            return;
        }

        this.abrirModalPin();
    },

    abrirModalPin() {
        document.getElementById('pin-total').textContent = this.estado.total.toLocaleString('es-CL');
        document.getElementById('pin-input-validacion').value = '';
        document.getElementById('pin-error-validacion').style.display = 'none';
        document.getElementById('modal-pin-validacion').classList.add('open');
        setTimeout(() => document.getElementById('pin-input-validacion').focus(), 100);
    },

    cerrarModalPin() {
        document.getElementById('modal-pin-validacion').classList.remove('open');
    },

    async confirmarPagoConPin() {
        const pinIngresado = document.getElementById('pin-input-validacion').value.trim();
        const errEl = document.getElementById('pin-error-validacion');
        errEl.style.display = 'none';

        if (!pinIngresado || pinIngresado.length !== 4) {
            errEl.textContent = 'El PIN debe tener 4 dígitos.';
            errEl.style.display = 'block';
            return;
        }
        const hashIngresado = await this.hashPin(pinIngresado, this.estado.cliente.email);
        if (hashIngresado !== this.estado.cliente.pin_hash) {
            errEl.textContent = 'PIN incorrecto. Intentá nuevamente.';
            errEl.style.display = 'block';
            return;
        }

        this.cerrarModalPin();
        this.mostrarToast('PIN correcto ✓ Procesando pago...');

        setTimeout(() => {
            if (this.estado.cliente.metodo_pago === 'mercadopago') {
                if (window.pagarConMP) window.pagarConMP();
                else this.mostrarToast('Redirigiendo a MercadoPago...');
            } else {
                if (window.enviarPedido) window.enviarPedido();
                else this.mostrarToast('Enviando pedido por WhatsApp...');
            }
        }, 500);
    },

    // ── DATOS ──
    descargarDatosJSON() {
        if (!this.estado.cliente) { this.mostrarToast('No hay datos para exportar'); return; }
        const c = this.estado.cliente;
        const datos = {
            nombre: c.nombre,
            email: c.email,
            telefono: c.telefono || null,
            direccion_entrega: c.direccion_entrega || null,
            metodo_pago: c.metodo_pago,
            creado: c.creado,
            tarjeta: c.ultimos4 ? {
                titular: c.titular_tarjeta || null,
                marca: c.marca_tarjeta || null,
                tipo: c.tipo_tarjeta || null,
                ultimos4: c.ultimos4,
                emisor: c.emisor_tarjeta || null
            } : null,
            exportado: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `mis-datos-orbita-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        this.mostrarToast('Datos descargados ✓');
    },

    descargarDatosPDF() {
        if (!this.estado.cliente) { this.mostrarToast('No hay datos para exportar'); return; }
        const c = this.estado.cliente;
        const e = (s) => this._esc(s);
        const tarjetaHtml = c.ultimos4 ? `
            <p><label>Tarjeta:</label> ${e(c.marca_tarjeta || '')} ${e(c.tipo_tarjeta || '')} **** ${e(c.ultimos4)}</p>
            <p><label>Titular:</label> ${e(c.titular_tarjeta || '')}</p>` : '';
        const w = window.open('', '_blank');
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Mis Datos Órbita</title>
            <style>body{font-family:Arial,sans-serif;padding:30px;line-height:1.6}h1{color:#ff4d00}hr{border:1px solid #ddd}label{font-weight:bold}</style>
            </head><body><h1>ÓRBITA — Mis Datos</h1><hr>
            <p><label>Nombre:</label> ${e(c.nombre)}</p>
            <p><label>Email:</label> ${e(c.email)}</p>
            <p><label>Teléfono:</label> ${e(c.telefono || '—')}</p>
            <p><label>Dirección:</label> ${e(c.direccion_entrega || '—')}</p>
            <p><label>Método pago:</label> ${e(c.metodo_pago)}</p>
            ${tarjetaHtml}
            <p><label>Registro:</label> ${new Date(c.creado).toLocaleString('es-CL')}</p>
            <p><label>Exportado:</label> ${new Date().toLocaleString('es-CL')}</p>
            <hr><p style="font-size:0.85em;color:#666;">Protegido por Ley 19.496 Chile</p></body></html>`);
        w.document.close();
        setTimeout(() => { w.print(); }, 400);
        this.mostrarToast('PDF generado ✓');
    },

    eliminarCuentaCompleta() {
        if (!confirm('¿Seguro quieres eliminar tu cuenta? Esta acción NO se puede deshacer.')) return;
        if (!confirm('Se eliminarán todos tus datos guardados en este dispositivo. ¿Confirmar?')) return;
        const email = (this.estado.cliente && this.estado.cliente.email || '').toLowerCase().trim();
        if (email) {
            const map = this._getUsuarios();
            delete map[email];
            this._saveUsuarios(map);
        }
        this._setSesionActiva(null);
        this.estado.cliente = null;
        this.estado.modo = 'nuevo';
        this.cerrarModal();
        this.actualizarUI();
        this.mostrarToast('Cuenta eliminada permanentemente.');
    },

    // ── UTILIDADES ──
    mostrarToast(msg) {
        const toast = document.getElementById('orbita-pago-toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.style.display = 'block';
        toast.style.opacity = '1';
        toast.style.transition = '';
        setTimeout(() => { toast.style.transition = 'opacity 0.4s'; toast.style.opacity = '0'; }, 2400);
        setTimeout(() => { toast.style.display = 'none'; }, 2900);
    },

    detectarMarca(num) {
        if (num.startsWith('4')) return 'Visa';
        if (num.startsWith('5')) return 'Mastercard';
        if (num.startsWith('3')) return 'American Express';
        return 'Otra';
    },

    actualizarTotal(total, items) {
        this.estado.total = total;
        this.estado.items = items;
        this.actualizarUI();
    }
};
