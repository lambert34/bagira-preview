'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const sharp = require('sharp');

const root = process.cwd();
const baseline = path.resolve(process.argv[2]);
const output = path.resolve(process.env.QA_OUTPUT || 'qa-mobile-review');
const mobileWidths = [320, 375, 393, 430, 767];
const widerWidths = [820, 1024, 1280, 1440];
const pages = ['', 'ohrana-doma/', 'ohrana-obektov/', 'fizicheskaya-ohrana/', 'trevozhnaya-knopka/', 'transportnaya-bezopasnost/'];
const sections = {
  hero: '.service-hero',
  highlights: '.service-hero__highlights',
  smartphone: '.service-application--smartphone-alarm',
  tariffs: '.service-pricing--tariffs-3',
  technologies: '.service-equipment__group:first-child',
  sensors: '.service-equipment__group:nth-child(2)',
  form: '#consultation',
};
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};
const report = { baseline: process.env.BASE_SHA || 'local', candidate: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), mobile: {}, wider: {}, forms: {}, errors: [] };

async function serve(directory) {
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const prefix = '/bagira-preview/';
      if (!pathname.startsWith(prefix)) throw Error('Route outside preview');
      let file = path.resolve(directory, pathname.slice(prefix.length));
      if (file !== directory && !file.startsWith(directory + path.sep)) throw Error('Route outside checkout');
      if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
      response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      response.end(await fs.readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: 'http://127.0.0.1:' + server.address().port };
}

async function open(browser, origin, route, width, motion = 'reduce') {
  const page = await browser.newPage({
    viewport: { width, height: 950 },
    hasTouch: width <= 767,
    isMobile: width <= 767,
    reducedMotion: motion,
  });
  page.on('pageerror', error => report.errors.push(route + ' ' + width + ': ' + error.message));
  await page.route('**/*', request => request.request().url().startsWith(origin + '/') ? request.continue() : request.abort());
  await page.goto(origin + '/bagira-preview/' + route);
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Warm the artwork consistently before the pixel comparison.
    await Promise.all([...document.images].map(image => {
      image.loading = 'eager';
      return image.decode().catch(() => {});
    }));
  });
  return page;
}

async function pixels(before, after) {
  const [a, b] = await Promise.all([before, after].map(buffer => sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
  const sameSize = a.info.width === b.info.width && a.info.height === b.info.height;
  if (!sameSize) return { sameSize, before: [a.info.width, a.info.height], after: [b.info.width, b.info.height] };
  let changedPixels = 0;
  let maxChannelDelta = 0;
  let brighterBluePixels = 0;
  for (let i = 0; i < a.data.length; i += 3) {
    const delta = Math.max(
      Math.abs(a.data[i] - b.data[i]),
      Math.abs(a.data[i + 1] - b.data[i + 1]),
      Math.abs(a.data[i + 2] - b.data[i + 2])
    );
    if (delta) changedPixels++;
    maxChannelDelta = Math.max(maxChannelDelta, delta);
    if (b.data[i + 2] - a.data[i + 2] > 4 && b.data[i + 2] > b.data[i] + 8) brighterBluePixels++;
  }
  return { sameSize, changedPixels, brighterBluePixels, maxChannelDelta, totalPixels: a.info.width * a.info.height };
}

// Chromium can round antialiased edges and translucent layers by one or two levels.
function sameRendering(comparison) {
  return comparison.sameSize && comparison.sameGeometry && comparison.maxChannelDelta <= 2;
}

async function snapshot(before, after, name, selector) {
  const capture = async (page, phase) => {
    const target = page.locator(selector);
    return target.screenshot({
      animations: 'disabled',
      path: path.join(output, phase, name + '.png'),
    });
  };
  const geometry = page => page.locator(selector).evaluate(el => {
    const { x, y, width, height } = el.getBoundingClientRect();
    return [x + window.scrollX, y + window.scrollY, width, height];
  });
  const [a, b] = await Promise.all([geometry(before), geometry(after)]);
  const diff = await pixels(await capture(before, 'BEFORE'), await capture(after, 'AFTER'));
  return { ...diff, sameGeometry: a.every((value, index) => Math.abs(value - b[index]) < .1) };
}

async function waitFor(page, test) {
  await page.waitForFunction(test, null, { timeout: 6000 });
}

async function verifyMobile(page, width) {
  const metrics = await page.evaluate(() => {
    const get = selector => document.querySelector(selector);
    const all = selector => [...document.querySelectorAll(selector)];
    const rect = e => e.getBoundingClientRect();
    const size = e => parseFloat(getComputedStyle(e).fontSize);
    const phone = get('.service-application__image');
    const equipment = get('.service-equipment__group:first-child');
    const sensors = all('.service-equipment__group:nth-child(2) .service-equipment__item');
    const tariffs = all('.service-tariff');
    return {
      pageWidth: document.documentElement.scrollWidth,
      highlights: all('.service-hero__highlights li').map(e => rect(e).height),
      applicationFeatures: all('.service-application__features li').map(e => e.innerText),
      phoneRatio: rect(phone).width / rect(phone.parentElement).width,
      appHeading: size(get('.service-application h2')),
      appBody: size(get('.service-application__text p')),
      tariffHeading: size(get('.service-pricing h2')),
      tariffLabels: all('.service-tariff__price-label').map(size),
      tariffs: tariffs.map(card => {
        const image = card.querySelector('.service-tariff__image');
        const panel = card.querySelector('.service-tariff__price-panel');
        const button = card.querySelector('.service-tariff__button');
        return {
          height: rect(card).height,
          photoTop: rect(image).top - rect(card).top,
          photoHeight: rect(image).height,
          overlap: rect(image).bottom - rect(panel).top,
          buttonGap: rect(card).bottom - rect(button).bottom,
          priceCount: card.querySelectorAll('.service-tariff__price-column').length,
        };
      }),
      technologiesHeading: size(equipment.querySelector('h2')),
      techDescriptionSize: size(equipment.querySelector('.service-equipment__item-text p')),
      firstOpen: equipment.querySelector('.service-equipment__flip-toggle').getAttribute('aria-pressed'),
      arrow: getComputedStyle(equipment.querySelector('.service-equipment__flip-toggle'), '::after').backgroundImage,
      sensors: sensors.map(card => [rect(card).x, rect(card).y, rect(card).width]),
    };
  });
  report.mobile[width] = metrics;
  assert.ok(metrics.pageWidth <= width + 1, width + ': no horizontal overflow');
  assert.equal(metrics.highlights.length, 3);
  assert.ok(Math.max(...metrics.highlights) - Math.min(...metrics.highlights) > 12, 'Natural highlight card heights');
  assert.equal(metrics.applicationFeatures.length, 6);
  assert.equal(new Set(metrics.applicationFeatures).size, 6);
  assert.ok(Math.abs(metrics.phoneRatio - .6) < .015);
  assert.equal(metrics.appHeading, 23);
  assert.equal(metrics.appBody, 14);
  assert.ok(metrics.tariffHeading >= 21 && metrics.tariffHeading <= 23);
  assert.deepEqual(metrics.tariffLabels, Array(6).fill(14));
  assert.equal(new Set(metrics.tariffs.map(card => Math.round(card.height))).size, 1);
  assert.ok(metrics.tariffs.every(card => card.photoTop <= 2 && card.overlap >= 28 && card.buttonGap <= 20 && card.priceCount === 2));
  assert.ok(metrics.tariffs[1].photoHeight < metrics.tariffs[0].photoHeight);
  assert.equal(metrics.technologiesHeading, 23);
  assert.equal(metrics.techDescriptionSize, 14);
  assert.equal(metrics.firstOpen, 'true');
  assert.match(metrics.arrow, /equipment-flip\.svg/);
  assert.equal(metrics.sensors.length, 4);
  assert.equal(new Set(metrics.sensors.map(card => card[0])).size, 1);
  assert.equal(new Set(metrics.sensors.map(card => card[1])).size, 4);
}

async function verifyInteractions(page) {
  const highlights = page.locator(sections.highlights);
  const smartphone = page.locator('.service-application__features');
  const nextTop = () => page.locator(sections.smartphone).evaluate(el => el.offsetTop);
  const initialTop = await nextTop();
  await highlights.press('ArrowRight');
  await waitFor(page, () => document.querySelector('.service-hero__highlights').scrollLeft > 100);
  assert.equal(await nextTop(), initialTop, 'Highlight scroll must not move the next section');
  await smartphone.press('End');
  for (let i = 0; i < 5; i++) await smartphone.press('ArrowRight');
  await waitFor(page, () => {
    const list = document.querySelector('.service-application__features');
    return list.scrollLeft >= list.scrollWidth - list.clientWidth - 2;
  });
  const dots = page.locator('[data-tariff-index]');
  for (const index of [1, 2, 0]) {
    await dots.nth(index).click();
    await page.waitForFunction(index => document.querySelector('[data-tariff-index="' + index + '"]').getAttribute('aria-pressed') === 'true', index, { timeout: 6000 });
  }
  const technologies = page.locator(sections.technologies);
  const first = technologies.locator('.service-equipment__flip-toggle').first();
  await first.press('Enter');
  assert.equal(await first.getAttribute('aria-pressed'), 'false');
  await first.press('Space');
  assert.equal(await first.getAttribute('aria-pressed'), 'true');
  const reveal = technologies.locator('.service-equipment__more');
  await reveal.click();
  assert.equal(await reveal.getAttribute('aria-expanded'), 'true');
  assert.ok(await technologies.locator('.service-equipment__item').last().isVisible());
  await reveal.click();
  assert.equal(await reveal.getAttribute('aria-expanded'), 'false');
  const sensors = page.locator(sections.sensors);
  for (const toggle of await sensors.locator('.service-equipment__flip-toggle').all()) {
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    const description = page.locator('#' + await toggle.getAttribute('aria-controls'));
    assert.equal(await description.getAttribute('aria-hidden'), 'false');
    const text = description.locator('.service-equipment__item-text');
    assert.ok(await text.isVisible());
    const bounds = await text.boundingBox();
    const card = await toggle.boundingBox();
    assert.ok(bounds.y >= card.y - 1 && bounds.y + bounds.height <= card.y + card.height + 1, 'Sensor text fits card');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  }
}

async function verifyForms(browser, before, after) {
  for (const route of pages) {
    const a = await open(browser, before, route, 393);
    const b = await open(browser, after, route, 393);
    try {
      const name = route.replace('/', '') || 'home';
      const form = b.locator('#consultation form');
      const glow = await b.locator('#consultation > .consultation__panel').evaluate(el => {
        const layer = getComputedStyle(el, '::after');
        return { width: parseFloat(layer.width), image: layer.backgroundImage, events: layer.pointerEvents };
      });
      assert.match(glow.image, /form-mobile\.svg/);
      assert.ok(glow.width > 100 && glow.events === 'none');
      const comparison = await snapshot(a, b, '393-form-' + name, sections.form);
      assert.ok(comparison.sameSize && comparison.brighterBluePixels > 100, 'Visible form glow: ' + name);
      const phone = form.locator('[name="phone"]');
      const email = form.locator('[name="email"]');
      await phone.pressSequentially('8 (900) 123-45-67');
      assert.equal(await phone.inputValue(), '89001234567', name + ': phone field accepts digits');
      await email.fill('preview@example.test');
      assert.equal(await form.evaluate(el => el.checkValidity()), false);
      await form.locator('label.consent:has([name="consent"]) .consent__box').click();
      assert.equal(await form.locator('[name="consent"]').isChecked(), true);
      assert.equal(await form.evaluate(el => el.checkValidity()), true);
      const submissions = [];
      b.on('request', request => { if (request.method() === 'POST') submissions.push(request.url()); });
      await form.locator('button[type="submit"]').click();
      assert.deepEqual(submissions, []);
      report.forms[name] = comparison;
      const wideA = await open(browser, before, route, 1280);
      const wideB = await open(browser, after, route, 1280);
      try {
        const wide = await snapshot(wideA, wideB, '1280-form-' + name, sections.form);
        assert.ok(sameRendering(wide), 'Desktop form unchanged: ' + name);
      } finally {
        await wideA.close();
        await wideB.close();
      }
    } finally {
      await a.close();
      await b.close();
    }
  }
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const before = await serve(baseline);
  const after = await serve(root);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const changed = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACM', process.env.BASE_SHA || 'HEAD'], { encoding: 'utf8' }).trim().split('\n');
    assert.ok(!changed.some(file => /\.(?:png|jpe?g|gif|bmp|avif|ico)$/i.test(file) && !file.startsWith('.github/')));
    for (const width of [...mobileWidths, ...widerWidths]) {
      const a = await open(browser, before.origin, 'ohrana-doma/', width);
      const b = await open(browser, after.origin, 'ohrana-doma/', width);
      try {
        if (width <= 767) {
          await verifyMobile(b, width);
          const hero = await snapshot(a, b, width + '-hero', '.service-hero__inner');
          report.mobile[width].hero = hero;
          assert.ok(hero.sameSize && hero.brighterBluePixels > 100, 'Visible V47B glow: ' + width);
          if (width === 393) {
            for (const [name, selector] of Object.entries(sections).filter(([name]) => !['hero', 'form'].includes(name))) {
              await snapshot(a, b, width + '-' + name, selector);
            }
            const header = await snapshot(a, b, '393-header', '.site-header');
            assert.ok(sameRendering(header), 'Approved mobile header');
            await verifyInteractions(b);
          }
        } else {
          const stableSections = { header: '.site-header', ...sections, footer: '.site-footer' };
          report.wider[width] = {};
          for (const [name, selector] of Object.entries(stableSections)) {
            const result = await snapshot(a, b, width + '-' + name, selector);
            report.wider[width][name] = result;
            assert.ok(sameRendering(result), width + ' ' + name + ': tablet and desktop must match baseline');
          }
        }
      } finally {
        await a.close();
        await b.close();
      }
    }
    const autoplay = await open(browser, after.origin, 'ohrana-doma/', 393, 'no-preference');
    try {
      await autoplay.locator(sections.smartphone).scrollIntoViewIfNeeded();
      await waitFor(autoplay, () => document.querySelector('.service-application__features').scrollLeft > 50);
    } finally {
      await autoplay.close();
    }
    await verifyForms(browser, before.origin, after.origin);
    assert.deepEqual(report.errors, []);
    report.status = 'PASS';
  } finally {
    await browser.close();
    before.server.close();
    after.server.close();
  }
}

main().catch(error => {
  report.status = 'FAIL';
  report.errors.push(error.stack);
  process.exitCode = 1;
}).finally(async () => {
  await fs.writeFile(path.join(output, 'REPORT.json'), JSON.stringify(report, null, 2));
  const pairs = (await fs.readdir(path.join(output, 'AFTER')).catch(() => []))
    .filter(name => /^[a-z0-9-]+\.png$/.test(name))
    .sort((a, b) => Number(!a.startsWith('393')) - Number(!b.startsWith('393')) || a.localeCompare(b));
  await fs.writeFile(path.join(output, '00_OPEN_COMPARE.html'), `<!doctype html>
<html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Багира — мобильные правки</title>
<style>body{font:16px system-ui;background:#141620;color:#fff;max-width:1250px;margin:auto;padding:20px}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}article{min-width:0}img{max-width:100%;height:auto}h2{font-size:18px}section{margin-bottom:30px}</style>
<h1>Багира — мобильные правки</h1><p>Chromium QA: ${report.status ?? 'FAIL'}</p>
${pairs.map(name => `<section><h2>${name.replace('.png', '')}</h2><main><article><p>До</p><a href="BEFORE/${name}"><img loading="lazy" src="BEFORE/${name}" alt="До"></a></article><article><p>После</p><a href="AFTER/${name}"><img loading="lazy" src="AFTER/${name}" alt="После"></a></article></main></section>`).join('')}
</html>`);
  console.log(JSON.stringify({ status: report.status, errors: report.errors }));
});
