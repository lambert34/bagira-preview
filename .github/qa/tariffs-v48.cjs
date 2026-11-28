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

async function capture(page, phase, name, selector) {
  const target = page.locator(selector);
  await target.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return target.screenshot({ animations: 'disabled', path: path.join(output, phase, name + '.png') });
}

async function snapshot(before, after, name, selector) {
  const geometry = page => page.locator(selector).evaluate(el => {
    const { x, y, width, height } = el.getBoundingClientRect();
    return [x + window.scrollX, y + window.scrollY, width, height];
  });
  const [a, b] = await Promise.all([geometry(before), geometry(after)]);
  const diff = await pixels(await capture(before, 'BEFORE', name, selector), await capture(after, 'AFTER', name, selector));
  return { ...diff, sameGeometry: a.every((value, index) => Math.abs(value - b[index]) < .1) };
}

async function waitFor(page, test) {
  await page.waitForFunction(test, null, { timeout: 6000 });
}


const failures=[];
const test=(ok,msg)=>{if(!ok)failures.push(msg)};
const near=(a,b,t=.6)=>Math.abs(a-b)<=t;
async function metrics(page) {
 return page.locator(sections.tariffs).evaluate(section=>{
  const q=(e,s)=>e.querySelector(s), rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom}}, style=e=>{const s=getComputedStyle(e);return {family:s.fontFamily,size:parseFloat(s.fontSize),weight:s.fontWeight,line:parseFloat(s.lineHeight),spacing:s.letterSpacing,padding:parseFloat(s.paddingLeft),radius:parseFloat(s.borderTopLeftRadius)}};
  const grid=q(section,'.service-pricing__grid'), heading=q(section,'h2'), dots=q(section,'.service-pricing__mobile-pagination');
  return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,grid:rect(grid),heading:{...style(heading),...rect(heading)},dots:rect(dots),cards:[...grid.querySelectorAll('.service-tariff')].map(card=>{
   const image=q(card,'.service-tariff__image'),img=q(image,'img'),panel=q(card,'.service-tariff__price-panel'),button=q(card,'.service-tariff__button'),title=q(card,'h3'),desc=q(card,'.service-tariff__details-description'),h4=q(card,'h4'),label=q(card,'.service-tariff__price-label'),price=q(card,'.service-tariff__price strong');
   return {card:rect(card),image:rect(image),panel:rect(panel),button:rect(button),title:rect(title),titleStyle:style(title),panelStyle:style(panel),buttonStyle:style(button),label:style(label),price:price?style(price):null,desc:style(desc),descRect:rect(desc),h4:h4?style(h4):null,items:[...card.querySelectorAll('.service-tariff__details li')].map(e=>({...rect(e),...style(e)})),overlap:rect(image).b-rect(panel).y,fit:getComputedStyle(img).objectFit,loaded:img.naturalWidth>0,buttonGap:rect(card).b-rect(button).b,photoVisible:rect(panel).y-rect(image).y,panelScroll:panel.scrollWidth,panelClient:panel.clientWidth};
  })};
 });
}
async function slide(page,index){
 const dot=page.locator('[data-tariff-index]').nth(index);
 await dot.click();
 await page.waitForFunction(i=>document.querySelector('[data-tariff-index="'+i+'"]').getAttribute('aria-pressed')==='true',index,{timeout:6000});
 await page.waitForTimeout(100);
}
async function main(){
 await fs.mkdir(output,{recursive:true});
 const a=await serve(baseline),b=await serve(root),browser=await chromium.launch();
 try {
  const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
  test(files.filter(f=>/\.webp$/i.test(f)).length===119&&!files.some(f=>/\.(png|jpe?g|gif|bmp|avif|tiff?)$/i.test(f)),'Raster standard');
  for(const w of [...mobileWidths,...widerWidths]){
   const p=await open(browser,a.origin,'ohrana-doma/',w),n=await open(browser,b.origin,'ohrana-doma/',w);
   try {
    if(w<=767){
     const m=await metrics(n);report.mobile[w]=m;
     test(m.scrollWidth<=w+1,w+' horizontal overflow');
     test(m.cards.length===3,w+' three cards');
     test(near(m.heading.size,23)&&near(m.heading.line,25.3),w+' heading');
     const h=m.cards[0].card.h;
     for(const [i,c] of m.cards.entries()){
      const k=w+' card '+(i+1);
      test(near(c.card.w,Math.min(w*.8,340)),k+' width');
      test(near(c.card.h,h),k+' shared height');
      test(near(c.overlap,66),k+' 66px overlap');
      test(near(c.panelStyle.padding,15)&&near(c.panelStyle.radius,20),k+' panel geometry');
      test(near(c.titleStyle.size,20)&&c.titleStyle.weight==='700',k+' title');
      test(near(c.label.size,16)&&c.label.weight==='400',k+' label');
      test(!c.price||(near(c.price.size,25)&&c.price.weight==='500'),k+' price');
      test(near(c.desc.size,14)&&near(c.desc.line,17.066)&&c.desc.weight==='400',k+' description');
      test(!c.h4||(near(c.h4.size,16)&&c.h4.weight==='700'),k+' h4');
      test(c.items.every(x=>near(x.size,14)&&x.weight==='400'),k+' list font');
      test(near(c.button.h,40)&&near(c.buttonStyle.size,16)&&c.buttonStyle.weight==='600'&&near(c.buttonGap,15),k+' button');
      test(c.photoVisible>=75&&c.loaded&&c.fit==='cover',k+' photo focus space');
      test(c.panelScroll<=c.panelClient+1,k+' panel overflow');
      test(c.title.b<=c.panel.y,k+' title above panel');
     }
     test(m.cards[1].image.h<m.cards[0].image.h,w+' longer basic list uses shorter photo');
     for(let i=0;i<3;i++){await slide(p,i);await slide(n,i);await capture(p,'BEFORE',w+'-tariffs-'+(i+1),sections.tariffs);await capture(n,'AFTER',w+'-tariffs-'+(i+1),sections.tariffs);}
     for(const sel of ['.site-header',sections.hero,sections.smartphone,sections.technologies,sections.sensors,sections.form]){
      const key=sel.replace(/[^a-z0-9]+/gi,'-');
      const d=await pixels(await capture(p,'BEFORE',w+'-stable-'+key,sel),await capture(n,'AFTER',w+'-stable-'+key,sel));
      test(d.sameSize&&d.maxChannelDelta<=2,w+' untouched '+sel);
     }
    } else {
     report.wider[w]={};
     for(const [key,sel] of Object.entries({header:'.site-header',...sections,footer:'.site-footer'})){
      const d=await snapshot(p,n,w+'-'+key,sel);report.wider[w][key]=d;test(sameRendering(d),w+' desktop/tablet '+key);
     }
    }
   }finally{await p.close();await n.close();}
   console.log(w+' complete');
  }
  test(!report.errors.length,'Browser errors');
  report.failures=failures;report.status=failures.length?'REVIEW_REQUIRED':'PASS';if(failures.length)process.exitCode=1;
 }finally{await browser.close();a.server.close();b.server.close();}
}
main().catch(e=>{report.status='FAIL';report.errors.push(e.stack);process.exitCode=1;}).finally(async()=>{
 await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'REPORT.json'),JSON.stringify(report,null,2));
 const names=(await fs.readdir(path.join(output,'AFTER')).catch(()=>[])).filter(n=>/^(320|375|393|430|767)-tariffs-[123]\.png$/.test(n));
 await fs.writeFile(path.join(output,'00_OPEN_COMPARE.html'),'<!doctype html><meta charset="utf-8"><title>V48</title><style>body{background:#171923;color:white;font:16px Arial}section{display:flex;gap:15px}img{max-width:48%;object-fit:contain;align-self:start}</style><h1>V48 — тарифы</h1>'+names.map(n=>'<h2>'+n+'</h2><section><img src="BEFORE/'+n+'"><img src="AFTER/'+n+'"></section>').join(''));
 console.log(JSON.stringify({status:report.status,failures,errors:report.errors}));
});
