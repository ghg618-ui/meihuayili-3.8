const puppeteer = require("puppeteer");
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Listen for console errors
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log(`BROWSER ERROR: ${msg.text()}`);
        }
    });

    try {
        await page.goto("file:///Users/gong-ai/梅花易数起卦/index.html");
        await page.waitForTimeout(500);

        // check if login modal is visible, login if needed
        const authName = await page.$('#auth-username');
        if (authName) {
            const isVisible = await authName.evaluate(el => {
                return window.getComputedStyle(el.closest('#modal-auth')).display !== 'none';
            });
            if (isVisible) {
                await page.fill('#auth-username', 'testuser');
                await page.fill('#auth-password', 'test1234');
                await page.click('#btn-auth-submit');
                await page.waitForTimeout(500);
            }
        }

        // Just click on the first history item!
        console.log("Looking for history items...");
        const historyItems = await page.$$('.history-item');
        if (historyItems.length > 0) {
            console.log(`Found ${historyItems.length} history items. Clicking the first one.`);
            await historyItems[0].click();
            await page.waitForTimeout(500);
        } else {
            console.log("No history items found. Need to cast first.");
            await page.click('.btn-cast-action'); // Cast by time
            await page.waitForTimeout(2000); // give it some time
            const historyItemsNow = await page.$$('.history-item');
            if (historyItemsNow.length > 0) {
                console.log("Clicking history item after cast.");
                await historyItemsNow[0].click();
                await page.waitForTimeout(500);
            }
        }

    } catch (e) {
        console.error("Puppeteer Error:", e);
    }
    await browser.close();
})();
