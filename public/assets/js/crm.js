/** CRM & Vents Dashboard Logic **/
let crmDeals = [];

// Column config for Kanban
const pipelineColumns = [
    { id: 'prospect', title: 'Prospecto Nuevo' },
    { id: 'qualified', title: 'Calificado' },
    { id: 'quote', title: 'Cotizado' },
    { id: 'negotiation', title: 'Negociación' },
    { id: 'won', title: 'Ganado / Cerrado' }
];

async function initCRM() {
    console.log("Inicializando CRM...");
    await loadCRMMetrics();
    await loadDeals();
}

async function loadCRMMetrics() {
    try {
        const res = await apiFetch('/api/crm/metrics');
        const data = await res.json();

        document.getElementById('crmWonVal').innerText = formatCurrency(data.wonValue);
        document.getElementById('crmActiveDeals').innerText = `${data.totalDeals} Tratos`;
        document.getElementById('crmConvRate').innerText = `${data.conversionRate}%`;
    } catch (err) {
        console.error("Error al cargar métricas CRM:", err);
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

function renderKanban() {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;
    board.innerHTML = '';

    // Create column structures
    pipelineColumns.forEach(pipe => {
        const colDiv = document.createElement('div');
        colDiv.className = 'kanban-column';

        // Count deals in this column
        const columnDeals = crmDeals.filter(d => d.status === pipe.id);

        colDiv.innerHTML = `
            <div class="kanban-col-header">
                <span class="kanban-col-title">${pipe.title}</span>
                <span class="kanban-col-count">${columnDeals.length}</span>
            </div>
            <div class="kanban-cards-area" id="kcol_${pipe.id}" data-status="${pipe.id}">
                ${columnDeals.map(d => generateCardHTML(d)).join('')}
            </div>
        `;
        board.appendChild(colDiv);
    });

    // Initialize Sortable for drag and drop
    initSortable();
}

function generateCardHTML(deal) {
    // Scoring de seguimiento via colores
    const msSinceContact = Date.now() - new Date(deal.last_contact_date).getTime();
    const daysSinceContact = msSinceContact / (1000 * 3600 * 24);

    let statusClass = 'status-green';
    if (daysSinceContact > 4) statusClass = 'status-yellow';
    if (daysSinceContact > 7) statusClass = 'status-red';

    // WhatsApp quick action
    const phone = deal.client_phone ? deal.client_phone.replace(/\D/g, '') : null;
    const waLink = phone ? `https://wa.me/${phone}?text=Hola,%20seguimiento%20cotizaci%C3%B3n` : '#';

    return `
        <div class="k-card ${statusClass}" data-id="${deal.id}">
            <div class="kc-title">${deal.title}</div>
            <div class="kc-client">
                <i class="fa-solid fa-building"></i> ${deal.client_company || deal.client_name || 'Desconocido'}
            </div>
            
            <div class="kc-footer">
                <div class="kc-val">${formatCurrency(deal.value)}</div>
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
            group: 'shared', // set both lists to same group
            animation: 150,
            ghostClass: 'k-card-ghost',
            onEnd: async function (evt) {
                const itemEl = evt.item;  // dragged HTMLElement
                const dealId = itemEl.getAttribute('data-id');
                const newStatus = evt.to.getAttribute('data-status');
                const oldStatus = evt.from.getAttribute('data-status');

                if (newStatus !== oldStatus) {
                    await updateDealStatus(dealId, newStatus);
                    // Actualizar contadores
                    loadCRMMetrics();
                    loadDeals(); // Refresh from DB to be clean
                }
            },
        });
    });
}

async function updateDealStatus(id, newStatus) {
    let lostReason = null;
    if (newStatus === 'lost') {
        lostReason = prompt("¿Razón por la cual se perdió este trato? (Precio, Competencia, Ghosting, Otro)");
        if (!lostReason) {
            alert("Es necesario indicar la razón para análisis de mercado.");
            return renderKanban(); // Revert visual move
        }
    }

    try {
        await apiFetch(`/api/crm/deals/${encodeURIComponent(id)}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus, lost_reason: lostReason })
        });
        console.log(`[CRM] Trato ${id} movido a ${newStatus}`);
    } catch (err) {
        alert("Error al actualizar estatus: " + err.message);
        renderKanban(); // Revert
    }
}

// Helpers
function formatCurrency(num) {
    if (!num) num = 0;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);
}

// Stubs for future use
function openNewDealModal() {
    alert("Función para Crear Nuevo Trato (Próximamente). Por favor revisa el código de UI para añadir el Modal HTML.");
}
function openDealDetails(id) {
    alert("Función para abrir Modal de Detalles del Trato: " + id);
}
async function logWhatsAppClick(dealId) {
    // Automatically flag as contacted today in DB
    try {
        await apiFetch('/api/crm/activities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deal_id: dealId,
                type: 'whatsapp',
                description: 'Contacto rápido por WhatsApp desde Kanban',
                completed: 1
            })
        });
        console.log("Logged WA interaction for " + dealId);
        setTimeout(loadDeals, 2000); // Reload colors a bit later
    } catch (e) { }
}
