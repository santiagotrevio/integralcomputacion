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

    let finalResults = [];

    try {
        for (const term of searchTerms) {
            console.log(`📡 Radar: Escaneando "${term}"...`);
            const query = encodeURIComponent(`toner ${term} precio mexico`);

            // Intentar Shopping primero
            await page.goto(`https://www.google.com/search?q=${query}&tbm=shop&hl=es-MX`, { waitUntil: 'networkidle2', timeout: 30000 });

            let results = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('.sh-dgr__content, .sh-np__click-target, .iXEZd, .sh-dlr__list-result'));
                return items.slice(0, 6).map(item => {
                    const titleEl = item.querySelector('h3, .ns7Aue, .tAx79b, .DEbx9b');
                    const priceTextEl = item.querySelector('.a893u, .XP1PBe, .kH9S7e, .OFFNJ, .Vne7u');
                    const storeEl = item.querySelector('.aULzUe, .I663ec, .vS779c, .ByU4id');
                    const linkEl = item.querySelector('a');

                    if (!titleEl || !priceTextEl) return null;

                    const title = titleEl.innerText;
                    const priceText = priceTextEl.innerText;
                    const store = storeEl?.innerText || "Tienda Online";
                    const url = linkEl ? (linkEl.href.startsWith('http') ? linkEl.href : 'https://www.google.com' + linkEl.getAttribute('href')) : '';

                    const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
                    return { title, priceText, store, price, url };
                }).filter(i => i && i.price > 50);
            });

            // Si Shopping no da nada, búsqueda regular con selectores más amplios
            if (results.length === 0) {
                await page.goto(`https://www.google.com/search?q=${query}&hl=es-MX`, { waitUntil: 'networkidle2' });
                results = await page.evaluate(() => {
                    const selectors = ['.g', '.v7W49e > div', '.Sr66ed', '.tF2Cxc'];
                    let containers = [];
                    selectors.forEach(s => {
                        const found = Array.from(document.querySelectorAll(s));
                        if (found.length > containers.length) containers = found;
                    });

                    return containers.slice(0, 5).map(s => {
                        const titleEl = s.querySelector('h3');
                        const linkEl = s.querySelector('a');
                        const text = s.innerText;
                        // Buscar patrón de precio: $1,200 o 1,200.00
                        const match = text.match(/\$\s?[\d,]+(\.\d+)?/);
                        if (!titleEl || !match || !linkEl) return null;
                        return {
                            title: titleEl.innerText.substring(0, 60),
                            priceText: match[0],
                            store: "Web",
                            price: parseFloat(match[0].replace(/[^0-9.]/g, '')),
                            url: linkEl.href
                        };
                    }).filter(i => i && i.price > 100);
                });
            }

            if (results.length > 0) {
                finalResults = results;
                break;
            }
        }

        await browser.close();
        return finalResults;
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
