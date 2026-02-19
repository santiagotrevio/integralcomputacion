let products = [];
let editingId = null;
let currentSort = 'recent';
let filteredList = [];
let cacheBuster = Date.now();
let currentPage = parseInt(localStorage.getItem('admin-catalog-page')) || 1;
const itemsPerPage = 50;

// --- SISTEMA DE AUTENTICACIÓN ---
let adminToken = sessionStorage.getItem('admin-token');

async function apiFetch(url, options = {}) {
    if (!options.headers) options.headers = {};
    if (adminToken) {
        options.headers['Authorization'] = `Bearer ${adminToken}`;
    }

    const res = await fetch(url, options);

    if (res.status === 401) {
        sessionStorage.removeItem('admin-token');
        adminToken = null;
        showLogin();
        throw new Error("Sesión expirada o no autorizada");
    }

    return res;
}

function showLogin() {
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('adminPassword').focus();
}

async function handleLogin() {
    const password = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('loginError');
    errorEl.style.display = 'none';

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        if (res.ok) {
            const data = await res.json();
            adminToken = data.token;
            sessionStorage.setItem('admin-token', adminToken);
            document.getElementById('loginOverlay').style.display = 'none';
            loadProducts(); // Recargar datos
        } else {
            errorEl.style.display = 'block';
        }
    } catch (err) {
        alert("Error de conexión con el servidor");
    }
}

document.getElementById('btnLogin').onclick = handleLogin;
document.getElementById('adminPassword').onkeyup = (e) => { if (e.key === 'Enter') handleLogin(); };

if (!adminToken) {
    showLogin();
}

const normalize = (str) => {
    if (!str) return '';
    return str.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

// Spotlight Logic
let spotlightIndex = 0;
let spotlightActions = [
    { id: 'view_table', title: 'Ver modo Tabla', icon: 'fa-table-list', type: 'action', run: () => setView('table') },
    { id: 'view_grid', title: 'Ver modo Galería (Auditoría)', icon: 'fa-grip', type: 'action', run: () => setView('grid') },
    { id: 'theme_dark', title: 'Cambiar a Modo Oscuro/Claro', icon: 'fa-moon', type: 'action', run: () => toggleTheme() },
    { id: 'theme_fallout', title: 'Modo Fallout ☢️', icon: 'fa-radiation', type: 'action', run: () => toggleTheme('fallout') },
    { id: 'theme_cyberpunk', title: 'Modo Cyberpunk 🦾', icon: 'fa-bolt-lightning', type: 'action', run: () => toggleTheme('cyberpunk') },
    { id: 'new_prod', title: 'Crear Nuevo Producto', icon: 'fa-plus', type: 'action', run: () => newProduct() },
    { id: 'publish', title: 'Publicar cambios en la Web', icon: 'fa-paper-plane', type: 'action', run: () => publishChanges() },
    { id: 'cat_toner', title: 'Filtrar por: Tóners', icon: 'fa-print', type: 'filter', run: () => applySpotlightFilter('toner') },
    { id: 'cat_papeleria', title: 'Filtrar por: Papelería', icon: 'fa-pen-ruler', type: 'filter', run: () => applySpotlightFilter('papeleria') },
    { id: 'cat_accesorios', title: 'Filtrar por: Accesorios', icon: 'fa-keyboard', type: 'filter', run: () => applySpotlightFilter('accesorios') }
];

window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSpotlight();
    }
    if (e.key === 'Escape') closeSpotlight();
});

function openSpotlight() {
    document.getElementById('spotlightOverlay').style.display = 'flex';
    const input = document.getElementById('spotlightInput');
    input.value = '';
    input.focus();
    searchSpotlight();
}

function closeSpotlight() {
    document.getElementById('spotlightOverlay').style.display = 'none';
}

function handleSpotlightKey(e) {
    const items = document.querySelectorAll('.spotlight-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        spotlightIndex = (spotlightIndex + 1) % items.length;
        updateSpotlightActive();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        spotlightIndex = (spotlightIndex - 1 + items.length) % items.length;
        updateSpotlightActive();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        const active = items[spotlightIndex];
        if (active) active.click();
    }
}

function updateSpotlightActive() {
    const items = document.querySelectorAll('.spotlight-item');
    items.forEach((it, i) => {
        it.classList.toggle('active', i === spotlightIndex);
        if (i === spotlightIndex) it.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
}

function searchSpotlight() {
    const query = document.getElementById('spotlightInput').value;
    const results = document.getElementById('spotlightResults');
    results.innerHTML = '';
    spotlightIndex = 0;

    // 1. Actions & Filters
    const filteredActions = spotlightActions.filter(a => normalize(a.title).includes(normalize(query)));
    if (filteredActions.length > 0) {
        const head = document.createElement('div');
        head.className = 'spotlight-section';
        head.innerText = 'Acciones y Comandos';
        results.appendChild(head);

        filteredActions.forEach((a, idx) => {
            const div = document.createElement('div');
            div.className = 'spotlight-item';
            div.innerHTML = `<i class="fa-solid ${a.icon}"></i> ${a.title} <span class="shortcut">Cmd</span>`;
            div.onclick = () => { a.run(); closeSpotlight(); };
            div.onmouseenter = () => {
                const allItems = Array.from(document.querySelectorAll('.spotlight-item'));
                spotlightIndex = allItems.indexOf(div);
                updateSpotlightActive();
            };
            results.appendChild(div);
        });
    }

    // 2. Products
    const filteredProducts = products.filter(p =>
        normalize(p.id).includes(normalize(query)) ||
        normalize(p.name).includes(normalize(query))
    ).slice(0, 8);

    if (filteredProducts.length > 0) {
        const head = document.createElement('div');
        head.className = 'spotlight-section';
        head.innerText = `Productos (${filteredProducts.length})`;
        results.appendChild(head);

        filteredProducts.forEach(p => {
            const div = document.createElement('div');
            div.className = 'spotlight-item';
            div.innerHTML = `<i class="fa-solid fa-box"></i> <div><b>${p.id}</b> <span style="opacity:0.6; font-size:0.9em;">- ${p.name}</span></div>`;
            div.onclick = () => {
                document.getElementById('search').value = p.id;
                filterAndSort();
                closeSpotlight();
            };
            div.onmouseenter = () => {
                const allItems = Array.from(document.querySelectorAll('.spotlight-item'));
                spotlightIndex = allItems.indexOf(div);
                updateSpotlightActive();
            };
            results.appendChild(div);
        });
    }

    updateSpotlightActive();
}

function applySpotlightFilter(cat) {
    document.getElementById('search').value = '';
    // For simplicity in this demo, we'll just show the category products if we had a category filter element
    // Since we use global filterAndSort, we'll just simulate a search for the category name for now
    document.getElementById('search').value = catMap[cat] || cat;
    filterAndSort();
}

async function loadProducts() {
    try {
        const fetchSafe = async (url) => {
            try {
                const r = await apiFetch(url);
                if (!r.ok) return { data: [] };
                return await r.json();
            } catch (e) {
                return { data: [] };
            }
        };

        const [pData, bData] = await Promise.all([
            fetchSafe('/api/products'),
            fetchSafe('/api/brands')
        ]);

        products = Array.isArray(pData.data) ? pData.data : [];
        brandSettings = Array.isArray(bData.data) ? bData.data : [];

        updateBrandSelector();
        filterAndSort(true);

        // Update conflicts badge
        const cRes = await apiFetch('/api/conflicts');
        const cData = await cRes.json();
        const badge = document.getElementById('conflictBadge');
        if (cData.data && cData.data.length > 0) {
            badge.innerText = cData.data.length;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    } catch (err) {
        console.error("Critical loader error:", err);
        products = products || [];
        brandSettings = brandSettings || [];
        filterAndSort();
    }
}

function updateBrandSelector() {
    // Marcas base que siempre deben estar + las que existan en la DB
    const standardBrands = ['HP', 'Brother', 'Canon', 'Lexmark', 'Xerox'];
    let dbBrands = [...new Set(products.map(p => p.brand).filter(b => b && !standardBrands.includes(b) && b !== 'Otros'))];
    let allBrands = [...standardBrands, ...dbBrands].sort();
    allBrands.push('Otros');

    // Selector del Modal
    const sel = document.getElementById('p_brand');
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">Seleccione marca...</option>';

    // Selector de Filtro en Tabla
    const filterSel = document.getElementById('filterBrand');
    const currentFilter = filterSel.value;
    filterSel.innerHTML = '<option value="">Todas las marcas</option>';

    allBrands.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b; opt.textContent = b;
        sel.appendChild(opt.cloneNode(true));
        filterSel.appendChild(opt);
    });

    if (currentVal) sel.value = currentVal;
    if (currentFilter) filterSel.value = currentFilter;
}

function addNewBrand() {
    const newB = prompt("Nombre de la nueva marca:");
    if (newB) {
        const sel = document.getElementById('p_brand');
        const opt = document.createElement('option');
        opt.value = newB;
        opt.textContent = newB;
        sel.appendChild(opt);
        sel.value = newB;
    }
}

function setSort(type, el) {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    currentSort = type;
    filterAndSort();
}

function filterAndSort(keepPage = false) {
    const term = normalize(document.getElementById('search').value);
    const brandFilter = document.getElementById('filterBrand').value;

    let list = products.filter(p => {
        const matchesSearch = normalize(p.id).includes(term) ||
            normalize(p.name).includes(term) ||
            normalize(p.brand).includes(term);

        const matchesBrand = !brandFilter || p.brand === brandFilter;

        const matchesPending = currentSort === 'pending' ? p.published === 0 : true;

        return matchesSearch && matchesBrand && matchesPending;
    });

    if (currentSort === 'alpha') list.sort((a, b) => (a.brand || "").localeCompare(b.brand || "") || a.name.localeCompare(b.name));
    if (currentSort === 'recent') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (currentSort === 'category') list.sort((a, b) => a.category.localeCompare(b.category));
    // Si es 'pending', ya el filter hizo el trabajo, pero podemos ordenar por fecha
    if (currentSort === 'pending') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    document.getElementById('totalCount').innerText = `${list.length} productos`;
    filteredList = list;

    if (!keepPage) currentPage = 1;

    renderTable(list);
}

// --- FUNCIONES DE EXPORTACIÓN ---
function copyToClipboard(text, btn) {
    if (!text) return;

    const doCopy = async () => {
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (err) {
                console.error('Clipboard API failed, trying fallback', err);
            }
        }

        // Fallback: Textarea selection (works in non-secure contexts)
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            return successful;
        } catch (err) {
            console.error('Fallback copy failed', err);
            document.body.removeChild(textArea);
            return false;
        }
    };

    doCopy().then(success => {
        if (success) {
            const icon = btn.querySelector('i');
            const originalClass = icon.className;
            icon.className = 'fa-solid fa-check';
            btn.classList.add('copied');
            setTimeout(() => {
                icon.className = originalClass;
                btn.classList.remove('copied');
            }, 2000);
        } else {
            alert("No se pudo copiar al portapapeles");
        }
    });
}

async function exportToExcel() {
    try {
        if (filteredList.length === 0) return alert("No hay datos para exportar");

        const data = filteredList.map(p => ({
            'ID': p.id,
            'Marca': p.brand,
            'Nombre': p.name,
            'Categoría': catMap[p.category] || p.category,
            'Fecha Alta': p.created_at ? new Date(p.created_at).toLocaleDateString('es-MX') : '-',
            'Compatibilidad': p.compatibility
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventario");
        XLSX.writeFile(wb, `Inventario_Integral_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
        console.error(err);
        alert("Error técnico al exportar Excel: " + err.message);
    }
}

async function exportToPDF() {
    try {
        if (filteredList.length === 0) return alert("No hay datos para exportar");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const isDark = document.body.getAttribute('data-theme') === 'dark';

        // Apple-style color palette
        const colors = isDark ? {
            bg: [0, 0, 0],
            text: [245, 245, 247],
            headBg: [28, 28, 30],
            headText: [255, 255, 255],
            alternateRow: [18, 18, 20],
            border: [44, 44, 46]
        } : {
            bg: [255, 255, 255],
            text: [29, 29, 31],
            headBg: [245, 245, 247],
            headText: [134, 134, 139],
            alternateRow: [250, 250, 252],
            border: [240, 240, 245]
        };

        // Fill background if dark mode
        if (isDark) {
            doc.setFillColor(...colors.bg);
            doc.rect(0, 0, 210, 297, 'F');
        }

        // Styled Header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(...colors.text);
        doc.text("Gestor de Catálogo Pro", 14, 25);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(isDark ? 161 : 134, isDark ? 161 : 134, isDark ? 166 : 139);
        doc.text("Reporte de Inventario | Integral Computación", 14, 32);
        doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 14, 37);

        const rows = filteredList.map(p => [
            p.id,
            p.brand,
            p.name,
            catMap[p.category] || p.category,
            p.created_at ? new Date(p.created_at).toLocaleDateString('es-MX') : '-',
            p.compatibility || '-'
        ]);

        doc.autoTable({
            head: [['ID', 'Marca', 'Nombre', 'Categoría', 'Alta', 'Compatibilidad']],
            body: rows,
            startY: 45,
            margin: { left: 14, right: 14 },
            styles: {
                font: "helvetica",
                fontSize: 8,
                cellPadding: 4,
                textColor: colors.text,
                fillColor: isDark ? [0, 0, 0] : [255, 255, 255],
                lineColor: colors.border,
                lineWidth: 0.1,
            },
            headStyles: {
                fillColor: colors.headBg,
                textColor: colors.headText,
                fontSize: 8,
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: colors.alternateRow
            },
            tableLineColor: colors.border,
            tableLineWidth: 0.1,
        });

        doc.save(`Inventario_Integral_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
        console.error(err);
        alert("Error al generar PDF: " + err.message);
    }
}

const catMap = { toner: 'TONERS', papeleria: 'PAPELERÍA', accesorios: 'ACCESORIOS' };

let currentView = 'table';
function setView(v) {
    currentView = v;
    document.getElementById('viewTable').classList.toggle('active', v === 'table');
    document.getElementById('viewGrid').classList.toggle('active', v === 'grid');
    document.getElementById('productTable').style.display = v === 'table' ? 'table' : 'none';
    document.getElementById('productGrid').style.display = v === 'grid' ? 'grid' : 'none';
    filterAndSort();
}

function renderTable(list) {
    updateDashboard(list);
    const tbody = document.querySelector('#productTable tbody');
    const grid = document.getElementById('productGrid');
    const pagContainer = document.getElementById('pagination');
    tbody.innerHTML = '';
    grid.innerHTML = '';
    pagContainer.innerHTML = '';

    const totalPages = Math.ceil(list.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedList = list.slice(start, end);

    let pending = 0;

    paginatedList.forEach(p => {
        // Common Logic
        const hasNoImage = !p.image || p.image.includes('logo.svg') || p.image.includes('default');
        const imgName = p.image ? p.image.split('/').pop() : 'logo.svg';
        const imgSrc = `/assets/${imgName}?v=${cacheBuster}`;
        const brandLogosrc = `/assets/${(p.brand || '').toLowerCase().replace(/[^a-z0-9]/g, '')}.png?v=${cacheBuster}`;
        const bSet = brandSettings.find(s => s.id === p.brand) || { scale: 1.0, offset_x: 0, offset_y: 0 };
        const brandImgStyle = `max-height: ${15 * bSet.scale}px; transform: translate(${bSet.offset_x || 0}px, ${bSet.offset_y || 0}px); object-fit: contain;`;

        if (p.published === 0) pending++;

        // 1. TABLE ROW
        const tr = document.createElement('tr');
        if (p.published === 0) tr.classList.add('pending');

        tr.innerHTML = `
                <td>
                    <div style="position:relative; width: 40px; height: 40px;">
                        ${hasNoImage ? `
                            <div class="no-image-placeholder" onclick='zoom("/assets/logo.svg")'>
                                <i class="fa-solid fa-face-dizzy"></i>
                                <span>SIN ASIGNAR</span>
                            </div>
                        ` : `
                            <img src="${imgSrc}" class="thumb" onclick='zoom("${imgSrc}")' onerror="this.src='/assets/logo.svg'">
                        `}
                        ${hasNoImage ? `
                            <div onclick='event.stopPropagation(); openImageWizard(${JSON.stringify(p.id)}, ${JSON.stringify(p.name)}, "product")' 
                                 style="position:absolute; bottom:-5px; right:-5px; background:var(--apple-blue); color:white; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px; border:2px solid white; box-shadow:0 4px 12px rgba(0,0,0,0.3); z-index: 1;" 
                                 title="Agregar imagen inteligente">
                                 <i class="fa-solid fa-wand-magic-sparkles"></i>
                            </div>
                        ` : ''}
                    </div>
                </td>
                <td>
                    <div style="display:flex; align-items:center;">
                        <b>${p.id}</b>
                        <span class="copy-btn" title="Copiar Código" onclick='copyToClipboard(${JSON.stringify(p.id)}, this)'>
                            <i class="fa-regular fa-copy"></i>
                        </span>
                    </div>
                </td>
                <td>
                    <div class="brand-container" data-brand="${p.brand || 'UNK'}" style="position:relative; display:flex; align-items:center; justify-content: center; background:#f8f9fa; padding:4px; border-radius:6px; border:1px solid #eee; width: 60px; height: 32px;">
                        <img src="${brandLogosrc}" class="brand-logo-img" 
                             style="${brandImgStyle}" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block'; const wand = this.parentNode.querySelector('.brand-magic'); if(wand && ${p.brand && p.brand !== 'Otros' ? 'true' : 'false'}) wand.style.display='flex';">
                        <span style="display:none; font-size:10px; font-weight:600; color:#999; text-transform:uppercase;">${p.brand || 'S/M'}</span>
                        <div class="brand-magic" onclick='event.stopPropagation(); openImageWizard(${JSON.stringify(p.brand)}, "", "brand")' 
                             style="display:none; position:absolute; bottom:-5px; right:-5px; background:#ff2d55; color:white; width:22px; height:22px; border-radius:50%; align-items:center; justify-content:center; cursor:pointer; font-size:10px; border:2px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.3); z-index: 2;" 
                             title="Agregar logo de marca">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div style="font-weight:600; display:flex; align-items:center; gap:8px;">
                            ${p.name} ${p.published === 0 ? '<span class="pending-tag">NUEVO</span>' : ''}
                        </div>
                        <div class="p-desc" title="${p.description && p.description !== 'null' ? p.description : p.name}">
                            ${p.description && p.description !== 'null' ? p.description : p.name}
                        </div>
                    </td>
                    <td>${catMap[p.category] || p.category}</td>
                    <td class="date-cell" style="font-size: 11px; color: #666;">${p.created_at ? new Date(p.created_at).toLocaleDateString('es-MX') : '-'}</td>
                    <td>
                        <div style="display: flex; gap: 6px; white-space: nowrap;">
                            <button class="secondary" style="padding:6px 12px; font-size: 14px; border-radius: 6px;" onclick='editProduct(${JSON.stringify(p)})'>
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="danger" style="padding:6px 14px; font-size: 14px; border-radius: 6px; background: #ea4335; color: white; border: none;" onclick='deleteProduct(${JSON.stringify(p.id)})'>
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                    `;
        tbody.appendChild(tr);

        // 2. GRID CARD (Audit Mode)
        const card = document.createElement('div');
        card.className = 'audit-card';
        if (p.published === 0) card.style.borderColor = 'var(--apple-blue)';

        card.innerHTML = `
                    <div style="position:relative; height: 180px; display: flex; align-items: center; justify-content: center; background: #fdfdfd; border-bottom: 1px solid var(--apple-border); overflow: hidden;">
                        ${hasNoImage ? `
                            <div class="no-image-placeholder" style="font-size: 10px; gap: 8px; opacity: 0.4;">
                                <i class="fa-solid fa-camera-retro" style="font-size: 24px;"></i>
                                <span>SIN IMAGEN</span>
                            </div>
                        ` : `
                            <img src="${imgSrc}" class="card-img" onclick='zoom("${imgSrc}")' onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="no-image-placeholder" style="display:none; font-size: 10px; gap: 8px;">
                                <i class="fa-solid fa-triangle-exclamation" style="font-size: 24px;"></i>
                                <span>ERROR</span>
                            </div>
                        `}
                         ${hasNoImage ? `
                            <div onclick='event.stopPropagation(); openImageWizard(${JSON.stringify(p.id)}, ${JSON.stringify(p.name)}, "product")' 
                                 style="position:absolute; bottom:10px; right:10px; background:var(--apple-blue); color:white; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; border:2px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.2); z-index: 3;" 
                                 title="Agregar imagen">
                                <i class="fa-solid fa-plus" style="font-size: 10px;"></i>
                            </div>
                        ` : ''}

                        <div class="brand-logo-pill" data-brand="${p.brand || 'UNK'}">
                            <img src="${brandLogosrc}" class="brand-logo-img" 
                                 style="${brandImgStyle}"
                                 onerror="this.outerHTML='<span style=\'font-size:10px; font-weight:800; color:var(--apple-blue)\'>${p.brand}</span>'; const wand = this.parentNode ? this.parentNode.querySelector('.brand-magic') : null; if(wand && ${p.brand && p.brand !== 'Otros' ? 'true' : 'false'}) wand.style.display='flex';">
                            <div class="brand-magic" onclick='event.stopPropagation(); openImageWizard(${JSON.stringify(p.brand)}, "", "brand")' 
                                 style="display:none; position:absolute; top:-5px; right:-5px; background:#ff2d55; color:white; width:14px; height:14px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:7px; border:1px solid white; z-index: 3;">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>
                            </div>
                        </div>
                    </div>

                    <div class="card-content">
                        <div class="card-id">
                            ${p.id}
                            <span class="copy-btn" title="Copiar Código" onclick='copyToClipboard(${JSON.stringify(p.id)}, this)'>
                                <i class="fa-regular fa-copy"></i>
                            </span>
                        </div>
                        <div class="card-title">${p.name}</div>
                        
                        <div class="card-actions">
                            <button class="secondary" style="flex:1; padding:6px; justify-content:center;" onclick='editProduct(${JSON.stringify(p)})'>
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="danger" style="flex:1; padding:6px; background: #ea4335; color: white; border: none; justify-content:center;" onclick='deleteProduct(${JSON.stringify(p.id)})'>
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
        grid.appendChild(card);
    });

    localStorage.setItem('admin-catalog-page', currentPage);

    const badge = document.getElementById('pendingCount');
    if (pending > 0) { badge.innerText = `${pending} pendientes`; badge.style.display = 'block'; }
    else { badge.style.display = 'none'; }

    // Render Pagination
    if (totalPages > 1) {
        pagContainer.style.display = 'flex';
        pagContainer.innerHTML = `
                    <button class="pg-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(-1)">
                        <i class="fa-solid fa-chevron-left"></i> Anterior
                    </button>
                    <div class="pg-info" style="display:flex; flex-direction:column; align-items:center;">
                        <div style="display:flex; align-items:center; gap:5px;">
                            Página 
                            <input type="number" value="${currentPage}" min="1" max="${totalPages}" 
                                   style="width: 45px; text-align: center; border: 1px solid var(--apple-border); border-radius: 6px; padding: 2px; font-weight: 700; background: var(--input-bg); color: var(--apple-text); border: 1px solid var(--apple-border);"
                                   onchange="goToPage(this.value, ${totalPages})"
                                   onkeyup="if(event.key === 'Enter') goToPage(this.value, ${totalPages})">
                            de <b>${totalPages}</b>
                        </div>
                        <div style="font-size:10px; opacity:0.6; margin-top:2px;">Mostrando ${start + 1} - ${Math.min(end, list.length)} de ${list.length}</div>
                    </div>
                    <button class="pg-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(1)">
                        Siguiente <i class="fa-solid fa-chevron-right"></i>
                    </button>
                `;
    } else {
        pagContainer.style.display = 'none';
    }
}

function changePage(dir) {
    currentPage += dir;
    renderTable(filteredList);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToPage(page, total) {
    let p = parseInt(page);
    if (isNaN(p) || p < 1) p = 1;
    if (p > total) p = total;
    currentPage = p;
    renderTable(filteredList);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleFileUpload(file) {
    if (!file) return;
    const dropZone = document.getElementById('dropZone');
    dropZone.innerHTML = "⏳ Subiendo...";
    const formData = new FormData();
    formData.append('image', file);
    const res = await apiFetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    document.getElementById('p_image').value = data.url;
    dropZone.innerHTML = `<img src="/${data.url}" style="height:60px; border-radius:4px;">`;
}

async function saveProduct() {
    try {
        const id = document.getElementById('p_id').value.trim();
        if (!id) return alert("❌ El ID/Modelo es obligatorio.");

        const name = document.getElementById('p_name').value;
        let description = document.getElementById('p_description').value;

        // Lógica: Si no hay descripción o es "null", copiar el nombre
        if (!description || !description.trim() || description.toLowerCase() === 'null') description = name;

        const body = {
            id,
            name,
            category: document.getElementById('p_category').value,
            brand: document.getElementById('p_brand').value,
            price: 0,
            stock: 0,
            compatibility: document.getElementById('p_compatibility').value,
            image: document.getElementById('p_image').value,
            description
        };

        const isEdit = editingId !== null;
        const method = isEdit ? 'PUT' : 'POST';
        const url = isEdit ? `/api/products/${encodeURIComponent(editingId)}` : '/api/products';

        const res = await apiFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            let errorMessage = "Desconocido";
            try {
                const errData = await res.json();
                errorMessage = errData.error || errorMessage;
            } catch (e) {
                errorMessage = res.statusText || "Error de servidor (posible error de ruta)";
            }
            alert("Error al guardar: " + errorMessage);
            return;
        }
        closeModal();
        loadProducts();
    } catch (err) {
        console.error("Save error:", err);
        alert("Error técnico al conectar con el servidor: " + err.message);
    }
}

async function publishChanges() {
    const btn = document.getElementById('btnPublish');
    const isCyber = document.body.getAttribute('data-theme') === 'cyberpunk';

    btn.innerText = isCyber ? "CARGANDO..." : "⏳ PROCESANDO...";
    btn.disabled = true;
    await apiFetch('/api/publish', { method: 'POST' });
    btn.innerText = isCyber ? "SISTEMA ACTUALIZADO" : "✅ ¡WEB ACTUALIZADA!";
    setTimeout(() => {
        btn.innerText = isCyber ? "ENVIAR A LA WEB" : "🚀 ENVIAR A LA WEB";
        btn.disabled = false;
        loadProducts();
    }, 3000);
}

async function deletePendingProducts() {
    if (!confirm("⚠️ ¿Estás seguro de que deseas borrar TODOS los productos pendientes?\n\nEsto eliminará los productos que acabas de subir y que aún no has enviado a la web. Esta acción no se puede deshacer.")) return;

    try {
        const res = await apiFetch('/api/products/pending', { method: 'DELETE' });
        const data = await res.json();
        if (data.message === "OK") {
            alert(`✅ Se borraron ${data.changes} productos pendientes.`);
            loadProducts();
        }
    } catch (err) {
        alert("Error al borrar pendientes: " + err.message);
    }
}

function newProduct() {
    editingId = null;
    document.getElementById('modalTitle').innerText = "Nuevo Producto";
    document.getElementById('p_id').value = ""; document.getElementById('p_id').disabled = false;
    document.getElementById('p_name').value = ""; document.getElementById('p_brand').value = "";
    document.getElementById('p_compatibility').value = ""; document.getElementById('p_image').value = "";
    document.getElementById('p_description').value = "";
    document.getElementById('dropZone').innerHTML = "📁 Arrastra o selecciona la foto";
    document.getElementById('modal').style.display = 'flex';
}

function editProduct(p) {
    editingId = p.id;
    document.getElementById('modalTitle').innerText = "Editar Producto";
    document.getElementById('p_id').value = p.id; document.getElementById('p_id').disabled = false;
    document.getElementById('p_name').value = p.name;
    document.getElementById('p_brand').value = p.brand || "";
    document.getElementById('p_category').value = p.category;
    document.getElementById('p_image').value = p.image || "";
    document.getElementById('p_compatibility').value = p.compatibility || "";
    document.getElementById('p_description').value = p.description || "";
    let imgName = p.image ? p.image.split('/').pop() : 'logo.svg';
    document.getElementById('dropZone').innerHTML = `<img src="/assets/${imgName}" style="height:60px; border-radius:4px;">`;
    document.getElementById('modal').style.display = 'flex';
}

function openBulkModal() { document.getElementById('bulkModal').style.display = 'flex'; }
function closeBulkModal() { document.getElementById('bulkModal').style.display = 'none'; }

let pendingBulkData = { newItems: [], conflicts: [], images: null };

async function processBulk() {
    const csvFile = document.getElementById('bulkCSV').files[0];
    const imagesArr = document.getElementById('bulkImages').files;
    if (!csvFile) return alert("Selecciona un CSV");

    const btn = document.getElementById('btnProcessBulk');
    btn.disabled = true;

    Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            const data = results.data;
            const newItems = [];
            const conflicts = [];

            const clean = (s) => (s || "").toString().replace(/[\uFEFF\u2028\u2029\u200B\u200C\u200D\u2060]/g, '').trim();

            const getCsvVal = (row, tags) => {
                const keys = Object.keys(row);
                for (const tag of tags) {
                    const found = keys.find(k => clean(k).toLowerCase() === tag.toLowerCase());
                    if (found && row[found] !== null && row[found] !== undefined) return clean(row[found]);
                }
                return null;
            };

            data.forEach(row => {
                const id = getCsvVal(row, ['id', 'modelo', 'sku', 'id/modelo', 'referencia', 'model']);
                if (!id) return;

                const normalizedId = id.toLowerCase();
                if (products.some(p => p.id.trim().toLowerCase() === normalizedId)) {
                    conflicts.push(row);
                } else {
                    newItems.push(row);
                }
            });

            btn.disabled = false;
            pendingBulkData = { newItems, conflicts, images: imagesArr };

            if (conflicts.length > 0) {
                document.getElementById('newItemsCount').innerText = newItems.length;
                document.getElementById('conflictItemsCount').innerText = conflicts.length;

                document.getElementById('newItemsList').innerHTML = newItems.map(row => {
                    const id = getCsvVal(row, ['id', 'modelo', 'sku', 'id/modelo', 'referencia', 'model']);
                    return `• ${id}`;
                }).join('<br>');

                document.getElementById('conflictItemsList').innerHTML = conflicts.map(row => {
                    const id = getCsvVal(row, ['id', 'modelo', 'sku', 'id/modelo', 'referencia', 'model']);
                    return `• ${id}`;
                }).join('<br>');

                document.getElementById('bulkConflictModal').style.display = 'flex';
            } else {
                executeBulkImport(true);
            }
        }
    });
}

async function executeBulkImport(overwriteExisting, stageConflicts = false) {
    document.getElementById('bulkConflictModal').style.display = 'none';
    const progress = document.getElementById('bulkProgress');
    const bar = document.getElementById('progressBar');
    const text = document.getElementById('progressText');

    const toProcess = [
        ...pendingBulkData.newItems,
        ...((overwriteExisting || stageConflicts) ? pendingBulkData.conflicts : [])
    ];

    if (toProcess.length === 0) {
        alert("No hay productos nuevos para cargar.");
        return;
    }

    progress.style.display = 'block';
    const total = toProcess.length;
    let count = 0;
    const images = pendingBulkData.images;

    for (const row of toProcess) {
        try {
            const clean = (s) => (s || "").toString().replace(/[\uFEFF\u2028\u2029\u200B\u200C\u200D\u2060]/g, '').trim();

            const getCsvVal = (r, tags) => {
                const keys = Object.keys(r);
                for (const tag of tags) {
                    const found = keys.find(k => clean(k).toLowerCase() === tag.toLowerCase());
                    if (found && r[found] !== null && r[found] !== undefined) return clean(r[found]);
                }
                return null;
            };

            const id = getCsvVal(row, ['id', 'modelo', 'sku', 'id/modelo', 'referencia', 'model']);
            if (!id) continue;

            const exists = products.find(p => p.id.trim().toLowerCase() === id.toLowerCase());

            const name = getCsvVal(row, ['nombre', 'name', 'producto', 'product', 'descripción corta']) || id;
            let description = getCsvVal(row, ['description', 'descripción', 'descripciôn', 'detalle', 'observaciones']) || name;
            if (!description || !description.trim() || description.toLowerCase() === 'null') description = name;

            let brand = getCsvVal(row, ['marca', 'brand', 'fabricante']) || 'Otros';
            const standardBrands = ['HP', 'Brother', 'Canon', 'Lexmark', 'Xerox'];
            const standardMatch = standardBrands.find(b => b.toLowerCase() === brand.trim().toLowerCase());
            if (standardMatch) brand = standardMatch;

            let category = getCsvVal(row, ['categoría', 'category', 'familia', 'ctaegoria web', 'categoria web']) || 'toner';

            const productData = {
                id: exists ? exists.id : id,
                name: name,
                category: category,
                brand: brand,
                price: 0,
                stock: 0,
                compatibility: getCsvVal(row, ['compatibilidad', 'compatibility', 'impresoras compatibles', 'modelos compatibles']) || '',
                description: description,
                image: ''
            };

            // IF we are in staging mode and it exists, call stage API
            if (exists && stageConflicts) {
                await apiFetch('/api/conflicts/stage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ product_id: exists.id, new_data: productData })
                });

                count++;
                bar.style.width = (count / total * 100) + '%';
                text.innerText = `Archivando para revisión: ${count} de ${total}`;
                continue;
            }

            // Buscar imagen
            let imageUrl = '';
            if (images && images.length > 0) {
                const matchingImage = Array.from(images).find(f => {
                    const nameNoExt = f.name.split('.').slice(0, -1).join('.');
                    return nameNoExt.toLowerCase() === id.toString().toLowerCase();
                });

                if (matchingImage) {
                    const formData = new FormData();
                    formData.append('image', matchingImage);
                    const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: formData });
                    const uploadData = await uploadRes.json();
                    imageUrl = uploadData.url;
                }
            }

            productData.image = imageUrl;

            const method = exists ? 'PUT' : 'POST';
            const url = exists ? `/api/products/${id}` : '/api/products';

            await apiFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });

        } catch (err) {
            console.error("Bulk Item Error:", err);
        }

        count++;
        const pct = Math.round((count / total) * 100);
        bar.style.width = pct + '%';
        text.innerText = `Procesando ${count} de ${total}...`;
    }

    alert("Carga masiva completada");
    progress.style.display = 'none';
    closeBulkModal();
    loadProducts();
}

// =========================================================================
// --- SECCIÓN: RADAR DE PRECIOS Y ESPIONAJE DE MERCADO ---
// =========================================================================

/**
 * Espía el mercado para un producto específico (Abre modal de Radar)
 */

let wizardMode = 'product'; // 'product' or 'brand'
let currentWizardTarget = null;
function updateDashboard(list) {
    const total = list.length;
    const pending = list.filter(p => p.published === 0).length;
    const withPhoto = list.filter(p => p.image && !p.image.includes('logo.svg') && !p.image.includes('default')).length;
    const photoPct = total > 0 ? Math.round((withPhoto / total) * 100) : 0;
    const brands = new Set(list.map(p => p.brand).filter(b => b)).size;

    document.getElementById('statTotal').innerText = total;
    document.getElementById('statPhotos').innerText = `${photoPct}%`;
    document.getElementById('photoProgress').style.width = `${photoPct}%`;
    document.getElementById('statPending').innerText = pending;
    document.getElementById('statBrands').innerText = brands;

    const publishAlert = document.getElementById('publishAlert');
    publishAlert.style.display = pending > 0 ? 'block' : 'none';

    const btnDel = document.getElementById('btnDeletePending');
    if (btnDel) btnDel.style.display = pending > 0 ? 'block' : 'none';
}

function fixNextPhoto() {
    const next = products.find(p => !p.image || p.image.includes('logo.svg') || p.image.includes('default'));
    if (next) {
        // Focus search and highlight next item
        document.getElementById('search').value = next.id;
        filterAndSort();
        if (currentView === 'table') {
            const row = document.querySelector(`tr:has(td:contains('${next.id}'))`);
            if (row) row.classList.add('highlight-fix'); // Add a brief highlight class
        }
        openImageWizard(next.id, next.name, 'product');
    } else {
        alert("🎉 ¡Felicidades! Todos los productos tienen imagen.");
    }
}

function openWizardFromEditor() {
    const id = document.getElementById('p_id').value.trim();
    const name = document.getElementById('p_name').value.trim();
    if (!id) return alert("Por favor, ingresa el ID/Modelo antes de usar el asistente.");
    openImageWizard(id, name, 'product');
}

function openBrandWizardFromEditor() {
    const brand = document.getElementById('p_brand').value;
    if (!brand || brand === 'Otros') return alert("Selecciona una marca válida para buscar su logo.");
    openImageWizard(brand, '', 'brand');
}

function openImageWizard(targetId, targetName, mode = 'product') {
    wizardMode = mode;
    currentWizardTarget = { id: targetId, name: targetName };

    const title = document.getElementById('wizardTitle');
    const subTitle = document.getElementById('wizardProductTitle');
    const searchBtn = document.getElementById('btnWizardSearch');

    if (mode === 'product') {
        title.innerText = "Asistente de Imagen";
        subTitle.innerText = `${targetId} - ${targetName}`;
        searchBtn.onclick = () => window.open(`https://www.google.com/search?q=${encodeURIComponent(targetId + ' ' + targetName + ' toner producto')}&tbm=isch`, '_blank');
    } else {
        title.innerText = "Asistente de Logo";
        subTitle.innerText = `Marca: ${targetId}`;
        searchBtn.onclick = () => window.open(`https://www.google.com/search?q=${encodeURIComponent(targetId + ' logo png official')}&tbm=isch`, '_blank');
    }

    document.getElementById('wizardImageUrl').value = '';
    document.getElementById('wizardStatus').style.display = 'none';
    document.getElementById('imageWizardModal').style.display = 'flex';
}

async function importWizardImage() {
    const url = document.getElementById('wizardImageUrl').value.trim();
    if (!url) return alert("Por favor, pega un enlace de imagen.");

    const status = document.getElementById('wizardStatus');
    const statusText = document.getElementById('wizardStatusText');
    status.style.display = 'block';
    statusText.innerText = "Procesando imagen...";

    const endpoint = wizardMode === 'product' ? '/api/import-image-url' : '/api/import-brand-logo';
    const body = wizardMode === 'product'
        ? { productId: currentWizardTarget.id, imageUrl: url }
        : { brandName: currentWizardTarget.id, imageUrl: url };

    try {
        const res = await apiFetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        if (data.success) {
            statusText.innerText = `✅ ¡Éxito! ${wizardMode === 'product' ? 'Imagen' : 'Logo'} actualizado.`;
            cacheBuster = Date.now(); // Force refresh images
            setTimeout(() => {
                document.getElementById('imageWizardModal').style.display = 'none';
                loadProducts();
                if (wizardMode === 'brand') loadBrandSettings();
            }, 1500);
        } else {
            throw new Error(data.error);
        }
    } catch (err) {
        statusText.innerText = `❌ Error: ${err.message}`;
    }
}

async function deleteProduct(id) {
    const productToDelete = products.find(p => p.id === id);
    if (!confirm(`¿Estás seguro de que deseas eliminar el producto "${id}"?`)) return;
    try {
        const res = await apiFetch(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al eliminar');

        if (data.changes === 0) {
            alert("No se encontró el producto para eliminar.");
        } else {
            // Guardar en la papelera antes de recargar
            auditManager.logDeletion(productToDelete);
            loadProducts();
        }
    } catch (err) {
        console.error(err);
        alert("Error: " + err.message);
    }
}
function closeModal() { document.getElementById('modal').style.display = 'none'; }
function zoom(src) { document.getElementById('zoomedImg').src = src; document.getElementById('zoomOverlay').style.display = 'flex'; }

function toggleTheme(specific) {
    const current = document.body.getAttribute('data-theme');
    let target;

    if (specific === 'fallout') {
        target = current === 'fallout' ? 'light' : 'fallout';
    } else if (specific === 'cyberpunk') {
        target = current === 'cyberpunk' ? 'light' : 'cyberpunk';
    } else {
        target = current === 'dark' ? 'light' : 'dark';
    }

    document.body.setAttribute('data-theme', target);
    localStorage.setItem('integral-theme', target);
    updateThemeIcon();
}

function updateThemeIcon() {
    const current = document.body.getAttribute('data-theme');
    const icon = document.querySelector('#themeToggle i');
    const falloutBtn = document.getElementById('falloutToggle');
    const cyberBtn = document.getElementById('cyberToggle');

    // Reset
    falloutBtn.style.color = ''; falloutBtn.style.borderColor = '';
    cyberBtn.style.color = ''; cyberBtn.style.borderColor = '';

    if (current === 'fallout') {
        icon.className = 'fa-solid fa-terminal';
        falloutBtn.style.color = '#18ff62';
        falloutBtn.style.borderColor = '#18ff62';
    } else if (current === 'cyberpunk') {
        icon.className = 'fa-solid fa-bolt-lightning';
        cyberBtn.style.color = '#f3e600';
        cyberBtn.style.borderColor = '#f3e600';
    } else {
        icon.className = 'fa-solid fa-moon';
    }

    // --- HP Secret Button Logic ---
    const hpBtn = document.getElementById('hpSecretBtn');
    const hpMenu = document.getElementById('hpMenu');
    if (current === 'dark' || current.startsWith('hp-')) {
        hpBtn.style.display = 'flex';
    } else {
        hpBtn.style.display = 'none';
        if (hpMenu) hpMenu.style.display = 'none';
    }

    // Fix botón publicar en modo Cyberpunk
    const btnPublish = document.getElementById('btnPublish');
    if (current === 'cyberpunk') {
        btnPublish.innerText = "ENVIAR A LA WEB";
    } else {
        btnPublish.innerText = "🚀 ENVIAR A LA WEB";
    }
}

function toggleHPMenu() {
    const menu = document.getElementById('hpMenu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function setHPTheme(house) {
    if (house === 'clear') {
        document.body.removeAttribute('data-theme');
        document.body.setAttribute('data-theme', 'dark');
        const sparks = document.querySelector('.magic-sparks');
        if (sparks) sparks.remove();
    } else {
        document.body.setAttribute('data-theme', 'hp-' + house);
        if (!document.querySelector('.magic-sparks')) {
            const sparks = document.createElement('div');
            sparks.className = 'magic-sparks';
            document.body.appendChild(sparks);
        }
    }
    document.getElementById('hpMenu').style.display = 'none';
    updateThemeIcon();
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('hpMenu');
    if (menu && !e.target.closest('#hpSecretBtn') && !e.target.closest('#hpMenu')) {
        menu.style.display = 'none';
    }
});

// Init Theme
const savedTheme = localStorage.getItem('integral-theme') || 'light';
document.body.setAttribute('data-theme', savedTheme);
updateThemeIcon();

window.addEventListener('keydown', (e) => { if (e.key === "Escape") closeModal(); });

// --- SISTEMA DE AUDITORÍA Y PAPELERA ---
const auditManager = {
    logs: JSON.parse(localStorage.getItem('auditLogs') || '[]'),
    trash: JSON.parse(localStorage.getItem('trashInventory') || '[]'),

    save() {
        localStorage.setItem('auditLogs', JSON.stringify(this.logs.slice(0, 50)));
        localStorage.setItem('trashInventory', JSON.stringify(this.trash.slice(0, 20)));
        this.render();
    },

    logAction(type, message, details = "", backup = null) {
        this.logs.unshift({
            type,
            message,
            details,
            backup, // Guardamos el estado anterior para el "Undo"
            time: new Date().toLocaleTimeString()
        });
        this.save();
    },

    logDeletion(product) {
        if (!product) return;
        this.trash.unshift({ ...product, deletedAt: new Date().getTime() });
        this.logAction('delete', `Eliminado: ${product.id}`, product.name);
        this.save();
    },

    async undoUpdate(logIndex) {
        const log = this.logs[logIndex];
        if (!log || !log.backup) return;

        if (!confirm(`¿Deshacer cambios y volver al estado anterior de "${log.backup.id}"?`)) return;

        try {
            const res = await apiFetch(`/api/products/${log.backup.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(log.backup)
            });
            if (res.ok) {
                this.logs.splice(logIndex, 1);
                this.logAction('create', `↩️ Revertido: ${log.backup.id}`);
                this.save();
                loadProducts();
            } else {
                alert("Error al revertir los cambios.");
            }
        } catch (err) {
            alert("Error mágico al deshacer");
        }
    },

    async restoreProduct(id) {
        const index = this.trash.findIndex(p => p.id === id);
        if (index === -1) return;
        const product = this.trash[index];

        try {
            const res = await apiFetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product)
            });
            if (res.ok) {
                this.trash.splice(index, 1);
                this.logAction('create', `Restaurado: ${product.id}`);
                this.save();
                loadProducts();
            } else {
                alert("Error al restaurar. Puede que el ID ya exista.");
            }
        } catch (err) {
            alert("Error mágico al restaurar");
        }
    },

    render() {
        const logEl = document.getElementById('logContent');
        const trashEl = document.getElementById('trashContent');
        if (!logEl || !trashEl) return;

        if (this.logs.length === 0) {
            logEl.innerHTML = '<div style="text-align:center; padding-top:40px; opacity:0.5">Sin actividad reciente</div>';
        } else {
            logEl.innerHTML = this.logs.map((l, index) => `
                        <div class="log-entry ${l.type}" style="position:relative">
                            <div style="display:flex; justify-content:space-between; align-items:center; width:100%">
                                <div style="flex:1; padding-right:10px">
                                    <strong style="display:block; margin-bottom:2px">${l.message}</strong>
                                    <div style="opacity:0.75; font-size:11px; line-height:1.2">${l.details || ''}</div>
                                </div>
                                ${l.type === 'update' && l.backup ? `
                                    <button class="btn-undo" onclick="auditManager.undoUpdate(${index})" 
                                            style="padding: 6px 10px; flex-shrink:0; background: var(--apple-blue); color:white; border:none; box-shadow:0 2px 8px rgba(0,113,227,0.3)">
                                        ↩️ DESHACER
                                    </button>` : ''}
                            </div>
                            <span class="time">${l.time}</span>
                        </div>
                    `).join('');
        }
        // ... trash rendering stays the same ...
        if (this.trash.length === 0) {
            trashEl.innerHTML = '<div style="text-align:center; padding-top:40px; opacity:0.5">La papelera está vacía</div>';
        } else {
            trashEl.innerHTML = this.trash.map(p => `
                        <div class="trash-item">
                            <img src="${p.image || 'https://via.placeholder.com/40'}" onerror="this.src='https://via.placeholder.com/40'">
                            <div style="flex:1">
                                <div style="font-size:11px; font-weight:bold">${p.id}</div>
                                <div style="font-size:9px; opacity:0.7">${p.name.substring(0, 25)}...</div>
                            </div>
                            <button class="btn-restore" onclick="auditManager.restoreProduct('${p.id}')">RESTAURAR</button>
                        </div>
                    `).join('');
        }
    }
};

function toggleHistory() {
    const side = document.getElementById('historySidebar');
    side.classList.toggle('open');
    if (side.classList.contains('open')) auditManager.render();
}

function showHistoryTab(tab) {
    document.getElementById('logContent').style.display = tab === 'log' ? 'block' : 'none';
    document.getElementById('trashContent').style.display = tab === 'trash' ? 'block' : 'none';
    document.getElementById('tabLog').classList.toggle('active', tab === 'log');
    document.getElementById('tabTrash').classList.toggle('active', tab === 'trash');
}

// Interceptor robusto para cambios
const originalSave = saveProduct;
saveProduct = async function () {
    const id = document.getElementById('p_id').value;
    // Capturar estado ANTES de que el original lo cambie usando el editingId
    const existingProduct = editingId ? products.find(p => p.id === editingId) : null;
    const backup = existingProduct ? JSON.parse(JSON.stringify(existingProduct)) : null;

    try {
        await originalSave(); // Ejecutar guardado real

        // Si el originalSave terminó sin errores, procedemos al log
        if (editingId) {
            let logMsg = `Actualizado: ${id}`;
            if (id !== editingId) {
                logMsg = `Código modificado: ${editingId} ➔ ${id}`;
            }
            auditManager.logAction('update', logMsg, document.getElementById('p_name').value, backup);
        } else {
            auditManager.logAction('create', `Creado: ${id}`, document.getElementById('p_name').value);
        }
    } catch (err) {
        console.error("Error en interceptor de guardado:", err);
    }
};

// SISTEMA DE AUDITORÍA SEO
function runSEOAudit() {
    if (!products || products.length === 0) return;

    const issues = {
        noDesc: [],
        shortTitle: [],
        noBrand: [],
        imageGap: []
    };

    products.forEach(p => {
        if (!p.description || p.description === 'null' || p.description.length < 10) issues.noDesc.push(p);
        if (p.name.length < 15) issues.shortTitle.push(p);
        if (!p.brand || p.brand === 'Otros') issues.noBrand.push(p);
        if (!p.image || p.image.includes('logo.svg')) issues.imageGap.push(p);
    });

    const totalIssues = issues.noDesc.length + issues.shortTitle.length + issues.imageGap.length;
    const health = Math.max(0, 100 - Math.round((totalIssues / (products.length * 3)) * 100));

    const badge = document.getElementById('seoQualityBadge');
    badge.innerHTML = `Salud del Catálogo: <span style="color:${health > 80 ? '#34c759' : '#ff9f0a'}">${health}%</span>`;

    const container = document.getElementById('seoSuggestions');
    container.innerHTML = '';

    const addSuggestion = (title, count, text, icon, color) => {
        if (count === 0) return;
        const div = document.createElement('div');
        div.style = `background:rgba(${color},0.05); padding:12px; border-radius:12px; border:1px solid rgba(${color},0.1); cursor:pointer; transition:0.3s;`;
        div.innerHTML = `
                    <div style="display:flex; align-items:center; gap:10px;">
                        <i class="fa-solid ${icon}" style="color:rgb(${color})"></i>
                        <div style="flex:1">
                            <div style="font-weight:600; font-size:12px;">${title} (${count})</div>
                            <div style="font-size:11px; opacity:0.7;">${text}</div>
                        </div>
                        <i class="fa-solid fa-chevron-right" style="font-size:10px; opacity:0.3"></i>
                    </div>
                `;
        div.onclick = () => {
            switchView('catalog');
            const searchBox = document.getElementById('search');
            // Simular una búsqueda o filtro para estos problemas
            alert(`Mostrando los ${count} productos con este problema...`);
        };
        container.appendChild(div);
    };

    addSuggestion("Faltan Descripciones", issues.noDesc.length, "Los buscadores ignoran productos sin texto.", "fa-align-left", "255, 59, 48");
    addSuggestion("Títulos muy cortos", issues.shortTitle.length, "Agrega marca y modelo para rankear mejor.", "fa-heading", "0, 113, 227");
    addSuggestion("Imágenes Pendientes", issues.imageGap.length, "El 90% de las ventas entran por los ojos.", "fa-image", "255, 159, 10");
}

// Cambio de vistas
function switchView(view) {
    localStorage.setItem('admin-active-view', view); // Persistir vista
    document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

    if (view === 'catalog') {
        document.getElementById('viewCatalog').classList.add('active');
        document.getElementById('navCatalog').classList.add('active');
    } else if (view === 'brands') {
        document.getElementById('viewBrands').classList.add('active');
        document.getElementById('navBrands').classList.add('active');
        loadBrandSettings();
    } else if (view === 'conflicts') {
        document.getElementById('viewConflicts').classList.add('active');
        document.getElementById('navConflicts').classList.add('active');
        loadConflicts();
    } else if (view === 'snapshots') {
        document.getElementById('viewSnapshots').classList.add('active');
        document.getElementById('navSnapshots').classList.add('active');
        loadSnapshots();
    }
}

async function loadSnapshots() {
    try {
        const res = await apiFetch('/api/snapshots');
        const data = await res.json();
        const tbody = document.getElementById('snapshotsTableBody');

        if (!data.data || data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; opacity:0.5;">No hay copias de seguridad aún. Haz clic en "Enviar a la Web" para crear una.</td></tr>';
            return;
        }

        tbody.innerHTML = data.data.map(s => `
            <tr>
                <td>
                    ${s.is_active ?
                '<span style="background:#34c759; color:white; padding:4px 10px; border-radius:12px; font-size:10px; font-weight:800;">ACTIVA EN WEB</span>' :
                '<span style="background:#8e8e93; color:white; padding:4px 10px; border-radius:12px; font-size:10px; font-weight:800; opacity:0.5;">RESPALDO</span>'}
                </td>
                <td style="font-family:monospace; font-weight:700;">${s.version_tag}</td>
                <td style="font-size:13px; opacity:0.7;">${new Date(s.created_at).toLocaleString('es-MX')}</td>
                <td style="font-size:13px;">${s.description}</td>
                <td>
                    <button class="secondary" onclick="rollbackToVersion(${s.id}, '${s.version_tag}')" 
                            ${s.is_active ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}
                            style="padding:6px 12px; font-size:11px; font-weight:700;">
                        <i class="fa-solid fa-clock-rotate-left"></i> RESTAURAR ESTA VERSIÓN
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error("Error cargando snapshots:", err);
    }
}

async function rollbackToVersion(id, tag) {
    if (!confirm(`¿Estás seguro de que quieres restaurar la versión ${tag}? \n\nEsto reemplazará los productos que ven los clientes actualmente por los de esa fecha.`)) return;

    try {
        const res = await apiFetch(`/api/snapshots/${id}/rollback`, { method: 'POST' });
        const data = await res.json();

        if (res.ok) {
            alert(`✅ ¡Restauración exitosa! La versión ${tag} ahora está activa en la web.`);
            loadSnapshots();
        } else {
            throw new Error(data.error);
        }
    } catch (err) {
        alert("Error al restaurar: " + err.message);
    }
}

let currentConflicts = [];
async function loadConflicts() {
    const res = await apiFetch('/api/conflicts');
    const data = await res.json();
    currentConflicts = data.data || [];
    const container = document.getElementById('conflictsList');
    const badge = document.getElementById('conflictBadge');

    if (data.data && data.data.length > 0) {
        badge.innerText = data.data.length;
        badge.style.display = 'flex';

        container.innerHTML = data.data.map(c => {
            const old = JSON.parse(c.old_data);
            const incoming = JSON.parse(c.new_data);

            return `
                        <div class="admin-card" style="border-left: 4px solid #ff3b30; background: white; padding: 20px;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
                                <div>
                                    <h4 style="margin:0; font-size:16px;">${c.product_id}</h4>
                                    <span style="font-size:10px; opacity:0.5;">Detectado el ${new Date(c.created_at).toLocaleString()}</span>
                                </div>
                                <div style="background:rgba(255,59,48,0.1); color:#ff3b30; font-size:9px; font-weight:900; padding:4px 8px; border-radius:10px;">CONFLICTO</div>
                            </div>

                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px;">
                                <div style="font-size:12px; border-right:1px solid #eee; padding-right:10px;">
                                    <div style="font-weight:800; color:#888; margin-bottom:5px; font-size:10px;">ACTUAL EN WEB</div>
                                    <div style="color:#333;">${old.name}</div>
                                    <div style="font-size:10px; opacity:0.6; margin-top:4px;">${(old.compatibility || '').substring(0, 60)}...</div>
                                </div>
                                <div style="font-size:12px;">
                                    <div style="font-weight:800; color:var(--apple-blue); margin-bottom:5px; font-size:10px;">ENTRANTE (CSV)</div>
                                    <div style="color:#333;">${incoming.name}</div>
                                    <div style="font-size:10px; opacity:0.6; margin-top:4px;">${(incoming.compatibility || '').substring(0, 60)}...</div>
                                </div>
                            </div>

                            <div style="display:grid; grid-template-columns: 1fr; gap:10px;">
                                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                                    <button class="secondary" onclick="resolveConflict(${c.id}, 'keep_old', this)" style="font-size:10px; font-weight:700;">
                                        <i class="fa-solid fa-clock-rotate-left"></i> MANTENER ACTUAL
                                    </button>
                                    <button class="primary" onclick="resolveConflict(${c.id}, 'keep_new', this)" style="font-size:10px; font-weight:700; background:#ff3b30;">
                                        <i class="fa-solid fa-check-double"></i> USAR TODO EL NUEVO
                                    </button>
                                </div>
                                <button class="primary" onclick="openConflictEditor(${c.id})" style="font-size:11px; font-weight:700; background:var(--apple-blue); width:100%;">
                                    <i class="fa-solid fa-pen-to-square"></i> EDITAR ACTUAL
                                </button>
                            </div>
                        </div>
                    `;
        }).join('');
    } else {
        badge.style.display = 'none';
        container.innerHTML = `
                    <div style="grid-column: 1/-1; text-align:center; padding:100px; opacity:0.3;">
                        <i class="fa-solid fa-check-double" style="font-size:48px; margin-bottom:20px;"></i>
                        <p>No hay conflictos de versión pendientes</p>
                    </div>
                `;
    }
}

async function resolveConflict(conflictId, action, btn) {
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        await apiFetch(`/api/conflicts/${conflictId}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });

        // Refresh list and badge
        loadConflicts();
        loadProducts(); // Important to refresh main catalog
    } catch (err) {
        alert("Error al resolver: " + err.message);
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

let ce_current_id = null;
function openConflictEditor(id) {
    const conflict = currentConflicts.find(c => c.id === id);
    if (!conflict) return;

    ce_current_id = id;
    const old = JSON.parse(conflict.old_data);
    const incoming = JSON.parse(conflict.new_data);

    document.getElementById('ce_id_title').innerText = conflict.product_id;

    // Editable (Current)
    document.getElementById('ce_name').value = old.name || '';
    document.getElementById('ce_desc').value = (old.description && old.description !== 'null') ? old.description : '';
    document.getElementById('ce_brand').value = old.brand || '';
    document.getElementById('ce_cat').value = old.category || 'toner';
    document.getElementById('ce_comp').value = old.compatibility || '';

    // Reference (Incoming)
    document.getElementById('ce_ref_name').innerText = incoming.name || '-';
    document.getElementById('ce_ref_desc').innerText = (incoming.description && incoming.description !== 'null') ? incoming.description : (incoming.name || '-');
    document.getElementById('ce_ref_brand').innerText = incoming.brand || '-';
    document.getElementById('ce_ref_cat').innerText = (catMap[incoming.category] || incoming.category) || '-';
    document.getElementById('ce_ref_comp').innerText = incoming.compatibility || '-';

    document.getElementById('conflictEditorModal').style.display = 'flex';
}

function closeConflictEditor() {
    document.getElementById('conflictEditorModal').style.display = 'none';
}

async function saveConflictEdits() {
    const btn = document.getElementById('btnSaveCE');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    const custom_data = {
        name: document.getElementById('ce_name').value,
        description: document.getElementById('ce_desc').value,
        brand: document.getElementById('ce_brand').value,
        category: document.getElementById('ce_cat').value,
        compatibility: document.getElementById('ce_comp').value
    };

    try {
        const res = await apiFetch(`/api/conflicts/${ce_current_id}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'custom', custom_data })
        });

        if (!res.ok) throw new Error("Error en el servidor");

        closeConflictEditor();
        loadConflicts();
        loadProducts();
    } catch (err) {
        alert("Error al guardar: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

// Inicializar auditoría
auditManager.render();

// --- BRAND CUSTOMIZATION LOGIC ---
let brandSettings = [];

async function loadBrandSettings() {
    const res = await apiFetch('/api/brands');
    const data = await res.json();
    brandSettings = data.data || [];
    renderBrandsTable();
}

function renderBrandsTable() {
    const tbody = document.getElementById('brandsTableBody');

    // Normalize brands to avoid duplicates like Ricoh/RICOH
    const brandMap = new Map();
    products.forEach(p => {
        if (p.brand && p.brand !== 'Otros') {
            const key = p.brand.toLowerCase().trim();
            // Keep the first version found but prefer Capitalized if available
            if (!brandMap.has(key)) brandMap.set(key, p.brand.trim());
        }
    });
    const uniqueBrands = [...brandMap.values()].sort();

    document.getElementById('brandCount').innerText = uniqueBrands.length;

    tbody.innerHTML = '';
    uniqueBrands.forEach(brandName => {
        const setting = brandSettings.find(s => s.id.toLowerCase() === brandName.toLowerCase()) || {
            id: brandName,
            name: brandName,
            logo: `/assets/images/brands/${brandName.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`,
            scale: 1.0,
            offset_x: 0,
            offset_y: 0,
            color: '#0071e3'
        };

        const isNew = !brandSettings.find(s => s.id.toLowerCase() === brandName.toLowerCase());
        const brandImgPath = setting.logo.startsWith('/') ? setting.logo.replace(/^\//, '../') : '../' + setting.logo;
        const tr = document.createElement('tr');

        tr.innerHTML = `
                    <td style="padding: 15px; width: 170px;">
                        <div style="background:#f8f9fa; border:1px solid #eee; border-radius:12px; padding:20px; text-align:center; position:relative;">
                            ${isNew ? '<span style="position:absolute; top:8px; left:8px; background:#ff9500; color:white; font-size:8px; padding:2px 6px; border-radius:10px; font-weight:900;">NUEVA</span>' : ''}
                            <!-- FIXED SIZE CONTAINER (CANON STYLE) -->
                            <div class="brand-logo-pill" style="position:relative; margin:0 auto; box-shadow:none; border:1px solid #ddd; background:white; width:80px; height:32px; overflow:hidden; padding:0; border-radius:16px; display:flex; align-items:center; justify-content:center;">
                                <!-- Safe Zone Guides (Only visible in this preview) -->
                                <div style="position:absolute; top:calc(50% - 7.5px); left:0; width:100%; height:15px; border-top:1px dashed #ff2d55; border-bottom:1px dashed #ff2d55; opacity:0.25; pointer-events:none; z-index:3;"></div>
                                
                                <div class="brand-placeholder" style="position:absolute; inset:0; background:#f1f5f9; display:none; flex-direction:column; align-items:center; justify-content:center; color:#94a3b8; font-size:8px; font-weight:800; text-transform:uppercase;">
                                    <i class="fa-solid fa-image" style="font-size:10px; margin-bottom:2px;"></i>
                                    ${brandName.substring(0, 8)}
                                </div>

                                <img src="${brandImgPath}" class="brand-prev-img"
                                     style="max-height: ${15 * setting.scale}px; transform:translate(${setting.offset_x || 0}px, ${setting.offset_y || 0}px); max-width:70px; object-fit:contain; z-index:2;"
                                     onerror="this.style.display='none'; this.previousElementSibling.style.display='flex';">
                                
                                <div onclick="openImageWizard('${brandName}', '', 'brand')" 
                                     style="position:absolute; top:4px; right:4px; background:rgba(255,45,85,0.7); color:white; width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:7px; z-index:4; border:1px solid white;" 
                                     title="Buscar logo">
                                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                                </div>
                            </div>
                            <div style="font-weight:800; font-size:14px; margin-top:10px; color:#333;">${brandName}</div>
                        </div>
                    </td>
                    <td>
                        <div style="display:flex; flex-direction:column; gap:12px; background: #fff; padding: 15px; border-radius: 12px; border:1px solid #eee;">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <span style="font-size:11px; width:60px; font-weight:700;">ESCALA</span>
                                <input type="range" min="0.4" max="2.0" step="0.05" value="${setting.scale}" 
                                    oninput="updateBrandPreview(this, '${brandName}', 'scale')" style="flex:1">
                                <span style="font-size:11px; width:35px; font-family:monospace; text-align:right;">${setting.scale}</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:12px;">
                                <span style="font-size:11px; width:60px; font-weight:700;">HORIZONTAL</span>
                                <input type="range" min="-25" max="25" step="1" value="${setting.offset_x || 0}" 
                                    oninput="updateBrandPreview(this, '${brandName}', 'offset_x')" style="flex:1">
                                <span style="font-size:11px; width:35px; font-family:monospace; text-align:right;">${setting.offset_x || 0}px</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:12px;">
                                <span style="font-size:11px; width:60px; font-weight:700;">VERTICAL</span>
                                <input type="range" min="-12" max="12" step="1" value="${setting.offset_y}" 
                                    oninput="updateBrandPreview(this, '${brandName}', 'offset_y')" style="flex:1">
                                <span style="font-size:11px; width:35px; font-family:monospace; text-align:right;">${setting.offset_y}px</span>
                            </div>
                            <div style="display:flex; gap:8px; margin-top:5px;">
                                <button class="secondary" onclick="openImageWizard('${brandName}', '', 'brand')" style="padding:10px; font-size:11px; font-weight:700;" title="Buscador Inteligente">
                                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                                </button>
                                <button class="secondary" onclick="this.nextElementSibling.click()" style="flex:1; padding:10px; font-size:11px; font-weight:700;">
                                    <i class="fa-solid fa-upload"></i> LOGO
                                </button>
                                <input type="file" style="display:none" accept="image/*" onchange="handleBrandLogoUpload(this, '${brandName}')">
                                
                                <button class="primary" onclick="saveBrandConfig('${brandName}', this)" style="flex:2; padding:10px; font-size:11px; font-weight:700;">
                                    <i class="fa-solid fa-floppy-disk"></i> GUARDAR CAMBIOS
                                </button>
                            </div>
                        </div>
                    </td>
                    <td style="background: #f1f5f980; padding: 20px;">
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; min-width:350px;">
                            <!-- MOCKUP ADMIN -->
                            <div style="text-align:center;">
                                <div style="font-size:9px; font-weight:800; color:#999; margin-bottom:8px;">VISTA GESTOR (ADMIN)</div>
                                <div class="audit-card" style="width:160px; margin:0 auto; transform:scale(0.8); transform-origin:top center; pointer-events:none;">
                                    <div style="height:100px; background:#fdfdfd; display:flex; align-items:center; justify-content:center; border-bottom:1px solid #eee; position:relative;">
                                         <i class="fa-solid fa-box" style="font-size:24px; opacity:0.1;"></i>
                                         <div class="brand-logo-pill" style="top:10px; right:-10px; height:32px; width:80px; padding:0; overflow:hidden;">
                                             <img src="${brandImgPath}" class="brand-prev-img" style="max-height: ${15 * setting.scale}px; transform:translate(${setting.offset_x || 0}px, ${setting.offset_y || 0}px); max-width:70px; object-fit:contain;">
                                         </div>
                                    </div>
                                    <div style="padding:10px; text-align:left;">
                                        <div style="font-size:8px; opacity:0.5;">RTX-4080</div>
                                        <div style="font-size:10px; font-weight:700; border-bottom:1px solid #eee; padding-bottom:5px; margin-bottom:5px;">Tarjeta de Video...</div>
                                        <div style="display:flex; gap:4px;">
                                            <div style="width:15px; height:15px; border-radius:4px; background:#eee;"></div>
                                            <div style="width:15px; height:15px; border-radius:4px; background:#eee;"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- MOCKUP CLIENTE -->
                            <div style="text-align:center;">
                                <div style="font-size:9px; font-weight:800; color:#999; margin-bottom:8px;">PÁGINA CLIENTES</div>
                                <div class="catalog-item-card" style="width:160px; margin:0 auto; transform:scale(0.8); transform-origin:top center; pointer-events:none; border:1px solid #eee;">
                                    <div style="height:100px; background:#fff; display:flex; align-items:center; justify-content:center; position:relative;">
                                         <div class="brand-badge" style="top:10px; right:-8px; height:32px; width:80px; padding:0; overflow:hidden;">
                                             <img src="${brandImgPath}" class="brand-prev-img" style="max-height: ${15 * setting.scale}px; transform:translate(${setting.offset_x || 0}px, ${setting.offset_y || 0}px); max-width:70px; object-fit:contain;">
                                         </div>
                                         <i class="fa-solid fa-print" style="font-size:24px; opacity:0.1;"></i>
                                    </div>
                                    <div style="padding:10px; text-align:left;">
                                        <div style="font-size:10px; font-weight:800; color:var(--ic-cyan); margin-bottom:4px;">Tóner Compatible</div>
                                        <div style="font-size:11px; font-weight:600; line-height:1.2;">Producto de Muestra...</div>
                                        <div style="margin-top:10px; height:20px; border-radius:10px; background:var(--ic-cyan); opacity:0.1;"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </td>
                `;
        tbody.appendChild(tr);
    });
}

function updateBrandPreview(input, brandId, field) {
    const val = input.value;
    input.nextElementSibling.innerText = (field === 'offset_y' || field === 'offset_x') ? val + 'px' : val;

    const tr = input.closest('tr');
    const scaleInput = tr.querySelectorAll('input')[0];
    const xInput = tr.querySelectorAll('input')[1];
    const yInput = tr.querySelectorAll('input')[2];

    const imgs = tr.querySelectorAll('.brand-prev-img');
    imgs.forEach(img => {
        img.style.maxHeight = `${15 * scaleInput.value}px`;
        img.style.transform = `translate(${xInput.value}px, ${yInput.value}px)`;
    });

    // Highlight the Save button to indicate changes
    const btn = tr.querySelector('.primary');
    btn.style.boxShadow = '0 0 15px rgba(0, 113, 227, 0.4)';
    const savedText = btn.innerHTML.includes('OK') ? '<i class="fa-solid fa-floppy-disk"></i> GUARDAR CAMBIOS' : btn.innerHTML;
    if (!btn.innerHTML.includes('*')) btn.innerHTML = savedText + ' *';
}

async function saveBrandConfig(brandId, btn) {
    const tr = btn.closest('tr');
    const inputs = tr.querySelectorAll('input');
    const body = {
        name: brandId,
        logo: `/assets/images/brands/${brandId.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`,
        scale: parseFloat(inputs[0].value),
        offset_x: parseInt(inputs[1].value),
        offset_y: parseInt(inputs[2].value),
        color: "#0071e3" // Default for now
    };

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    const res = await apiFetch(`/api/brands/${brandId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (res.ok) {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> OK';
        setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> GUARDAR';
            btn.disabled = false;
        }, 1500);
    } else {
        alert("Error al guardar");
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> GUARDAR';
    }
}

async function handleBrandLogoUpload(input, brandName) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const btn = input.previousElementSibling;
    const originalHtml = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    const formData = new FormData();
    formData.append('image', file);
    formData.append('name', brandName);

    try {
        const res = await apiFetch('/api/upload-brand', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.url) {
            // Update all previews in this row immediately
            const tr = input.closest('tr');
            const allImgs = tr.querySelectorAll('.brand-prev-img');
            const allPlaceholders = tr.querySelectorAll('.brand-placeholder');

            allPlaceholders.forEach(p => p.style.display = 'none');
            allImgs.forEach(img => {
                img.src = `${data.url.startsWith('/') ? data.url.replace(/^\//, '../') : '../' + data.url}?v=${Date.now()}`;
                img.style.display = 'block';
            });

            // Mark the Save button as modified
            const saveBtn = tr.querySelector('.primary');
            saveBtn.style.boxShadow = '0 0 15px rgba(0, 113, 227, 0.4)';
            if (!saveBtn.innerHTML.includes('*')) saveBtn.innerHTML += ' *';

            btn.innerHTML = '<i class="fa-solid fa-check"></i> OK';
        }
    } catch (err) {
        alert("Error al subir logo: " + err.message);
    } finally {
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
            // Reset input so it can be used again for same file
            input.value = '';
        }, 1500);
    }
}

const savedView = localStorage.getItem('admin-active-view') || 'catalog';
if (savedView !== 'catalog') switchView(savedView);
loadProducts();
