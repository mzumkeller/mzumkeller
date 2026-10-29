// Gera os PNGs do perfil a partir de design.html (rodar: node src/render.js)
const puppeteer = require('puppeteer-core');
const path = require('path');
(async () => {
  const b = await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const p = await b.newPage();
  await p.setViewport({width:1340, height:1000, deviceScaleFactor:2});
  await p.goto('file://' + path.join(__dirname, 'design.html'), {waitUntil:'networkidle0'});
  await p.evaluateHandle('document.fonts.ready');
  for (const id of ['header','faco','stack','agora','footer','btn-site']) {
    const el = await p.$('#' + id);
    await el.screenshot({path: path.join(__dirname, '..', 'assets', id + '.png'), omitBackground:true});
  }
  await b.close();
})();
