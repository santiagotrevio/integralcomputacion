/** CRM & Ventas Dashboard Logic (Intelligent Layer) **/
let crmDeals = [];
let crmMetrics = null;
let origenChart = null;

// Kanban Pipeline configuration
const pipelineColumns = [
    { id: 'prospect', title: 'Prospecto Nuevo' },
    { id: 'qualified', title: 'Calificado' },
    { id: 'quote', title: 'Cotizado' },
    { id: 'negotiation', title: 'Negociación' },
    { id: 'won', title: 'Ganado / Cerrado' }
];

async function initCRM() {
    console.log("Inicializando CRM Estratégico...");
    await Promise.all([
        loadCRMMetrics(),
        loadDeals(),
        loadTasks()
    ]);
}

async function loadCRMMetrics() {
    try {
        const res = await apiFetch('/api/crm/metrics');
        crmMetrics = await res.json();

        // 1. Vista Ejecutiva
        const ej = crmMetrics.ejecutiva;
        document.getElementById('metricVentasMes').innerText = formatCurrency(ej.ventasMes);
        document.getElementById('metricForecast').innerText = formatCurrency(ej.forecast30);
        document.getElementById('metricPipeline').innerText = formatCurrency(ej.pipelineTotal);
        document.getElementById('metricConv').innerText = `${ej.conversionRate}%`;
        document.getElementById('metricTicket').innerText = formatCurrency(ej.ticketPromedio);

        // Render Inactivos si el tab está listo
        renderInactiveClients();

    } catch (err) {
        console.error("Error al cargar métricas ejecutivas:", err);
    }
}

async function loadDeals() {
    try {
        const res = await apiFetch('/api/crm/deals');
        const result = await res.json();
        crmDeals = result.data || [];
        renderKanban();
    } catch (err) {
        console.error("Error al cargar tratos CRM:", err);
    }
}

async function loadTasks() {
    try {
        const res = await apiFetch('/api/crm/activities/pending');
        const result = await res.json();
        const tasks = result.data || [];

        const tasksList = document.getElementById('tasksList');
        const upcomingList = document.getElementById('upcomingTasksList');

        if (!tasksList || !upcomingList) return;

        tasksList.innerHTML = '';
        upcomingList.innerHTML = '';

        let delayed = 0; let upcoming = 0;
        const now = new Date();

        tasks.forEach(t => {
            const dueDate = t.due_date ? new Date(t.due_date) : new Date();
            const isDelayed = dueDate < now;

            const html = `
                <div class="k-card" style="border-left: 4px solid ${isDelayed ? '#ff3b30' : 'var(--apple-blue)'};">
                    <div style="font-weight:600; font-size:14px; margin-bottom:4px;">${t.type.toUpperCase()}: ${t.description}</div>
                    <div style="font-size:12px; opacity:0.6;"><i class="fa-regular fa-clock"></i> ${dueDate.toLocaleDateString()}</div>
                </div>
            `;
            if (isDelayed || dueDate.toDateString() === now.toDateString()) {
                tasksList.innerHTML += html;
                delayed++;
            } else {
                upcomingList.innerHTML += html;
                upcoming++;
            }
        });

        if (delayed === 0) tasksList.innerHTML = `<div style="opacity: 0.5; text-align:center;">Al día. No hay pendientes atrasados.</div>`;
        if (upcoming === 0) upcomingList.innerHTML = `<div style="opacity: 0.5; text-align:center;">No hay seguimientos a futuro.</div>`;

    } catch (err) {
        console.error("Error loadTasks", err);
    }
}

function renderKanban() {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;
    board.innerHTML = '';

    pipelineColumns.forEach(pipe => {
        const colDiv = document.createElement('div');
        colDiv.className = 'kanban-column';

        const columnDeals = crmDeals.filter(d => d.status === pipe.id);
        const colVal = columnDeals.reduce((sum, d) => sum + (d.value || 0), 0);

        colDiv.innerHTML = `
            <div class="kanban-col-header" style="flex-wrap:wrap;">
                <span class="kanban-col-title">${pipe.title}</span>
                <span class="kanban-col-count">${columnDeals.length}</span>
                <div style="width:100%; font-size:11px; opacity:0.6; margin-top:4px;">${formatCurrency(colVal)}</div>
            </div>
            <div class="kanban-cards-area" id="kcol_${pipe.id}" data-status="${pipe.id}">
                ${columnDeals.map(d => generateCardHTML(d)).join('')}
            </div>
        `;
        board.appendChild(colDiv);
    });

    initSortable();
}

function generateCardHTML(deal) {
    const msSinceContact = Date.now() - new Date(deal.last_contact_date).getTime();
    const daysSinceContact = Math.floor(msSinceContact / (1000 * 3600 * 24));

    // Prioridad visual basada en tiempo sin contacto
    let statusClass = 'status-green'; // Activo, saludable
    if (daysSinceContact > 4) statusClass = 'status-yellow'; // Toca seguimiento
    if (daysSinceContact > 10) statusClass = 'status-red';   // Riesgo

    if (deal.status === 'won') statusClass = 'status-green'; // Ganado siempre verde

    let daysText = daysSinceContact === 0 ? 'Hoy' : `hace ${daysSinceContact} d`;

    const phone = deal.client_phone ? deal.client_phone.replace(/\D/g, '') : null;
    const waLink = phone ? `https://wa.me/${phone}?text=Hola,%20seguimiento%20cotizaci%C3%B3n` : '#';

    return `
        <div class="k-card ${statusClass}" data-id="${deal.id}">
            <div class="kc-title">${deal.title}</div>
            <div class="kc-client">
                <i class="fa-solid fa-building"></i> ${deal.client_company || deal.client_name || 'Desconocido'}
            </div>
            
            <div class="kc-footer" style="padding-top:10px;">
                <div>
                    <div class="kc-val">${formatCurrency(deal.value)}</div>
                    <div style="font-size:10px; opacity:0.5; margin-top:2px;">Contacto: ${daysText}</div>
                </div>
                <div class="kc-actions">
                    ${phone ? `<a href="${waLink}" target="_blank" class="kc-btn whatsapp" onclick="logWhatsAppClick('${deal.id}')"><i class="fa-brands fa-whatsapp"></i></a>` : ''}
                    <button class="kc-btn" onclick="openDealDetails('${deal.id}')"><i class="fa-solid fa-ellipsis"></i></button>
                </div>
            </div>
        </div>
    `;
}

function initSortable() {
    document.querySelectorAll('.kanban-cards-area').forEach(col => {
        new Sortable(col, {
            group: 'shared',
            animation: 150,
            ghostClass: 'k-card-ghost',
            onEnd: async function (evt) {
                const itemEl = evt.item;
                const dealId = itemEl.getAttribute('data-id');
                const newStatus = evt.to.getAttribute('data-status');
                const oldStatus = evt.from.getAttribute('data-status');

                if (newStatus !== oldStatus) {
                    await updateDealStatus(dealId, newStatus);
                    initCRM(); // reload everything to update Top Metrics
                }
            },
        });
    });
}

async function updateDealStatus(id, newStatus) {
    let lostReason = null;
    if (newStatus === 'lost') {
        lostReason = prompt("Inteligencia Comercial: ¿Razón de pérdida? (Precio / Competencia / Ghosting)");
        if (!lostReason) {
            alert("Obligatorio para el análisis comercial.");
            return renderKanban();
        }
    }
    try {
        await apiFetch(`/api/crm/deals/${encodeURIComponent(id)}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus, lost_reason: lostReason })
        });
    } catch (err) {
        alert("Error al actualizar estatus: " + err.message);
        renderKanban();
    }
}


/* --- 4. MAPA TERRITORIAL (Mockup visual para impacto rápido) --- */
function renderMapPins() {
    const area = document.getElementById('mapZonesArea');
    if (!area) return;
    area.innerHTML = '';

    // Generar clusters mock basados en los tratos reales
    const activeDeals = crmDeals.filter(d => d.status !== 'won' && d.status !== 'lost');

    if (activeDeals.length === 0) {
        area.innerHTML = `<div style="position:absolute; top:45%; width:100%; text-align:center;">Agrega prospectos para ver el mapa de calor.</div>`;
        return;
    }

    // Dibujamos un cluster principal con el número de tratos (Estilo Apple Maps pin)
    area.innerHTML = `
        <div style="position:absolute; top: 40%; left: 45%; 
             background: rgba(255, 59, 48, 0.9); backdrop-filter:blur(5px);
             color: white; padding: 8px 14px; border-radius: 20px;
             font-weight: 700; font-size: 14px; box-shadow: 0 4px 15px rgba(255,59,48,0.4);
             border: 2px solid white; cursor:pointer;" title="Zona Industrial">
             ${activeDeals.length} Prospectos
             <div style="position:absolute; bottom:-6px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:6px solid rgba(255,59,48,0.9);"></div>
        </div>
        <div style="position:absolute; top: 20%; left: 30%; 
             background: rgba(0, 113, 227, 0.9); backdrop-filter:blur(5px);
             color: white; padding: 6px 12px; border-radius: 20px;
             font-weight: 600; font-size: 12px; box-shadow: 0 4px 15px rgba(0,113,227,0.4);
             border: 2px solid white; cursor:pointer;" title="Zona Centro">
             Nuevos
             <div style="position:absolute; bottom:-6px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:6px solid rgba(0,113,227,0.9);"></div>
        </div>
    `;
}

/* --- 5. INTELIGENCIA COMERCIAL CHART --- */
function renderIntelCharts() {
    if (!crmMetrics || !crmMetrics.inteligencia) return;
    const ctx = document.getElementById('chartOrigen');
    if (!ctx) return;

    const data = crmMetrics.inteligencia.origenes;
    const labels = data.map(d => d.source || 'Directo');
    const counts = data.map(d => d.count);

    if (origenChart) origenChart.destroy();

    origenChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.length ? labels : ['Sin datos'],
            datasets: [{
                data: counts.length ? counts : [1],
                backgroundColor: ['#0071e3', '#34c759', '#ff9f0a', '#ff3b30', '#bf5af2'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            },
            cutout: '70%'
        }
    });
}

function renderInactiveClients() {
    const box = document.getElementById('inactiveClientsBox');
    if (!box || !crmMetrics) return;
    const inactivos = crmMetrics.inteligencia.inactivos || [];

    if (inactivos.length === 0) {
        box.innerHTML = `<div style="opacity:0.5; font-size:13px;">Todo tu pipeline está respirando. ¡Sigue así!</div>`;
        return;
    }

    box.innerHTML = inactivos.map(i => `
        <div class="k-card" style="border-left: 4px solid #ff3b30; padding:12px;">
            <div style="font-weight:600; font-size:14px; margin-bottom:4px;">${i.title}</div>
            <div style="font-size:12px; opacity:0.6;"><i class="fa-regular fa-calendar-xmark"></i> Sin tocar desde: ${new Date(i.last_contact_date).toLocaleDateString()}</div>
        </div>
    `).join('');
}

// Helpers
function formatCurrency(num) {
    if (!num) num = 0;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(num);
}

// Stubs
function openNewDealModal() {
    const title = prompt("Nombre del Trato / Prospecto:");
    const val = prompt("Valor aproximado en pesos:");
    if (title && val) {
        apiFetch('/api/crm/deals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, value: parseFloat(val) })
        }).then(() => initCRM());
    }
}
function openDealDetails(id) {
    alert("Próximamente: Abre el perfil 360 del trato " + id);
}
async function logWhatsAppClick(dealId) {
    try {
        await apiFetch('/api/crm/activities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deal_id: dealId, type: 'whatsapp', description: 'Contacto rápido por WhatsApp', completed: 1 })
        });
        setTimeout(initCRM, 2000);
    } catch (e) { }
}
