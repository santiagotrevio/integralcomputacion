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

    // Mejorar la limpieza del ID: HPCE400X -> CE400X
    // Intentamos separar marca de código: LX-74 -> 74
    const cleanId = model.replace(/^(HP|LX|BR|brother|CANON|EPSON|SAMSUNG)+/i, '');
    const spacedId = model.replace(/([A-Z]+)(\d+)/, '$1 $2');

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

    const searchTerms = [
        spacedId,
        model,
        targetColorName ? `${spacedId} ${targetColorName}` : null,
        `${spacedId} cyberpuerta`,
        `${spacedId} va de volada`
    ].filter((t, i, self) => t && t.length > 2 && self.indexOf(t) === i);

    let finalResultsMap = new Map();

    // Tiendas prioritarias en México
    const priorityStores = ['Va de volada', 'Cyberpuerta', 'CAD Toner', 'PCEL', 'Abasteo', 'Amazon', 'Mercado Libre', 'Office Depot', 'Walmart', 'Zegucom', 'Intercompras', 'Claro Shop'];

    const searchFunction = async (term) => {
        const query = encodeURIComponent(`toner ${term} precio mexico`);
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
                    const items = Array.from(document.querySelectorAll('.sh-dgr__content, .sh-np__click-target, .iXEZd, .sh-dlr__list-result, .sh-pr__product-results-grid > div'));
                    return items.map(item => {
                        const titleEl = item.querySelector('h3, .ns7Aue, .tAx79b, .DEbx9b, .sh-np__product-title');
                        const priceTextEl = item.querySelector('.a893u, .XP1PBe, .kH9S7e, .OFFNJ, .Vne7u, .hn99U, .sh-np__product-price');
                        const storeEl = item.querySelector('.aULzUe, .I663ec, .vS779c, .ByU4id, .m09pAb, .sh-np__seller-name');
                        const linkEl = item.querySelector('a');

                        if (!titleEl || !priceTextEl) return null;

                        const title = titleEl.innerText;
                        const priceText = priceTextEl.innerText;
                        let store = storeEl?.innerText || "Tienda Online";
                        const url = linkEl ? (linkEl.href.startsWith('http') ? linkEl.href : 'https://www.google.com' + linkEl.getAttribute('href')) : '';
                        const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

                        if (url.includes('vadevolada')) store = 'Va de volada';
                        if (url.includes('cyberpuerta')) store = 'Cyberpuerta';

                        // --- FILTRO DE COLOR (Intra-página) ---
                        if (targetColorName) {
                            const titleLower = title.toLowerCase();
                            const hasTarget = targetColorKeywords.some(k => titleLower.includes(k));
                            let hasOther = false;
                            for (const [ckey, kws] of Object.entries(colors)) {
                                if (ckey !== targetColorName && kws.some(k => titleLower.includes(k))) {
                                    hasOther = true;
                                    break;
                                }
                            }
                            if (hasOther && !hasTarget) return null; // Es de otro color claramente
                        }

                        return { title, priceText, store, price, url };
                    }).filter(i => i && i.price > 100);
                });
                localResults.push(...shopRes);
            }

            // Búsqueda Web (siempre para términos específicos de tienda, o como respaldo)
            await searchPage.goto(`https://www.google.com/search?q=${query}&hl=es-MX`, { waitUntil: 'networkidle2', timeout: 15000 });
            const webRes = await searchPage.evaluate(() => {
                const containers = Array.from(document.querySelectorAll('.g, .v7W49e > div, .Sr66ed, .tF2Cxc'));
                return containers.map(s => {
                    const titleEl = s.querySelector('h3');
                    const linkEl = s.querySelector('a');
                    const citeEl = s.querySelector('cite');
                    const text = s.innerText;

                    const match = text.match(/\$\s?[\d,]+(\.\d+)?/);
                    if (!titleEl || !match || !linkEl) return null;

                    let detectedStore = "Web";
                    const domain = linkEl.href.toLowerCase();

                    if (domain.includes('amazon')) detectedStore = "Amazon";
                    else if (domain.includes('mercadolibre')) detectedStore = "Mercado Libre";
                    else if (domain.includes('cyberpuerta')) detectedStore = "Cyberpuerta";
                    else if (domain.includes('vadevolada')) detectedStore = "Va de volada";
                    else if (domain.includes('abasteo')) detectedStore = "Abasteo";
                    else if (citeEl) {
                        let raw = citeEl.innerText.split(' › ')[0].trim().replace(/^(https?:\/\/)?(www\.)?/, '');
                        let namePart = raw.split('.')[0];
                        if (namePart.toLowerCase() === 'www' && raw.split('.')[1]) namePart = raw.split('.')[1];
                        detectedStore = namePart.charAt(0).toUpperCase() + namePart.slice(1);
                    } else {
                        const host = new URL(linkEl.href).hostname.replace('www.', '').split('.')[0];
                        detectedStore = host.charAt(0).toUpperCase() + host.slice(1);
                    }

                    // --- FILTRO DE COLOR (Intra-página Web) ---
                    const titleStr = titleEl.innerText;
                    if (targetColorName) {
                        const titleLower = titleStr.toLowerCase();
                        const hasTarget = targetColorKeywords.some(k => titleLower.includes(k));
                        let hasOther = false;
                        for (const [ckey, kws] of Object.entries(colors)) {
                            if (ckey !== targetColorName && kws.some(k => titleLower.includes(k))) {
                                hasOther = true;
                                break;
                            }
                        }
                        if (hasOther && !hasTarget) return null;
                    }

                    return {
                        title: titleStr.substring(0, 60),
                        priceText: match[0],
                        store: detectedStore,
                        price: parseFloat(match[0].replace(/[^0-9.]/g, '')),
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
        return localResults;
    };

    try {
        console.log(`📡 Radar Sniper: Buscando "${searchTerms.join(' | ')}"`);
        const allSearchResults = await Promise.all(searchTerms.map(term => searchFunction(term)));

        allSearchResults.flat().forEach(res => {
            // Deduplicar: Si es la misma tienda y el precio es similar, ignorar
            const key = `${res.store.toLowerCase()}_${Math.round(res.price / 10)}`;
            if (!finalResultsMap.has(key)) {
                finalResultsMap.set(key, res);
            }
        });

        let results = Array.from(finalResultsMap.values());

        // Ordenar por tiendas prioritarias
        results.sort((a, b) => {
            const scoreIndexA = priorityStores.findIndex(s => a.store.toLowerCase().includes(s.toLowerCase()));
            const scoreIndexB = priorityStores.findIndex(s => b.store.toLowerCase().includes(s.toLowerCase()));

            const scoreA = scoreIndexA === -1 ? 999 : scoreIndexA;
            const scoreB = scoreIndexB === -1 ? 999 : scoreIndexB;

            if (scoreA !== scoreB) return scoreA - scoreB;
            return a.price - b.price; // Ordenar por precio si son igual de prioritarios
        });

        await browser.close();
        return results.slice(0, 15);
    } catch (error) {
        console.error('❌ Radar Error:', error.message);
        if (browser) await browser.close();
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
