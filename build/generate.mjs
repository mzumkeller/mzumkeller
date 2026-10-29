// Gera os SVGs animados do perfil em ../assets.
// Uso: node build/generate.mjs          (todos os cards)
//      node build/generate.mjs atividade (só o card de atividade, usado pelo robô diário)
// O card de atividade lê GITHUB_TOKEN; localmente cai para `gh auth token`.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, '..', 'assets');
const LOGIN = 'mzumkeller';
const W = 1280;

/* ─── marca ─────────────────────────────────────────────── */
const C = {
  azul: '#3D6BFF', azul7: '#2B52D1', azulL: '#5B8BFF', ciano: '#22D3EE', ciano7: '#1AA8C2',
  tinta: '#14131C', surface: '#1B1A26', surface2: '#22202E', papel: '#F6F4EF',
  ink2: 'rgba(246,244,239,.78)', muted: 'rgba(246,244,239,.52)', line: '#332F40', line2: '#443F52',
};

/* ─── fontes e medidas ──────────────────────────────────── */
const FONTS = path.join(HERE, 'fonts');
const METRICS = JSON.parse(fs.readFileSync(path.join(FONTS, 'metrics.json'), 'utf8'));
const FAMILY = { SG: 'SpaceGrotesk', MR: 'Manrope' };

function fontFaces(keys) {
  return keys.map(k => {
    const [fam, w] = [k.slice(0, 2), k.slice(2)];
    const b64 = fs.readFileSync(path.join(FONTS, `${FAMILY[fam]}-${w}.woff2`)).toString('base64');
    return `@font-face{font-family:${fam};font-weight:${w};src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
  }).join('');
}

function measure(str, f, w, size, ls = 0) {
  const m = METRICS[`${FAMILY[f]}-${w}`];
  let units = 0;
  for (const ch of str) units += m.adv[ch] ?? m.adv[' '];
  return units / m.upm * size + ls * size * Math.max(0, [...str].length - 1);
}

function wrap(str, f, w, size, maxW) {
  const lines = [];
  let cur = '';
  for (const word of str.split(' ')) {
    const next = cur ? cur + ' ' + word : word;
    if (cur && measure(next, f, w, size) > maxW) { lines.push(cur); cur = word; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function text(x, y, str, { f = 'MR', w = 400, s = 16, fill = C.papel, ls = 0, anchor, cls, style, extra = '' } = {}) {
  return `<text x="${x}" y="${y}" font-family="${f}" font-weight="${w}" font-size="${s}" fill="${fill}"` +
    (ls ? ` letter-spacing="${(ls * s).toFixed(2)}"` : '') +
    (anchor ? ` text-anchor="${anchor}"` : '') + (cls ? ` class="${cls}"` : '') +
    (style ? ` style="${style}"` : '') + `${extra}>${esc(str)}</text>`;
}

const eyebrow = (x, y, str, fill = C.ciano) => text(x, y, str.toUpperCase(), { f: 'SG', w: 600, s: 13, ls: .22, fill });

/* ─── peças comuns ──────────────────────────────────────── */
const LOGO = `<symbol id="logo" viewBox="0 0 64 64"><g transform="rotate(8 32 32)">
  <rect x="10" y="11" width="48" height="48" rx="12" fill="#0B0A12"/><rect x="8" y="8" width="48" height="48" rx="12" fill="#242244"/>
  <polygon points="24,18 14,48 19,48" fill="${C.azul7}"/><polygon points="24,18 19,48 24,48 31,30" fill="${C.azul}"/>
  <polygon points="40,18 50,48 45,48" fill="${C.ciano7}"/><polygon points="40,18 45,48 40,48 33,30" fill="${C.ciano}"/></g></symbol>`;

const FACETS = `<pattern id="fx" width="88" height="88" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
  <polygon points="22,7 7,50 19,50" fill="${C.azul}" opacity=".16"/><polygon points="22,7 19,50 27,50 37,25" fill="${C.azul}" opacity=".30"/>
  <polygon points="56,7 71,50 59,50" fill="${C.ciano}" opacity=".16"/><polygon points="56,7 59,50 51,50 41,25" fill="${C.ciano}" opacity=".30"/></pattern>`;

const BASE_CSS = `
  .up{animation:up .8s cubic-bezier(.2,.7,.2,1) both}
  @keyframes up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
  .pop{animation:pop .55s cubic-bezier(.2,.8,.3,1.25) both;transform-box:fill-box;transform-origin:center}
  @keyframes pop{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:none}}
  .grow{animation:grow 1.1s cubic-bezier(.6,0,.2,1) both;transform-box:fill-box;transform-origin:left}
  @keyframes grow{from{transform:scaleX(0)}to{transform:none}}
  .draw{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1.3s ease forwards}
  @keyframes draw{to{stroke-dashoffset:0}}
  .drift{animation:drift 30s linear infinite}
  @keyframes drift{to{transform:translate(-87.14px,-12.25px)}}
  .fade{animation:fade 1s ease both}
  @keyframes fade{from{opacity:0}to{opacity:1}}
  @media (prefers-reduced-motion:reduce){*{animation:none!important}}`;

// Moldura de cada card: fundo, borda, facetados opcionais, fontes e CSS.
function card(h, body, { fonts, css = '', defs = '', facets = null, label }) {
  const fx = facets ? `
  <mask id="fxm" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#fxg)"/></mask>
  <linearGradient id="fxg" x1="1" y1="0" x2="${facets === 'forte' ? .25 : .6}" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="${facets === 'forte' ? .8 : .38}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` : '';
  const fxLayer = facets ? `<g mask="url(#fxm)"><rect class="drift" x="-180" y="-180" width="${W + 360}" height="${h + 360}" fill="url(#fx)"/></g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(label)}">
<style>${fontFaces(fonts)}${BASE_CSS}${css}</style>
<defs>${LOGO}${FACETS}${fx}<clipPath id="frame"><rect width="${W}" height="${h}" rx="20"/></clipPath>${defs}</defs>
<g clip-path="url(#frame)"><rect width="${W}" height="${h}" fill="${C.tinta}"/>${fxLayer}${body}</g>
<rect x=".5" y=".5" width="${W - 1}" height="${h - 1}" rx="19.5" fill="none" stroke="${C.line}"/>
</svg>`;
}

// Cabeçalho de seção: "01  O QUE EU FAÇO ───────"
function sectionHead(num, title) {
  const lx = 94 + measure(title.toUpperCase(), 'SG', 600, 13, .22) + 18;
  return `<g class="pop"><rect x="48" y="40" width="30" height="30" rx="7" fill="${C.azul}"/>
    ${text(63, 60, num, { f: 'SG', w: 700, s: 13, fill: C.tinta, anchor: 'middle' })}</g>
  <g class="fade" style="animation-delay:.1s">${eyebrow(94, 60, title)}</g>
  <rect class="grow" style="animation-delay:.2s" x="${lx.toFixed(1)}" y="54.5" width="${(W - 48 - lx).toFixed(1)}" height="1" fill="${C.line}"/>`;
}

function pill(x, y, label, { dot = false } = {}) {
  const tw = measure(label, 'SG', 500, 14);
  const w = tw + 32 + (dot ? 20 : 0);
  const tx = x + 16 + (dot ? 20 : 0);
  return {
    w,
    svg: `<rect x="${x}" y="${y}" width="${w.toFixed(1)}" height="38" rx="19" fill="rgba(27,26,38,.75)" stroke="${C.line2}"/>` +
      (dot ? `<circle class="halo" cx="${x + 22}" cy="${y + 19}" r="4" fill="${C.ciano}"/><circle cx="${x + 22}" cy="${y + 19}" r="4" fill="${C.ciano}"/>` : '') +
      text(tx, y + 24, label, { f: 'SG', w: 500, s: 14, fill: C.ink2 }),
  };
}

/* ─── 1. capa ───────────────────────────────────────────── */
function header() {
  const H = 610;
  const phrases = ['sites que trazem clientes.', 'sistemas sob medida.', 'WordPress sem dor de cabeça.', 'a internet do seu negócio.'];
  const prefix = 'Eu faço ';
  const typeY = 494, typeS = 21;
  const px = 56 + measure(prefix, 'MR', 500, typeS);

  // Linha do tempo da digitação: cada frase digita, segura, apaga.
  const per = 4.2, dur = per * phrases.length;
  const times = [], widths = [];
  phrases.forEach((ph, i) => {
    const chars = [...ph], t0 = i * per, typeT = 1.6, hold = 1.8, delT = .55;
    chars.forEach((_, k) => { times.push(t0 + typeT * k / chars.length); widths.push({ i, w: measure(chars.slice(0, k).join(''), 'SG', 600, typeS) }); });
    times.push(t0 + typeT); widths.push({ i, w: measure(ph, 'SG', 600, typeS) });
    for (let k = chars.length - 1; k >= 0; k -= 2) {
      times.push(t0 + typeT + hold + delT * (1 - k / chars.length)); widths.push({ i, w: measure(chars.slice(0, k).join(''), 'SG', 600, typeS) });
    }
    times.push(t0 + typeT + hold + delT + .01); widths.push({ i, w: 0 });
  });
  const kt = times.map(t => (t / dur).toFixed(4));
  kt[0] = '0';
  const clips = phrases.map((_, i) => `<clipPath id="ty${i}"><rect x="${px}" y="${typeY - 24}" height="34" width="0">
    <animate attributeName="width" dur="${dur}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${kt.join(';')}"
      values="${widths.map(v => v.i === i ? (v.w + 1).toFixed(1) : 0).join(';')}"/></rect></clipPath>`).join('');
  const caretX = widths.map(v => (px + v.w + 2).toFixed(1)).join(';');

  const pills = [];
  let x = 56;
  for (const [label, opt] of [['Disponível para projetos', { dot: true }], ['Praia Grande · SP'], ['mazok.com.br']]) {
    const p = pill(x, 530, label, opt); pills.push(p.svg); x += p.w + 12;
  }

  const css = `
    .bob{animation:bob 7s ease-in-out infinite alternate}
    @keyframes bob{from{transform:translateY(-10px) rotate(-1.5deg)}to{transform:translateY(10px) rotate(1.5deg)}}
    .bob{transform-box:fill-box;transform-origin:center}
    .caret{animation:blink 1s steps(1) infinite}
    @keyframes blink{50%{opacity:0}}
    .halo{animation:halo 2s ease-out infinite;transform-box:fill-box;transform-origin:center}
    @keyframes halo{from{transform:scale(1);opacity:.6}to{transform:scale(3.2);opacity:0}}
    .glow{animation:glow 6s ease-in-out infinite alternate}
    @keyframes glow{from{opacity:.35}to{opacity:.7}}
    .typed{font-kerning:none}`;
  const defs = `${clips}
    <linearGradient id="name" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="900" y2="0">
      <stop offset="0" stop-color="${C.azulL}"/><stop offset=".35" stop-color="${C.ciano}"/><stop offset=".5" stop-color="#E8FBFF"/>
      <stop offset=".65" stop-color="${C.ciano}"/><stop offset="1" stop-color="${C.azulL}"/>
      <animateTransform attributeName="gradientTransform" type="translate" values="-900 0;900 0" dur="7s" repeatCount="indefinite"/></linearGradient>
    <radialGradient id="aura"><stop offset="0" stop-color="${C.azul}" stop-opacity=".45"/><stop offset="1" stop-color="${C.azul}" stop-opacity="0"/></radialGradient>`;

  const body = `
  <circle class="glow" cx="1060" cy="300" r="260" fill="url(#aura)"/>
  <g class="bob"><use href="#logo" x="905" y="150" width="310" height="310"/></g>
  <g class="up"><use href="#logo" x="56" y="44" width="50" height="50"/>
    ${text(118, 76, 'mazok', { f: 'SG', w: 600, s: 30, ls: -.02 })}
    ${text(119, 95, 'WEB & DIGITAL STUDIO', { f: 'SG', w: 600, s: 10, ls: .22, fill: C.azulL })}</g>
  <g class="up" style="animation-delay:.15s">${eyebrow(56, 228, 'Olá, eu sou')}</g>
  <g class="up" style="animation-delay:.25s">${text(52, 316, 'Matheus', { f: 'SG', w: 700, s: 88, ls: -.035 })}</g>
  <g class="up" style="animation-delay:.35s">${text(52, 402, 'Zumkeller', { f: 'SG', w: 700, s: 88, ls: -.035, fill: 'url(#name)' })}</g>
  <g class="up" style="animation-delay:.5s">${text(56, 456, 'Desenvolvedor web e fundador da Mazok, web & digital studio.', { w: 500, s: 21, fill: C.ink2 })}</g>
  <g class="up" style="animation-delay:.6s">
    ${text(56, typeY, prefix, { w: 500, s: typeS, fill: C.ink2 })}
    ${phrases.map((ph, i) => `<g clip-path="url(#ty${i})">${text(px, typeY, ph, { f: 'SG', w: 600, s: typeS, fill: C.ciano, cls: 'typed' })}</g>`).join('')}
    <rect class="caret" x="${px}" y="${typeY - 20}" width="2.5" height="25" rx="1" fill="${C.ciano}">
      <animate attributeName="x" dur="${dur}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${kt.join(';')}" values="${caretX}"/></rect>
  </g>
  <g class="up" style="animation-delay:.75s">${pills.join('')}</g>`;

  return card(H, body, { fonts: ['SG500', 'SG600', 'SG700', 'MR500'], css, defs, facets: 'forte',
    label: 'Matheus Zumkeller, desenvolvedor web e fundador da Mazok, web & digital studio. Praia Grande, SP.' });
}

/* ─── 2. o que eu faço ──────────────────────────────────── */
const ICONS = {
  site: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
  sistema: '<path d="M4 6h16M4 12h16M4 18h10"/><circle cx="18" cy="18" r="2"/>',
  wp: '<path d="M12 3l8 4v5c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V7z"/><path d="M9 12l2 2 4-4"/>',
};

function faco() {
  const tiles = [
    { icon: 'site', cor: C.azul, title: 'Sites institucionais', desc: 'One-pages e sites completos, leves e bem posicionados, feitos para converter visita em contato.', tags: ['HTML', 'CSS', 'JavaScript'] },
    { icon: 'sistema', cor: C.ciano, title: 'Sistemas sob medida', desc: 'Painéis de gestão, CRMs e controle financeiro, desenhados em volta da rotina de cada negócio.', tags: ['Laravel', 'Filament', 'TypeScript'] },
    { icon: 'wp', cor: C.azul7, title: 'WordPress e manutenção', desc: 'Atualizações supervisionadas, backup externo, segurança e relatório mensal, com painel próprio.', tags: ['WordPress', 'Elementor', 'PHP'] },
  ];
  const gap = 18, tw = (W - 96 - gap * 2) / 3, pad = 26, top = 104;
  const lay = tiles.map(t => ({ ...t, lines: wrap(t.desc, 'MR', 400, 16, tw - pad * 2) }));
  const maxLines = Math.max(...lay.map(t => t.lines.length));
  const th = pad + 44 + 22 + 24 + 14 + maxLines * 26 + 20 + 30 + pad;
  const H = top + th + 44;

  const body = lay.map((t, i) => {
    const x = 48 + i * (tw + gap), d = .25 + i * .15;
    const iconStroke = t.cor === C.ciano ? C.ciano : C.azulL;
    let tx = x + pad;
    const tagY = top + pad + 44 + 22 + 24 + 14 + maxLines * 26 + 20;
    const tags = t.tags.map(tag => {
      const w = measure(tag, 'SG', 500, 12.5) + 24;
      const s = `<rect x="${tx}" y="${tagY}" width="${w.toFixed(1)}" height="30" rx="15" fill="${C.surface2}" stroke="${C.line}"/>` +
        text(tx + w / 2, tagY + 20, tag, { f: 'SG', w: 500, s: 12.5, fill: C.ink2, anchor: 'middle' });
      tx += w + 7; return s;
    }).join('');
    return `<g class="up" style="animation-delay:${d}s">
      <rect x="${x}" y="${top}" width="${tw.toFixed(1)}" height="${th}" rx="14" fill="${C.surface}" stroke="${C.line}"/>
      <clipPath id="tile${i}"><rect x="${x}" y="${top}" width="${tw.toFixed(1)}" height="${th}" rx="14"/></clipPath>
      <g clip-path="url(#tile${i})"><rect class="grow" style="animation-delay:${d + .3}s" x="${x}" y="${top}" width="${tw.toFixed(1)}" height="3" fill="${t.cor}"/></g>
      <rect x="${x + pad}" y="${top + pad}" width="44" height="44" rx="10" fill="${t.cor === C.ciano ? 'rgba(34,211,238,.12)' : 'rgba(61,107,255,.15)'}"/>
      <g transform="translate(${x + pad + 11} ${top + pad + 11}) scale(.9167)" fill="none" stroke="${iconStroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${ICONS[t.icon].replace(/<(path|rect|circle)/g, `<$1 pathLength="1" class="draw" style="animation-delay:${d + .4}s"`)}</g>
      ${text(x + pad, top + pad + 44 + 22 + 20, t.title, { f: 'SG', w: 600, s: 23, ls: -.015 })}
      ${t.lines.map((ln, k) => text(x + pad, top + pad + 44 + 22 + 24 + 14 + 16 + k * 26, ln, { s: 16, fill: C.ink2 })).join('')}
      ${tags}</g>`;
  }).join('');

  return card(H, sectionHead('01', 'O que eu faço') + body, { fonts: ['SG500', 'SG600', 'SG700', 'MR400'], facets: 'leve',
    label: 'O que eu faço: sites institucionais, sistemas sob medida, WordPress e manutenção.' });
}

/* ─── 3. stack ──────────────────────────────────────────── */
function stack() {
  const rows = [
    ['Front-end', [['HTML', '#E34F26'], ['CSS', '#663399'], ['JavaScript', '#F7DF1E'], ['TypeScript', '#3178C6']]],
    ['Back-end', [['PHP', '#777BB4'], ['Laravel', '#FF2D20'], ['Filament', '#FDAE4B'], ['Node.js', '#5FA04E']]],
    ['CMS', [['WordPress', '#21759B'], ['Elementor', '#D63AA1'], ['WP Rocket', '#F56640']]],
    ['Ferramentas', [['Git', '#F05032'], ['GitHub', C.papel], ['Figma', '#A259FF'], ['Claude Code', '#D97757']]],
  ];
  const top = 104, rh = 64, rg = 14;
  const H = top + rows.length * (rh + rg) - rg + 46;
  let n = 0;
  const body = rows.map(([label, chips], r) => {
    const y = top + r * (rh + rg);
    let x = 258;
    const cs = chips.map(([name, cor]) => {
      const w = measure(name, 'SG', 600, 16) + 50;
      const d = (.35 + n++ * .06).toFixed(2);
      const s = `<g class="pop" style="animation-delay:${d}s"><rect x="${x}" y="${y + 12}" width="${w.toFixed(1)}" height="40" rx="10" fill="${C.surface2}" stroke="${C.line2}"/>
        <rect x="${x + 13}" y="${y + 27}" width="10" height="10" rx="3" fill="${cor}"/>
        ${text(x + 33, y + 38, name, { f: 'SG', w: 600, s: 16 })}</g>`;
      x += w + 10; return s;
    }).join('');
    return `<g class="up" style="animation-delay:${.15 + r * .08}s"><rect x="48" y="${y}" width="${W - 96}" height="${rh}" rx="14" fill="${C.surface}" stroke="${C.line}"/>
      ${text(72, y + 37, label.toUpperCase(), { w: 600, s: 11.5, ls: .18, fill: C.muted })}</g>${cs}`;
  }).join('');
  return card(H, sectionHead('02', 'Stack') + body, { fonts: ['SG600', 'SG700', 'MR600'],
    label: 'Stack: HTML, CSS, JavaScript, TypeScript, PHP, Laravel, Filament, Node.js, WordPress, Elementor, WP Rocket, Git, GitHub, Figma, Claude Code.' });
}

/* ─── 4. agora ──────────────────────────────────────────── */
function agora() {
  const top = 104, gap = 18, cw = (W - 96 - gap) / 2, ch = 168;
  const H = top + ch + 46;
  const items = [
    { k: 'Construindo', v: 'Sites e sistemas para pequenos negócios', d: 'Padarias, madeireiras, clínicas e engenharia, cada um com o que realmente precisa.', kind: 'build' },
    { k: 'Estudando', v: 'curso.dev', d: 'Implementando o TabNews do zero, do banco de dados ao deploy.', kind: 'study' },
  ];
  const css = `
    .bar{animation:bar 2.4s cubic-bezier(.6,0,.4,1) infinite}
    @keyframes bar{from{transform:translateX(-160px)}to{transform:translateX(${cw}px)}}
    .spark{animation:spark 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
    @keyframes spark{0%,100%{transform:scale(.85) rotate(0);opacity:.75}50%{transform:scale(1.1) rotate(45deg);opacity:1}}
    .nudge{animation:nudge 1.6s ease-in-out infinite}
    @keyframes nudge{50%{transform:translateX(4px)}}`;
  const body = items.map((it, i) => {
    const x = 48 + i * (cw + gap), d = .2 + i * .15, tx = x + 84;
    const lines = wrap(it.d, 'MR', 400, 15, cw - 84 - 26);
    const icon = it.kind === 'build'
      ? `<g class="nudge" fill="none" stroke="${C.azulL}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M${x + 36} ${top + 46}h16M${x + 46} ${top + 40}l6 6-6 6"/></g>`
      : `<path class="spark" d="M${x + 44} ${top + 34}l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="${C.azulL}"/>`;
    const extra = it.kind === 'build'
      ? `<clipPath id="trk"><rect x="${tx}" y="${top + ch - 30}" width="${cw - 84 - 26}" height="4" rx="2"/></clipPath>
         <rect x="${tx}" y="${top + ch - 30}" width="${cw - 84 - 26}" height="4" rx="2" fill="${C.surface2}"/>
         <g clip-path="url(#trk)"><rect class="bar" x="${tx}" y="${top + ch - 30}" width="160" height="4" rx="2" fill="url(#barg)"/></g>`
      : `${text(tx, top + ch - 22, 'Em andamento', { f: 'SG', w: 600, s: 12, ls: .08, fill: C.muted })}`;
    return `<g class="up" style="animation-delay:${d}s">
      <rect x="${x}" y="${top}" width="${cw}" height="${ch}" rx="14" fill="${C.surface}" stroke="${C.line}"/>
      <rect x="${x + 24}" y="${top + 24}" width="40" height="40" rx="10" fill="${C.surface2}" stroke="${C.line2}"/>${icon}
      ${text(tx, top + 40, it.k.toUpperCase(), { w: 600, s: 11.5, ls: .18, fill: C.ciano })}
      ${text(tx, top + 68, it.v, { f: 'SG', w: 600, s: 20, ls: -.01 })}
      ${lines.map((ln, k) => text(tx, top + 96 + k * 23, ln, { s: 15, fill: C.ink2 })).join('')}
      ${extra}</g>`;
  }).join('');
  const defs = `<linearGradient id="barg"><stop offset="0" stop-color="${C.azul}" stop-opacity="0"/><stop offset=".5" stop-color="${C.azul}"/><stop offset="1" stop-color="${C.ciano}"/></linearGradient>`;
  return card(H, sectionHead('03', 'Agora') + body, { fonts: ['SG600', 'SG700', 'MR400', 'MR600'], css, defs,
    label: 'Agora: construindo sites e sistemas para pequenos negócios; estudando no curso.dev.' });
}

/* ─── 5. atividade (dados ao vivo) ──────────────────────── */
async function fetchCalendar() {
  let token = process.env.GITHUB_TOKEN;
  if (!token) { try { token = execSync('gh auth token', { encoding: 'utf8' }).trim(); } catch { /* sem token */ } }
  if (!token) throw new Error('Defina GITHUB_TOKEN ou faça login no gh para gerar o card de atividade.');
  const query = `{ user(login:"${LOGIN}") { contributionsCollection { contributionCalendar { totalContributions
    weeks { contributionDays { date contributionCount weekday } } } } } }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST', headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': LOGIN },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error('GitHub GraphQL: ' + JSON.stringify(json.errors || json));
  return json.data.user.contributionsCollection.contributionCalendar;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmtNum = n => n.toLocaleString('pt-BR');
const fmtData = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

function atividade(cal) {
  const days = cal.weeks.flatMap(w => w.contributionDays);
  const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // horário de Brasília
  const past = days.filter(d => d.date <= today);

  let best = 0, run = 0;
  for (const d of past) { run = d.contributionCount ? run + 1 : 0; best = Math.max(best, run); }
  const top = past.reduce((a, b) => (b.contributionCount > a.contributionCount ? b : a), past[0]);
  const activeDays = past.filter(d => d.contributionCount).length;

  const nonzero = past.map(d => d.contributionCount).filter(Boolean).sort((a, b) => a - b);
  const q = p => nonzero[Math.floor((nonzero.length - 1) * p)] ?? 1;
  const cuts = [q(.25), q(.5), q(.8)];
  const level = c => (!c ? 0 : c <= cuts[0] ? 1 : c <= cuts[1] ? 2 : c <= cuts[2] ? 3 : 4);
  const FILL = [C.surface2, 'rgba(61,107,255,.35)', C.azul7, C.azul, C.ciano];

  // métricas
  const statsTop = 104, sw = (W - 96 - 3 * 14) / 4;
  const stats = [
    [fmtNum(cal.totalContributions), 'contribuições no último ano'],
    [`${best} dias`, 'maior sequência'],
    [fmtNum(top.contributionCount), 'recorde em um dia'],
    [`${fmtNum(activeDays)}`, 'dias com código'],
  ];
  const statSvg = stats.map(([v, l], i) => {
    const x = 48 + i * (sw + 14);
    return `<g class="up" style="animation-delay:${.15 + i * .08}s"><rect x="${x}" y="${statsTop}" width="${sw.toFixed(1)}" height="96" rx="14" fill="${C.surface}" stroke="${C.line}"/>
      <rect x="${x}" y="${statsTop + 20}" width="3" height="56" rx="1.5" fill="${i === 0 ? C.ciano : C.azul}"/>
      ${text(x + 24, statsTop + 50, v, { f: 'SG', w: 700, s: 30, ls: -.02 })}
      ${text(x + 24, statsTop + 76, l, { s: 14, fill: C.muted, w: 600 })}</g>`;
  }).join('');

  // mapa de calor
  const gx = 48 + 24 + 40, gy = statsTop + 96 + 18 + 58, step = 20.6, cell = 16;
  const panelY = statsTop + 96 + 18, panelH = 7 * step + 58 + 46;
  let cells = '', glow = '', months = '';
  let lastMonth = -1;
  cal.weeks.forEach((wk, c) => {
    const first = wk.contributionDays[0];
    const m = +first.date.slice(5, 7) - 1;
    if (m !== lastMonth && c < cal.weeks.length - 2) {
      if (lastMonth !== -1 || +first.date.slice(8) <= 7) months += text(gx + c * step, gy - 12, MESES[m], { s: 12, w: 600, fill: C.muted });
      lastMonth = m;
    }
    wk.contributionDays.forEach(d => {
      if (d.date > today) return;
      const x = (gx + c * step).toFixed(1), y = (gy + d.weekday * step).toFixed(1), lv = level(d.contributionCount);
      cells += `<rect class="cel" style="animation-delay:${(.4 + c * .018).toFixed(3)}s" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="4" fill="${FILL[lv]}"><title>${fmtData(d.date)}: ${d.contributionCount}</title></rect>`;
      if (lv) glow += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="4"/>`;
    });
  });
  const wd = [[1, 'seg'], [3, 'qua'], [5, 'sex']].map(([r, l]) => text(gx - 40, gy + r * step + 12.5, l, { s: 12, w: 600, fill: C.muted })).join('');
  const lx = W - 48 - 24 - measure('mais', 'MR', 600, 12) - 6 - 5 * (cell + 5) + 5;
  const legend = text(lx - 54, panelY + panelH - 20, 'menos', { s: 12, w: 600, fill: C.muted }) +
    FILL.map((f, i) => `<rect x="${lx + i * (cell + 5)}" y="${panelY + panelH - 33}" width="${cell}" height="${cell}" rx="4" fill="${f}"/>`).join('') +
    text(lx + 5 * (cell + 5) + 6, panelY + panelH - 20, 'mais', { s: 12, w: 600, fill: C.muted });
  const foot = text(48 + 24, panelY + panelH - 20, `Últimos 12 meses · dia mais ativo: ${fmtData(top.date)}`, { s: 13, w: 600, fill: C.ink2 });

  const H = panelY + panelH + 44;
  const atualizado = `atualizado em ${fmtData(today)}`;
  const css = `
    .cel{animation:pop .45s cubic-bezier(.2,.8,.3,1.2) both;transform-box:fill-box;transform-origin:center}
    .sweep{animation:sweep 5s cubic-bezier(.5,0,.5,1) 1.6s infinite}
    @keyframes sweep{from{transform:translateX(-260px)}to{transform:translateX(${W + 260}px)}}
    .live{animation:halo 2s ease-out infinite;transform-box:fill-box;transform-origin:center}
    @keyframes halo{from{transform:scale(1);opacity:.6}to{transform:scale(3.2);opacity:0}}`;
  const defs = `<linearGradient id="swg"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="glowcells">${glow}</clipPath>`;
  const ax = W - 48 - measure(atualizado, 'MR', 600, 12);
  const body = sectionHead('04', 'Atividade') +
    `<g class="fade" style="animation-delay:.3s"><rect x="${ax - 26}" y="38" width="${measure(atualizado, 'MR', 600, 12) + 40}" height="34" rx="17" fill="${C.tinta}"/>
      <circle class="live" cx="${ax - 12}" cy="55" r="3.5" fill="${C.ciano}"/><circle cx="${ax - 12}" cy="55" r="3.5" fill="${C.ciano}"/>
      ${text(ax, 59.5, atualizado, { s: 12, w: 600, fill: C.muted })}</g>` +
    statSvg +
    `<g class="up" style="animation-delay:.3s"><rect x="48" y="${panelY}" width="${W - 96}" height="${panelH}" rx="14" fill="${C.surface}" stroke="${C.line}"/>${months}${wd}${legend}${foot}</g>
     ${cells}
     <g clip-path="url(#glowcells)"><rect class="sweep" x="0" y="${gy}" width="220" height="${7 * step}" fill="url(#swg)"/></g>`;
  return card(H, body, { fonts: ['SG600', 'SG700', 'MR600'], css, defs,
    label: `Atividade no GitHub: ${cal.totalContributions} contribuições no último ano, maior sequência de ${best} dias.` });
}

/* ─── 6. rodapé e botão ─────────────────────────────────── */
function footer() {
  const H = 124, a = 'Tem um projeto em mente?', b = ' Vamos conversar.';
  const wa = measure(a, 'SG', 600, 24), wb = measure(b, 'SG', 500, 24);
  const css = `.nudge{animation:nudge 1.6s ease-in-out infinite}@keyframes nudge{50%{transform:translateX(6px)}}`;
  const body = `<g class="up">${text(48, 70, a, { f: 'SG', w: 600, s: 24, ls: -.01 })}${text(48 + wa, 70, b, { f: 'SG', w: 500, s: 24, ls: -.01, fill: C.muted })}
    <g class="nudge" fill="none" stroke="${C.ciano}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M${62 + wa + wb} 62h22M${76 + wa + wb} 54l8 8-8 8"/></g></g>
    <use href="#logo" x="${W - 48 - 60}" y="32" width="60" height="60"/>`;
  return card(H, body, { fonts: ['SG500', 'SG600'], css, facets: 'leve', label: 'Tem um projeto em mente? Vamos conversar.' });
}

function botao() {
  const label = 'mazok.com.br', w = Math.ceil(measure(label, 'SG', 600, 19) + 80), h = 56;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="mazok.com.br">
<style>${fontFaces(['SG600'])}.sh{animation:sh 3.5s ease-in-out 1s infinite}@keyframes sh{from{transform:translateX(-120px)}60%,to{transform:translateX(${w + 120}px)}}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>
<defs><clipPath id="b"><rect width="${w}" height="${h}" rx="14"/></clipPath>
<linearGradient id="g"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
<g clip-path="url(#b)"><rect width="${w}" height="${h}" fill="${C.azul}"/><rect class="sh" x="0" y="-10" width="70" height="${h + 20}" fill="url(#g)" transform="skewX(-20)"/></g>
<g transform="translate(22 18)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><circle cx="10" cy="10" r="9"/><path d="M1 10h18M10 1c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S7.5 3.5 10 1z"/></g>
${text(54, 35, label, { f: 'SG', w: 600, s: 19, fill: '#fff' })}
</svg>`;
}

/* ─── saída ─────────────────────────────────────────────── */
const write = (name, svg) => { fs.writeFileSync(path.join(ASSETS, name), svg); console.log(`✓ assets/${name} (${(svg.length / 1024).toFixed(1)} KB)`); };

fs.mkdirSync(ASSETS, { recursive: true });
const only = process.argv[2];
if (!only) {
  write('header.svg', header());
  write('faco.svg', faco());
  write('stack.svg', stack());
  write('agora.svg', agora());
  write('footer.svg', footer());
  write('btn-site.svg', botao());
}
if (!only || only === 'atividade') write('atividade.svg', atividade(await fetchCalendar()));
