/* Live graphs. One small line chart per value (small multiples), so a CO2 level of
   800 and a temperature of 22 each get their own scale instead of one flat line.
   Used by the simulator and by the serial monitor, which reads "name:value" lines
   (the same format the Arduino Serial Plotter uses). */
(function () {
  const esc = FM.esc;
  const MAX = 120; // points kept per value

  // A plot store: { order: [names], data: { name: [numbers] } }
  FM.plotStore = () => ({ order: [], data: {} });
  FM.plotPush = function (store, values) {
    Object.entries(values).forEach(([k, x]) => {
      if (typeof x !== 'number' || !isFinite(x)) return;
      if (!store.data[k]) { store.data[k] = []; store.order.push(k); }
      const d = store.data[k];
      d.push(x);
      if (d.length > MAX) d.shift();
    });
  };

  // "co2:812 temperature:22.4" or "co2:812,temperature:22.4" -> { co2: 812, temperature: 22.4 }
  FM.plotParse = function (line) {
    const s = String(line).trim();
    if (!/^([A-Za-z_][\w]*:-?\d+(\.\d+)?([eE][-+]?\d+)?[\s,]*)+$/.test(s)) return null;
    const out = {};
    s.split(/[\s,]+/).filter(Boolean).forEach((p) => { const i = p.indexOf(':'); out[p.slice(0, i)] = +p.slice(i + 1); });
    return out;
  };

  const fmt = (x) => (Math.abs(x) >= 1000 ? Math.round(x) : Math.round(x * 10) / 10).toString();

  FM.chart = function (store, units) {
    if (!store.order.length) return '';
    const W = 300, H = 56, pad = 3;
    return '<div class="charts">' + store.order.map((name) => {
      const d = store.data[name];
      let lo = Math.min.apply(null, d), hi = Math.max.apply(null, d);
      if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
      const x = (i) => W - ((d.length - 1 - i) / (MAX - 1)) * W; // newest on the right
      const y = (v) => pad + (1 - (v - lo) / (hi - lo)) * (H - pad * 2);
      const pts = d.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
      const last = d[d.length - 1];
      const u = (units && units[name]) || '';
      return '<div class="chart-row"><div class="chart-name"><span class="mono">{' + esc(name) + '}</span><b>' + esc(fmt(last)) + (u ? ' <small>' + esc(u) + '</small>' : '') + '</b></div>' +
        '<div class="chart-plot"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" data-chart="' + esc(JSON.stringify(d)) + '" data-unit="' + esc(u) + '" role="img" aria-label="' + esc(name + ' over time, now ' + fmt(last) + ' ' + u + ', lowest ' + fmt(Math.min.apply(null, d)) + ', highest ' + fmt(Math.max.apply(null, d))) + '">' +
        '<line x1="0" y1="' + (H - 0.5) + '" x2="' + W + '" y2="' + (H - 0.5) + '" class="chart-base"/>' +
        (d.length > 1 ? '<polyline points="' + pts + '" class="chart-line" vector-effect="non-scaling-stroke"/>' : '') +
        '<circle cx="' + x(d.length - 1).toFixed(1) + '" cy="' + y(last).toFixed(1) + '" r="3" class="chart-dot" vector-effect="non-scaling-stroke"/>' +
        '<line class="chart-cross" x1="0" x2="0" y1="0" y2="' + H + '" vector-effect="non-scaling-stroke" visibility="hidden"/></svg>' +
        (Math.max.apply(null, d) > Math.min.apply(null, d) ? '<span class="chart-range"><span>' + esc(fmt(Math.max.apply(null, d))) + '</span><span>' + esc(fmt(Math.min.apply(null, d))) + '</span></span>' : '<span class="chart-range"><span></span><span>steady</span></span>') +
        '<span class="chart-tip" hidden></span></div></div>';
    }).join('') + '</div>';
  };

  // Hover: a crosshair and the value under the pointer.
  function hover(e) {
    const svg = e.target.closest && e.target.closest('svg[data-chart]');
    document.querySelectorAll('.chart-tip:not([hidden])').forEach((t) => { if (!svg || t.parentNode !== svg.parentNode) { t.hidden = true; const c = t.parentNode.querySelector('.chart-cross'); if (c) c.setAttribute('visibility', 'hidden'); } });
    if (!svg) return;
    const d = JSON.parse(svg.dataset.chart);
    const r = svg.getBoundingClientRect();
    const back = Math.round((r.right - e.clientX) / r.width * (MAX - 1));
    const i = Math.max(0, d.length - 1 - back);
    const cx = (300 - (d.length - 1 - i) / (MAX - 1) * 300).toFixed(1);
    const cross = svg.querySelector('.chart-cross');
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    const tip = svg.parentNode.querySelector('.chart-tip');
    const ago = d.length - 1 - i;
    tip.textContent = fmt(d[i]) + (svg.dataset.unit ? ' ' + svg.dataset.unit : '') + (ago ? ' · ' + ago + ' reading' + (ago > 1 ? 's' : '') + ' ago' : ' · now');
    tip.style.left = Math.min(r.width - 10, Math.max(10, (cx / 300) * r.width)) + 'px';
    tip.hidden = false;
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('pointermove', hover);
    document.addEventListener('pointerleave', () => hover({ target: document.body }));
  }
})();
