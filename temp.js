
        // ────────────────────────────────────────────────────────────────────────────
        // STATE
        // ────────────────────────────────────────────────────────────────────────────
        const TOKEN_KEY = 'admin_token';
        let products = [];
        let quoteItems = [];
        let notFound = [];
        let clients = []; // Historial de clientes

        // ────────────────────────────────────────────────────────────────────────────
        // AUTH & LOAD
        // ────────────────────────────────────────────────────────────────────────────
        function getToken() { return localStorage.getItem(TOKEN_KEY); }
        async function apiFetch(url, opts = {}) {
            opts.headers = { ...(opts.headers || {}), 'Authorization': `Bearer ${getToken()}` };
            return fetch(url, opts);
        }
        async function checkAuth() {
            if (!getToken()) { showLogin(); return false; }
            try {
                const r = await fetch('/api/brands', { headers: { 'Authorization': `Bearer ${getToken()}` } });
                if (r.status === 401) { showLogin(); return false; }
            } catch (_) { }
            return true;
        }
        function showLogin() {
            document.getElementById('loginOverlay').style.display = 'flex';
            setTimeout(() => document.getElementById('adminPwd').focus(), 300);
        }
        async function doLogin() {
            const pwd = document.getElementById('adminPwd').value;
            const err = document.getElementById('loginError');
            err.style.display = 'none';
            try {
                const r = await fetch('/api/login', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: pwd })
                });
                const d = await r.json();
                if (r.ok && d.token) {
                    localStorage.setItem(TOKEN_KEY, d.token);
                    document.getElementById('loginOverlay').style.display = 'none';
                    loadInitialData();
                } else { err.style.display = 'block'; document.getElementById('adminPwd').value = ''; }
            } catch (e) { err.textContent = 'Error de conexión.'; err.style.display = 'block'; }
        }

        async function loadInitialData() {
            loadProducts();
            loadClients();
        }

        async function loadProducts() {
            try {
                const r = await apiFetch('/api/products');
                if (r.status === 401) { showLogin(); return; }
                const d = await r.json();
                products = d.data || [];
                // Guardar en caché local para modo offline
                localStorage.setItem('offlineProducts', JSON.stringify(products));
            } catch (_) {
                // Modo Offline: intentar usar catálogo guardado
                const cached = localStorage.getItem('offlineProducts');
                if (cached) {
                    products = JSON.parse(cached);
                    showToast('⚡️ Modo Offline: Usando catálogo descargado');
                } else {
                    showToast('⚠️ Sin conexión y sin catálogo guardado');
                }
            }
        }

        async function loadClients() {
            try {
                const r = await apiFetch('/api/clients');
                const d = await r.json();
                clients = d.data || [];
                const list = document.getElementById('clientsList');
                list.innerHTML = clients.map(c => `<option value="${c.name}">`).join('');
            } catch (_) { }
        }

        function onClientSelect(name) {
            const c = clients.find(cl => cl.name === name);
            if (c) {
                document.getElementById('fClientPhone').value = c.phone || '';
                document.getElementById('fClientEmail').value = c.email || '';
            }
        }

        async function updateQuoteId() {
            const userId = document.getElementById('fVendor').value;
            const date = document.getElementById('fQuoteDate').value;
            try {
                const r = await apiFetch(`/api/quotes/next-id/${userId}?date=${date}`);
                const d = await r.json();
                document.getElementById('fQuoteNum').value = d.nextId;
            } catch (_) {
                showToast('Error al generar folio');
            }
        }

        // ────────────────────────────────────────────────────────────────────────────
        // TEXT PARSING
        // ────────────────────────────────────────────────────────────────────────────
        const SKIP_WORDS = new Set(['HOLA', 'BUENOS', 'DIAS', 'TARDES', 'NOCHES', 'GRACIAS', 'FAVOR',
            'PRECIO', 'PRECIOS', 'CUANTO', 'CUANTOS', 'NECESITO', 'TENGO', 'QUIERO', 'COTIZAR',
            'HACER', 'DAME', 'POR', 'PARA', 'CON', 'SIN', 'DEL', 'LAS', 'LOS', 'UNA', 'UNO', 'QUE',
            'ESA', 'ESE', 'ESTE', 'ESTA', 'INTEGRAL', 'COSTO', 'COSTOS', 'TODOS', 'TIENE',
            'TIENEN', 'COMO', 'CUANDO', 'DONDE', 'SOBRE', 'ENTRE', 'STOCK', 'MARCA', 'MODELO',
            'SERIE', 'CODIGO', 'NUMERO', 'UNIDAD', 'CANTIDAD', 'TOTAL', 'IVA', 'MXN', 'USD',
            'DADO', 'SOBRE', 'ENTRE', 'TENGO', 'BUENAS']);

        function extractCodes(text) {
            const raw = text.toUpperCase();
            const matches = [];
            const re = /\b([A-Z0-9][A-Z0-9\-\.]{2,}[A-Z0-9])\b/g;
            let m;
            while ((m = re.exec(raw)) !== null) {
                const t = m[1];
                if (!SKIP_WORDS.has(t) && t.length >= 4) matches.push(t);
            }
            return [...new Set(matches)];
        }

        function matchCode(code) {
            let p = products.find(pr => pr.id.toUpperCase() === code);
            if (!p) p = products.find(pr => pr.id.toUpperCase().includes(code) || code.includes(pr.id.toUpperCase()));
            return p || null;
        }

        // ────────────────────────────────────────────────────────────────────────────
        // NAVIGATION
        // ────────────────────────────────────────────────────────────────────────────
        function goToStep(n) {
            document.querySelectorAll('.section').forEach((s, i) => s.classList.toggle('active', i === n - 1));
            [0, 1, 2].forEach(i => {
                const d = document.getElementById(`dot${i}`);
                d.classList.remove('active', 'done');
                if (i === n - 1) d.classList.add('active');
                else if (i < n - 1) d.classList.add('done');
            });
            document.getElementById('actionBar').style.display = (n === 3) ? 'flex' : 'none';
            document.getElementById('btnReset').style.display = (n > 1) ? 'block' : 'none';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // ────────────────────────────────────────────────────────────────────────────
        // STEP 1 → ANALYZE
        // ────────────────────────────────────────────────────────────────────────────
        async function analyzeText() {
            const text = document.getElementById('pasteInput').value.trim();
            if (!text) { showToast('Pega primero un texto'); return; }
            if (!products.length) { showToast('Cargando catálogo…'); await loadProducts(); }
            const btn = document.getElementById('btnAnalyze');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analizando…';
            const codes = extractCodes(text);
            quoteItems = []; notFound = [];
            codes.forEach(code => {
                const p = matchCode(code);
                if (p && !quoteItems.find(q => q.id === p.id))
                    quoteItems.push({ id: p.id, name: p.name, brand: p.brand, qty: 1, price: '' });
                else if (!p) notFound.push(code);
            });
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Analizar texto';
            renderReview();
            goToStep(2);
        }

        // ────────────────────────────────────────────────────────────────────────────
        // STEP 2 → RENDER
        // ────────────────────────────────────────────────────────────────────────────
        function renderReview() {
            const list = document.getElementById('productList');
            document.getElementById('step2Sub').textContent = quoteItems.length
                ? `${quoteItems.length} producto${quoteItems.length !== 1 ? 's' : ''} encontrado${quoteItems.length !== 1 ? 's' : ''}. Ajusta cantidades y precios.`
                : 'No se encontraron códigos conocidos en el texto.';
            if (!quoteItems.length) {
                list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><p>Ningún código identificado.<br>Intenta con otro texto.</p></div>`;
            } else {
                list.innerHTML = '';
                quoteItems.forEach((item, idx) => {
                    const div = document.createElement('div');
                    div.className = 'product-item matched';
                    div.innerHTML = `
                <div class="product-header">
                    <div class="product-status"><i class="fa-solid fa-check"></i></div>
                    <div class="product-meta">
                        <div class="product-code">${item.id}</div>
                        <div class="product-name">${item.name || '—'}</div>
                        ${item.brand ? `<div class="product-brand">${item.brand}</div>` : ''}
                    </div>
                    <button class="product-remove" onclick="removeItem(${idx})"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="product-qty-price">
                    <div class="field-wrap">
                        <label class="field-label">Cantidad</label>
                        <input class="field-input" type="number" min="1" value="${item.qty}"
                            oninput="quoteItems[${idx}].qty=parseInt(this.value)||1" inputmode="numeric">
                    </div>
                    <div class="field-wrap">
                        <label class="field-label">Precio Unit.</label>
                        <input class="field-input price" type="number" min="0" step="0.01"
                            placeholder="$ —" value="${item.price}"
                            oninput="quoteItems[${idx}].price=this.value" inputmode="decimal">
                    </div>
                </div>`;
                    list.appendChild(div);
                });
            }
            const nfSection = document.getElementById('notFoundSection');
            const nfChips = document.getElementById('notFoundChips');
            nfSection.style.display = notFound.length ? 'block' : 'none';
            nfChips.innerHTML = notFound.map(c => `<span class="code-chip">${c}</span>`).join('');
            document.getElementById('btnGenerate').disabled = !quoteItems.length;
        }
        function removeItem(idx) { quoteItems.splice(idx, 1); renderReview(); }

        // ────────────────────────────────────────────────────────────────────────────
        // STEP 3 → QUICK QUOTE
        // ────────────────────────────────────────────────────────────────────────────
        const fmt = n => Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 });

        function generateQuote() {
            const date = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            document.getElementById('quoteDate').textContent = date.charAt(0).toUpperCase() + date.slice(1);
            const body = document.getElementById('quoteBody');
            body.innerHTML = '';
            let total = 0;
            quoteItems.forEach(item => {
                const qty = item.qty || 1, p = parseFloat(item.price) || 0, sub = qty * p;
                total += sub;
                const row = document.createElement('div');
                row.className = 'quote-row';
                row.innerHTML = `
            <div>
                <div class="quote-row-name">${item.name || item.id}</div>
                <div class="quote-row-code">${item.id}</div>
            </div>
            <div class="quote-row-qty">× ${qty}</div>
            <div class="quote-row-price">${p > 0 ? fmt(sub) : '—'}</div>`;
                body.appendChild(row);
            });
            document.getElementById('quoteTotal').textContent = total > 0 ? fmt(total) : '—';
            goToStep(3);
        }

        // ────────────────────────────────────────────────────────────────────────────
        // FORMAL PDF SHEET
        // ────────────────────────────────────────────────────────────────────────────
        // --- AUTO-COMPLETE CRM ---
        function loadClientCRM() {
            const savedClients = JSON.parse(localStorage.getItem('crmClients') || '[]');
            const nameInput = document.getElementById('fClientName');
            const emailInput = document.getElementById('fClientEmail');
            const phoneInput = document.getElementById('fClientPhone');

            nameInput.addEventListener('change', () => {
                const found = savedClients.find(c => c.name.toLowerCase() === nameInput.value.trim().toLowerCase());
                if (found && emailInput.value === '' && phoneInput.value === '') {
                    emailInput.value = found.email || '';
                    phoneInput.value = found.phone || '';
                    showToast('⚡️ Autocompletado desde libreta');
                }
            });

            emailInput.addEventListener('change', () => {
                const found = savedClients.find(c => c.email.toLowerCase() === emailInput.value.trim().toLowerCase());
                if (found && nameInput.value === '') {
                    nameInput.value = found.name || '';
                    phoneInput.value = found.phone || '';
                    showToast('⚡️ Autocompletado desde libreta');
                }
            });
        }

        function saveClientToCRM(name, email, phone) {
            if (!name || name === 'Cliente') return;
            let saved = JSON.parse(localStorage.getItem('crmClients') || '[]');
            const idx = saved.findIndex(c => c.email && c.email === email || (c.name === name && name.length > 3));
            const entry = { name, email, phone };
            if (idx >= 0) saved[idx] = entry;
            else saved.unshift(entry); // newest first
            // Keep max 200 contacts
            saved = saved.slice(0, 200);
            localStorage.setItem('crmClients', JSON.stringify(saved));
        }

        // --- FORMAL SHEET ---
        async function openFormalSheet() {
            // 1. Abrir el sheet INMEDIATAMENTE (no esperar el fetch del folio)
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('fQuoteDate').value = today;
            loadClientCRM();
            document.getElementById('formalOverlay').classList.add('open');

            // 2. Cargar el folio en segundo plano (sin bloquear apertura)
            const quoteNumEl = document.getElementById('fQuoteNum');
            quoteNumEl.value = '...';
            try {
                const userId = document.getElementById('fVendor').value;
                const r = await apiFetch(`/api/quotes/next-id/${userId}?date=${today}`);
                const d = await r.json();
                quoteNumEl.value = d.nextId || generarFolioLocal(userId, today);
            } catch (_) {
                quoteNumEl.value = generarFolioLocal(
                    document.getElementById('fVendor').value, today
                );
            }
        }
        function generarFolioLocal(userId, dateStr) {
            // Fallback cuando la red falla: genera folio con timestamp único
            const [y, m, d] = dateStr.split('-');
            const date = `${d}${m}${y.slice(-2)}`;
            const rand = String(Math.floor(Math.random() * 90) + 10);
            return `IC${userId.padStart(2, '0')}-${date}-${rand}`;
        }
        function closeFormalSheet() {
            document.getElementById('formalOverlay').classList.remove('open');
        }

        // --- SETTINGS SHEET ---
        function openSettingsSheet() {
            closeFormalSheet();
            document.getElementById('settingsOverlay').classList.add('open');

            // Reemplazar antiguo default si quedó en caché
            let bizEmail = localStorage.getItem('bizEmail');
            if (bizEmail === 'info@integralcomputacion.com') bizEmail = 'ventas@integralcomputacion.com';

            // Cargar desde localStorage o poner defaults
            document.getElementById('cfgPhone').value = localStorage.getItem('bizPhone') || '(33) 12680092';
            document.getElementById('cfgEmail').value = bizEmail || 'ventas@integralcomputacion.com';
            document.getElementById('cfgWa').value = localStorage.getItem('bizWa') || '(33) 12680092';
            document.getElementById('cfgTerms').value = localStorage.getItem('bizTerms') || 'Esta cotización es válida por 15 días naturales. Los precios se respetan dentro de este plazo al confirmar el pedido.';
        }
        function closeSettingsSheet() {
            document.getElementById('settingsOverlay').classList.remove('open');
            openFormalSheet(); // Vuelve al PDF
        }
        function saveSettings() {
            localStorage.setItem('bizPhone', document.getElementById('cfgPhone').value);
            localStorage.setItem('bizEmail', document.getElementById('cfgEmail').value);
            localStorage.setItem('bizWa', document.getElementById('cfgWa').value);
            localStorage.setItem('bizTerms', document.getElementById('cfgTerms').value);
            showToast('✓ Datos de empresa guardados');
            closeSettingsSheet();
        }

        // --- DESIGN SHEET (Moved to Admin Home) ---

        function getCheckedPayments() {
            const map = {
                payEfectivo: 'Efectivo', payTransferencia: 'Transferencia', payBBVA: 'BBVA CoDi',
                payOXXO: 'OXXO Pay', payTarjeta: 'Tarjeta (cargo del 3%)', payMercadoPago: 'MercadoPago'
            };
            return Object.entries(map)
                .filter(([id]) => document.getElementById(id).checked)
                .map(([, label]) => label);
        }

        async function printFormal() {
            // Reemplazar antiguo default si quedó en caché
            let currentEmail = localStorage.getItem('bizEmail');
            if (currentEmail === 'info@integralcomputacion.com') {
                currentEmail = 'ventas@integralcomputacion.com';
                localStorage.setItem('bizEmail', currentEmail);
            }

            // Cargar configuración de empresa
            const bizPhone = localStorage.getItem('bizPhone') || '(33) 12680092';
            const bizEmail = currentEmail || 'ventas@integralcomputacion.com';
            const bizWa = localStorage.getItem('bizWa') || '(33) 12680092';
            const bizTerms = localStorage.getItem('bizTerms') || 'Esta cotización es válida por 15 días naturales. Los precios se respetan dentro de este plazo al confirmar el pedido.';

            // Valores inmutables
            const bizWeb = 'www.integralcomputacion.com';
            const bizIg = '@integralcomputacion';
            const bizFb = '/integralcomputacion';

            // Gather form values
            const clientName = document.getElementById('fClientName').value || 'Cliente';
            const clientPhone = document.getElementById('fClientPhone').value || '';
            const clientEmail = document.getElementById('fClientEmail').value || '';

            const vendorSelect = document.getElementById('fVendor');
            const userId = vendorSelect.value;
            const vendorName = vendorSelect.options[vendorSelect.selectedIndex].text.split(' (')[0];

            saveClientToCRM(clientName, clientEmail, clientPhone); // Guardar en CRM local inmediato

            const quoteNum = document.getElementById('fQuoteNum').value || `IC${userId}-${new Date().toISOString().split('T')[0].split('-').reverse().join('').slice(0, 4)}${new Date().getFullYear().toString().slice(-2)}-01`;
            const validity = document.getElementById('fValidity').value || '15';
            const notes = document.getElementById('fNotes').value || '';
            const ivaRate = parseFloat(document.getElementById('fIvaRate').value) || 16;
            const discount = parseFloat(document.getElementById('fDiscount').value) || 0;
            const payments = getCheckedPayments();

            // Usar la fecha seleccionada en el input
            const selectedDate = new Date(document.getElementById('fQuoteDate').value + 'T00:00:00');
            const dateStr = selectedDate.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

            const expiry = new Date(selectedDate.getTime() + parseInt(validity) * 86400000)
                .toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

            // Calculate totals
            let subtotal = quoteItems.reduce((s, i) => s + (parseFloat(i.price) || 0) * (i.qty || 1), 0);
            const disc = subtotal * discount / 100;
            const base = subtotal - disc;
            const iva = base * ivaRate / 100;
            const total = base + iva;

            // Guardar en DB antes de imprimir
            try {
                await apiFetch('/api/quotes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        quoteId: quoteNum, clientName, clientEmail, clientPhone, userId, total, items: quoteItems
                    })
                });
                loadClients(); // Recargar historial de clientes
            } catch (e) { console.error('Error saving quote', e); }

            const payRow = payments.length ? payments.map(p => `• ${p}`).join('<br>') : 'Consultar con el vendedor';

            // Design Layout Values
            const cfgLogoScale = parseFloat(localStorage.getItem('cfgLogoScale')) || 1;
            const cfgLogoY = parseFloat(localStorage.getItem('cfgLogoY')) || 0;
            const cfgTextY = parseFloat(localStorage.getItem('cfgTextY')) || 0;

            // Explicit Pagination Logic
            const chunkedPages = [];
            const itemsCopy = [...quoteItems];
            const itemsLimitWithTotals = 5;
            const itemsLimitWithoutTotals = 6;

            while (itemsCopy.length > 0) {
                let takeCount = itemsLimitWithoutTotals;
                if (itemsCopy.length <= itemsLimitWithTotals) {
                    takeCount = itemsCopy.length;
                } else if (itemsCopy.length === itemsLimitWithoutTotals) {
                    takeCount = itemsLimitWithoutTotals - 1;
                }
                chunkedPages.push(itemsCopy.splice(0, takeCount));
            }
            if (chunkedPages.length === 0) chunkedPages.push([]);

            let pagesHtml = '';
            const totalPages = chunkedPages.length;
            let currentGlobalItemIndex = 0;

            chunkedPages.forEach((chunk, pageIndex) => {
                const isFirstPage = pageIndex === 0;
                const isLastPage = pageIndex === totalPages - 1;

                const chunkRows = chunk.map((item) => {
                    currentGlobalItemIndex++;
                    return `
        <tr>
            <td>${currentGlobalItemIndex}</td>
            <td>
                ${item.name || item.id}
                <span class="pv-td-code">${item.id}</span>
            </td>
            <td style="text-align:right">${item.qty || 1}</td>
            <td style="text-align:right">${parseFloat(item.price) > 0 ? fmt(item.price) : '—'}</td>
            <td style="text-align:right">${parseFloat(item.price) > 0 ? fmt((item.qty || 1) * parseFloat(item.price)) : '—'}</td>
        </tr>`;
                }).join('');

                const pagePagination = `Página ${pageIndex + 1} de ${totalPages}`;

                pagesHtml += `
        <div class="pv-page">
            ${isFirstPage ? `
            <div class="pv-header">
                <img class="pv-logo" src="/assets/images/HORIZONTAL grande.png" onerror="this.src='/assets/logo.svg'" style="transform: translateY(${cfgLogoY}px) scale(${cfgLogoScale}); transform-origin: left center;">
                <div class="pv-biz" style="transform: translateY(${cfgTextY}px);">
                    Suministros y Equipos de Cómputo<br>
                    Tel: ${bizPhone}<br>
                    ${bizEmail}<br>
                    ${bizWeb}
                </div>
            </div>

            <div class="pv-meta">
                <div class="pv-meta-box">
                    <h4>Cotización para</h4>
                    <p>
                        <strong>${clientName}</strong><br>
                        ${clientPhone ? `Tel: ${clientPhone}<br>` : ''}
                        ${clientEmail ? `${clientEmail}<br>` : ''}
                    </p>
                </div>
                <div class="pv-meta-box">
                    <p>
                        <strong>Folio: ${quoteNum}</strong><br>
                        Fecha: <span style="white-space: nowrap;">${dateStr}</span><br>
                        Vigente hasta: <span style="white-space: nowrap;">${expiry}</span><br>
                        Agente de Ventas: ${vendorName}
                    </p>
                </div>
            </div>

            ${notes ? `<div style="font-size:8.5pt; color:#2c2c2e; padding:6pt 0; font-weight:600;">📌 Nota al cliente: ${notes}</div>` : ''}
            ` : `<div style="height: 15mm;"></div>`}

            <div class="pv-table-container" ${(!isLastPage || (isFirstPage && isLastPage)) ? 'style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center;"' : ''}>
                <table class="pv-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Descripción</th>
                            <th style="text-align:right; white-space: nowrap;">Cant.</th>
                            <th style="text-align:right; white-space: nowrap;">P. Unit.</th>
                            <th style="text-align:right; white-space: nowrap;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>${chunkRows}</tbody>
                </table>
            </div>

            ${isLastPage ? `
            <div class="pv-totals">
                <div class="pv-totals-box">
                    <div class="pv-totals-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
                    ${discount > 0 ? `<div class="pv-totals-row"><span>Descuento (${discount}%)</span><span>-${fmt(disc)}</span></div>` : ''}
                    <div class="pv-totals-row"><span>IVA (${ivaRate}%)</span><span>${fmt(iva)}</span></div>
                    <div class="pv-totals-row total"><span>TOTAL</span><span>${fmt(total)}</span></div>
                </div>
            </div>

            <div class="pv-flex-spacer" style="flex-grow:1;"></div>

            <div style="page-break-inside: avoid; margin-top: auto; padding-top: 15pt;">
                <div class="pv-legal-notes" style="border-top: none; padding-top: 0; margin-bottom: 12pt; text-align: justify;">
                    <strong>CONDICIONES:</strong> Vigencia: ${validity} días naturales. ${bizTerms}
                </div>

                <div class="pv-footer" style="border-top: 1pt solid #e5e5ea; padding-top: 12pt;">
                    <div class="pv-footer-col">
                        <h5>Formas de Pago</h5>
                        <p>${payRow}</p>
                    </div>
                    <div class="pv-footer-col">
                        <h5>Atención al Cliente</h5>
                        <p>
                            📱 Directo / WhatsApp: ${bizWa}<br>
                            ${bizEmail}
                        </p>
                    </div>
                </div>
            </div>
            ` : ``}

            <div class="pv-global-footer">
                <div style="text-align:left;">Cotización No. <strong>${quoteNum}</strong></div>
                <div style="text-align:center; padding: 0 5pt;">${pagePagination}</div>
                <div style="text-align:right;"><strong>${bizEmail}</strong><br>${bizWeb}</div>
            </div>
        </div>
        `;
            });

            // Inject print view
            document.getElementById('printView').innerHTML = pagesHtml;

            closeFormalSheet();

            // Cambiar título de la página temporalmente para prenombrar el PDF ("Cotizacion_ICXX_..._Cliente")
            const originalTitle = document.title;
            const pdfName = `Cotizacion_${quoteNum}_${clientName.replace(/[^a-zA-Z0-9]/g, '_')}`;
            document.title = pdfName;

            // Detect iOS Safari (window.print() no funciona en iPhone)
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            if (isIOS) {
                // En iOS: mostrar printView en pantalla completa con botón de Share
                const pv = document.getElementById('printView');
                pv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;overflow-y:auto;background:white;';
                // Botón para cerrar la vista previa
                const closeBar = document.createElement('div');
                closeBar.innerHTML = `
                    <div style="position:sticky;top:0;background:#1c1c1e;color:white;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;z-index:10000;">
                        <span style="font-size:14px;font-weight:600;">📄 ${pdfName}</span>
                        <div style="display:flex;gap:12px;">
                            <button onclick="window.print()" style="background:#0071e3;color:white;border:none;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:700;">🖨️ Imprimir / PDF</button>
                            <button onclick="document.getElementById('printView').style.cssText='display:none';document.getElementById('printView').removeChild(document.getElementById('printView').firstChild);document.title='${originalTitle}';" style="background:#3a3a3c;color:white;border:none;padding:8px 14px;border-radius:8px;font-size:13px;">✕ Cerrar</button>
                        </div>
                    </div>`;
                pv.prepend(closeBar);
                document.title = pdfName;
                showToast('📄 Usa Compartir (☐↑) → Imprimir para guardar el PDF');
            } else {
                setTimeout(() => {
                    window.print();
                    document.title = originalTitle;
                }, 200);
            }
        }

        // ────────────────────────────────────────────────────────────────────────────
        // WHATSAPP / COPY
        // ────────────────────────────────────────────────────────────────────────────
        function buildTextQuote() {
            const date = new Date().toLocaleDateString('es-MX');
            let lines = ['🧾 *Cotización — Integral Computación*', `📅 ${date}`, ''];
            quoteItems.forEach(item => {
                const qty = item.qty || 1, p = parseFloat(item.price) || 0, sub = qty * p;
                lines.push(`▸ *${item.id}*`);
                if (item.name) lines.push(`  ${item.name}`);
                lines.push(`  Cant: ${qty}   Precio: ${p > 0 ? fmt(p) + ' c/u' : 'Por cotizar'}`);
                if (p > 0 && qty > 1) lines.push(`  Subtotal: ${fmt(sub)}`);
                lines.push('');
            });
            const total = quoteItems.reduce((s, i) => s + (parseFloat(i.price) || 0) * (i.qty || 1), 0);
            if (total > 0) lines.push(`💰 *Total estimado: ${fmt(total)}*`);
            lines.push('', '_Precios sujetos a disponibilidad._');
            return lines.join('\n');
        }
        function shareWhatsApp() { window.open(`https://wa.me/?text=${encodeURIComponent(buildTextQuote())}`, '_blank'); }
        async function copyQuote() {
            try { await navigator.clipboard.writeText(buildTextQuote()); showToast('✓ Copiado'); }
            catch (_) { showToast('✓ Copiado'); }
        }

        // ────────────────────────────────────────────────────────────────────────────
        // UTILS
        // ────────────────────────────────────────────────────────────────────────────
        function showToast(msg) {
            const t = document.getElementById('toast');
            t.textContent = msg; t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 2500);
        }
        function resetAll() {
            document.getElementById('pasteInput').value = '';
            quoteItems = []; notFound = []; goToStep(1);
        }
        function goBack() { window.location.href = '/public/admin/home.html'; }

        // ── INIT ─────────────────────────────────────────────────────────────────────
        // Migración automática: corregir email antiguo en localStorage
        (function migrateDefaults() {
            const savedEmail = localStorage.getItem('bizEmail');
            if (!savedEmail || savedEmail === 'info@integralcomputacion.com') {
                localStorage.setItem('bizEmail', 'ventas@integralcomputacion.com');
            }
        })();

        // Theme initialization
        if (localStorage.getItem('admin-theme') === 'dark') {
            document.body.classList.add('dark-mode');
        }

        (async () => { if (await checkAuth()) loadInitialData(); })();

        /* ── SIDEBAR JS ── */
        function openSidebar() {
            document.getElementById('sidebarOverlay').classList.add('active');
            document.getElementById('sidebar').classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeSidebar() {
            document.getElementById('sidebarOverlay').classList.remove('active');
            document.getElementById('sidebar').classList.remove('active');
            document.body.style.overflow = '';
        }

        function openSidebarTab(target) {
            closeSidebar();
            if (target === 'history') {
                showToast('Historial en construcción 🚧');
            } else if (target === 'contacts') {
                showToast('Contactos en construcción 🚧');
            }
        }

        function toggleDarkMode() {
            const isDark = document.body.classList.toggle('dark-mode');
            localStorage.setItem('admin-theme', isDark ? 'dark' : 'light');
            showToast(isDark ? '🌙 Modo Oscuro Activado' : '☀️ Modo Claro Activado');
        }
    