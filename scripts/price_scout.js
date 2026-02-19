const puppeteer = require('puppeteer');

/**
 * RADAR SNIPER v3.1 - "Identity Armor"
 * Sistema de inteligencia de mercado con validación de ADN de categoría y búsqueda multitérmino.
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
            'toner': { keys: ['toner', 'polvo', 'cartucho', 'laserjet'], bad: ['papel', 'hoja', 'disco', 'dvd', 'collarin'] },
            'papel': { keys: ['papel', 'etiqueta', 'bond', 'rollo', 'termica', 'z-perform'], bad: ['toner', 'tinta', 'cartucho', 'disco', 'dvd', 'collarin'] },
            'disco': { keys: ['dvd', 'cd', 'disco', 'verbatim', 'sony'], bad: ['toner', 'papel', 'etiqueta', 'mouse'] },
            'mouse': { keys: ['mouse', 'gamer', 'optico', 'alambrico', 'inalambrico', 'mou'], bad: ['toner', 'papel', 'etiqueta', 'refaccion'] },
            'laptop': { keys: ['laptop', 'notebook', 'computadora', 'portatil'], bad: ['toner', 'cartucho', 'papel'] },
            'tinta': { keys: ['tinta', 'ink', 'cartucho', 'ecotank'], bad: ['toner', 'papel', 'disco'] }
        };

        for (const [cat, data] of Object.entries(catMap)) {
            if (data.keys.some(k => n.includes(k))) {
                category = cat;
                keywords = data.keys;
                break;
            }
        }

        const brandKeywords = ['hp', 'zebra', 'techzone', 'teros', 'logitech', 'sony', 'verbatim', 'kingston', 'xerox', 'lexmark', 'samsung', 'brother', 'epson', 'canon'];
        const detectedBrand = brandKeywords.find(b => n.includes(b)) || "";

        // --- 2. BÚSQUEDA INTELIGENTE CON FALLBACK ---
        let masterKeyword = category !== "general" ? category : (keywords.length > 0 ? keywords[0] : "");
        if (masterKeyword === "general") masterKeyword = "";

        const searchTerms = [
            `${detectedBrand} ${rawModel} ${masterKeyword} precio`.trim(),
            `${rawModel} ${masterKeyword} precio`.trim()
        ].filter((v, i, a) => v.length > 3 && a.indexOf(v) === i);

        console.log(`📡 Radar Sniper 3.1 | Identidad: ${category.toUpperCase()} | Marca: ${detectedBrand.toUpperCase()}`);

        let allItems = [];

        for (const term of searchTerms) {
            console.log(`🔍 Escaneando: "${term}"...`);
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

            try {
                const url = `https://www.google.com/search?q=${encodeURIComponent(term)}&hl=es-MX`;
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

                const results = await page.evaluate(() => {
                    const items = [];
                    // 1. Shopping (Carrusel/Ads)
                    document.querySelectorAll('.mnr-c, .pla-unit, .commercial-unit-desktop-top').forEach(el => {
                        const title = el.querySelector('[role="heading"], .pla-unit-title, .mB697c')?.innerText;
                        const priceMatch = el.innerText.match(/(?:MXN|\$)\s?([\d,]+(?:\.\d+)?)/i);
                        const store = el.querySelector('.LbUacb, .pla-unit-seller, .pj79ce')?.innerText;
                        const link = el.querySelector('a')?.href;
                        if (title && priceMatch) {
                            items.push({
                                title,
                                price: parseFloat(priceMatch[1].replace(/,/g, '')),
                                store: store || "Shopping",
                                url: link || '',
                                source: 'shop'
                            });
                        }
                    });

                    // 2. Orgánicos
                    document.querySelectorAll('.g, .MjjYud').forEach(el => {
                        const title = el.querySelector('h3')?.innerText;
                        const link = el.querySelector('a')?.href;
                        const priceMatch = el.innerText.match(/(?:MXN|\$)\s?([\d,]+(?:\.\d+)?)/i);
                        if (title && link && priceMatch) {
                            items.push({
                                title,
                                price: parseFloat(priceMatch[1].replace(/,/g, '')),
                                store: "Web",
                                url: link,
                                source: 'web'
                            });
                        }
                    });
                    return items;
                });
                allItems.push(...results);
            } catch (e) {
                console.log(`⚠️ Error en término "${term}":`, e.message);
            } finally {
                await page.close();
            }
            if (allItems.length >= 8) break; // Si ya tenemos suficientes con el primer término, terminamos
        }

        // --- 3. FILTRO DE ADN (QUIRÚRGICO) ---
        const finalResultsMap = new Map();
        const m = norm(rawModel);

        allItems.forEach(item => {
            let score = 0;
            const t = norm(item.title);

            // A. Coincidencia de Modelo
            const cleanM = m.replace(/[^a-z0-9]/g, '');
            const cleanT = t.replace(/[^a-z0-9]/g, '');
            if (t.includes(m) || cleanT.includes(cleanM)) score += 70;

            // B. ADN de Categoría
            const currentCat = catMap[category] || { keys: [], bad: [] };
            if (currentCat.keys.some(k => t.includes(k))) score += 30;
            if (currentCat.bad.some(b => t.includes(b))) score -= 500; // BLOQUEO

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
