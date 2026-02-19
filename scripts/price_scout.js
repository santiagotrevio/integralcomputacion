const puppeteer = require('puppeteer');

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
    const page = await browser.newPage();

    // Fingerprint más humano
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // --- LIMPIEZA AVANZADA DE IDENTIFICADOR ---
    // Muchos ERPs añaden prefijos como HT, IT, SKU, etc.
    // También aislamos el código si viene pegado a la marca: HPW2122A -> W2122A
    // --- LIMPIEZA AVANZADA DE IDENTIFICADOR ---
    let cleanId = model.trim().toUpperCase()
        .replace(/^(HT|IT|SKU|PROD|COD|REF|ART|ITEM|LOTE|KIT|COMP|GEN|OEM|HP|LX|BR|CANON|EPSON|SAMSUNG|BROTHER|Z)+/i, '')
        .replace(/^[-_ ]+/, '');

    if (cleanId.length < 3) cleanId = model.toUpperCase();
    const numericId = cleanId.replace(/\D/g, ''); // Solo números para match relajado

    // Generar versiones con espacio
    const spacedId = cleanId.replace(/([A-Z]+)(\d+)/, '$1 $2');

    // --- DETECCIÓN DE COLOR ---
    const colors = {
        'negro': ['negro', 'black', 'bk'],
        'cian': ['cian', 'cyan', 'azul', 'blue'],
        'magenta': ['magenta', 'rojo', 'red', 'rosa', 'pink'],
        'amarillo': ['amarillo', 'yellow', 'amarilla', 'yel']
    };

    let targetColorName = null;
    let targetColorKeywords = [];
    const lowerName = name.toLowerCase();

    for (const [colorKey, keywords] of Object.entries(colors)) {
        if (keywords.some(k => lowerName.includes(k))) {
            targetColorName = colorKey;
            targetColorKeywords = keywords;
            break;
        }
    }

    // Intentar extraer el modelo real desde el nombre si el ID parece truncado o prefijado
    // Ej: "TONER 212A AMARILLO" -> 212A
    const nameMatches = name.match(/([A-Z]*\d+[A-Z]*)/g) || [];
    const bestNameMatch = nameMatches.find(m => m.length >= 4 && m.length <= 10);

    const searchTerms = [
        model,
        bestNameMatch,
        cleanId,
        spacedId,
        targetColorName ? `${bestNameMatch || cleanId} ${targetColorName}` : null,
        `${bestNameMatch || cleanId} cyberpuerta`,
        `${bestNameMatch || cleanId} va de volada`
    ].filter((t, i, self) => t && t.length > 2 && self.indexOf(t) === i);

    let finalResultsMap = new Map();

    // Tiendas prioritarias en México
    const priorityStores = ['Va de volada', 'Cyberpuerta', 'CAD Toner', 'PCEL', 'Abasteo', 'Amazon', 'Mercado Libre', 'Office Depot', 'Walmart', 'Zegucom', 'Intercompras', 'Claro Shop'];

    // --- DETECCIÓN DE CATEGORÍA ---
    let categoryPrefix = ""; // Neutral por defecto
    if (lowerName.includes("toner") || lowerName.includes("polvo")) {
        categoryPrefix = "toner";
    } else if (lowerName.includes("papel") || lowerName.includes("bond") || lowerName.includes("hojas") || lowerName.includes("oficio")) {
        categoryPrefix = "papel";
    } else if (lowerName.includes("laptop") || lowerName.includes("computadora") || lowerName.includes("macbook") || lowerName.includes("notebook")) {
        categoryPrefix = "laptop";
    } else if (lowerName.includes("tinta") || lowerName.includes("cartucho") || lowerName.includes("ink")) {
        categoryPrefix = "tinta";
    } else if (lowerName.includes("impresora") || lowerName.includes("multifuncional") || lowerName.includes("laserjet")) {
        categoryPrefix = "impresora";
    }

    const searchFunction = async (term) => {
        const finalQuery = `${categoryPrefix} ${term} precio mexico`.trim();
        const query = encodeURIComponent(finalQuery);
        console.log(`🔎 Buscando: "${finalQuery}"`);
        const searchPage = await browser.newPage();

        // Debug logs de la página
        searchPage.on('console', msg => {
            const txt = msg.text();
            if (txt.includes('Found')) console.log(`[Browser] ${txt} for "${term}"`);
        });

        await searchPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await searchPage.setExtraHTTPHeaders({ 'Accept-Language': 'es-MX,es;q=0.9' });

        let localResults = [];
        try {
            // Decidir si buscar en Shopping o Web basado en el término
            const engine = (term.includes('cyberpuerta') || term.includes('volada')) ? 'web' : 'shop';

            if (engine === 'shop') {
                await searchPage.goto(`https://www.google.com/search?q=${query}&tbm=shop&hl=es-MX`, { waitUntil: 'networkidle2', timeout: 15000 });
                const shopRes = await searchPage.evaluate(() => {
                    const products = [];
                    // Selector RADICAL: Cualquier cosa que parezca una oferta con aria-label completo
                    const ariaMatches = Array.from(document.querySelectorAll('[aria-label*="Precio actual"]'));
                    const gridMatches = Array.from(document.querySelectorAll('.sh-dgr__content, .sh-dgr__grid-result, .iXEZd, .wOPJ9c, g-inner-card'));

                    const allCards = [...new Set([...ariaMatches, ...gridMatches])];

                    allCards.forEach(card => {
                        let title, price, store, url;

                        // DATA EXTRACTION (ARIA FIRST)
                        const ariaLabel = card.getAttribute('aria-label') || card.querySelector('[aria-label*="Precio actual"]')?.getAttribute('aria-label');

                        if (ariaLabel && ariaLabel.includes('Precio')) {
                            const parts = ariaLabel.split('. ');
                            title = parts[0];
                            const priceMatch = ariaLabel.match(/Precio actual: ([^.]+)/) || ariaLabel.match(/Precio: ([^.]+)/);
                            if (priceMatch) {
                                price = parseFloat(priceMatch[1].replace(/[^0-9.]/g, '')) || 0;
                            }
                            // La tienda suele ser lo que no es título ni precio
                            store = parts.find(p => !p.includes('Precio') && p !== title && p.length > 2);
                        }

                        // FALLBACK SELECTORS
                        const titleEl = card.querySelector('h3, .tAx79b, .translate-content, [role="heading"], .tAx77b');
                        if (titleEl && (!title || title.length < 5)) title = titleEl.innerText;

                        if (!price || price === 0) {
                            const priceEl = card.querySelector('.a893u, .XP1PBe, .kH9S7e, .OFFNJ, .Vne7u, .hn99U, .sh-np__product-price, .a8S75c, .a893sc');
                            if (priceEl) price = parseFloat(priceEl.innerText.replace(/[^0-9.]/g, '')) || 0;
                        }

                        if (!store || store === 'Tienda Online') {
                            const storeEl = card.querySelector('.aULzUe, .I89Sbc, .vS77S, .b57YQ2, .m9986b, .I663ec, .vS779c, .ByU4id, .m09pAb, .sh-np__seller-name, .vP6bu');
                            if (storeEl) store = storeEl.innerText;
                        }

                        // URL (Aggressive search)
                        const links = Array.from(card.querySelectorAll('a'));
                        let mainLink = links.find(a => a.href && (a.href.includes('shopping/product') || a.href.includes('url?url=') || a.href.includes('googleadservices')));
                        if (!mainLink) mainLink = links.find(a => a.href && !a.href.includes('support.google.com') && !a.href.includes('google.com/search') && a.href.includes('http'));
                        if (!mainLink) mainLink = card.tagName === 'A' ? card : card.closest('a');

                        url = mainLink ? (mainLink.href.startsWith('http') ? mainLink.href : 'https://www.google.com' + mainLink.getAttribute('href')) : '';

                        if (title && title.length > 5 && price > 100) {
                            products.push({
                                title: title.trim().substring(0, 150),
                                priceText: `MXN ${price.toLocaleString('es-MX')}`,
                                store: (store ? store.replace('Vendido por ', '').replace(' y más', '').trim() : "Tienda Online"),
                                price,
                                url
                            });
                        }
                    });
                    return products;
                });
                localResults.push(...shopRes);
            }

            // Búsqueda Web (siempre para términos específicos de tienda, o como respaldo)
            await searchPage.goto(`https://www.google.com/search?q=${query}&hl=es-MX`, { waitUntil: 'networkidle2', timeout: 15000 });
            const webRes = await searchPage.evaluate(() => {
                const containers = Array.from(document.querySelectorAll('.g, .v7W49e > div, .Sr66ed, .tF2Cxc, div.MjjYud'));
                return containers.map(s => {
                    const titleEl = s.querySelector('h3');
                    const linkEl = s.querySelector('a');
                    const citeEl = s.querySelector('cite');
                    const text = s.innerText;

                    // Regex más permisiva para precios en México (soporta MXN, $ y comas)
                    const priceRegex = /(?:MXN|\$)\s?([\d,]+(?:\.\d+)?)/i;
                    const match = text.match(priceRegex);

                    if (!titleEl || !match || !linkEl) return null;

                    let detectedStore = "Web";
                    const urlStr = linkEl.href.toLowerCase();

                    // Mapeo manual de grandes retailers
                    if (urlStr.includes('amazon')) detectedStore = "Amazon";
                    else if (urlStr.includes('mercadolibre')) detectedStore = "Mercado Libre";
                    else if (urlStr.includes('cyberpuerta')) detectedStore = "Cyberpuerta";
                    else if (urlStr.includes('vadevolada')) detectedStore = "Va de Volada";
                    else if (urlStr.includes('abasteo')) detectedStore = "Abasteo";
                    else if (urlStr.includes('pcel')) detectedStore = "PCEL";
                    else if (urlStr.includes('zegucom')) detectedStore = "Zegucom";
                    else if (urlStr.includes('cyberpo')) detectedStore = "Cyberpuerta";
                    else if (citeEl) {
                        // Limpieza del nombre de la tienda desde el cite
                        let raw = citeEl.innerText.split(' › ')[0].trim().replace(/^(https?:\/\/)?(www\.)?/, '');
                        let namePart = raw.split('.')[0];
                        if (namePart.toLowerCase() === 'www' && raw.split('.')[1]) namePart = raw.split('.')[1];
                        detectedStore = namePart.charAt(0).toUpperCase() + namePart.slice(1);
                    } else {
                        try {
                            const host = new URL(linkEl.href).hostname.replace('www.', '').split('.')[0];
                            detectedStore = host.charAt(0).toUpperCase() + host.slice(1);
                        } catch (e) { detectedStore = "Referencia"; }
                    }

                    const priceVal = parseFloat(match[1].replace(/,/g, ''));

                    return {
                        title: titleEl.innerText.substring(0, 100),
                        priceText: `MXN ${priceVal.toLocaleString('es-MX')}`,
                        store: detectedStore,
                        price: priceVal,
                        url: linkEl.href
                    };
                }).filter(i => i && i.price > 100);
            });
            localResults.push(...webRes);
        } catch (e) {
            // Ignorar errores individuales de pestañas
        } finally {
            await searchPage.close();
        }

        // --- FILTRO ESTRÍCTO DE RELEVANCIA ---
        const genericStartWords = ['etiqueta', 'papel', 'toner', 'cartucho', 'tinta', 'hojas', 'bond', 'oficio', 'carta', 'caja', 'kit', 'original', 'generico', 'compatible', 'premium', 'nuevo', 'rollo'];
        const knownBrands = ['zebra', 'hp', 'xerox', 'lexmark', 'samsung', 'brother', 'epson', 'canon', 'pantum', 'okidata', 'kyocera', 'ricoh', 'sharp', 'toshiba', 'kronaline', 'navitek', 'janel'];

        let brandMatch = "";
        const nameParts = name.toLowerCase().split(/[\s,.-]+/);
        brandMatch = nameParts.find(word => knownBrands.includes(word)) || "";

        if (!brandMatch) {
            for (const word of nameParts) {
                if (!genericStartWords.includes(word) && word.length > 2) {
                    brandMatch = word;
                    break;
                }
            }
        }

        const idLower = cleanId.toLowerCase();
        const altIdLower = bestNameMatch ? bestNameMatch.toLowerCase() : idLower;
        const numId = (numericId && numericId.length >= 4) ? numericId : "____NONE____";

        return localResults.filter(res => {
            const titleLower = res.title.toLowerCase();

            // 0. EXCLUSIÓN DE BASURA (PDFs, Buscadores genéricos, etc)
            if (titleLower.includes(".pdf") || titleLower.includes("adjudicaciones") || titleLower.includes("transparencia") ||
                titleLower.includes("pdf)") || titleLower.includes("licitacion") || titleLower.includes("gob.mx")) return false;

            // 1. ANÁLISIS DE CATEGORÍA (RECHAZO ABSOLUTO)
            const isTonerProduct = (titleLower.includes("toner") || titleLower.includes("polvo") || titleLower.includes("drum") || titleLower.includes("tambor") || titleLower.includes("unidad de imagen"));
            const isPaperProduct = (titleLower.includes("papel") || titleLower.includes("etiqueta") || titleLower.includes("bond") || titleLower.includes("hoja") || titleLower.includes("rollo") || titleLower.includes("ttr"));
            const isInkProduct = (titleLower.includes("tinta") || titleLower.includes("ink") || titleLower.includes("cartucho"));

            // BLOQUEO CRUZADO: Papel vs Consumibles Químicos
            if (categoryPrefix === "papel" || lowerName.includes("etiqueta") || lowerName.includes("rollo")) {
                if (isTonerProduct || isInkProduct) return false; // Prohibido toners si buscamos papel
            }
            if (categoryPrefix === "toner" || categoryPrefix === "tinta") {
                if (isPaperProduct) return false; // Prohibido papel si buscamos toner
            }

            // 2. VALIDACIÓN DE MODELO
            const hasModelId = (idLower.length > 3 && titleLower.includes(idLower)) ||
                (altIdLower.length > 3 && titleLower.includes(altIdLower)) ||
                (numId !== "____NONE____" && titleLower.includes(numId));

            // 3. VALIDACIÓN DE MARCA Y COINCIDENCIA SEMÁNTICA
            // Si tiene el ID del modelo Y pasó el filtro de categoría, es muy probable que sea correcto
            if (hasModelId) return true;

            // Sin ID: Validar marca y palabras clave (extremadamente estricto)
            const isBrandRelevant = brandMatch.length > 2 ? titleLower.includes(brandMatch) : false;

            const keywords = name.toLowerCase().split(' ')
                .filter(w => w.length > 3 && !genericStartWords.includes(w) && w !== brandMatch);

            const matchCount = keywords.filter(kw => titleLower.includes(kw)).length;
            const matchRatio = keywords.length > 0 ? matchCount / keywords.length : 0;

            // Para ser válido sin ID: Marca + 2 palabras clave descriptivas
            return isBrandRelevant && matchCount >= 2;
        });
    };

    try {
        console.log(`📡 Radar Sniper: Analizando "${searchTerms.join(' | ')}"`);

        // Ejecución SECUENCIAL para evitar bloqueos y consumo excesivo de RAM
        let results = [];
        for (const term of searchTerms) {
            console.log(`🔍 Escaneando: ${term}...`);
            const termResults = await searchFunction(term);
            results.push(...termResults);
            // Pequeño delay para ser más humano
            await new Promise(r => setTimeout(r, 500));
        }

        results.flat().forEach(res => {
            // Deduplicar: Si es la misma tienda y el precio es similar, ignorar
            // Pero preferir el que tenga URL
            const priceKey = Math.round(res.price / 20); // Agrupar precios muy similares
            const key = `${res.store.toLowerCase().trim()}_${priceKey}`;

            const existing = finalResultsMap.get(key);
            if (!existing || (!existing.url && res.url)) {
                finalResultsMap.set(key, res);
            }
        });

        let finalResults = Array.from(finalResultsMap.values());

        // Ordenar por precio de MAYOR a MENOR (como solicitó el usuario)
        finalResults.sort((a, b) => {
            // Priorizar resultados con URL (estos son siempre más útiles)
            if (a.url && !b.url) return -1;
            if (!a.url && b.url) return 1;

            // Orden global por precio descendente
            return b.price - a.price;
        });

        if (browser) await browser.close();
        return finalResults.slice(0, 15);
    } catch (error) {
        console.error('❌ Radar Error:', error.message);
        if (browser) {
            try { await browser.close(); } catch (e) { }
        }
        return [];
    }
}

// CLI Support
if (require.main === module) {
    const model = process.argv[2];
    const name = process.argv[3] || "";
    if (!model) process.exit(1);
    scoutPrice(model, name).then(res => console.log(JSON.stringify(res, null, 2)));
}

module.exports = scoutPrice;
