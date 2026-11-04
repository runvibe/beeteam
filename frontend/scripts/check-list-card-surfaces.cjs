// Read-only browser regression check against a built frontend and a running API.
// Requires Playwright via QA_PLAYWRIGHT_MODULE and QA_BROWSER_EXECUTABLE.
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const baselineOnly = process.argv.includes('--baseline');
  const root = path.resolve('frontend/dist');
  const output = path.resolve('.local/qa/codex-list-surfaces');
  const api = process.env.QA_API_URL || 'http://127.0.0.1:59865';
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true, executablePath: process.env.QA_BROWSER_EXECUTABLE,
  });
  const evidence = [];
  try {
    for (const width of [1440, 390]) {
      for (const mode of ['light', 'dark']) {
        for (const preset of ['default', 'codex', 'claude-code', 'copilot']) {
          const context = await browser.newContext({ viewport: { width, height: 1000 } });
          await context.addInitScript(({ mode, preset }) => {
            localStorage.setItem('bee-locale', 'pt');
            localStorage.setItem('beeteam.theme', mode);
            localStorage.setItem('beeteam.palette', preset);
          }, { mode, preset });
          const page = await context.newPage();
          await page.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.pathname.startsWith('/api/')) {
              if (route.request().method() !== 'GET' || url.pathname.includes('/changes')) return route.abort();
              const response = await context.request.get(api + url.pathname + url.search);
              return route.fulfill({ status: response.status(), body: await response.body(), contentType: 'application/json' });
            }
            const file = path.join(root, path.extname(url.pathname) ? decodeURIComponent(url.pathname) : 'index.html');
            if (!file.startsWith(root + path.sep)) return route.abort();
            try {
              return route.fulfill({ body: await fs.readFile(file), contentType: ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream' });
            } catch { return route.fulfill({ status: 404, body: '' }); }
          });
          let boardPath = process.env.QA_BOARD_PATH;
          for (const routePath of ['/boards', '/teams', '/agents', 'kanban']) {
            const isKanban = routePath === 'kanban';
            await page.goto('http://bee-qa.invalid' + (isKanban ? boardPath : routePath));
            const selector = isKanban ? '.task-card' : '.balanced-card-grid .board-card';
            await page.locator(selector).first().waitFor();
            if (routePath === '/boards' && !boardPath) boardPath = await page.locator('.board-card-link').first().getAttribute('href');
            await page.waitForTimeout(300);
            const styles = await page.evaluate(selector => {
              const probe = document.createElement('span');
              probe.style.backgroundColor = 'var(--secondary)';
              document.body.append(probe);
              const secondary = getComputedStyle(probe).backgroundColor;
              probe.remove();
              return {
                page: getComputedStyle(document.body).backgroundColor,
                secondary,
                cards: [...document.querySelectorAll(selector)].map(el => ({
                  background: getComputedStyle(el).backgroundColor,
                  color: getComputedStyle(el).color,
                })),
                overflow: document.documentElement.scrollWidth > innerWidth,
              };
            }, selector);
            assert(styles.cards.length > 0);
            if (!baselineOnly && preset === 'codex' && !isKanban) {
              for (const card of styles.cards) assert.equal(card.background, styles.secondary);
              assert.equal(styles.page, mode === 'light' ? 'rgb(255, 255, 255)' : 'rgb(24, 24, 24)');
            }
            evidence.push({ width, mode, preset, route: routePath, ...styles });
            if (!baselineOnly && preset === 'codex') await page.screenshot({ path: path.join(output, `${width}-${mode}-${routePath.replace('/', '')}.png`) });
          }
          await page.unrouteAll({ behavior: 'ignoreErrors' });
          await context.close();
        }
      }
    }
    if (!baselineOnly) {
      const baseline = JSON.parse(await fs.readFile(path.join(output, 'baseline.json'), 'utf8'));
      assert.equal(evidence.length, baseline.length);
      evidence.forEach((row, index) => {
        const before = baseline[index];
        assert.equal(row.page, before.page, 'Page surface changed');
        assert.equal(row.overflow, before.overflow, 'Overflow changed');
        if (row.preset !== 'codex' || row.route === 'kanban') assert.deepEqual(row, before);
        else assert.deepEqual(row.cards.map(c => c.color), before.cards.map(c => c.color));
      });
    }
    await fs.writeFile(path.join(output, baselineOnly ? 'baseline.json' : 'evidence.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ baselineOnly, cases: evidence.length, passed: true }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
