/** CRM & Ventas Dashboard Logic (Intelligent Layer - Internal IC) **/
let crmDeals = [];
let crmMetrics = null;
let goalChartInstance = null;
let zoneChartInstance = null;
let simuladorActualVentas = 0;
let metaMensual = 200000;

// Kanban Pipeline configuration
const pipelineColumns = [
    { id: 'prospect', title: 'Prospecto Nuevo' },
    { id: 'qualified', title: 'Calificado' },
    { id: 'quote', title: 'Cotizado' },
    { id: 'negotiation', title: 'Negociación' },
    { id: 'won', title: 'Ganado / Cerrado' },
    { id: 'lost', title: 'Perdido', hidden: true } // Oculto en Kanban
];

// Leaflet Map instance
let lmap = null;
let markersLayer = null;

// Tab switcher
function switchTab(tabId) {
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.querySelector(`.tab-btn[data-target="${tabId}"]`).classList.add('active');

    const titles = {
        'comando': 'Centro de Comando Estratégico',
        'kanban': 'Pipeline Operativo',
        'simulador': 'Simulador Financiero de Cierres',
        'mapa': 'Inteligencia Territorial (Mapa)'
    };
    document.getElementById('headerTitle').innerText = titles[tabId];

    if (tabId === 'mapa') {
        setTimeout(initMap, 500); // Wait for tab to render so Leaflet gets correct size
    }
    if (tabId === 'simulador') {
        buildSimulator();
    }
}

async function apiFetch(url, options = {}) {
    if (!options.headers) options.headers = {};
    if (typeof adminToken !== 'undefined' && adminToken) {
        options.headers['Authorization'] = `Bearer ${adminToken}`;
    }
    const res = await fetch(url, options);
    if (res.status === 401) {
        alert("Sesión expirada."); window.location.href = 'home.html';
    }
    return res;
}

async function initCRM() {
    console.log("Inicializando SDK Comercial MVC...");
    await Promise.all([loadCRMMetrics(), loadDeals(), loadTasks(), loadClients(), loadBranches()]);
    // Default Tab is Comando
    switchTab('comando');
}

async function loadCRMMetrics() {
    try {
        const res = await apiFetch('/api/crm/metrics');
        crmMetrics = await res.json();

        const ej = crmMetrics.ejecutiva;
        simuladorActualVentas = ej.ventasMes || 0;

        document.getElementById('m_ventas').innerText = formatCurrency(ej.ventasMes);
        document.getElementById('m_forecast').innerText = formatCurrency(ej.forecast30);
        document.getElementById('m_pipeline').innerText = formatCurrency(ej.pipelineTotal);

        updateHealthScore(ej);
        updateGoalChart(ej.ventasMes, metaMensual);

    } catch (err) { console.error("Error métricas", err); }
}

function updateHealthScore(ej) {
    // Cálculo Dinámico de Salud del Pipeline
    let score = 100;

    // Si la conversión es muy baja (<20%), penalizar
    if (ej.conversionRate < 20) score -= 15;

    // Penalizar si hay muchos tratos inactivos (calculado desde el cliente)
    const inactivosCount = (crmMetrics.inteligencia.inactivos || []).length;
    if (inactivosCount > 5) score -= 20;
    else if (inactivosCount > 0) score -= (inactivosCount * 2);

    score = Math.max(0, Math.min(100, score));

    const hEl = document.getElementById('m_health');
    hEl.innerText = `${score}/100`;
    document.getElementById('m_health_bar').style.width = `${score}%`;

    // Colors
    hEl.className = `text-2xl font-bold mb-1 ${score > 70 ? 'text-success' : score > 40 ? 'text-warning' : 'text-danger'}`;
    document.getElementById('m_health_bar').className = `h-full rounded-full ${score > 70 ? 'bg-success' : score > 40 ? 'bg-warning' : 'bg-danger'}`;

    // Tooltip stats
    document.getElementById('h_estancados').innerText = `${inactivosCount} tratos`;
}

function updateGoalChart(actual, meta) {
    const ctx = document.getElementById('goalChart');
    if (!ctx) return;

    let pct = (actual / meta) * 100;
    if (pct > 100) pct = 100;
    document.getElementById('goalPct').innerText = `${pct.toFixed(0)}%`;
    document.getElementById('goalTarget').innerText = formatCurrency(meta);

    if (goalChartInstance) goalChartInstance.destroy();

    const remaining = meta - actual;
    const remainingText = remaining > 0 ? `Faltan <strong>${formatCurrency(remaining)}</strong> para meta.` : '<strong class="text-success">¡Meta superada!</strong>';
    const remainingEl = document.getElementById('goalRemaining');
    if (remainingEl) remainingEl.innerHTML = `<i class="fa-regular fa-calendar"></i> ${remainingText}`;

    goalChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [pct, 100 - pct],
                backgroundColor: ['#0ea5e9', '#f1f5f9'],
                borderWidth: 0,
                circumference: 180, rotation: 270, cutout: '80%', borderRadius: 10
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { enabled: false } }, animation: { animateScale: true } }
    });
}

function buildSnapshot() {
    const snap = document.getElementById('pipelineSnapshot');
    if (!snap) return;
    snap.innerHTML = '';

    // Solo mostrar las etapas importantes (Calificado, Cotizado, Negociación)
    const stages = [
        { id: 'qualified', title: 'CALIFICADO', colorClass: 'bg-blue-400', borderClass: 'border-border text-primary' },
        { id: 'quote', title: 'COTIZADO', colorClass: 'bg-amber-400', borderClass: 'border-warning ring-1 ring-warning/20 text-primary' },
        { id: 'negotiation', title: 'NEGOCIACIÓN', colorClass: 'bg-purple-400', borderClass: 'border-border text-primary' }
    ];

    stages.forEach(stage => {
        const deals = crmDeals.filter(d => d.status === stage.id).slice(0, 3); // top 3
        const totalCount = crmDeals.filter(d => d.status === stage.id).length;

        let htmlDeals = deals.map(d => {
            const daysSince = Math.floor((new Date() - new Date(d.last_contact_date)) / (1000 * 3600 * 24));
            let alertHtml = '';

            if (d.status === 'quote' && daysSince > 5) {
                alertHtml = `<div class="absolute top-0 right-0 w-8 h-8 flex justify-end p-2 items-start bg-orange-50 rounded-bl-xl text-warning">
                                <i class="fa-solid fa-triangle-exclamation text-[10px]"></i>
                            </div>`;
            }

            return `
                <div class="bg-white border ${stage.borderClass} p-3 rounded-xl shadow-sm relative overflow-hidden">
                    ${alertHtml}
                    <h5 class="text-sm font-bold text-primary mb-1">${d.title}</h5>
                    <p class="text-xs text-secondary mb-3"><i class="fa-regular fa-building"></i> ${d.client_company || 'Cliente'}</p>
                    <div class="flex justify-between items-end">
                        <span class="text-sm font-bold text-slate-800">${formatCurrency(d.value)}</span>
                        ${daysSince > 5 ? `<span class="text-[10px] text-danger font-bold">Sin contacto en ${daysSince}d</span>` : `<span class="text-[10px] text-slate-400 font-medium">Hace ${daysSince}d</span>`}
                    </div>
                </div>
            `;
        }).join('');

        if (deals.length === 0) {
            htmlDeals = `<div class="text-[10px] text-slate-400 text-center italic mt-4">Sin tratos en esta etapa</div>`;
        }

        snap.innerHTML += `
            <div class="flex-1 p-5 bg-slate-50/30">
                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-xs font-bold text-slate-500 flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full ${stage.colorClass}"></div> ${stage.title}
                    </h4>
                    <span class="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">${totalCount}</span>
                </div>
                <div class="space-y-3 cursor-pointer" onclick="switchTab('kanban')">
                    ${htmlDeals}
                </div>
            </div>
        `;
    });
}


// ---- DEALS & RADAR ----
async function loadDeals() {
    try {
        const res = await apiFetch('/api/crm/deals');
        const result = await res.json();
        crmDeals = result.data || [];

        // 1. Render Kanban
        renderKanban();

        // 2. Render Radar (Inteligencia predictiva)
        buildRadar();

        // 3. Render Snapshot
        buildSnapshot();

    } catch (err) { console.error("Error deals", err); }
}

function buildRadar() {
    const list = document.getElementById('radarList');
    list.innerHTML = '';
    let alerts = 0;

    const inactivos = crmMetrics.inteligencia.inactivos || [];

    // Regla 1: Recompra Predictiva Histórica
    // Asumimos tóners o consumibles. Si un cliente ganó hace 30+ días
    const wonDeals = crmDeals.filter(d => d.status === 'won');
    wonDeals.forEach(d => {
        const days = Math.floor((new Date() - new Date(d.updated_at)) / (1000 * 3600 * 24));
        if (days >= 25 && days <= 40) { // Ventana de resurtido
            list.innerHTML += radarItemHTML(
                'fa-rotate-left', 'bg-blue-50 text-accent',
                `Posible Recompra: ${d.client_company || 'Cliente'}`,
                `Compraron hace ${days} días por ${formatCurrency(d.value)}. Momento ideal para resurtir.`,
                formatCurrency(d.value), '75%',
                `<button class="text-[10px] font-bold bg-white border border-slate-200 px-3 py-1.5 rounded hover:border-accent hover:text-accent shadow-sm flex items-center gap-1.5" onclick="waContact('${d.id}', 'recompra')"><i class="fa-brands fa-whatsapp text-green-500"></i> Ofrecer Resurtido</button>`
            );
            alerts++;
        }
    });

    // Regla 2: Riesgo de Pérdida (Mucha plata, 0 contacto)
    const hotDeals = crmDeals.filter(d => d.status === 'quote' || d.status === 'negotiation');
    hotDeals.forEach(d => {
        const daysContact = Math.floor((new Date() - new Date(d.last_contact_date)) / (1000 * 3600 * 24));
        if (daysContact > 7 && d.value > 5000) {
            list.innerHTML += radarItemHTML(
                'fa-ghost', 'bg-red-50 text-danger',
                `Alerta de Pérdida: ${d.client_company || 'Cliente'}`,
                `Trato de alto valor estancado sin contacto en ${daysContact} días. Probabilidad cayendo rápido.`,
                formatCurrency(d.value), 'Riesgo Crítico',
                `<button class="text-[10px] font-bold bg-white border border-slate-200 px-3 py-1.5 rounded hover:border-slate-800 shadow-sm" onclick="switchTab('kanban')">Atender Inmediatamente</button>`
            );
            alerts++;
        }
    });

    // Regla 3: Follow-ups Normales
    if (inactivos.length > 0 && alerts < 5) {
        list.innerHTML += radarItemHTML(
            'fa-clock', 'bg-amber-50 text-warning',
            `Limpieza de Pipeline: ${inactivos.length} tratos muertos`,
            `Llevas más de 45 días sin tocar estos negocios. Sé radical: ciérralos por perdido o revive con descuento.`,
            `---`, `Mantenimiento`,
            `<button class="text-[10px] font-bold bg-white border border-slate-200 px-3 py-1.5 rounded hover:border-slate-800 shadow-sm" onclick="switchTab('kanban')">Ir al Tablero</button>`
        );
        alerts++;
    }

    if (alerts === 0) {
        list.innerHTML = `<div class="p-8 text-center text-slate-400"><i class="fa-solid fa-mug-hot text-3xl mb-3 text-slate-200"></i><br>Radar limpio. Gran trabajo manteniendo el pipeline saludable.</div>`;
    }

    document.getElementById('radarCount').innerText = `${alerts} Alertas Activas`;
}

function radarItemHTML(icon, iconClass, title, desc, val, prob, btnHtml) {
    return `
        <div class="px-5 py-4 flex items-start gap-4 hover:bg-slate-50 transition border-b border-border last:border-0 group">
            <div class="w-10 h-10 rounded-full ${iconClass} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-sm">
                <i class="fa-solid ${icon}"></i>
            </div>
            <div class="flex-1">
                <h4 class="text-sm font-bold text-primary">${title}</h4>
                <p class="text-xs text-secondary mt-1 max-w-lg">${desc}</p>
                <div class="mt-3 flex gap-2 items-center">
                    ${btnHtml}
                    <div class="ml-auto text-right">
                        <span class="block text-xs font-bold text-primary">${val}</span>
                        <span class="block text-[9px] font-bold text-slate-400 uppercase">Impacto</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function waContact(dealId, mode) {
    alert(`Aquí pre-cargaremos el WhatsApp de la empresa según el tipo: ${mode}`);
}

async function loadTasks() {
    // Simulated Momentum Logic
    document.getElementById('m_activos').innerText = crmDeals.filter(d => ['prospect', 'qualified', 'quote', 'negotiation'].includes(d.status)).length;
    document.getElementById('mo_segs').innerText = "14";
    document.getElementById('mo_moved').innerText = "3";
}

// ---- KANBAN V2 ----
function renderKanban() {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;
    board.innerHTML = '';

    pipelineColumns.filter(p => !p.hidden).forEach(pipe => {
        const colDiv = document.createElement('div');
        colDiv.className = 'kanban-col flex-1 min-w-[280px] max-w-[320px]';

        const columnDeals = crmDeals.filter(d => d.status === pipe.id);
        const colVal = columnDeals.reduce((sum, d) => sum + (d.value || 0), 0);

        colDiv.innerHTML = `
            <div class="px-4 py-3 border-b border-border bg-slate-100/50 rounded-t-xl flex justify-between items-center">
                <div>
                    <span class="text-xs font-bold text-primary uppercase tracking-wide">${pipe.title}</span>
                    <div class="text-[10px] font-bold text-slate-400 mt-0.5">${formatCurrency(colVal)}</div>
                </div>
                <span class="bg-white border border-border text-xs font-bold px-2 py-0.5 rounded shadow-sm text-slate-500">${columnDeals.length}</span>
            </div>
            <div class="flex-1 p-3 overflow-y-auto kanban-drag-area" data-status="${pipe.id}">
                ${columnDeals.map(d => generateCardHTML(d)).join('')}
            </div>
        `;
        board.appendChild(colDiv);
    });

    // Agregar columna Perdido para Analytics (Oculta, solo drag)
    const lostCol = document.createElement('div');
    lostCol.className = 'kanban-col flex-1 min-w-[280px] border-dashed border-2 border-red-200 bg-red-50/30';
    lostCol.innerHTML = `
        <div class="px-4 py-3 text-center"><i class="fa-solid fa-trash text-red-300 text-xl"></i><br><span class="text-xs font-bold text-red-400 uppercase">Arrastra aquí para Perder Trato</span></div>
        <div class="flex-1 p-3 kanban-drag-area" data-status="lost"></div>
    `;
    board.appendChild(lostCol);

    initSortable();
}

function generateCardHTML(deal) {
    const msSinceContact = Date.now() - new Date(deal.last_contact_date).getTime();
    const daysSinceContact = Math.floor(msSinceContact / (1000 * 3600 * 24));

    let borderC = 'border-l-blue-400';
    if (daysSinceContact > 4) borderC = 'border-l-warning';
    if (daysSinceContact > 10) borderC = 'border-l-danger';
    if (deal.status === 'won') borderC = 'border-l-success';

    let prob = deal.probability || 10;

    return `
        <div class="k-card ${borderC} group" data-id="${deal.id}">
            <h4 class="font-bold text-sm text-primary mb-1">${deal.title}</h4>
            <p class="text-[11px] text-secondary mb-3"><i class="fa-regular fa-building opacity-50"></i> ${deal.client_company || deal.client_name || 'Sin Asignar'}</p>
            
            <div class="flex justify-between items-end border-t border-slate-100 pt-2 mt-2">
                <div>
                    <span class="block text-sm font-bold text-slate-800">${formatCurrency(deal.value)}</span>
                    <span class="block text-[9px] font-bold uppercase tracking-widest text-slate-400">Hace ${daysSinceContact}d</span>
                </div>
                <div class="text-right">
                    <span class="block text-[10px] font-bold text-accent bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 mb-1 inline-block">${prob}% Cierre</span>
                    <i class="fa-solid fa-ellipsis text-slate-300 hover:text-primary cursor-pointer transition"></i>
                </div>
            </div>
        </div>
    `;
}

function initSortable() {
    document.querySelectorAll('.kanban-drag-area').forEach(col => {
        new Sortable(col, {
            group: 'shared', animation: 150, ghostClass: 'k-ghost',
            onEnd: async function (evt) {
                const dealId = evt.item.getAttribute('data-id');
                const newStatus = evt.to.getAttribute('data-status');
                const oldStatus = evt.from.getAttribute('data-status');

                if (newStatus !== oldStatus) {
                    await updateDealStatus(dealId, newStatus);
                    initCRM();
                }
            },
        });
    });
}

async function updateDealStatus(id, newStatus) {
    let lostReason = null;
    if (newStatus === 'lost') {
        lostReason = prompt("Inteligencia Comercial: ¿Motivo de pérdida? (Precio / Competencia / Ghosting)");
        if (!lostReason) { alert("Obligatorio."); return renderKanban(); }
    }
    await apiFetch(`/api/crm/deals/${id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, lost_reason: lostReason })
    });
}


// ---- SIMULADOR DE CIERRE ----
function buildSimulator() {
    const list = document.getElementById('simBoxList');
    list.innerHTML = '';

    const simulable = crmDeals.filter(d => ['quote', 'negotiation'].includes(d.status));

    document.getElementById('sim_actual').innerText = formatCurrency(simulable.length ? crmMetrics?.ejecutiva?.ventasMes || 0 : 0);
    document.getElementById('sim_proyectado').innerText = '+$0';
    document.getElementById('sim_total').innerText = document.getElementById('sim_actual').innerText;

    if (simulable.length === 0) {
        list.innerHTML = `<div class="p-4 text-center text-slate-400 text-sm">No hay tratos en Cotizado o Negociación para simular.</div>`;
        return;
    }

    simulable.forEach(d => {
        list.innerHTML += `
            <div class="flex items-center justify-between p-3 bg-white border border-border rounded-lg hover:border-blue-300 transition cursor-pointer" onclick="toggleSim(this, ${d.value})">
                <div class="flex items-center gap-3">
                    <input type="checkbox" class="w-4 h-4 text-accent pointer-events-none">
                    <div>
                        <p class="text-sm font-bold text-primary">${d.title}</p>
                        <p class="text-[10px] text-slate-400">${d.client_company}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-sm font-bold text-green-600">${formatCurrency(d.value)}</p>
                    <p class="text-[10px] font-bold text-accent uppercase">Prob: ${d.probability || 10}%</p>
                </div>
            </div>
        `;
    });
}

function toggleSim(row, val) {
    const cb = row.querySelector('input');
    cb.checked = !cb.checked;
    if (cb.checked) row.classList.add('ring-2', 'ring-accent', 'bg-blue-50/30');
    else row.classList.remove('ring-2', 'ring-accent', 'bg-blue-50/30');
    calcSim();
}

function calcSim() {
    let extra = 0;
    document.getElementById('simBoxList').querySelectorAll('.ring-2').forEach(r => {
        const valTxt = r.querySelector('.text-green-600').innerText.replace(/[^\d.-]/g, '');
        extra += parseFloat(valTxt) || 0;
    });

    document.getElementById('sim_proyectado').innerText = `+${formatCurrency(extra)}`;

    const total = simuladorActualVentas + extra;
    const tEl = document.getElementById('sim_total');
    tEl.innerText = formatCurrency(total);

    if (total >= metaMensual) {
        tEl.classList.remove('text-accent');
        tEl.classList.add('text-success');
    } else {
        tEl.classList.add('text-accent');
        tEl.classList.remove('text-success');
    }
}

// ---- LEAFLET MAP REAL ----
function initMap() {
    if (lmap) return renderMap(); // Ya inicializado

    lmap = L.map('map').setView([20.659698, -103.349609], 12); // GDL

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap | CartoDB',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(lmap);

    markersLayer = L.layerGroup().addTo(lmap);
    renderMap();
}

function renderMap() {
    if (!lmap || !markersLayer) return;
    markersLayer.clearLayers();

    const mode = document.querySelector('input[name="mfilter"]:checked').value;

    let toDrawDeals = [];
    if (mode === 'won') toDrawDeals = crmDeals.filter(d => d.lat && d.status === 'won');
    else if (mode === 'active') toDrawDeals = crmDeals.filter(d => d.lat && !['won', 'lost'].includes(d.status));

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

    function addPointToMap(lat, lng, color, title, desc, customHtml = null) {
        if (!lat || !lng) return;
        const markerHtmlStyles = customHtml || `
            background-color: ${color};
            width: 1.5rem; height: 1.5rem;
            display: block; left: -0.75rem; top: -0.75rem;
            position: relative; border-radius: 3rem 3rem 0;
            transform: rotate(45deg);
            border: 2px solid #FFFFFF;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        `;
        const icon = L.divIcon({ className: "custom-pin", iconAnchor: [0, 24], popupAnchor: [0, -36], html: `<span style="${markerHtmlStyles}" />` });

        L.marker([lat, lng], { icon }).addTo(markersLayer)
            .bindPopup(`<b>${title}</b><br>${desc}`);

        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
    }

    // 1. Plot Branches (Sucursales) - Always show
    const branchStyle = `
        background-color: #0F172A;
        width: 1.8rem; height: 1.8rem;
        display: flex; align-items: center; justify-content: center;
        position: relative; left: -0.9rem; top: -0.9rem;
        border-radius: 0.5rem;
        border: 2px solid #FFFFFF;
        box-shadow: 0 4px 10px rgba(0,0,0,0.4);
        color: white; font-size: 12px;
    `;
    const branchIconHtml = `<div style="${branchStyle}"><i class="fa-solid fa-building"></i></div>`;

    if (typeof AppConfig !== 'undefined' && AppConfig.branches) {
        AppConfig.branches.forEach(b => {
            addPointToMap(b.lat, b.lng, '#0F172A', b.name, b.description || 'Sucursal IC', branchIconHtml);
        });
    } else {
        addPointToMap(20.673868, -103.356345, '#0F172A', 'Integral Computación', 'Matriz', branchIconHtml);
    }

    // 2. Plot Clients if 'Todos' is selected
    if (mode === 'all') {
        const clientsWithCoords = crmClients.filter(c => c.lat && c.lng);
        clientsWithCoords.forEach(c => {
            const numDeals = crmDeals.filter(d => d.client_id === c.id).length;
            addPointToMap(c.lat, c.lng, '#94a3b8', c.company || c.name, `${numDeals} tratos asociados<br>${c.address || ''}`);
        });
    }

    // 3. Plot Deals
    toDrawDeals.forEach(d => {
        let color = '#3b82f6';
        if (d.status === 'won') color = '#10b981';
        if (d.status === 'quote' || d.status === 'negotiation') color = '#f59e0b';
        addPointToMap(d.lat, d.lng, color, d.client_company || d.title, formatCurrency(d.value));
    });

    if (minLat !== 90) { // Elements were added
        lmap.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [50, 50] });
    } else {
        lmap.setView([20.659698, -103.349609], 12);
    }

    // Actualizar Resumen
    document.getElementById('z_hot').innerText = "Área Metropolitana";
    document.getElementById('z_hot_val').innerText = `${toDrawDeals.filter(d => ['won', 'negotiation'].includes(d.status)).length} tratos valiosos y ${crmClients.filter(c => c.lat).length} clientes ubicados.`;
}

// ---- DIRECTORIO DE CLIENTES ----
let crmClients = [];

async function loadClients() {
    try {
        const res = await apiFetch('/api/crm/clients');
        const result = await res.json();
        crmClients = result.data || [];
        renderDirectory();
    } catch (err) {
        console.error("Error loading clients", err);
    }
}

function renderDirectory(filterText = '') {
    const grid = document.getElementById('clientsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    let toDraw = crmClients;
    if (filterText) {
        const ft = filterText.toLowerCase();
        toDraw = crmClients.filter(c =>
            (c.name && c.name.toLowerCase().includes(ft)) ||
            (c.company && c.company.toLowerCase().includes(ft)) ||
            (c.email && c.email.toLowerCase().includes(ft)) ||
            (c.phone && c.phone.toLowerCase().includes(ft))
        );
    }

    if (toDraw.length === 0) {
        grid.innerHTML = `<div class="p-8 text-center w-full col-span-full text-slate-400">No se encontraron clientes.</div>`;
        return;
    }

    toDraw.forEach(c => {
        let phoneHtml = '';
        if (c.phone) phoneHtml = `<button onclick="window.open('https://wa.me/${c.phone.replace(/[^0-9]/g, '')}', '_blank')" class="text-success hover:bg-green-50 p-1.5 rounded-full transition flex items-center justify-center w-8 h-8 shrink-0" title="WhatsApp Principal"><i class="fa-brands fa-whatsapp"></i></button>`;

        let emailHtml = '';
        if (c.email) emailHtml = `<a href="mailto:${c.email}" class="text-accent hover:bg-blue-50 p-1.5 rounded-full transition flex items-center justify-center w-8 h-8 shrink-0" title="Enviar Correo Principal"><i class="fa-regular fa-envelope"></i></a>`;

        grid.innerHTML += `
            <div class="bg-white border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col group relative overflow-hidden h-full">
                <!-- Dropdown Actions -->
                <div class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="openClientModal(${c.id})" class="text-slate-400 hover:text-primary p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg mr-1" title="Editar"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button onclick="archiveClient(${c.id})" class="text-slate-400 hover:text-danger p-1.5 bg-slate-50 hover:bg-red-50 rounded-lg" title="Archivar/Eliminar"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>

                <div class="flex items-center gap-4 mb-4 pr-16">
                    <div class="w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 flex items-center justify-center text-xl font-bold shadow-inner shrink-0 border border-slate-300">
                        ${(c.company ? c.company : c.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h4 class="font-bold text-primary leading-tight text-sm">${c.company || c.name || 'Empresa S/N'}</h4>
                        ${c.company && c.name ? `<p class="text-[10px] uppercase font-bold text-slate-400 mt-0.5"><i class="fa-solid fa-user text-[9px]"></i> ${c.name}</p>` : ''}
                    </div>
                </div>

                <div class="space-y-2 mt-auto text-xs text-secondary mb-4">
                    ${c.email ? `<p class="flex items-center gap-2 truncate" title="${c.email}"><i class="fa-regular fa-envelope text-slate-300 w-4"></i> ${c.email}</p>` : ''}
                    ${c.phone ? `<p class="flex items-center gap-2"><i class="fa-brands fa-whatsapp text-slate-300 w-4"></i> ${c.phone}</p>` : ''}
                    ${c.address ? `<p class="flex items-start gap-2 max-h-12 overflow-hidden" title="${c.address}"><i class="fa-solid fa-location-dot text-slate-300 w-4 mt-0.5"></i> <span class="line-clamp-2 leading-tight">${c.address}</span></p>` : ''}
                </div>

                <!-- Footer Quick Actions -->
                <div class="flex items-center gap-2 border-t border-slate-100 pt-3 mt-auto">
                    ${phoneHtml}
                    ${emailHtml}
                </div>
            </div>
        `;
    });
}

function filterDirectory() {
    const val = document.getElementById('dirSearchInput').value;
    renderDirectory(val);
}

function openClientModal(id = null) {
    document.getElementById('cId').value = '';
    document.getElementById('cCompany').value = '';
    document.getElementById('cName').value = '';
    document.getElementById('cEmail').value = '';
    document.getElementById('cOtherEmails').value = '';
    document.getElementById('cPhone').value = '';
    document.getElementById('cOtherPhones').value = '';
    document.getElementById('cAddress').value = '';
    document.getElementById('cBilling').value = '';
    document.getElementById('cLat').value = '';
    document.getElementById('cLng').value = '';

    document.getElementById('clientModalTitle').innerHTML = '<i class="fa-solid fa-address-book text-accent"></i> Nuevo Cliente';

    if (id) {
        const client = crmClients.find(c => c.id === id);
        if (client) {
            document.getElementById('clientModalTitle').innerHTML = '<i class="fa-solid fa-pen text-accent"></i> Editar Cliente';
            document.getElementById('cId').value = client.id;
            document.getElementById('cCompany').value = client.company || '';
            document.getElementById('cName').value = client.name || '';

            document.getElementById('cEmail').value = client.email || '';
            let secondaryEmails = '';
            try { secondaryEmails = JSON.parse(client.secondary_emails).join('\n'); } catch (e) { secondaryEmails = client.secondary_emails || ''; }
            document.getElementById('cOtherEmails').value = secondaryEmails;

            document.getElementById('cPhone').value = client.phone || '';
            let secondaryPhones = '';
            try { secondaryPhones = JSON.parse(client.secondary_phones).join('\n'); } catch (e) { secondaryPhones = client.secondary_phones || ''; }
            document.getElementById('cOtherPhones').value = secondaryPhones;

            document.getElementById('cAddress').value = client.address || '';
            document.getElementById('cBilling').value = client.billing_info || '';
            document.getElementById('cLat').value = client.lat || '';
            document.getElementById('cLng').value = client.lng || '';
        }
    }

    const modal = document.getElementById('clientModal');
    const content = document.getElementById('clientModalContent');

    modal.classList.remove('hidden');
    // peqeño timeout para animación
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeClientModal() {
    const modal = document.getElementById('clientModal');
    const content = document.getElementById('clientModalContent');

    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');

    setTimeout(() => modal.classList.add('hidden'), 200);
}

async function saveClient() {
    const id = document.getElementById('cId').value;

    const company = document.getElementById('cCompany').value;
    const name = document.getElementById('cName').value;
    if (!company) return alert("La Empresa o Razón Social es requerida.");

    let secondaryEmails = document.getElementById('cOtherEmails').value.split('\n').map(s => s.trim()).filter(s => s);
    let secondaryPhones = document.getElementById('cOtherPhones').value.split('\n').map(s => s.trim()).filter(s => s);

    const payload = {
        company: company,
        name: name,
        email: document.getElementById('cEmail').value,
        phone: document.getElementById('cPhone').value,
        address: document.getElementById('cAddress').value,
        billing_info: document.getElementById('cBilling').value,
        lat: document.getElementById('cLat').value || null,
        lng: document.getElementById('cLng').value || null,
        secondary_emails: JSON.stringify(secondaryEmails),
        secondary_phones: JSON.stringify(secondaryPhones)
    };

    const url = id ? `/api/crm/clients/${id}` : '/api/crm/clients';
    const method = id ? 'PUT' : 'POST';

    const btn = document.querySelector('#clientModalContent button.bg-primary');
    const prevText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    try {
        await apiFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        closeClientModal();
        await loadClients();
    } catch (err) {
        console.error("Error saving client:", err);
        alert("Ocurrió un error al guardar.");
    } finally {
        btn.innerHTML = prevText;
    }
}

async function archiveClient(id) {
    if (!confirm('¿Estás seguro de que deseas archivar a este cliente? Se ocultará del directorio principal.')) return;
    try {
        await apiFetch(`/api/crm/clients/${id}/archive`, { method: 'PATCH' });
        await loadClients();
    } catch (err) {
        console.error("Archive error", err);
    }
}

// Nominatim Geocoding API integration (Free & No Key Required)
async function geocodeAddress() {
    const address = document.getElementById('cAddress').value;
    if (!address || address.length < 5) return alert('Por favor, ingresa una dirección más completa primero.');

    const btn = event.currentTarget;
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Buscando...';

    try {
        const query = encodeURIComponent(address + ', Jalisco, Mexico'); // Assume regional scope to improve accuracy
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
            document.getElementById('cLat').value = data[0].lat;
            document.getElementById('cLng').value = data[0].lon;
            btn.innerHTML = '<i class="fa-solid fa-check text-success"></i> ¡Ubicado!';
            setTimeout(() => btn.innerHTML = ogHtml, 2000);
        } else {
            alert("No se encontró la dirección exacta. Intenta ser más específico (Ej. 'Av Vallarta 1000, Guadalajara').");
            btn.innerHTML = ogHtml;
        }
    } catch (err) {
        console.error("Geocoding failed", err);
        alert("Falla de conexión al servicio de mapas.");
        btn.innerHTML = ogHtml;
    }
}

// ---- CONFIGURACIÓN Y SUCURSALES ----
let crmBranches = [];

async function loadBranches() {
    try {
        const res = await apiFetch('/api/crm/branches');
        const result = await res.json();
        crmBranches = result.data || [];
        renderBranchesList();
    } catch (err) {
        console.error("Error loading branches", err);
    }
}

function renderBranchesList() {
    const list = document.getElementById('branchesList');
    if (!list) return;
    list.innerHTML = '';
    if (crmBranches.length === 0) {
        list.innerHTML = '<div class="text-sm text-slate-400 text-center py-4">No hay sucursales registradas.</div>';
        return;
    }
    crmBranches.forEach(b => {
        list.innerHTML += `
            <div class="flex items-center justify-between p-4 bg-slate-50 border border-border rounded-xl">
                <div>
                    <h4 class="font-bold text-sm text-primary flex items-center gap-2"><i class="fa-solid fa-building text-accent opacity-50"></i> ${b.name}</h4>
                    <p class="text-xs text-slate-500 mt-1">${b.description || 'Sin dirección'}</p>
                    <p class="text-[10px] text-slate-400 font-mono mt-1 bg-white inline-block px-1.5 py-0.5 rounded border border-slate-200">Lat: ${b.lat || 'N/A'}, Lng: ${b.lng || 'N/A'}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="openBranchModal(${b.id})" class="text-slate-400 hover:text-accent p-2 bg-white rounded-lg shadow-sm border border-slate-100 hover:border-accent/30 transition-colors"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteBranch(${b.id})" class="text-slate-400 hover:text-danger p-2 bg-white rounded-lg shadow-sm border border-slate-100 hover:border-danger/30 transition-colors"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
}

function openBranchModal(id = null) {
    document.getElementById('bId').value = '';
    document.getElementById('bName').value = '';
    document.getElementById('bDesc').value = '';
    document.getElementById('bLat').value = '';
    document.getElementById('bLng').value = '';
    document.getElementById('branchModalTitle').innerHTML = '<i class="fa-solid fa-building text-accent"></i> Nueva Sucursal';

    if (id) {
        const branch = crmBranches.find(b => b.id === id);
        if (branch) {
            document.getElementById('branchModalTitle').innerHTML = '<i class="fa-solid fa-pen text-accent"></i> Editar Sucursal';
            document.getElementById('bId').value = branch.id;
            document.getElementById('bName').value = branch.name || '';
            document.getElementById('bDesc').value = branch.description || '';
            document.getElementById('bLat').value = branch.lat || '';
            document.getElementById('bLng').value = branch.lng || '';
        }
    }

    const modal = document.getElementById('branchModal');
    const content = document.getElementById('branchModalContent');
    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeBranchModal() {
    const modal = document.getElementById('branchModal');
    const content = document.getElementById('branchModalContent');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 200);
}

async function saveBranch() {
    const id = document.getElementById('bId').value;
    const name = document.getElementById('bName').value;
    if (!name) return alert("El nombre es requerido.");

    const payload = {
        name: name,
        description: document.getElementById('bDesc').value,
        lat: document.getElementById('bLat').value || null,
        lng: document.getElementById('bLng').value || null
    };

    const url = id ? `/api/crm/branches/${id}` : '/api/crm/branches';
    const method = id ? 'PUT' : 'POST';

    const btn = document.querySelector('#branchModalContent button.bg-primary');
    const prevText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>...';

    try {
        await apiFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        closeBranchModal();
        await loadBranches();
        if (lmap) renderMap(); // Update pin on map immediately
    } catch (err) {
        console.error("Error saving branch:", err);
        alert("Ocurrió un error.");
    } finally {
        btn.innerHTML = prevText;
    }
}

async function deleteBranch(id) {
    if (!confirm('¿Eliminar esta sucursal del sistema de forma permanente?')) return;
    try {
        await apiFetch(`/api/crm/branches/${id}`, { method: 'DELETE' });
        await loadBranches();
        if (lmap) renderMap(); // Update pin on map immediately
    } catch (err) {
        alert("Error al eliminar sucursal");
    }
}

async function geocodeBranch() {
    const desc = document.getElementById('bDesc').value;
    if (!desc || desc.length < 5) return alert('Por favor, ingresa una dirección de sucursal válida.');

    const btn = event.currentTarget;
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Buscando...';

    try {
        const query = encodeURIComponent(desc + ', Jalisco, Mexico');
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
            document.getElementById('bLat').value = data[0].lat;
            document.getElementById('bLng').value = data[0].lon;
            btn.innerHTML = '<i class="fa-solid fa-check text-success"></i> ¡Ubicado!';
            setTimeout(() => btn.innerHTML = ogHtml, 2000);
        } else {
            alert("No se encontró la dirección.");
            btn.innerHTML = ogHtml;
        }
    } catch (err) {
        alert("Falla de conexión.");
        btn.innerHTML = ogHtml;
    }
}

// Shared Formatting
function formatCurrency(num) { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(num || 0); }

document.addEventListener('DOMContentLoaded', initCRM);
