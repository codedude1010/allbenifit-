const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();

chromium.use(stealth);

// --- Config ---
const TARGET_URL = "https://youtu.be/gNcXZZNoSto";
const ENGINES = [
  { name: "ecosia",   url: "https://www.ecosia.org/search?q=" },
  { name: "yahoo",    url: "https://search.yahoo.com/search?p=" },
  { name: "startpage",url: "https://www.startpage.com/sp/search?query=" },
  { name: "yandex",   url: "https://yandex.com/search/?text=" },
  { name: "duckduckgo",url: "https://duckduckgo.com/?q=" },
  { name: "google",   url: "https://www.google.com/search?q=" },
  { name: "swisscows",url: "https://swisscows.com/en/web?query=" }
];

const SEARCH_QUERIES = [
  "how+to+get+all+benefits",
  "benefits+of+online+services",
  "youtube+video+gNcXZZNoSto",
  "all+benefits+guide"
];

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 }
];

// --- Helpers ---
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[randInt(0, arr.length - 1)];

function bezierPoint(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

async function humanMouseMove(page, x0, y0, x1, y1) {
  const steps = randInt(30, 60);
  const cx1 = x0 + (x1 - x0) * rand(0.2, 0.4) + rand(-50, 50);
  const cy1 = y0 + (y1 - y0) * rand(0.1, 0.3) + rand(-40, 40);
  const cx2 = x0 + (x1 - x0) * rand(0.6, 0.8) + rand(-50, 50);
  const cy2 = y0 + (y1 - y0) * rand(0.7, 0.9) + rand(-40, 40);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mx = bezierPoint(t, x0, cx1, cx2, x1);
    const my = bezierPoint(t, y0, cy1, cy2, y1);
    await page.mouse.move(mx, my);
    await sleep(rand(5, 15));
  }
}

async function randomPause(page) {
    if (Math.random() < 0.3) {
        const pauseTime = rand(5000, 15000);
        log(`      ⏸ Random pause: ${Math.round(pauseTime/1000)}s`);
        await sleep(pauseTime);
    }
}

async function skipAds(page) {
    try {
        const skipBtn = await page.$(".ytp-skip-ad-button, .ytp-ad-skip-button-hover");
        if (skipBtn) {
            log("      ⏭ Ad skip button found!");
            await sleep(rand(2000, 4000)); // Wait a bit before skipping
            const box = await skipBtn.boundingBox();
            if (box) {
                const cur = await page.evaluate(() => ({ x: window.innerWidth/2, y: window.innerHeight/2 }));
                await humanMouseMove(page, cur.x, cur.y, box.x + box.width/2, box.y + box.height/2);
                await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
                log("      ✅ Ad skipped");
            }
        }
    } catch (e) {}
}

function log(msg, engineName = "") {
  const ts = new Date().toISOString().substring(11, 19);
  const prefix = engineName ? `[${engineName.toUpperCase()}] ` : "";
  console.log(`[${ts}] ${prefix}${msg}`);
}

async function runFlow(engine) {
    const ua = pick(USER_AGENTS);
    const viewport = pick(VIEWPORTS);
    const query = pick(SEARCH_QUERIES);
    const referrer = engine.url + query;

    log(`Starting flow for ${engine.name}`, engine.name);
    
    const isHeadless = process.env.HEADLESS === "true";
    const browser = await chromium.launch({ 
        headless: isHeadless, 
        args: ["--disable-blink-features=AutomationControlled"] 
    });
    
    const context = await browser.newContext({
        userAgent: ua,
        viewport,
        extraHTTPHeaders: { 'Referer': referrer }
    });

    const page = await context.newPage();

    try {
        log(`Navigating to target video`, engine.name);
        await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
        
        // Wait for video player
        await page.waitForSelector(".html5-video-player");
        
        // Handle play if needed
        const playBtn = await page.$(".ytp-large-play-button");
        if (playBtn) {
            await sleep(rand(2000, 4000));
            await playBtn.click();
            log("Clicking play button", engine.name);
        }

        // Get video duration
        let duration = await page.evaluate(() => {
            const video = document.querySelector("video");
            return video ? video.duration : 0;
        });

        if (duration === 0) {
            log("Could not detect duration, waiting 5 minutes", engine.name);
            duration = 300; 
        } else {
            log(`Video duration: ${Math.round(duration)}s`, engine.name);
        }

        // Watch loop
        let elapsed = 0;
        while (elapsed < duration) {
            await skipAds(page);
            await randomPause(page);
            
            // Random mouse movement
            if (Math.random() < 0.2) {
                const rx = rand(100, viewport.width - 100);
                const ry = rand(100, viewport.height - 100);
                const cur = await page.evaluate(() => ({ x: window.innerWidth/2, y: window.innerHeight/2 }));
                await humanMouseMove(page, cur.x, cur.y, rx, ry);
            }

            await sleep(10000); // Check every 10 seconds
            elapsed += 10;
            
            // Re-check duration in case it was 0 initially
            if (duration === 300) {
                const newDuration = await page.evaluate(() => {
                    const video = document.querySelector("video");
                    return video ? video.duration : 0;
                });
                if (newDuration > 0) duration = newDuration;
            }
        }

        log(`Finished watching video`, engine.name);
    } catch (err) {
        log(`Error: ${err.message}`, engine.name);
    } finally {
        await browser.close();
    }
}

async function main() {
    log("🚀 Starting parallel YouTube watch time bot...");
    while (true) {
        const tasks = ENGINES.map(engine => runFlow(engine));
        await Promise.all(tasks);
        log("🔄 All parallel flows completed. Waiting 30s before restart...");
        await sleep(30000);
    }
}

main();
