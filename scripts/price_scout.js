const puppeteer = require('puppeteer');

async function scoutPrice(model, name = "") {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Intentar limpiar el ID (quitar prefijos como HP, LX, BR, etc.)
    const cleanId = model.replace(/^[A-Z]{1,4}(?=\d)/, ''); // Quita letras iniciales si van seguidas de números

    // Lista de términos a probar en orden de "relevancia"
    const searchTerms = [
        model,
        cleanId !== model ? cleanId : null,
        name
    ].filter(t => t && t.length > 2);

    let finalResults = [];

    try {
        for (const term of searchTerms) {
            console.log(`🔍 Radar: Intentando con "${term}"...`);
            const query = encodeURIComponent(`toner ${term} precio mexico`);

            // Probar primero Shopping
            await page.goto(`https://www.google.com/search?q=${query}&tbm=shop&hl=es-419`, { waitUntil: 'domcontentloaded' });
            await new Promise(r => setTimeout(r, 1000));

            let results = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('.sh-dgr__content, .sh-np__click-target, .iXEZd'));
                return items.slice(0, 5).map(item => {
                    const title = item.querySelector('h3, .ns7Aue, .tAx79b')?.innerText;
                    const priceText = item.querySelector('.a893u, .XP1PBe, .kH9S7e, .OFFNJ')?.innerText;
                    const store = item.querySelector('.aULzUe, .I663ec, .vS779c')?.innerText;
                    if (!title || !priceText) return null;
                    const priceNumbers = priceText.replace(/[^0-9.]/g, '');
                    return { title, priceText, store: store || "Tienda Online", price: parseFloat(priceNumbers) };
                }).filter(i => i && i.price > 0);
            });

            // Si falla Shopping, probar búsqueda regular
            if (results.length === 0) {
                await page.goto(`https://www.google.com/search?q=${query}&hl=es-419`, { waitUntil: 'domcontentloaded' });
                await new Promise(r => setTimeout(r, 1000));
                results = await page.evaluate(() => {
                    const snippets = Array.from(document.querySelectorAll('.g, .v7W49e > div'));
                    return snippets.slice(0, 5).map(s => {
                        const title = s.querySelector('h3')?.innerText;
                        const text = s.innerText;
                        const match = text.match(/\$\s?[\d,]+(\.\d+)?/);
                        if (!title || !match) return null;
                        return { title: title.substring(0, 50), priceText: match[0], store: "Web", price: parseFloat(match[0].replace(/[^0-9.]/g, '')) };
                    }).filter(i => i && i.price > 0);
                });
            }

            if (results.length > 0) {
                finalResults = results;
                break; // Si encontramos resultados con un término, paramos
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
