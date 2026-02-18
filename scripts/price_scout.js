const puppeteer = require('puppeteer');

async function scoutPrice(model, name = "") {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080'
        ]
    });
    const page = await browser.newPage();

    // Fingerprint más humano
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // Mejorar la limpieza del ID: HPCE400X -> CE400X
    // Intentamos separar marca de código: LX-74 -> 74
    const cleanId = model.replace(/^(HP|LX|BR|brother|CANON|EPSON|SAMSUNG)+/i, '');
    const spacedId = model.replace(/([A-Z]+)(\d+)/, '$1 $2'); // HPCE400X -> HPCE 400X

    const searchTerms = [
        spacedId,
        cleanId.length > 2 ? cleanId : null,
        name,
        model
    ].filter(t => t && t.length > 2);

    let finalResultsMap = new Map();

    // Tiendas prioritarias en México
    const priorityStores = ['CAD Toner', 'PCEL', 'Cyberpuerta', 'Abasteo', 'Amazon', 'Mercado Libre', 'Office Depot', 'Walmart', 'Zegucom', 'Intercompras', 'Claro Shop'];

    try {
        for (const term of searchTerms) {
            if (finalResultsMap.size >= 5) break;

            console.log(`📡 Radar: Escaneando "${term}"...`);
            const query = encodeURIComponent(`toner ${term} precio mexico`);

            // Intentar Shopping primero
            await page.goto(`https://www.google.com/search?q=${query}&tbm=shop&hl=es-MX`, { waitUntil: 'networkidle2', timeout: 30000 });

            let shopResults = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('.sh-dgr__content, .sh-np__click-target, .iXEZd, .sh-dlr__list-result'));
                return items.map(item => {
                    const titleEl = item.querySelector('h3, .ns7Aue, .tAx79b, .DEbx9b');
                    const priceTextEl = item.querySelector('.a893u, .XP1PBe, .kH9S7e, .OFFNJ, .Vne7u');
                    const storeEl = item.querySelector('.aULzUe, .I663ec, .vS779c, .ByU4id, .m09pAb');
                    const linkEl = item.querySelector('a');

                    if (!titleEl || !priceTextEl) return null;

                    const title = titleEl.innerText;
                    const priceText = priceTextEl.innerText;
                    const store = storeEl?.innerText || "Tienda Online";
                    const url = linkEl ? (linkEl.href.startsWith('http') ? linkEl.href : 'https://www.google.com' + linkEl.getAttribute('href')) : '';
                    const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
                    return { title, priceText, store, price, url };
                }).filter(i => i && i.price > 300);
            });

            // Si falla Shopping o hay pocos, probar búsqueda regular
            let webResults = [];
            if (shopResults.length < 3) {
                await page.goto(`https://www.google.com/search?q=${query}&hl=es-MX`, { waitUntil: 'networkidle2' });
                webResults = await page.evaluate(() => {
                    const containers = Array.from(document.querySelectorAll('.g, .v7W49e > div, .Sr66ed, .tF2Cxc'));
                    return containers.map(s => {
                        const titleEl = s.querySelector('h3');
                        const linkEl = s.querySelector('a');
                        const citeEl = s.querySelector('cite');
                        const text = s.innerText;

                        const match = text.match(/\$\s?[\d,]+(\.\d+)?/);
                        if (!titleEl || !match || !linkEl) return null;

                        // Identificar la tienda
                        let detectedStore = "Web";
                        const domain = linkEl.href.toLowerCase();

                        if (domain.includes('amazon')) detectedStore = "Amazon";
                        else if (domain.includes('mercadolibre')) detectedStore = "Mercado Libre";
                        else if (domain.includes('cyberpuerta')) detectedStore = "Cyberpuerta";
                        else if (domain.includes('abasteo')) detectedStore = "Abasteo";
                        else if (domain.includes('cadtoner')) detectedStore = "CAD Toner";
                        else if (domain.includes('pcel')) detectedStore = "PCEL";
                        else if (domain.includes('intercompras')) detectedStore = "Intercompras";
                        else if (domain.includes('zegucom')) detectedStore = "Zegucom";
                        else if (domain.includes('officedepot')) detectedStore = "Office Depot";
                        else if (domain.includes('walmart')) detectedStore = "Walmart";
                        else if (domain.includes('tonermexico')) detectedStore = "Toner México";
                        else if (domain.includes('pcstore')) detectedStore = "PC Store";
                        else if (citeEl) {
                            // Limpieza profunda: https://www.pcstore.com.mx -> PCSTORE
                            let raw = citeEl.innerText.split(' › ')[0].trim();
                            // Quitar protocolo y www
                            raw = raw.replace(/^(https?:\/\/)?(www\.)?/, '');
                            // Tomar solo el nombre antes del primer punto
                            let namePart = raw.split('.')[0];
                            if (namePart.toLowerCase() === 'www' && raw.split('.')[1]) {
                                namePart = raw.split('.')[1];
                            }
                            detectedStore = namePart.charAt(0).toUpperCase() + namePart.slice(1);
                        } else {
                            // Si no hay cite, intentar con el href
                            const host = new URL(linkEl.href).hostname.replace('www.', '').split('.')[0];
                            detectedStore = host.charAt(0).toUpperCase() + host.slice(1);
                        }

                        return {
                            title: titleEl.innerText.substring(0, 60),
                            priceText: match[0],
                            store: detectedStore,
                            price: parseFloat(match[0].replace(/[^0-9.]/g, '')),
                            url: linkEl.href
                        };
                    }).filter(i => i && i.price > 300);
                });
            }

            // Mezclar y Guardar (Evitando duplicados por título similar)
            [...shopResults, ...webResults].forEach(res => {
                const key = res.title.substring(0, 30).toLowerCase();
                if (!finalResultsMap.has(key)) {
                    finalResultsMap.set(key, res);
                }
            });
        }

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
        return results.slice(0, 8);
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
