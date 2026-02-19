const puppeteer = require('puppeteer');

/**
 * RADAR SNIPER v2.3
 * Inteligencia de Mercado Avanzada con Triple Validación de Identidad.
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
        const normName = norm(rawName);

        // 1. EXTRACCIÓN DE MARCA Y CATEGORÍA
        const knownBrands = ['zebra', 'hp', 'xerox', 'lexmark', 'samsung', 'brother', 'epson', 'canon', 'sony', 'verbatim', 'kingston', 'adata', 'sandisk', 'logitech', 'dell', 'lenovo', 'techzone', 'teros', 'acteck', 'vorago'];
        let detectedBrand = knownBrands.find(b => normName.includes(b)) || "";

        // Identificar "Palabra Clave Maestra" (DVD, Mouse, Toner, Papel)
        let masterKeyword = "";
        if (normName.includes("toner")) masterKeyword = "toner";
        else if (normName.includes("etiqueta") || normName.includes("papel")) masterKeyword = "etiqueta";
        else if (normName.includes("dvd") || normName.includes("cd")) masterKeyword = "dvd";
        else if (normName.includes("mouse") || normName.includes("mou")) masterKeyword = "mouse";
        else if (normName.includes("laptop")) masterKeyword = "laptop";

        // 2. CONSTRUCCIÓN DE BÚSQUEDA ROBUSTA
        // Si buscamos Z10026382 solo, sale basura. Si buscamos "Zebra Z10026382" sale el producto.
        const searchTerms = [
            `${detectedBrand} ${rawModel} ${masterKeyword}`.trim(),
            rawModel
        ].filter((v, i, a) => v.length > 2 && a.indexOf(v) === i);

        console.log(`📡 Radar Sniper 2.3 | Objetivo: ${rawModel} (${masterKeyword}) | Marca: ${detectedBrand || 'Indeterminada'}`);

        let allResults = [];

        for (const term of searchTerms) {
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            console.log(`🔍 Escaneando: "${term}"...`);

            try {
                const query = encodeURIComponent(term);
                // Realizar búsqueda WEB (más confiable para SKUs técnicos)
                await page.goto(`https://www.google.com/search?q=${query}+precio&hl=es-MX`, { waitUntil: 'domcontentloaded', timeout: 10000 });

                const results = await page.evaluate(() => {
                    const items = [];
                    // Analizar bloques de resultados de búsqueda y snippets
                    document.querySelectorAll('.g, .MjjYud, .Sr66ed').forEach(el => {
                        const titleEl = el.querySelector('h3');
                        const linkEl = el.querySelector('a');
                        const text = el.innerText;

                        // Capturar precio (formatos: $1,234.00, MXN 500, etc)
                        const match = text.match(/(?:MXN|\$)\s?([\d,]+(?:\.\d+)?)/i);

                        if (titleEl && linkEl && match) {
                            const val = parseFloat(match[1].replace(/,/g, ''));
                            if (val > 20) {
                                items.push({
                                    title: titleEl.innerText,
                                    price: val,
                                    url: linkEl.href,
                                    text: text // Para validación de contexto
                                });
                            }
                        }
                    });
                    return items;
                });
                allResults.push(...results);
            } catch (e) {
                console.log(`⚠️ Error en "${term}":`, e.message);
            } finally {
                await page.close();
            }
        }

        // --- FILTRO DE RELEVANCIA QUIRÚRGICO (PUNTAJE) ---
        const finalResults = [];
        const seen = new Set();
        const m = norm(rawModel);

        allResults.forEach(res => {
            let score = 0;
            const t = norm(res.title);
            const body = norm(res.text);

            // 1. ¿Contiene el modelo exacto? (Vital)
            if (t.includes(m) || body.includes(m)) score += 80;

            // 2. ¿Contiene la palabra clave maestra? (Evita confusiones)
            if (masterKeyword && (t.includes(masterKeyword) || body.includes(masterKeyword))) score += 40;

            // 3. ¿Contiene la marca?
            if (detectedBrand && (t.includes(detectedBrand) || body.includes(detectedBrand))) score += 20;

            // PENALIZACIONES (Los "Impostores")
            // Si buscamos algo que NO es toner, y el resultado es toner -> CHAO.
            if (masterKeyword !== "toner" && (t.includes("toner") || body.includes("toner") || t.includes("polvo") || body.includes("polvo"))) score -= 300;
            if (masterKeyword !== "etiqueta" && (t.includes("etiqueta") || body.includes("etiqueta"))) score -= 300;

            // Si el puntaje es alto, es un match real
            if (score >= 60) {
                let store = "Tienda";
                try {
                    const host = new URL(res.url).hostname.replace('www.', '').split('.')[0].toUpperCase();
                    store = host;
                } catch (e) { }

                const key = `${store}_${Math.round(res.price / 10)}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    finalResults.push({
                        title: res.title.substring(0, 100),
                        price: res.price,
                        priceText: `MXN ${res.price.toLocaleString('es-MX')}`,
                        store: store,
                        url: res.url,
                        score: score
                    });
                }
            }
        });

        // Ordenar: Mayores precios primero (Margen competitivo)
        finalResults.sort((a, b) => b.price - a.price);

        await browser.close();
        return finalResults.slice(0, 15);

    } catch (error) {
        if (browser) await browser.close();
        return [];
    }
}

// CLI Support
if (require.main === module) {
    const model = process.argv[2], name = process.argv[3] || "";
    if (model) scoutPrice(model, name).then(res => console.log(JSON.stringify(res, null, 2)));
}

module.exports = scoutPrice;
