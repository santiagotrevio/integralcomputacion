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
    await Promise.all([loadCRMMetrics(), loadDeals(), loadTasks()]);
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

    let toDraw = [];
    if (mode === 'all') toDraw = crmDeals.filter(d => d.lat);
    else if (mode === 'won') toDraw = crmDeals.filter(d => d.lat && d.status === 'won');
    else if (mode === 'active') toDraw = crmDeals.filter(d => d.lat && !['won', 'lost'].includes(d.status));

    // Si no hay coords reales, inyectamos unas MOCK alrededor de GDL para el Demo PoC SaaS
    if (toDraw.length === 0 && crmDeals.length > 0) {
        crmDeals.forEach((d, i) => {
            // Mock random GDL locations
            d.lat = 20.659698 + (Math.random() - 0.5) * 0.1;
            d.lng = -103.349609 + (Math.random() - 0.5) * 0.1;
            toDraw.push(d);
        });
    }

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

    toDraw.forEach(d => {
        let color = '#3b82f6';
        if (d.status === 'won') color = '#10b981';
        if (d.status === 'quote' || d.status === 'negotiation') color = '#f59e0b';

        const markerHtmlStyles = `
            background-color: ${color};
            width: 1.5rem; height: 1.5rem;
            display: block; left: -0.75rem; top: -0.75rem;
            position: relative; border-radius: 3rem 3rem 0;
            transform: rotate(45deg);
            border: 2px solid #FFFFFF;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        `;
        const icon = L.divIcon({ className: "custom-pin", iconAnchor: [0, 24], popupAnchor: [0, -36], html: `<span style="${markerHtmlStyles}" />` });

        L.marker([d.lat, d.lng], { icon }).addTo(markersLayer)
            .bindPopup(`<b>${d.client_company || d.title}</b><br>${formatCurrency(d.value)}`);

        if (d.lat < minLat) minLat = d.lat; if (d.lat > maxLat) maxLat = d.lat;
        if (d.lng < minLng) minLng = d.lng; if (d.lng > maxLng) maxLng = d.lng;
    });

    if (toDraw.length > 0) {
        lmap.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [50, 50] });
    }

    // Actualizar Resumen Inteligente Territorial
    document.getElementById('z_hot').innerText = "Zonas GDL (Mock)";
    document.getElementById('z_hot_val').innerText = `${toDraw.filter(d => ['won', 'negotiation'].includes(d.status)).length} tratos valiosos.`;
}

// Shared Formatting
function formatCurrency(num) { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(num || 0); }

document.addEventListener('DOMContentLoaded', initCRM);
