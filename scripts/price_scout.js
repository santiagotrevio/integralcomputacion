const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

/**
 * RADAR SNIPER v3.2 - "Stealth Armor"
 * Sistema de inteligencia de mercado con validación de ADN y evasión de bloqueos.
 */
async function scoutPrice(model, name = "") {
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1280,720'
        ]
    });

    try {
        const rawModel = model.trim().toUpperCase();
        const rawName = name.trim();
        const norm = (str) => (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

        // --- 1. EXTRACCIÓN DE IDENTIDAD ---
        const n = norm(rawName);
        let category = "general";
        let keywords = [];

        const catMap = {
            'papel': { keys: ['papel', 'etiqueta', 'bond', 'rollo', 'termica', 'z-perform', 'libreta'], bad: ['toner', 'tinta', 'cartucho', 'disco', 'dvd', 'collarin', 'monitor'] },
            'toner': { keys: ['toner', 'polvo', 'cartucho', 'laserjet', 'tambor', 'drum'], bad: ['papel', 'hoja', 'disco', 'dvd', 'collarin', 'monitor'] },
            'disco': { keys: ['dvd', 'cd', 'disco', 'verbatim', 'sony'], bad: ['toner', 'papel', 'etiqueta', 'mouse', 'monitor'] },
            'mouse': { keys: ['mouse', 'optico', 'alambrico', 'inalambrico', 'mou'], bad: ['toner', 'papel', 'etiqueta', 'refaccion', 'monitor'] },
            'monitor': { keys: ['monitor', 'pantalla', 'led', 'display', 'panel', 'hz'], bad: ['toner', 'papel', 'disco', 'mou'] },
            'laptop': { keys: ['laptop', 'notebook', 'computadora', 'portatil', 'portatil'], bad: ['toner', 'cartucho', 'papel'] },
            'tinta': { keys: ['tinta', 'ink', 'cartucho', 'ecotank'], bad: ['toner', 'papel', 'disco'] }
        };

        // Detección de categoría mejorada (priorizada)
        for (const [cat, data] of Object.entries(catMap)) {
            if (data.keys.some(k => n.includes(k))) {
                // Verificar que no contenga palabras "bad" de esta categoría
                if (!data.bad.some(b => n.includes(b))) {
                    category = cat;
                    keywords = data.keys;
                    break;
                }
            }
        }

        const brandKeywords = ['hp', 'zebra', 'techzone', 'teros', 'logitech', 'sony', 'verbatim', 'kingston', 'xerox', 'lexmark', 'samsung', 'brother', 'epson', 'canon', 'xzeal', 'acer', 'asus', 'dell', 'lg', 'gigabyte', 'msi'];
        const detectedBrand = brandKeywords.find(b => n.includes(b)) || "";

        // Limpieza de modelos para evitar prefijos duplicados (Ej: XZXZMXZ32B -> XZMXZ32B)
        let cleanModel = rawModel;
        if (detectedBrand === 'xzeal' && rawModel.startsWith('XZXZ')) cleanModel = rawModel.substring(2);
        if (detectedBrand === 'hp' && rawModel.startsWith('HPHP')) cleanModel = rawModel.substring(2);

        // --- 2. BÚSQUEDA INTELIGENTE CON FALLBACK ---
        let masterKeyword = category !== "general" ? category : (keywords.length > 0 ? keywords[0] : "");
        if (masterKeyword === "general") masterKeyword = "";

        const searchTerms = [
            `${detectedBrand} ${cleanModel} ${masterKeyword} precio`.trim(),
            `${cleanModel} ${masterKeyword} precio México`.trim(),
            `${rawName.split(' ').slice(0, 4).join(' ')} precio`.trim()
        ].filter((v, i, a) => v.length > 3 && a.indexOf(v) === i);

        console.log(`📡 Radar Sniper 3.1 | Identidad: ${category.toUpperCase()} | Marca: ${detectedBrand.toUpperCase()}`);

        let allItems = [];

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        for (const term of searchTerms) {
            try {
                // Limpieza para ML: quitar "precio" y "mexico"
                const cleanTerm = term.split(' ').filter(w => !['precio', 'mexico', 'mx'].includes(w.toLowerCase())).join(' ');
                const mlUrl = `https://listado.mercadolibre.com.mx/${encodeURIComponent(cleanTerm)}`;

                const response = await page.goto(mlUrl, { waitUntil: 'networkidle2', timeout: 15000 });

                // Pausa humana
                await new Promise(r => setTimeout(r, 2000));

                const mlResults = await page.evaluate(() => {
                    const results = [];
                    // Selector muy amplio para los contenedores de productos
                    const nodes = document.querySelectorAll('.ui-search-result__wrapper, .ui-search-result, .ui-search-layout__item');

                    nodes.forEach(el => {
                        const text = el.innerText || "";
                        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);

                        // El título suele ser la primera línea larga o el H2
                        const titleEl = el.querySelector('h2, .ui-search-item__title');
                        const title = titleEl ? titleEl.innerText : (lines[0] || "");

                        // Precio: Buscar el primer número después de un $ que sea > 100 (para evitar falsos mini-precios)
                        const priceMatch = text.match(/\$\s?([\d,]{2,})/);

                        if (title && priceMatch) {
                            const price = parseFloat(priceMatch[1].replace(/,/g, ''));
                            if (price < 50) return; // Filtro de basura

                            const linkEl = el.querySelector('a');

                            results.push({
                                title,
                                price,
                                store: "Mercado Libre",
                                url: linkEl ? linkEl.href : '',
                                source: 'ml'
                            });
                        }
                    });
                    return results;
                });

                if (mlResults.length > 0) {
                    allItems.push(...mlResults);
                }

                if (allItems.length < 3) {
                    // Fallback Google
                    const gUrl = `https://www.google.com/search?q=${encodeURIComponent(term)}&hl=es-MX`;
                    await page.goto(gUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
                    const gResults = await page.evaluate(() => {
                        const found = [];
                        document.querySelectorAll('.g, .MjjYud, .pla-unit, .mnr-c').forEach(el => {
                            const h3 = el.querySelector('h3, .pla-unit-title, .mB697c');
                            const a = el.querySelector('a');
                            const text = el.innerText;
                            const pMatch = text.match(/(?:MXN|\$)\s?([\d,]+(?:\.\d+)?)/i);

                            if (h3 && pMatch) {
                                found.push({
                                    title: h3.innerText,
                                    price: parseFloat(pMatch[1].replace(/,/g, '')),
                                    store: "Web",
                                    url: a ? a.href : '',
                                    source: 'google'
                                });
                            }
                        });
                        return found;
                    });
                    if (gResults.length > 0) {
                        console.log(`✅ Google encontró ${gResults.length} ítems.`);
                        allItems.push(...gResults);
                    }
                }
            } catch (e) {
                console.log(`⚠️ Error en "${term}": ${e.message}`);
            }
            if (allItems.length >= 10) break;
        }

        await page.close();

        // --- 3. FILTRO DE ADN (QUIRÚRGICO) ---
        const finalResultsMap = new Map();
        const m = norm(cleanModel);
        const mRaw = norm(rawModel);

        allItems.forEach(item => {
            let score = 0;
            const t = norm(item.title);

            // A. Coincidencia de Modelo (Prueba con limpio y original)
            const cleanM = m.replace(/[^a-z0-9]/g, '');
            const cleanMRaw = mRaw.replace(/[^a-z0-9]/g, '');
            const cleanT = t.replace(/[^a-z0-9]/g, '');

            const match = t.includes(m) || t.includes(mRaw) || cleanT.includes(cleanM) || cleanT.includes(cleanMRaw);
            if (match) score += 70;

            // B. ADN de Categoría
            const currentCat = catMap[category] || { keys: [], bad: [] };
            if (currentCat.keys.some(k => t.includes(k))) score += 30;
            if (currentCat.bad.some(b => t.includes(b))) score -= 500;

            if (score >= 60) {
                if (item.store === "Web" || item.store === "Shopping") {
                    try { item.store = new URL(item.url).hostname.replace('www.', '').split('.')[0].toUpperCase(); } catch (e) { }
                }
                const key = `${item.store}_${Math.round(item.price / 10)}`;
                if (!finalResultsMap.has(key)) {
                    finalResultsMap.set(key, {
                        ...item,
                        priceText: `MXN ${item.price.toLocaleString('es-MX')}`,
                        score: score
                    });
                }
            }
        });

        console.log(`🎯 Radar completado: ${finalResultsMap.size} resultados finales tras filtrado ADN.`);

        const finalResults = Array.from(finalResultsMap.values());
        finalResults.sort((a, b) => b.price - a.price);

        await browser.close();
        return finalResults.slice(0, 15);

    } catch (error) {
        if (browser) await browser.close();
        return [];
    }
}

if (require.main === module) {
    const m = process.argv[2], n = process.argv[3];
    if (m) scoutPrice(m, n).then(res => console.log(JSON.stringify(res, null, 2)));
}
module.exports = scoutPrice;
