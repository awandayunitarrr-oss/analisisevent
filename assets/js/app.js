/* Tampilan dashboard: routing, filter, tabel index, grafik ECharts, kritik & saran. */
(function () {
  const CFG = window.SURVEY_CONFIG;
  const A = window.SurveyAnalytics;
  const D = window.SurveyData;
  const $ = (s, el) => (el || document).querySelector(s);
  const AREAS = CFG.AREAS;

  /* Palet: tiap divisi punya warna identitas; area & tahun memakai warna tetap. */
  const DIV_COLOR = { it: '#2563eb', helpdesk: '#f97316', simo: '#0d9488', hcgs: '#8b5cf6', corpsec: '#e11d74', purchasing: '#16a34a' };
  const DIV_GRAD = { it: '#06b6d4', helpdesk: '#facc15', simo: '#22d3ee', hcgs: '#ec4899', corpsec: '#f97316', purchasing: '#84cc16' };
  const PALETTE = ['#2563eb', '#f97316', '#14b8a6', '#8b5cf6', '#ec4899', '#22c55e', '#f59e0b', '#0ea5e9', '#ef4444', '#6366f1'];
  const AREA_COLOR = ['#2563eb', '#f97316', '#14b8a6'];
  const YEAR_COLOR = { prev: '#94a3b8', cur: '#dc2626' };
  const LIKERT = ['#dc2626', '#fb923c', '#cbd5e1', '#60a5fa', '#2563eb'];
  const CAT_COLOR = { 'cat-1': '#dc2626', 'cat-2': '#f97316', 'cat-3': '#f59e0b', 'cat-4': '#0ea5e9', 'cat-5': '#16a34a' };
  const T = {};
  const MASCOT = '<img class="band-mascot" src="assets/img/maskot.png" alt="Maskot MPM: burung, harimau, dan gajah" width="640" height="220">';

  const state = { sheets: null, source: '', loadedAt: null, prepared: {}, filters: { area: '', div: '' }, charts: [], route: 'ringkasan', ui: {} };

  /* ───────── util ───────── */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f2 = (v) => (v == null || Number.isNaN(v) ? '–' : v.toFixed(2));
  const pct = (v) => (v == null ? '–' : Math.round(v * 100) + '%');
  const short = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
  const catColor = (v) => { const c = A.category(v); return c ? CAT_COLOR[c.cls] : T.muted; };
  function gapHtml(cur, prev) {
    if (cur == null || prev == null) return '<span class="gap gap-na">–</span>';
    const r = Math.round((A.round2(cur) - A.round2(prev)) * 100) / 100;
    if (r > 0) return `<span class="gap gap-up" title="Naik">▲ ${r.toFixed(2)}</span>`;
    if (r < 0) return `<span class="gap gap-down" title="Turun">▼ ${r.toFixed(2)}</span>`;
    return '<span class="gap gap-flat" title="Tetap">► 0.00</span>';
  }
  function catBadge(v) {
    const c = A.category(v);
    return c ? `<span class="badge ${c.cls}">${c.label}</span>` : '<span class="badge">Belum ada data</span>';
  }
  function scoreCell(v, extra) {
    const c = A.category(v);
    return `<td class="num score ${c ? 'bg-' + c.cls : ''}" ${extra || ''}>${f2(v)}</td>`;
  }
  function fmtDate(d) { return d ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'; }
  const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  /* ───────── ECharts helper ───────── */
  function readTheme() {
    const css = getComputedStyle(document.documentElement);
    ['ink', 'ink-2', 'muted', 'line', 'surface', 'surface-2'].forEach((n) => { T[n.replace('-', '')] = css.getPropertyValue('--' + n).trim(); });
  }
  const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
  function tooltipBase() {
    return { backgroundColor: T.surface, borderColor: T.line, borderWidth: 1, padding: [8, 12], textStyle: { color: T.ink, fontFamily: FONT, fontSize: 12 }, extraCssText: 'border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,.18);' };
  }
  function axisStyle(extra) {
    return Object.assign({
      axisLine: { lineStyle: { color: T.line } }, axisTick: { show: false },
      axisLabel: { color: T.ink2, fontFamily: FONT, fontSize: 11 },
      splitLine: { lineStyle: { color: T.line, type: 'dashed' } },
    }, extra || {});
  }
  function legendBase(extra) { return Object.assign({ top: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 12, textStyle: { color: T.ink2, fontFamily: FONT } }, extra || {}); }
  function ec(id, option) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (!el || !window.echarts) return null;
    const c = echarts.init(el, null, { renderer: 'canvas' });
    option.textStyle = Object.assign({ fontFamily: FONT, color: T.ink2 }, option.textStyle || {});
    option.tooltip = Object.assign(tooltipBase(), option.tooltip || {});
    if (option.animationDuration == null) option.animationDuration = 700;
    try { c.setOption(option); } catch (e) { console.warn('Grafik gagal digambar:', e.message); }
    state.charts.push(c);
    return c;
  }
  function destroyCharts() { state.charts.forEach((c) => c.dispose()); state.charts = []; }
  const grad = (a, b, horizontal) => new echarts.graphic.LinearGradient(0, 0, horizontal ? 1 : 0, horizontal ? 0 : 1, [{ offset: 0, color: a }, { offset: 1, color: b }]);
  const fade = (hex, alpha) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`; };
  const catLabel = (v) => (A.category(v) || {}).label || '';

  /* ───────── meta slide (judul + insight untuk mode presentasi) ───────── */
  function setSlides(map) {
    Object.entries(map).forEach(([key, v]) => {
      const el = document.querySelector(`[data-s="${key}"]`);
      if (el && v) { el.dataset.title = v[0]; el.dataset.insight = v[1] || ''; }
    });
  }
  function setCardInsight(id, html) { const el = document.getElementById(id); if (el) el.dataset.insight = html; }
  const share = (n, t) => (t ? Math.round((n / t) * 100) + '%' : '–');

  /* ───────── data & filter ───────── */
  // Filter silang: klik area/divisi di grafik untuk memfilter, klik lagi untuk menghapus.
  function setFilter(key, val) {
    state.filters[key] = state.filters[key] === val ? '' : val;
    $('#fArea').value = state.filters.area;
    $('#fDiv').value = state.filters.div;
    render(false);
  }
  function renderFilterChips() {
    const f = state.filters;
    const chips = [['area', 'Area', f.area], ['div', 'Divisi', f.div]].filter((c) => c[2]);
    $('#filterNote').innerHTML = chips.length
      ? chips.map(([k, l, v]) => `<button type="button" class="fchip" data-clear="${k}" title="Hapus filter">${l}: <b>${esc(v)}</b> ✕</button>`).join('')
      : '<span class="filter-hint">Tip: klik area atau divisi pada grafik untuk memfilter</span>';
  }
  function prepareAll() {
    state.prepared = {};
    CFG.DIVISIONS.forEach((d) => { state.prepared[d.id] = A.prepareDivision(d, state.sheets[d.sheet]); });
    fillFilterOptions();
  }
  function filtered(prep) {
    const f = state.filters;
    return prep.respondents.filter((r) => (!f.area || r.area === f.area) && (!f.div || r.div === f.div));
  }
  function fillFilterOptions() {
    const all = Object.values(state.prepared).flatMap((p) => p.respondents);
    const uniq = (k) => [...new Set(all.map((r) => r[k]))].sort((a, b) => a.localeCompare(b));
    const fill = (sel, values, first) => {
      const cur = sel.value;
      sel.innerHTML = `<option value="">${first}</option>` + values.map((v) => `<option ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');
    };
    fill($('#fArea'), AREAS, 'Semua area');
    fill($('#fDiv'), uniq('div'), 'Semua divisi');
  }

  /* ───────── load ───────── */
  async function load() {
    const status = $('#sourceStatus');
    status.className = 'pill pill-muted';
    status.textContent = 'Memuat data…';
    let res;
    try {
      res = await D.loadLive();
    } catch (e) {
      console.warn('Gagal memuat data live:', e.message);
      try { res = D.loadSnapshot(); res.warn = e.message; } catch (e2) { $('#app').innerHTML = `<div class="empty">Data tidak dapat dimuat: ${esc(e2.message)}</div>`; return; }
    }
    const first = !state.sheets;
    state.sheets = res.sheets;
    state.source = res.source;
    state.loadedAt = new Date();
    const live = /live|publish/.test(res.source);
    status.className = 'pill ' + (live ? 'pill-live' : 'pill-warn');
    status.textContent = live ? `● Live · ${state.loadedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
      : (res.stamp ? `Snapshot ${fmtDate(new Date(res.stamp))}` : res.source);
    status.title = res.warn ? `Google Sheets tidak bisa diakses (${res.warn}). Pastikan sheet dibagikan "Siapa saja yang memiliki link". Menampilkan ${res.source}.` : res.source;
    prepareAll();
    render(first);
  }

  /* ───────── routing ───────── */
  function buildTabs() {
    const tabs = [{ id: 'ringkasan', name: 'Ringkasan' }].concat(CFG.DIVISIONS.map((d) => ({ id: d.id, name: d.name })));
    $('#tabs').innerHTML = tabs.map((t) => `<a href="#${t.id}" data-id="${t.id}" style="--dc:${DIV_COLOR[t.id] || '#ffffff'}"><span class="dot"></span>${esc(t.name)}</a>`).join('');
  }
  function onRoute() {
    state.route = (location.hash.replace(/^#\/?/, '') || 'ringkasan').split(/[/?]/)[0];
    document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('active', a.dataset.id === state.route));
    if (state.sheets) render(true);
  }
  function render(scrollTop) {
    destroyCharts();
    readTheme();
    renderFilterChips();
    const div = CFG.DIVISIONS.find((d) => d.id === state.route);
    if (div) renderDivision(div); else renderOverview();
    if (scrollTop) window.scrollTo({ top: 0 });
    document.dispatchEvent(new CustomEvent('survey:rendered'));
  }

  function analyzeAll() {
    return CFG.DIVISIONS.map((d) => {
      const prep = state.prepared[d.id];
      const resp = filtered(prep);
      const an = A.analyzeDivision(prep, resp);
      return { d, prep, resp, an, prev: d.indexHistory[CFG.prevYear] || [], color: DIV_COLOR[d.id] };
    });
  }

  /* ───────── RINGKASAN ───────── */
  function renderOverview() {
    const rows = analyzeAll();
    const totalN = rows.reduce((s, r) => s + r.resp.length, 0);
    const withIdx = rows.filter((r) => r.an.index[0] != null);
    const avgIdx = A.mean(withIdx.map((r) => r.an.index[0]));
    const up = withIdx.filter((r) => r.prev[0] != null && A.round2(r.an.index[0]) > r.prev[0]).length;
    const down = withIdx.filter((r) => r.prev[0] != null && A.round2(r.an.index[0]) < r.prev[0]).length;
    const dates = rows.flatMap((r) => r.resp.map((x) => x.date).filter(Boolean)).sort((a, b) => a - b);
    const days = [...new Set(dates.map(isoDay))].sort();
    const perDay = days.map((day) => dates.filter((d) => isoDay(d) === day).length);

    const allItems = rows.flatMap((r) => r.an.items.filter((i) => !i.overall && i.stats.n >= 3).map((i) => ({ ...i, divName: r.d.name, divId: r.d.id })));
    const sorted = allItems.slice().sort((a, b) => b.stats.mean - a.stats.mean);
    const best = sorted.slice(0, 6);
    const worst = sorted.slice(-6).reverse();
    const ranked = withIdx.slice().sort((a, b) => b.an.index[0] - a.an.index[0]);

    const insights = [];
    if (withIdx.length) {
      insights.push(`Rata-rata index seluruh layanan ${CFG.year} sebesar <b>${f2(avgIdx)}</b> (${catLabel(avgIdx).toLowerCase()}) dari <b>${totalN}</b> respons di ${rows.length} survey divisi.`);
      insights.push(`Index tertinggi: <b>${esc(ranked[0].d.name)}</b> (${f2(ranked[0].an.index[0])}); terendah: <b>${esc(ranked[ranked.length - 1].d.name)}</b> (${f2(ranked[ranked.length - 1].an.index[0])}).`);
      insights.push(`Dibanding ${CFG.prevYear}: <b>${up}</b> divisi naik, <b>${down}</b> divisi turun.`);
      if (worst[0]) insights.push(`Indikator dengan skor terendah lintas divisi: <b>${esc(worst[0].label)}</b> (${esc(worst[0].divName)}, ${f2(worst[0].stats.mean)}).`);
    }

    $('#app').innerHTML = `
      <section data-s="ov-band" class="band">
        <div class="band-head">
          <div class="band-text">
            <p class="eyebrow">Survey Pengukuran Kepuasan Divisi · Karyawan MPM ${CFG.year}</p>
            <h1>Ringkasan Index Pelayanan Divisi ${CFG.year}</h1>
            <p class="band-meta">Periode respons ${dates.length ? fmtDate(dates[0]) + ' – ' + fmtDate(dates[dates.length - 1]) : '–'} · ${esc(state.source)}</p>
          </div>
          ${MASCOT}
        </div>
        <div class="band-kpis">
          ${kpi('Total respons', totalN, `${rows.length} survey divisi`, 'kpi-spark', 'kSpark')}
          ${kpi('Rata-rata index ' + CFG.year, f2(avgIdx), catBadge(avgIdx))}
          ${kpi('Naik vs ' + CFG.prevYear, `${up}<small> / ${withIdx.length}</small>`, `▼ ${down} divisi turun`)}
          ${kpi('Respons hari terakhir', perDay.length ? perDay[perDay.length - 1] : 0, days.length ? fmtDate(new Date(days[days.length - 1])) : '')}
        </div>
      </section>

      <section data-s="ov-cards" class="div-cards">
        ${rows.map((r) => `
          <a class="div-card" href="#${r.d.id}" style="--dc:${r.color};--dc2:${DIV_GRAD[r.d.id]}">
            <div class="div-card-head"><div><b>${esc(r.d.name)}</b><span>${esc(r.d.full)}</span></div>${gapHtml(r.an.index[0], r.prev[0])}</div>
            <div class="div-card-body">
              <div class="mini-gauge" id="g-${r.d.id}"></div>
              <div class="div-card-meta">
                ${catBadge(r.an.index[0])}
                <span class="muted small">${r.resp.length} responden · ${CFG.prevYear}: ${f2(r.prev[0])}</span>
                <div class="mini-spark" id="s-${r.d.id}"></div>
              </div>
            </div>
          </a>`).join('')}
      </section>

      <section data-s="ov-insight" class="card insight"><h2>Temuan utama</h2><ul>${insights.map((i) => `<li>${i}</li>`).join('')}</ul></section>

      <section data-s="ov-change" class="grid-2">
        <div class="card"><h2>Perubahan index ${CFG.prevYear} → ${CFG.year}</h2><p class="muted">Dumbbell chart: titik abu-abu ${CFG.prevYear}, titik merah ${CFG.year}; garis hijau = naik, kuning = turun.</p><div class="chart h-320" id="cDumb"></div></div>
        <div class="card"><h2>Peringkat divisi dari tahun ke tahun</h2><p class="muted">Bump chart: posisi 1 = index tertinggi pada tahun tersebut.</p><div class="chart h-320" id="cBump"></div></div>
      </section>

      <section data-s="ov-area" class="grid-2">
        <div class="card"><h2>Peta panas index per area</h2><p class="muted">Warna mengikuti kategori kepuasan ${CFG.year}.</p><div class="chart h-320" id="cHeat"></div></div>
        <div class="card"><h2>Komposisi responden</h2><p class="muted">Sunburst: lingkar dalam = survey divisi, lingkar luar = area kerja.</p><div class="chart h-320" id="cSun"></div></div>
      </section>

      <section data-s="ov-river" class="card"><h2>Arus respons harian</h2><p class="muted">Streamgraph jumlah respons per hari untuk tiap survey.</p><div class="chart h-280" id="cRiver"></div></section>

      <section data-s="ov-rank" class="grid-2">
        <div class="card"><h2>Indikator tertinggi</h2><div class="chart h-300" id="cBest"></div></div>
        <div class="card"><h2>Indikator terendah</h2><div class="chart h-300" id="cWorst"></div></div>
      </section>

      <section data-s="ov-table" class="card">
        <div class="card-head"><h2>Tabel index per divisi</h2><p class="muted">Klik baris untuk membuka detail divisi.</p></div>
        <div class="table-wrap">
          <table class="idx-table overview-table">
            <thead>
              <tr><th rowspan="2" class="left">Divisi</th><th colspan="2">Responden</th><th colspan="5">Index Total</th><th colspan="${AREAS.length}">Index ${CFG.year} per area</th></tr>
              <tr><th>n ${CFG.prevYear}</th><th>n ${CFG.year}</th><th>2024</th><th>${CFG.prevYear}</th><th>${CFG.year}</th><th>Gap</th><th>Kategori</th>${AREAS.map((a) => `<th>${a}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.map((r) => {
                const nPrev = r.d.nHistory[CFG.prevYear];
                return `<tr class="clickable" data-go="${r.d.id}">
                  <td class="left"><span class="swatch" style="background:${r.color}"></span><b>${esc(r.d.name)}</b><br><span class="muted small">${esc(r.d.full)}</span></td>
                  <td class="num">${nPrev ? nPrev.reduce((a, b) => a + b, 0) : '–'}</td>
                  <td class="num"><b>${r.resp.length}</b></td>
                  ${scoreCell((r.d.indexHistory[2024] || [])[0])}${scoreCell(r.prev[0])}${scoreCell(r.an.index[0], 'style="font-weight:800"')}
                  <td class="num">${gapHtml(r.an.index[0], r.prev[0])}</td><td>${catBadge(r.an.index[0])}</td>
                  ${AREAS.map((_, i) => scoreCell(r.an.index[i + 1])).join('')}
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <p class="note">${CFG.DIVISIONS.filter((d) => d.indexHistoryNote).map((d) => `${esc(d.name)}: ${esc(d.indexHistoryNote)}`).join(' ')}</p>
      </section>`;

    document.querySelectorAll('[data-go]').forEach((tr) => tr.addEventListener('click', () => { location.hash = '#' + tr.dataset.go; }));

    sparkline('kSpark', perDay, '#ffffff', true);
    rows.forEach((r) => {
      miniGauge('g-' + r.d.id, r.an.index[0], r.color, DIV_GRAD[r.d.id]);
      const years = Object.keys(r.d.indexHistory).map(Number).sort();
      sparkline('s-' + r.d.id, years.map((y) => r.d.indexHistory[y][0]).concat(A.round2(r.an.index[0])), r.color);
    });

    dumbbell('cDumb', rows.map((r) => r.d.name), rows.map((r) => r.prev[0] ?? null), rows.map((r) => A.round2(r.an.index[0])));
    bumpChart('cBump', rows);

    const heat = [];
    const cols = ['Total'].concat(AREAS);
    rows.forEach((r, y) => cols.forEach((_, x) => { if (r.an.index[x] != null) heat.push([x, y, A.round2(r.an.index[x])]); }));
    const hm = heatmap('cHeat', cols, rows.map((r) => r.d.name), heat);
    if (hm) hm.on('click', (p) => { if (p.value[0] > 0) setFilter('area', cols[p.value[0]]); });

    const sun = ec('cSun', {
      tooltip: { formatter: (p) => `${esc(p.treePathInfo.map((x) => x.name).filter(Boolean).join(' › '))}<br><b>${p.value}</b> respons` },
      series: [{
        type: 'sunburst', radius: ['14%', '92%'], sort: null, nodeClick: false,
        itemStyle: { borderColor: T.surface, borderWidth: 2, borderRadius: 4 },
        label: { color: '#fff', fontFamily: FONT, fontSize: 11, minAngle: 12 },
        levels: [{}, { label: { rotate: 'tangential', fontWeight: 700 } }, { label: { show: false } }],
        data: rows.map((r) => ({
          name: r.d.name, itemStyle: { color: r.color },
          children: AREAS.map((a, i) => ({ name: a, value: r.an.areaN[i], itemStyle: { color: fade(r.color, [0.85, 0.6, 0.38][i]) } })).filter((c) => c.value),
        })),
      }],
    });

    ec('cRiver', {
      color: rows.map((r) => r.color),
      tooltip: { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: T.muted, type: 'dashed' } } },
      legend: legendBase({ data: rows.map((r) => r.d.name) }),
      singleAxis: Object.assign(axisStyle(), { type: 'time', top: 40, bottom: 30, left: 30, right: 30, axisLabel: { color: T.ink2, formatter: '{d} {MMM}' } }),
      series: [{
        type: 'themeRiver', label: { show: false }, emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,.25)' } },
        data: days.flatMap((day) => rows.map((r) => [day, r.resp.filter((x) => x.date && isoDay(x.date) === day).length, r.d.name])),
      }],
    });

    if (sun) sun.on('click', (p) => { if (AREAS.includes(p.name)) setFilter('area', p.name); });

    const gaps = withIdx.filter((r) => r.prev[0] != null).map((r) => ({ r, g: A.round2(r.an.index[0]) - r.prev[0] })).sort((a, b) => b.g - a.g);
    const areaTot = AREAS.map((a, i) => [a, rows.reduce((t, r) => t + r.an.areaN[i], 0)]).sort((a, b) => b[1] - a[1]);
    let lowCell = null;
    rows.forEach((r) => AREAS.forEach((a, i) => { const v = r.an.index[i + 1]; if (v != null && (!lowCell || v < lowCell.v)) lowCell = { v, a, d: r.d.name }; }));
    const peak = perDay.length ? perDay.indexOf(Math.max(...perDay)) : -1;
    const sgn = (g) => (g >= 0 ? '+' : '') + g.toFixed(2);
    setSlides({
      'ov-band': [`Ringkasan Index Pelayanan Divisi ${CFG.year}`, withIdx.length ? `Rata-rata index <b>${f2(avgIdx)}</b> (${catLabel(avgIdx).toLowerCase()}) dari <b>${totalN}</b> respons di ${rows.length} survey divisi.` : ''],
      'ov-cards': ['Index per divisi', ranked.length ? `<b>${esc(ranked[0].d.name)}</b> tertinggi (${f2(ranked[0].an.index[0])}), <b>${esc(ranked[ranked.length - 1].d.name)}</b> terendah (${f2(ranked[ranked.length - 1].an.index[0])}). ${up} divisi naik, ${down} turun dibanding ${CFG.prevYear}.` : ''],
      'ov-insight': ['Temuan utama', insights[3] || insights[0] || ''],
      'ov-change': [`Perubahan & peringkat ${CFG.prevYear} → ${CFG.year}`, gaps.length ? `Kenaikan terbesar <b>${esc(gaps[0].r.d.name)}</b> (${sgn(gaps[0].g)}); penurunan terbesar <b>${esc(gaps[gaps.length - 1].r.d.name)}</b> (${sgn(gaps[gaps.length - 1].g)}).` : ''],
      'ov-area': ['Index per area & komposisi responden', `Responden terbanyak dari <b>${areaTot[0][0]}</b> (${areaTot[0][1]} respons).${lowCell ? ` Skor area terendah: <b>${esc(lowCell.d)}</b> di ${lowCell.a} (${f2(lowCell.v)}).` : ''} Klik area untuk memfilter.`],
      'ov-river': ['Arus respons harian', peak >= 0 ? `Puncak respons <b>${perDay[peak]}</b> pada ${fmtDate(new Date(days[peak]))}; pengisian berlangsung ${days.length} hari.` : ''],
      'ov-rank': ['Indikator tertinggi & terendah', best[0] ? `Tertinggi: <b>${esc(best[0].label)}</b> (${esc(best[0].divName)}, ${f2(best[0].stats.mean)}). Terendah: <b>${esc(worst[0].label)}</b> (${esc(worst[0].divName)}, ${f2(worst[0].stats.mean)}).` : ''],
      'ov-table': ['Tabel index per divisi', `${withIdx.filter((r) => r.an.index[0] > 4.2).length} dari ${withIdx.length} divisi berkategori <b>sangat puas</b> (> 4.2).`],
    });

    lollipop('cBest', best.map((i) => `${i.label} · ${i.divName}`), best.map((i) => A.round2(i.stats.mean)), best.map((i) => DIV_COLOR[i.divId]));
    lollipop('cWorst', worst.map((i) => `${i.label} · ${i.divName}`), worst.map((i) => A.round2(i.stats.mean)), worst.map((i) => DIV_COLOR[i.divId]));
  }

  function kpi(label, value, sub, cls, sparkId) {
    return `<div class="kpi ${cls || ''}"><span class="kpi-label">${label}</span><span class="kpi-value">${value}</span><span class="kpi-sub">${sub || ''}</span>${sparkId ? `<div class="kpi-sparkbox" id="${sparkId}"></div>` : ''}</div>`;
  }

  /* ───────── komponen grafik ───────── */
  function miniGauge(id, value, color, color2, opts) {
    const o = opts || {};
    return ec(id, {
      series: [{
        type: 'gauge', startAngle: 220, endAngle: -40, min: o.min ?? 1, max: o.max ?? 5, radius: '96%', center: ['50%', '56%'],
        progress: { show: true, width: o.width || 10, roundCap: true, itemStyle: { color: grad(color2 || color, color, true) } },
        axisLine: { roundCap: true, lineStyle: { width: o.width || 10, color: [[1, o.track || T.surface2]] } },
        axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false }, anchor: { show: false },
        title: { show: !!o.title, offsetCenter: [0, '42%'], color: T.muted, fontSize: 11, fontFamily: FONT },
        detail: { valueAnimation: true, offsetCenter: [0, o.title ? '-6%' : '4%'], fontSize: o.fontSize || 20, fontWeight: 800, fontFamily: FONT, color: o.textColor || T.ink, formatter: o.formatter || ((v) => (value == null ? '–' : v.toFixed(2))) },
        data: [{ value: value == null ? (o.min ?? 1) : A.round2(value), name: o.title || '' }],
      }],
    });
  }

  function sparkline(id, values, color, onDark) {
    return ec(id, {
      grid: { left: 2, right: 6, top: 6, bottom: 2 },
      xAxis: { type: 'category', show: false, boundaryGap: false, data: values.map((_, i) => i) },
      yAxis: { type: 'value', show: false, scale: true },
      tooltip: { show: false },
      series: [{
        type: 'line', data: values, smooth: true, symbol: 'none', connectNulls: true,
        lineStyle: { width: 2, color: onDark ? 'rgba(255,255,255,.9)' : color },
        areaStyle: { color: grad(onDark ? 'rgba(255,255,255,.35)' : fade(color, 0.35), onDark ? 'rgba(255,255,255,0)' : fade(color, 0)) },
        endLabel: { show: false },
        markPoint: { symbol: 'circle', symbolSize: 7, itemStyle: { color: onDark ? '#fff' : color }, label: { show: false }, data: [{ coord: [values.length - 1, values[values.length - 1]] }] },
      }],
    });
  }

  function dumbbell(id, labels, prev, cur, o) {
    const opts = o || {};
    const vals = prev.concat(cur).filter((v) => v != null);
    const min = vals.length ? Math.max(1, Math.floor((Math.min(...vals) - 0.15) * 4) / 4) : 1;
    return ec(id, {
      grid: { left: 8, right: 40, top: 34, bottom: 10, containLabel: true },
      legend: legendBase({ data: [String(CFG.prevYear), String(CFG.year)] }),
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: fade('#2563eb', 0.06) } },
        formatter: (ps) => { const i = ps[0].dataIndex; return `<b>${esc(labels[i])}</b><br>${CFG.prevYear}: ${f2(prev[i])}<br>${CFG.year}: <b>${f2(cur[i])}</b> ${prev[i] != null && cur[i] != null ? `(${cur[i] - prev[i] >= 0 ? '+' : ''}${(cur[i] - prev[i]).toFixed(2)})` : ''}${opts.extra ? opts.extra(i) : ''}`; } },
      xAxis: axisStyle({ type: 'value', min, max: 5 }),
      yAxis: axisStyle({ type: 'category', inverse: true, data: labels, splitLine: { show: false }, axisLine: { show: false },
        axisLabel: { color: T.ink2, fontFamily: FONT, fontSize: 11, width: opts.labelWidth || 150, overflow: 'break', lineHeight: 14 } }),
      series: [
        { type: 'custom', silent: true, z: 1, renderItem: (params, api) => {
            const a = api.value(1), b = api.value(2);
            if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) return null;
            const p1 = api.coord([a, api.value(0)]), p2 = api.coord([b, api.value(0)]);
            return { type: 'line', shape: { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] }, style: { stroke: b >= a ? fade('#16a34a', 0.55) : fade('#f59e0b', 0.7), lineWidth: 5, lineCap: 'round' } };
          }, encode: { y: 0, x: [1, 2] }, data: labels.map((_, i) => [i, prev[i], cur[i]]) },
        { name: String(CFG.prevYear), type: 'scatter', z: 2, symbolSize: 13, color: YEAR_COLOR.prev, itemStyle: { color: YEAR_COLOR.prev, borderColor: T.surface, borderWidth: 2 }, data: prev.map((v, i) => [v, i]) },
        { name: String(CFG.year), type: 'scatter', z: 3, symbolSize: 16, color: opts.color || YEAR_COLOR.cur, itemStyle: { color: opts.color || YEAR_COLOR.cur, borderColor: T.surface, borderWidth: 2 },
          label: { show: true, formatter: (p) => f2(p.value[0]), color: T.ink, fontWeight: 700, fontSize: 11 },
          data: cur.map((v, i) => ({ value: [v, i], label: { position: prev[i] != null && v != null && v < prev[i] ? 'left' : 'right' } })) },
      ],
    });
  }

  function bumpChart(id, rows) {
    const years = [...new Set(rows.flatMap((r) => Object.keys(r.d.indexHistory).map(Number)))].sort().concat(CFG.year);
    const valueOf = (r, y) => (y === CFG.year ? r.an.index[0] : (r.d.indexHistory[y] || [])[0]);
    const ranks = {};
    years.forEach((y) => {
      rows.filter((r) => valueOf(r, y) != null).sort((a, b) => valueOf(b, y) - valueOf(a, y)).forEach((r, i) => { (ranks[r.d.id] = ranks[r.d.id] || {})[y] = i + 1; });
    });
    return ec(id, {
      grid: { left: 30, right: 90, top: 20, bottom: 30 },
      tooltip: { trigger: 'item', formatter: (p) => `<b>${esc(p.seriesName)}</b> · ${years[p.dataIndex]}<br>Peringkat ${p.value}<br>Index ${f2(valueOf(rows[p.seriesIndex], years[p.dataIndex]))}` },
      xAxis: axisStyle({ type: 'category', data: years.map(String), boundaryGap: false, splitLine: { show: true, lineStyle: { color: T.line, type: 'dashed' } } }),
      yAxis: axisStyle({ type: 'value', inverse: true, min: 1, max: rows.length, interval: 1, axisLabel: { formatter: '#{value}', color: T.ink2 } }),
      series: rows.map((r) => ({
        name: r.d.name, type: 'line', smooth: 0.3, connectNulls: false, symbol: 'circle', symbolSize: 14,
        lineStyle: { width: 4, color: r.color }, itemStyle: { color: r.color, borderColor: T.surface, borderWidth: 2 },
        endLabel: { show: true, formatter: '{a}', color: r.color, fontWeight: 700, fontFamily: FONT },
        emphasis: { focus: 'series' },
        data: years.map((y) => (ranks[r.d.id] || {})[y] ?? null),
      })),
    });
  }

  function heatmap(id, xLabels, yLabels, data, o) {
    const opts = o || {};
    return ec(id, {
      grid: { left: 8, right: 10, top: 10, bottom: 50, containLabel: true },
      tooltip: { formatter: (p) => `${esc(yLabels[p.value[1]])}<br>${esc(xLabels[p.value[0]])}: <b>${f2(p.value[2])}</b> · ${catLabel(p.value[2])}` },
      xAxis: axisStyle({ type: 'category', data: xLabels, splitArea: { show: false }, axisLine: { show: false }, position: 'top' }),
      yAxis: axisStyle({ type: 'category', data: yLabels, inverse: true, axisLine: { show: false },
        axisLabel: { color: T.ink2, fontFamily: FONT, fontSize: 11, width: opts.labelWidth || 130, overflow: 'truncate' } }),
      visualMap: {
        type: 'piecewise', orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 14, itemHeight: 10, textStyle: { color: T.ink2, fontSize: 11 },
        pieces: [
          { gte: 4.2, label: '> 4.2 Sangat puas', color: CAT_COLOR['cat-5'] },
          { gte: 3.4, lt: 4.2, label: '3.4–4.2 Puas', color: CAT_COLOR['cat-4'] },
          { gte: 2.6, lt: 3.4, label: '2.6–3.4 Antara', color: CAT_COLOR['cat-3'] },
          { lt: 2.6, label: '< 2.6 Kurang', color: CAT_COLOR['cat-1'] },
        ],
      },
      series: [{ type: 'heatmap', data, label: { show: true, color: '#fff', fontWeight: 700, fontSize: 12, formatter: (p) => f2(p.value[2]) },
        itemStyle: { borderColor: T.surface, borderWidth: 3, borderRadius: 6 }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,.3)' } } }],
    });
  }

  function lollipop(id, labels, values, colors, o) {
    const opts = o || {};
    const vals = values.filter((v) => v != null);
    const min = opts.min != null ? opts.min : (vals.length ? Math.max(0, Math.floor((Math.min(...vals) - 0.2) * 4) / 4) : 0);
    return ec(id, {
      grid: { left: 8, right: 64, top: 8, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'none' }, formatter: (ps) => `${esc(labels[ps[0].dataIndex])}<br><b>${opts.fmt ? opts.fmt(values[ps[0].dataIndex]) : f2(values[ps[0].dataIndex])}</b>` },
      xAxis: axisStyle({ type: 'value', min, max: opts.max, axisLabel: { color: T.ink2, formatter: opts.axisFmt } }),
      yAxis: axisStyle({ type: 'category', inverse: true, data: labels, splitLine: { show: false }, axisLine: { show: false },
        axisLabel: { color: T.ink2, fontFamily: FONT, fontSize: 11, width: opts.labelWidth || 220, overflow: 'break', lineHeight: 13 } }),
      series: [
        { type: 'bar', barWidth: 4, data: values.map((v, i) => ({ value: v, itemStyle: { color: grad(fade(colors[i % colors.length], 0.15), colors[i % colors.length], true), borderRadius: 2 } })), silent: true },
        { type: 'scatter', symbolSize: 16, data: values.map((v, i) => ({ value: v, itemStyle: { color: colors[i % colors.length], borderColor: T.surface, borderWidth: 3, shadowBlur: 6, shadowColor: fade(colors[i % colors.length], 0.4) } })),
          label: { show: true, position: 'right', distance: 8, color: T.ink, fontWeight: 700, fontSize: 11, formatter: (p) => (opts.fmt ? opts.fmt(p.value) : f2(p.value)) } },
      ],
    });
  }

  function donut(id, entries, o) {
    const opts = o || {};
    const total = entries.reduce((s, e) => s + e[1], 0);
    return ec(id, {
      color: opts.colors || PALETTE,
      tooltip: { formatter: (p) => `${esc(p.name)}<br><b>${p.value}</b> (${p.percent}%)` },
      legend: legendBase({ type: 'scroll', orient: 'vertical', right: 0, top: 'middle', itemWidth: 10, itemHeight: 10, textStyle: { color: T.ink2, fontSize: 11, width: 110, overflow: 'truncate' } }),
      title: opts.center === false ? undefined : { text: opts.centerText || String(total), subtext: opts.centerSub || 'total', left: opts.rose ? '-100%' : '30%', top: '40%', textAlign: 'center',
        textStyle: { color: T.ink, fontSize: 20, fontWeight: 800, fontFamily: FONT }, subtextStyle: { color: T.muted, fontSize: 11 } },
      series: [{
        type: 'pie', radius: opts.rose ? ['12%', '80%'] : ['48%', '78%'], center: ['31%', '52%'], roseType: opts.rose ? 'radius' : undefined,
        itemStyle: { borderColor: T.surface, borderWidth: 3, borderRadius: 6 }, label: { show: false }, avoidLabelOverlap: true,
        data: entries.map(([name, value]) => ({ name, value })),
      }],
    });
  }

  /* ───────── HALAMAN DIVISI ───────── */
  function renderDivision(d) {
    const prep = state.prepared[d.id];
    if (!prep || prep.missing) { $('#app').innerHTML = `<div class="empty">Sheet "${esc(d.sheet)}" tidak ditemukan di sumber data.</div>`; return; }
    const color = DIV_COLOR[d.id];
    const resp = filtered(prep);
    const an = A.analyzeDivision(prep, resp);
    const prev = d.indexHistory[CFG.prevYear] || [];
    const ov = an.items.find((i) => i.overall && i.sub === 'Kepuasan keseluruhan');
    const scored = an.items.filter((i) => !i.overall && i.stats.n > 0);
    const t2b = A.mean(scored.map((i) => i.stats.top2));
    const missingCols = an.items.filter((i) => i.col < 0).map((i) => i.label);
    state.ui.itemView = state.ui.itemView || 'dumbbell';

    $('#app').innerHTML = `
      <section data-s="dv-band" class="band">
        <div class="band-head">
          <div class="band-text">
            <p class="eyebrow">Survey Pengukuran Kepuasan · ${esc(d.full)}</p>
            <h1>Index Pelayanan ${esc(d.name)} ${CFG.year}</h1>
            <p class="band-meta">${resp.length} responden${resp.length !== prep.respondents.length ? ` (dari ${prep.respondents.length}, sesuai filter)` : ''} · ${esc(state.source)}</p>
          </div>
          ${MASCOT}
        </div>
        <div class="band-kpis">
          <div class="kpi kpi-gauge"><span class="kpi-label">Index ${CFG.year}</span><div class="kpi-gaugebox" id="kGauge"></div>${catBadge(an.index[0])}</div>
          ${kpi('Perubahan vs ' + CFG.prevYear, prev[0] != null ? gapHtml(an.index[0], prev[0]) : '–', prev[0] != null ? `Index ${CFG.prevYear}: ${f2(prev[0])}` : 'Belum ada pembanding')}
          <div class="kpi kpi-gauge"><span class="kpi-label">Responden per area</span><div class="kpi-gaugebox" id="kArea"></div><span class="kpi-sub">${AREAS.map((a, i) => `${a}: ${an.areaN[i]}`).join(' · ')}</span></div>
          <div class="kpi kpi-gauge"><span class="kpi-label">${ov ? 'Kepuasan keseluruhan' : 'Responden puas'}</span><div class="kpi-gaugebox" id="kT2b"></div><span class="kpi-sub">${ov ? `Skor ${f2(ov.stats.mean)} · % jawaban puas` : 'rata-rata % Puas + Sangat puas'}</span></div>
        </div>
      </section>
      ${missingCols.length ? `<div class="alert">Kolom tidak ditemukan di sheet: ${missingCols.map(esc).join('; ')}. Periksa judul kolom pada spreadsheet.</div>` : ''}

      <section data-s="dv-insight" class="card insight"><h2>Temuan utama</h2><ul>${divisionInsights(d, an, prev).map((i) => `<li>${i}</li>`).join('')}</ul></section>

      <section data-s="dv-trend" class="grid-2">
        <div class="card"><h2>Tren index per area</h2><p class="muted">${Object.keys(d.indexHistory).length ? 'Index total dan per area kerja, ' + Object.keys(d.indexHistory)[0] + '–' + CFG.year + '.' : 'Pembanding tahun lalu belum tersedia.'}</p><div class="chart h-300" id="cTrend"></div>${d.indexHistoryNote ? `<p class="note">${esc(d.indexHistoryNote)}</p>` : ''}</div>
        <div class="card"><h2>${an.subs.filter((s) => !s.overall && s.value).length + an.groups.length >= 3 ? 'Radar sub-kategori' : 'Radar indikator'}</h2><p class="muted">Garis putus abu-abu = ${CFG.prevYear}, area berwarna = ${CFG.year}.</p><div class="chart h-300" id="cRadar"></div></div>
      </section>

      <section data-s="dv-items" class="card">
        <div class="card-head row">
          <div><h2>Skor per indikator</h2><p class="muted" id="itemHint"></p></div>
          <div class="seg" role="tablist">
            <button type="button" class="seg-btn" data-view="dumbbell">Dumbbell ${CFG.prevYear}→${CFG.year}</button>
            <button type="button" class="seg-btn" data-view="dist">Distribusi jawaban</button>
            <button type="button" class="seg-btn" data-view="heat">Heatmap area</button>
          </div>
        </div>
        <div class="chart" id="cItems" style="height:${Math.max(280, scored.length * 40 + 90)}px"></div>
      </section>

      <section data-s="dv-prio" class="grid-2">
        <div class="card"><h2>Matriks prioritas</h2><p class="muted">Sumbu X = skor ${CFG.year}, sumbu Y = % responden belum puas (netral/tidak puas). Kuadran kanan-atas = prioritas perbaikan.</p><div class="chart h-360" id="cQuad"></div></div>
        <div class="card"><h2>Prioritas perbaikan</h2><p class="muted">Bahan <i>problem identification</i> &amp; <i>corrective action</i>.</p>${priorityHtml(an)}</div>
      </section>

      ${extrasHtml(prep)}

      <section data-s="dv-comments" class="card" id="comments"></section>

      <section data-s="dv-table" class="card">
        <div class="card-head row">
          <div><h2>Tabel index ${esc(d.name)}</h2><p class="muted">Format seperti report ${CFG.prevYear}: total dan per area kerja. Gap = ${CFG.year} − ${CFG.prevYear}.</p></div>
          <label class="inline" for="sortSel">Urutkan
            <select id="sortSel">
              <option value="sub">Per sub-kategori</option>
              <option value="desc">Skor tertinggi</option>
              <option value="asc">Skor terendah</option>
              <option value="gap">Penurunan terbesar</option>
            </select>
          </label>
        </div>
        <div class="table-wrap" id="idxTable"></div>
        <details class="outline" ${state.ui.outlineOpen ? 'open' : ''}>
          <summary><h3>Outline survey &amp; jumlah responden 2021–${CFG.year}</h3></summary>
          ${outlineHtml(d, an)}
        </details>
      </section>

      <section data-s="dv-profile" class="card">
        <h2>Profil responden</h2>
        <div class="grid-3">
          <div><h3>Area kerja</h3><div class="chart h-240" id="cProfArea"></div></div>
          <div><h3>Jabatan</h3><div class="chart h-240" id="cProfJab"></div></div>
          <div><h3>Divisi responden</h3><div class="chart h-240" id="cProfDiv"></div></div>
          ${(d.profile || []).map((p, i) => `<div><h3>${esc(p)}</h3><div class="chart h-240" id="cProfX${i}"></div></div>`).join('')}
        </div>
      </section>`;

    $('details.outline').addEventListener('toggle', (e) => { state.ui.outlineOpen = e.target.open; });
    const sortSel = $('#sortSel');
    sortSel.value = state.ui.sort || 'sub';
    const drawTable = () => { $('#idxTable').innerHTML = indexTableHtml(d, an, sortSel.value); };
    sortSel.addEventListener('change', () => { state.ui.sort = sortSel.value; drawTable(); });
    drawTable();

    miniGauge('kGauge', an.index[0], '#ffffff', 'rgba(255,255,255,.55)', { fontSize: 24, width: 12, textColor: '#ffffff', track: 'rgba(255,255,255,.22)' });
    ec('kArea', {
      color: ['#ffffff', 'rgba(255,255,255,.7)', 'rgba(255,255,255,.42)'],
      tooltip: { formatter: (p) => `${p.name}: <b>${p.value}</b> (${p.percent}%)` },
      title: { text: String(an.n), left: 'center', top: '36%', textStyle: { color: '#fff', fontSize: 22, fontWeight: 800, fontFamily: FONT } },
      series: [{ type: 'pie', radius: ['58%', '86%'], label: { show: false }, itemStyle: { borderColor: 'rgba(0,0,0,0)', borderWidth: 2, borderRadius: 4 },
        data: AREAS.map((a, i) => ({ name: a, value: an.areaN[i] })) }],
    });
    const t2v = ov ? ov.stats.top2 : t2b;
    ec('kT2b', {
      series: [{
        type: 'gauge', startAngle: 90, endAngle: -270, min: 0, max: 100, radius: '92%',
        progress: { show: true, width: 11, roundCap: true, itemStyle: { color: '#ffffff' } },
        axisLine: { lineStyle: { width: 11, color: [[1, 'rgba(255,255,255,.22)']] } },
        axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false },
        detail: { offsetCenter: [0, 0], fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: FONT, formatter: (v) => (t2v == null ? '–' : Math.round(v) + '%') },
        data: [{ value: t2v == null ? 0 : t2v * 100 }],
      }],
    });

    drawTrend(d, an, color);
    drawRadar(d, an, color);
    const setView = (v) => {
      state.ui.itemView = v;
      document.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('active', x.dataset.view === v));
      const old = echarts.getInstanceByDom($('#cItems'));
      if (old) { state.charts = state.charts.filter((c) => c !== old); old.dispose(); }
      drawItems(an, v, color);
    };
    document.querySelectorAll('.seg-btn').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    setView(state.ui.itemView);
    drawQuadrant(an);
    drawExtras(prep, resp, color);
    divisionSlides(d, an, prev, prep, resp);
    renderComments(prep, resp, color);
    drawProfile(d, resp, color);
  }

  function divisionSlides(d, an, prev, prep, resp) {
    const items = an.items.filter((i) => !i.overall && i.stats.n > 0);
    const byMean = items.slice().sort((a, b) => b.stats.mean - a.stats.mean);
    const idx = an.index[0];
    const g = prev[0] != null && idx != null ? A.round2(idx) - prev[0] : null;
    const areas = AREAS.map((a, i) => ({ a, v: an.index[i + 1] })).filter((x) => x.v != null).sort((a, b) => a.v - b.v);
    const subs = an.subs.filter((s) => !s.overall && s.value && s.value[0] != null).sort((a, b) => a.value[0] - b.value[0]);
    const prio = priorityTop(an)[0];
    const mx = A.mean(items.map((i) => i.stats.mean)), my = A.mean(items.map((i) => 1 - i.stats.top2));
    const nQuad = items.filter((i) => i.stats.mean < mx && 1 - i.stats.top2 > my).length;
    const entries = A.textEntries(prep, resp);
    const themes = Object.keys(d.themes || {}).map((t) => [t, entries.filter((e) => e.themes.includes(t)).length]).sort((a, b) => b[1] - a[1]);
    const words = A.wordFreq(entries, 3).map((w) => `“${esc(w[0])}”`);
    const cnt = (fn) => { const c = {}; resp.forEach((r) => { const k = fn(r); c[k] = (c[k] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]); };
    const topArea = cnt((r) => r.area)[0], topJab = cnt((r) => r.jab)[0];
    const drops = items.filter((i) => i.b25 && i.b25[0] != null && i.stats.mean < i.b25[0] - 0.005).length;
    setSlides({
      'dv-band': [`Index Pelayanan ${d.name} ${CFG.year}`, idx != null ? `Index <b>${f2(idx)}</b> (${catLabel(idx).toLowerCase()})${g != null ? `, ${g > 0.004 ? 'naik' : g < -0.004 ? 'turun' : 'tetap'} ${Math.abs(g).toFixed(2)} dari ${f2(prev[0])} di ${CFG.prevYear}` : ''} · ${an.n} responden.` : 'Belum ada jawaban untuk filter ini.'],
      'dv-insight': ['Temuan utama', divisionInsights(d, an, prev)[1] || ''],
      'dv-trend': ['Tren index & sub-kategori', [areas.length > 1 ? `Area terendah <b>${areas[0].a}</b> (${f2(areas[0].v)}), tertinggi <b>${areas[areas.length - 1].a}</b> (${f2(areas[areas.length - 1].v)}).` : '', subs.length > 1 ? `Sub-kategori terendah <b>${esc(subs[0].name)}</b> (${f2(subs[0].value[0])}).` : ''].join(' ')],
      'dv-items': ['Skor per indikator', byMean.length ? `Tertinggi <b>${esc(byMean[0].label)}</b> (${f2(byMean[0].stats.mean)}); terendah <b>${esc(byMean[byMean.length - 1].label)}</b> (${f2(byMean[byMean.length - 1].stats.mean)}).${drops ? ` ${drops} indikator turun dibanding ${CFG.prevYear}.` : ''}` : ''],
      'dv-prio': ['Prioritas perbaikan', prio ? `Prioritas #1: <b>${esc(prio.label)}</b> (${f2(prio.stats.mean)}). ${nQuad} indikator berada di kuadran prioritas utama.` : ''],
      'dv-extras': ['Analisis tambahan', ''],
      'dv-comments': ['Kritik & saran karyawan', entries.length ? `${entries.length} masukan bermakna${themes[0] && themes[0][1] ? `; tema terbanyak <b>${esc(themes[0][0])}</b> (${themes[0][1]})` : ''}${words.length ? `; kata yang sering muncul ${words.join(', ')}` : ''}.` : 'Belum ada masukan tertulis.'],
      'dv-table': [`Tabel index ${d.name}`, `${items.filter((i) => i.stats.mean > 4.2).length} dari ${items.length} indikator berkategori <b>sangat puas</b> (> 4.2)${drops ? `; ${drops} indikator turun vs ${CFG.prevYear}` : ''}.`],
      'dv-profile': ['Profil responden', topArea ? `Mayoritas responden dari <b>${topArea[0]}</b> (${share(topArea[1], resp.length)}); jabatan terbanyak <b>${esc(topJab[0])}</b> (${share(topJab[1], resp.length)}). Klik area atau divisi untuk memfilter.` : ''],
    });
  }

  function divisionInsights(d, an, prev) {
    const out = [];
    const idx = an.index[0];
    if (idx == null) return ['Belum ada jawaban untuk filter ini.'];
    let s = `Index Pelayanan ${esc(d.name)} ${CFG.year} sebesar <b>${f2(idx)}</b> dan berada dalam kategori <b>${catLabel(idx).toLowerCase()}</b>`;
    if (prev[0] != null) {
      const g = A.round2(idx) - prev[0];
      s += g > 0.004 ? `, <b>meningkat</b> dari ${f2(prev[0])} di ${CFG.prevYear}` : g < -0.004 ? `, <b>menurun</b> dari ${f2(prev[0])} di ${CFG.prevYear}` : `, sama dengan ${CFG.prevYear}`;
    }
    out.push(s + '.');
    const items = an.items.filter((i) => !i.overall && i.stats.n > 0);
    if (items.length) {
      const lo = items.slice().sort((a, b) => a.stats.mean - b.stats.mean)[0];
      const hi = items.slice().sort((a, b) => b.stats.mean - a.stats.mean)[0];
      out.push(`Skor tertinggi: <b>${esc(hi.label)}</b> (${f2(hi.stats.mean)}). Skor terendah: <b>${esc(lo.label)}</b> (${f2(lo.stats.mean)}).`);
      const drops = items.filter((i) => i.b25 && i.b25[0] != null).map((i) => ({ i, g: i.stats.mean - i.b25[0] })).sort((a, b) => a.g - b.g);
      if (drops.length && drops[0].g < -0.05) out.push(`Penurunan terbesar vs ${CFG.prevYear}: <b>${esc(drops[0].i.label)}</b> (${f2(drops[0].i.b25[0])} → ${f2(drops[0].i.stats.mean)}).`);
      const ups = drops.slice().reverse();
      if (ups.length && ups[0].g > 0.05) out.push(`Kenaikan terbesar: <b>${esc(ups[0].i.label)}</b> (${f2(ups[0].i.b25[0])} → ${f2(ups[0].i.stats.mean)}).`);
    }
    const areas = AREAS.map((a, i) => ({ a, v: an.index[i + 1], n: an.areaN[i] })).filter((x) => x.v != null);
    if (areas.length > 1) {
      const lo = areas.slice().sort((a, b) => a.v - b.v)[0];
      out.push(`Area dengan index terendah: <b>${lo.a}</b> (${f2(lo.v)}, n=${lo.n}).`);
    }
    const subs = an.subs.filter((s2) => !s2.overall && s2.value && s2.value[0] != null);
    if (subs.length > 1) {
      const lo = subs.slice().sort((a, b) => a.value[0] - b.value[0])[0];
      out.push(`Sub-kategori terendah: <b>${esc(lo.name)}</b> (${f2(lo.value[0])}).`);
    }
    return out;
  }

  function outlineHtml(d, an) {
    const years = Object.keys(d.nHistory).map(Number).sort();
    const tot = (arr) => arr.reduce((a, b) => a + b, 0);
    return `
      <dl class="outline-grid">
        <dt>Background</dt><dd>Index kepuasan ${esc(d.name)} kepada karyawan dilaksanakan dari tahun ke tahun.</dd>
        <dt>Objective</dt><dd><ul>${d.objective.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></dd>
        <dt>Checked points</dt><dd>Skoring kepuasan skala 5 terhadap item pelayanan tim ${esc(d.name)} kepada karyawan, harapan dan saran.</dd>
        <dt>Area / Date</dt><dd>Periode ${esc(CFG.period)}</dd>
        <dt>Respondent</dt><dd>Karyawan MPM semua divisi &amp; lokasi kerja</dd>
        <dt>Metodologi</dt><dd>Self survey melalui link survey di aplikasi MPM Online Survey Tools (MOST)</dd>
      </dl>
      <div class="table-wrap">
        <table class="idx-table compact">
          <thead><tr><th class="left">Area</th>${years.map((y) => `<th>n ${y}</th>`).join('')}<th class="hl">n ${CFG.year}</th></tr></thead>
          <tbody>
            ${AREAS.map((a, i) => `<tr><td class="left">${a === 'Others' ? 'Other (luar Sby &amp; Sedati)' : 'Mulia ' + a}</td>${years.map((y) => `<td class="num">${d.nHistory[y][i]}</td>`).join('')}<td class="num hl">${an.areaN[i]}</td></tr>`).join('')}
            <tr class="total"><td class="left">Total</td>${years.map((y) => `<td class="num">${tot(d.nHistory[y])}</td>`).join('')}<td class="num hl">${an.n}</td></tr>
          </tbody>
        </table>
      </div>
      ${d.nHistoryNote ? `<p class="note">${esc(d.nHistoryNote)}</p>` : ''}`;
  }

  function indexTableHtml(d, an, sort) {
    const head = `
      <thead>
        <tr><th rowspan="2" class="left sticky-col">Indikator</th><th colspan="3">Total</th>${AREAS.map((a) => `<th colspan="3">${a}</th>`).join('')}<th rowspan="2">n</th><th rowspan="2" title="% jawaban Puas + Sangat puas">% Puas</th><th rowspan="2" title="% jawaban Tidak puas + Sangat tidak puas">% Tidak puas</th></tr>
        <tr>${[0, 1, 2, 3].map(() => `<th>${CFG.prevYear}</th><th>${CFG.year}</th><th>Gap</th>`).join('')}</tr>
      </thead>`;
    const row = (it) => {
      const b = it.b25 || [];
      const st = it.stats;
      return `<tr class="${it.overall ? 'row-overall' : ''}">
        <td class="left sticky-col">${esc(it.label)}${it.note ? ` <span class="info" title="${esc(it.note)}">ⓘ</span>` : ''}${it.col < 0 ? ' <span class="badge cat-2">kolom tidak ditemukan</span>' : ''}${st.notExp ? `<span class="muted small"> · ${st.notExp} tidak pernah</span>` : ''}</td>
        ${[0, 1, 2, 3].map((k) => { const cur = k === 0 ? st.mean : st.area[k - 1]; return `<td class="num prev">${f2(b[k])}</td>${scoreCell(cur)}<td class="num">${gapHtml(cur, b[k])}</td>`; }).join('')}
        <td class="num">${st.n}</td><td class="num">${pct(st.top2)}</td><td class="num ${st.bottom2 > 0.1 ? 'warn-text' : ''}">${pct(st.bottom2)}</td>
      </tr>`;
    };
    const subRow = (name, val, hist, cls) => {
      const p = hist[CFG.prevYear] || [];
      return `<tr class="${cls}"><td class="left sticky-col">${esc(name)}</td>${[0, 1, 2, 3].map((k) => `<td class="num prev">${f2(p[k])}</td>${scoreCell(val ? val[k] : null)}<td class="num">${gapHtml(val ? val[k] : null, p[k])}</td>`).join('')}<td colspan="3"></td></tr>`;
    };
    let body = '';
    const prevIdx = d.indexHistory[CFG.prevYear] || [];
    const totalRow = `<tr class="row-index"><td class="left sticky-col">INDEX ${esc(d.name.toUpperCase())}</td>${[0, 1, 2, 3].map((k) => `<td class="num prev">${f2(prevIdx[k])}</td>${scoreCell(an.index[k])}<td class="num">${gapHtml(an.index[k], prevIdx[k])}</td>`).join('')}<td class="num">${an.n}</td><td colspan="2"></td></tr>`;
    if (sort === 'sub') {
      an.groups.forEach((g) => { body += subRow(g.name, g.value, g.hist, 'row-group'); });
      an.subs.forEach((s) => {
        if (an.subs.length > 1 || s.overall) body += s.overall ? `<tr class="row-sub"><td class="left sticky-col" colspan="16">${esc(s.name)} <span class="muted small">(tidak dihitung dalam index)</span></td></tr>` : subRow(s.name, s.value, s.hist, 'row-sub');
        s.items.slice().sort((a, b) => (b.stats.mean ?? -1) - (a.stats.mean ?? -1)).forEach((it) => { body += row(it); });
      });
    } else {
      const gapOf = (i) => ((i.b25 && i.b25[0] != null && i.stats.mean != null) ? i.stats.mean - i.b25[0] : 9);
      const key = { desc: (a, b) => (b.stats.mean ?? -1) - (a.stats.mean ?? -1), asc: (a, b) => (a.stats.mean ?? 9) - (b.stats.mean ?? 9), gap: (a, b) => gapOf(a) - gapOf(b) }[sort];
      an.items.filter((i) => !i.overall).sort(key).forEach((it) => { body += row(it); });
    }
    return `<table class="idx-table">${head}<tbody>${totalRow}${body}</tbody></table>`;
  }

  function drawTrend(d, an, color) {
    const years = Object.keys(d.indexHistory).map(Number).sort().concat(CFG.year);
    const labels = ['Total'].concat(AREAS);
    const colors = [color].concat(AREA_COLOR);
    const all = years.flatMap((y) => (y === CFG.year ? an.index : (d.indexHistory[y] || []))).filter((v) => v != null);
    const tmin = all.length ? Math.max(1, Math.floor((Math.min(...all) - 0.1) * 4) / 4) : 1;
    ec('cTrend', {
      color: colors,
      legend: legendBase({ data: labels }),
      grid: { left: 8, right: 24, top: 40, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', valueFormatter: (v) => f2(v) },
      xAxis: axisStyle({ type: 'category', data: years.map(String), boundaryGap: false }),
      yAxis: axisStyle({ type: 'value', min: tmin, max: 5, interval: 5 - tmin > 1.5 ? 0.5 : 0.25 }),
      series: labels.map((l, k) => ({
        name: l, type: 'line', smooth: true, connectNulls: true, symbol: 'circle', symbolSize: k === 0 ? 10 : 7,
        lineStyle: { width: k === 0 ? 4 : 2, type: k === 0 ? 'solid' : 'solid' },
        itemStyle: { color: colors[k], borderColor: T.surface, borderWidth: 2 },
        areaStyle: k === 0 ? { color: grad(fade(color, 0.35), fade(color, 0.02)) } : undefined,
        emphasis: { focus: 'series' },
        data: years.map((y) => (y === CFG.year ? A.round2(an.index[k]) : (d.indexHistory[y] || [])[k] ?? null)),
      })),
    });
  }

  function drawRadar(d, an, color) {
    let list = an.groups.map((g) => ({ name: g.name, cur: g.value[0], prev: (g.hist[CFG.prevYear] || [])[0] }))
      .concat(an.subs.filter((s) => !s.overall && s.value).map((s) => ({ name: s.name, cur: s.value[0], prev: (s.hist[CFG.prevYear] || [])[0] })));
    if (list.length < 3) list = an.items.filter((i) => !i.overall && i.stats.n > 0).map((i) => ({ name: i.label, cur: i.stats.mean, prev: i.b25 ? i.b25[0] : null }));
    const vals = list.flatMap((x) => [x.cur, x.prev]).filter((v) => v != null);
    const min = vals.length ? Math.max(1, Math.floor((Math.min(...vals) - 0.15) * 4) / 4) : 1;
    const hasPrev = list.some((x) => x.prev != null);
    ec('cRadar', {
      legend: legendBase({ data: (hasPrev ? [String(CFG.prevYear)] : []).concat(String(CFG.year)) }),
      tooltip: { trigger: 'item' },
      radar: {
        center: ['50%', '56%'], radius: '64%', splitNumber: 4, shape: 'polygon',
        indicator: list.map((x) => ({ name: short(x.name, 24), min, max: 5 })),
        axisName: { color: T.ink2, fontFamily: FONT, fontSize: 11 },
        splitLine: { lineStyle: { color: T.line } }, splitArea: { areaStyle: { color: [fade(color, 0.02), fade(color, 0.06)] } }, axisLine: { lineStyle: { color: T.line } },
      },
      series: [{
        type: 'radar', symbol: 'circle', symbolSize: 6,
        data: (hasPrev ? [{ name: String(CFG.prevYear), value: list.map((x) => (x.prev == null ? min : x.prev)), lineStyle: { color: YEAR_COLOR.prev, width: 2, type: 'dashed' }, itemStyle: { color: YEAR_COLOR.prev }, areaStyle: { color: fade(YEAR_COLOR.prev, 0.12) } }] : [])
          .concat([{ name: String(CFG.year), value: list.map((x) => A.round2(x.cur)), lineStyle: { color, width: 3 }, itemStyle: { color }, areaStyle: { color: fade(color, 0.3) } }]),
      }],
    });
  }

  function drawItems(an, view, color) {
    const items = an.items.filter((i) => i.stats.n > 0 && (!i.overall || i.sub === 'Kepuasan keseluruhan'));
    const labels = items.map((i) => i.label);
    const hint = $('#itemHint');
    if (view === 'dist') {
      hint.textContent = 'Distribusi jawaban 100%: merah = tidak puas, abu-abu = netral, biru = puas.';
      const names = ['Sangat tidak puas', 'Tidak puas', 'Antara', 'Puas', 'Sangat puas'];
      return ec('cItems', {
        color: LIKERT,
        legend: legendBase({ data: names }),
        grid: { left: 8, right: 20, top: 36, bottom: 8, containLabel: true },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps) => `<b>${esc(labels[ps[0].dataIndex])}</b><br>` + ps.slice().reverse().map((p) => `${p.marker}${p.seriesName}: ${Math.round(p.value)}% (${items[p.dataIndex].stats.dist[names.indexOf(p.seriesName)]} org)`).join('<br>') },
        xAxis: axisStyle({ type: 'value', max: 100, axisLabel: { color: T.ink2, formatter: '{value}%' } }),
        yAxis: axisStyle({ type: 'category', inverse: true, data: labels, splitLine: { show: false }, axisLine: { show: false }, axisLabel: { color: T.ink2, fontSize: 11, width: 230, overflow: 'break', lineHeight: 13 } }),
        series: names.map((nm, k) => ({
          name: nm, type: 'bar', stack: 'x', barWidth: 18,
          itemStyle: { borderColor: T.surface, borderWidth: 1, borderRadius: k === 0 ? [6, 0, 0, 6] : k === 4 ? [0, 6, 6, 0] : 0 },
          label: { show: true, formatter: (p) => (p.value >= 9 ? Math.round(p.value) + '%' : ''), color: k === 2 ? '#334155' : '#fff', fontSize: 10, fontWeight: 700 },
          data: items.map((i) => (i.stats.n ? (i.stats.dist[k] / i.stats.n) * 100 : 0)),
        })),
      });
    }
    if (view === 'heat') {
      hint.textContent = 'Heatmap skor per indikator dan area kerja, berwarna sesuai kategori kepuasan.';
      const cols = ['Total'].concat(AREAS);
      const data = [];
      items.forEach((it, y) => cols.forEach((_, x) => { const v = x === 0 ? it.stats.mean : it.stats.area[x - 1]; if (v != null) data.push([x, y, A.round2(v)]); }));
      return heatmap('cItems', cols, labels, data, { labelWidth: 230 });
    }
    hint.textContent = `Titik abu-abu = ${CFG.prevYear}, titik berwarna = ${CFG.year}. Garis hijau = naik, kuning = turun. Indikator baru hanya menampilkan titik ${CFG.year}.`;
    return dumbbell('cItems', labels, items.map((i) => (i.b25 ? i.b25[0] : null)), items.map((i) => A.round2(i.stats.mean)), {
      color, labelWidth: 230,
      extra: (i) => `<br>n = ${items[i].stats.n} · ${pct(items[i].stats.top2)} puas${items[i].note ? '<br><i>' + esc(items[i].note) + '</i>' : ''}`,
    });
  }

  function drawQuadrant(an) {
    const items = an.items.filter((i) => !i.overall && i.stats.n > 0);
    const subs = [...new Set(items.map((i) => i.sub))];
    const pts = items.map((i, k) => ({ i, k, x: A.round2(i.stats.mean), y: Math.round((1 - i.stats.top2) * 100) }));
    const mx = A.mean(pts.map((p) => p.x)), my = A.mean(pts.map((p) => p.y));
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const xmin = Math.max(1, Math.floor((Math.min(...xs) - 0.1) * 10) / 10), xmax = Math.min(5, Math.ceil((Math.max(...xs) + 0.1) * 10) / 10);
    const ymax = Math.max(10, Math.ceil((Math.max(...ys) + 5) / 5) * 5);
    ec('cQuad', {
      color: PALETTE,
      legend: legendBase({ type: 'scroll', data: subs }),
      grid: { left: 8, right: 24, top: 64, bottom: 28, containLabel: true },
      tooltip: { formatter: (p) => { const q = pts[p.data.k]; return `<b>${esc(q.i.label)}</b><br>Skor ${f2(q.x)} · ${q.y}% belum puas<br>n = ${q.i.stats.n}`; } },
      xAxis: axisStyle({ type: 'value', name: 'Skor', nameLocation: 'middle', nameGap: 24, min: xmin, max: xmax, inverse: true }),
      yAxis: axisStyle({ type: 'value', name: '% belum puas', min: 0, max: ymax, axisLabel: { color: T.ink2, formatter: '{value}%' } }),
      series: subs.map((s, si) => ({
        name: s, type: 'scatter',
        symbolSize: (v) => 12 + Math.sqrt(v[2]) * 2,
        itemStyle: { color: PALETTE[si % PALETTE.length], opacity: 0.85, borderColor: T.surface, borderWidth: 2, shadowBlur: 6, shadowColor: fade(PALETTE[si % PALETTE.length], 0.35) },
        label: { show: true, formatter: (p) => String(p.data.k + 1), color: '#fff', fontSize: 10, fontWeight: 700 },
        data: pts.filter((p) => p.i.sub === s).map((p) => ({ value: [p.x, p.y, p.i.stats.n], k: p.k })),
        markLine: si === 0 ? { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: T.muted, type: 'dashed' }, data: [{ xAxis: A.round2(mx) }, { yAxis: Math.round(my) }] } : undefined,
        markArea: si === 0 ? { silent: true, itemStyle: { color: fade('#dc2626', 0.07) }, label: { show: true, position: 'insideTopRight', color: '#dc2626', fontWeight: 700, fontSize: 11 },
          data: [[{ name: 'Prioritas utama', xAxis: A.round2(mx), yAxis: Math.round(my) }, { xAxis: xmin, yAxis: ymax }],
            [{ name: 'Pertahankan', xAxis: xmax, yAxis: 0, itemStyle: { color: fade('#16a34a', 0.07) }, label: { position: 'insideBottomLeft', color: '#16a34a' } }, { xAxis: A.round2(mx), yAxis: Math.round(my) }]] } : undefined,
      })),
    });
  }

  function priorityTop(an) {
    const items = an.items.filter((i) => !i.overall && i.stats.n > 0);
    const scoreOf = (i) => (4.2 - i.stats.mean) * 2 + (i.b25 && i.b25[0] != null ? Math.max(0, i.b25[0] - i.stats.mean) * 3 : 0) + (i.stats.bottom2 || 0) * 4;
    return items.slice().sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, 5);
  }

  function priorityHtml(an) {
    const top = priorityTop(an);
    if (!top.length) return '<p class="muted">Belum ada data.</p>';
    return `<div class="prio">${top.map((i, k) => {
      const reasons = [];
      if (i.stats.mean < 4.2) reasons.push(`skor ${f2(i.stats.mean)} belum “sangat puas”`);
      if (i.b25 && i.b25[0] != null && i.stats.mean < i.b25[0] - 0.005) reasons.push(`turun ${f2(i.b25[0] - i.stats.mean)} dari ${CFG.prevYear}`);
      if (i.stats.bottom2 > 0) reasons.push(`${pct(i.stats.bottom2)} responden tidak puas`);
      const lowArea = AREAS.map((a, x) => ({ a, v: i.stats.area[x] })).filter((x) => x.v != null).sort((a, b) => a.v - b.v)[0];
      if (lowArea && lowArea.v < i.stats.mean - 0.15) reasons.push(`terendah di ${lowArea.a} (${f2(lowArea.v)})`);
      if (!reasons.length) reasons.push('skor relatif paling rendah');
      const num = an.items.filter((x) => !x.overall && x.stats.n > 0).indexOf(i) + 1;
      return `<div class="prio-item" style="--pc:${catColor(i.stats.mean)}"><span class="prio-n" title="Nomor pada matriks prioritas">${num}</span><div><b>${esc(i.label)}</b><span class="muted small"> · ${esc(i.sub)}</span><p>${reasons.join(' · ')}</p></div><span class="prio-val">${f2(i.stats.mean)}</span></div>`;
    }).join('')}</div>`;
  }

  /* ───────── ekstra per divisi ───────── */
  function extrasHtml(prep) {
    const parts = [];
    if (prep.gates.length) parts.push(`<div class="card" id="xcG"><h2>Interaksi dengan layanan</h2><p class="muted">Persentase responden yang pernah berinteraksi dengan tiap unit.</p><div class="chart h-280" id="cGates"></div></div>`);
    prep.extras.forEach((x, k) => {
      if (!x.cols.length) return;
      if (x.type === 'nps') parts.push(`<div class="card span-2" id="xc${k}"><h2>${esc(x.label)}</h2><div class="nps-wrap"><div class="chart h-240" id="cXg${k}"></div><div class="chart h-240" id="cX${k}"></div></div><div id="xNps${k}"></div></div>`);
      else if (x.type === 'yesno') parts.push(`<div class="card" id="xc${k}"><h2>${esc(x.label)}</h2><div class="waffle-wrap" id="xW${k}"></div></div>`);
      else if (x.type === 'rank') parts.push(`<div class="card" id="xc${k}"><h2>${esc(x.label)}</h2><div class="chart h-300" id="cX${k}"></div></div>`);
      else if (x.type === 'likert') parts.push(`<div class="card" id="xc${k}"><h2>${esc(x.label)}</h2><div class="chart h-260" id="cX${k}"></div></div>`);
      else parts.push(`<div class="card" id="xc${k}"><h2>${esc(x.label)}</h2><div class="chart h-300" id="cX${k}"></div></div>`);
    });
    return parts.length ? `<section data-s="dv-extras" class="grid-2 extras">${parts.join('')}</section>` : '';
  }

  function waffle(pctYes, prevYes, yes, n) {
    const filled = Math.round((pctYes || 0) * 100);
    const cells = Array.from({ length: 100 }, (_, i) => `<span class="${i < filled ? 'on' : ''}"></span>`).join('');
    return `<div class="waffle" role="img" aria-label="${filled}% menjawab Ya">${cells}</div>
      <div class="waffle-text"><span class="waffle-big">${pct(pctYes)}</span><span>menjawab <b>Ya</b><br><span class="muted small">${yes} dari ${n} responden</span></span>
      ${prevYes != null ? `<span class="waffle-prev">${CFG.prevYear}: <b>${pct(prevYes)}</b> ${gapPct(pctYes, prevYes)}</span>` : ''}
      <span class="legend-row"><i class="lg on"></i>Ya <i class="lg"></i>Tidak</span></div>`;
  }
  const gapPct = (a, b) => { const g = Math.round((a - b) * 100); return `<span class="gap ${g >= 0 ? 'gap-up' : 'gap-down'}">${g >= 0 ? '▲' : '▼'} ${Math.abs(g)} poin</span>`; };

  function drawExtras(prep, resp, color) {
    if (prep.gates.length) {
      const vals = prep.gates.map((g) => {
        const ans = resp.map((r) => A.norm(r.row[g.col])).filter((v) => v && v !== 'none');
        return { label: g.label, yes: ans.filter((v) => v === 'pernah').length, n: ans.length };
      });
      const topGate = vals.slice().sort((a, b) => b.yes / (b.n || 1) - a.yes / (a.n || 1));
      setCardInsight('xcG', topGate.length ? `Interaksi tertinggi dengan <b>${esc(topGate[0].label)}</b> (${share(topGate[0].yes, topGate[0].n)}), terendah <b>${esc(topGate[topGate.length - 1].label)}</b> (${share(topGate[topGate.length - 1].yes, topGate[topGate.length - 1].n)}).` : '');
      ec('cGates', {
        polar: { radius: ['18%', '86%'] },
        angleAxis: { max: 100, startAngle: 90, show: false },
        radiusAxis: { type: 'category', data: vals.map((v) => v.label), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false } },
        tooltip: { formatter: (p) => `${esc(vals[p.dataIndex].label)}<br><b>${Math.round(p.value)}%</b> (${vals[p.dataIndex].yes} dari ${vals[p.dataIndex].n})` },
        series: [{
          type: 'bar', coordinateSystem: 'polar', roundCap: true, barWidth: 14, showBackground: true, backgroundStyle: { color: T.surface2 },
          data: vals.map((v, i) => ({ value: v.n ? (v.yes / v.n) * 100 : 0, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
          label: { show: true, position: 'start', formatter: (p) => `${vals[p.dataIndex].label}  ${Math.round(p.value)}%`, color: T.ink, fontSize: 11, fontWeight: 600 },
        }],
      });
    }
    prep.extras.forEach((x, k) => {
      if (!x.cols.length) return;
      if (x.type === 'yesno') {
        const ans = resp.map((r) => A.norm(r.row[x.cols[0]])).filter((v) => v === 'ya' || v === 'tidak');
        const ya = ans.filter((v) => v === 'ya').length;
        setCardInsight('xc' + k, `<b>${share(ya, ans.length)}</b> responden menjawab Ya${x.prev ? ` (${CFG.prevYear}: ${pct(x.prev.Ya)})` : ''}.`);
        const box = $('#xW' + k);
        box.style.setProperty('--wc', color);
        box.innerHTML = waffle(ans.length ? ya / ans.length : null, x.prev ? x.prev.Ya : null, ya, ans.length);
      } else if (x.type === 'likert') {
        const scores = resp.map((r) => A.score(r.row[x.cols[0]])).filter((v) => v != null);
        setCardInsight('xc' + k, scores.length ? `Skor rata-rata <b>${f2(A.mean(scores))}</b>; ${share(scores.filter((v) => v >= 4).length, scores.length)} menilai penting/sangat penting.` : '');
        const names = ['Sangat tidak penting', 'Tidak penting', 'Antara', 'Penting', 'Sangat penting'];
        const entries = names.map((nm, i) => [nm, scores.filter((v) => v === i + 1).length]).filter((e) => e[1] > 0).reverse();
        donut('cX' + k, entries, { colors: entries.map((e) => LIKERT[names.indexOf(e[0])]), centerText: f2(A.mean(scores)), centerSub: 'skor rata-rata' });
      } else if (x.type === 'nps') {
        const vals = resp.map((r) => String(r.row[x.cols[0]]).trim()).filter((v) => v !== '' && !Number.isNaN(Number(v.replace(',', '.')))).map((v) => Number(v.replace(',', '.'))).filter((v) => v >= 0 && v <= 10);
        const pro = vals.filter((v) => v >= 9).length, det = vals.filter((v) => v <= 6).length, pas = vals.length - pro - det;
        const nps = vals.length ? Math.round(((pro - det) / vals.length) * 100) : null;
        setCardInsight('xc' + k, nps == null ? '' : `eNPS <b>${nps > 0 ? '+' : ''}${nps}</b>: ${share(pro, vals.length)} promoter, ${share(det, vals.length)} detractor.`);
        ec('cXg' + k, {
          series: [{
            type: 'gauge', min: -100, max: 100, startAngle: 200, endAngle: -20, radius: '100%', center: ['50%', '62%'], splitNumber: 4,
            axisLine: { lineStyle: { width: 18, color: [[0.5, '#dc2626'], [0.75, '#f59e0b'], [1, '#16a34a']] } },
            pointer: { length: '62%', width: 6, itemStyle: { color: T.ink } }, anchor: { show: true, size: 14, itemStyle: { color: T.ink } },
            axisTick: { show: false }, splitLine: { length: 18, lineStyle: { color: T.surface, width: 3 } },
            axisLabel: { distance: 24, color: T.muted, fontSize: 10 },
            detail: { offsetCenter: [0, '34%'], fontSize: 30, fontWeight: 800, color: T.ink, fontFamily: FONT, formatter: (v) => (nps == null ? '–' : (v > 0 ? '+' : '') + Math.round(v)) },
            title: { offsetCenter: [0, '58%'], color: T.muted, fontSize: 12 },
            data: [{ value: nps ?? 0, name: 'eNPS' }],
          }],
        });
        const bins = Array.from({ length: 11 }, (_, i) => vals.filter((v) => Math.round(v) === i).length);
        ec('cX' + k, {
          grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps) => `Skor ${ps[0].name}: <b>${ps[0].value}</b> responden` },
          xAxis: axisStyle({ type: 'category', data: bins.map((_, i) => String(i)), name: 'Skor rekomendasi', nameLocation: 'middle', nameGap: 26 }),
          yAxis: axisStyle({ type: 'value', minInterval: 1 }),
          series: [{ type: 'bar', barWidth: '60%', data: bins.map((b, i) => ({ value: b, itemStyle: { borderRadius: [6, 6, 0, 0], color: i >= 9 ? grad('#4ade80', '#16a34a') : i >= 7 ? grad('#fde68a', '#f59e0b') : grad('#fca5a5', '#dc2626') } })),
            label: { show: true, position: 'top', color: T.ink2, fontSize: 10, formatter: (p) => (p.value ? p.value : '') } }],
        });
        $('#xNps' + k).innerHTML = `<div class="nps-split">
          <span><i class="lg" style="background:#16a34a"></i>Promoter 9–10 <b>${pct(vals.length ? pro / vals.length : null)}</b></span>
          <span><i class="lg" style="background:#f59e0b"></i>Passive 7–8 <b>${pct(vals.length ? pas / vals.length : null)}</b></span>
          <span><i class="lg" style="background:#dc2626"></i>Detractor 0–6 <b>${pct(vals.length ? det / vals.length : null)}</b></span>
          <span class="muted">Rata-rata skor ${f2(A.mean(vals))} · n=${vals.length}</span></div>`;
      } else if (x.type === 'cat') {
        const all = A.countValues(null, x.cols, resp).filter(([k2]) => !/^(-+|tidak ada.*|tdk ada|none|ok.*|sudah.*|belum ada)$/i.test(k2));
        const c = all.slice(0, 7);
        const rest = all.slice(7).reduce((sum, v) => sum + v[1], 0);
        if (rest) c.push([`Jawaban lain (${all.length - 7} variasi)`, rest]);
        setCardInsight('xc' + k, c[0] ? `Paling banyak disebut: <b>${esc(c[0][0])}</b> (${c[0][1]} responden).` : '');
        lollipop('cX' + k, c.map((v) => v[0]), c.map((v) => v[1]), PALETTE, { min: 0, fmt: (v) => `${v} org`, labelWidth: 170 });
      } else if (x.type === 'rank') {
        const pts = {};
        resp.forEach((r) => x.cols.forEach((col, rank) => {
          const v = String(r.row[col] || '').trim();
          if (!v || A.norm(v) === 'none') return;
          const key = v.replace(/\s*\(.*\)\s*$/, '');
          pts[key] = (pts[key] || 0) + (x.cols.length - rank);
        }));
        const list = Object.entries(pts).sort((a, b) => b[1] - a[1]);
        setCardInsight('xc' + k, list[0] ? `Preferensi utama: <b>${esc(list[0][0])}</b>${list[1] ? `, disusul ${esc(list[1][0])}` : ''}.` : '');
        ec('cX' + k, {
          color: PALETTE,
          tooltip: { formatter: (p) => `${esc(p.name)}<br><b>${p.value}</b> poin preferensi` },
          series: [{ type: 'pie', roseType: 'area', radius: ['14%', '82%'], center: ['50%', '52%'], itemStyle: { borderRadius: 8, borderColor: T.surface, borderWidth: 3 },
            label: { color: T.ink, fontSize: 11, fontWeight: 600, formatter: '{b}\n{c} poin' }, labelLine: { length: 6, length2: 8 },
            data: list.map(([name, value]) => ({ name, value })) }],
        });
      }
    });
  }

  /* ───────── kritik & saran ───────── */
  function renderComments(prep, resp, color) {
    const entries = A.textEntries(prep, resp);
    const box = $('#comments');
    const themes = Object.keys(prep.div.themes || {}).concat('Lainnya');
    const questions = [...new Set(entries.map((e) => e.q))];
    const ui = { q: '', theme: '', word: '', search: '' };
    const themeCount = (list) => themes.map((t) => [t, list.filter((e) => e.themes.includes(t)).length]).filter((x) => x[1] > 0).sort((a, b) => (a[0] === 'Lainnya') - (b[0] === 'Lainnya') || b[1] - a[1]);
    const hasCloud = (() => { try { const t = echarts.init(document.createElement('div'), null, { width: 10, height: 10 }); t.setOption({ series: [{ type: 'wordCloud', data: [] }] }); t.dispose(); return true; } catch (e) { return false; } })();

    box.innerHTML = `
      <div class="card-head row">
        <div><h2>Kritik &amp; saran karyawan</h2><p class="muted">${entries.length} masukan bermakna (jawaban kosong / “tidak ada” / “-” disaring). Klik kata atau tema untuk menyaring daftar.</p></div>
        <div class="row gap-s wrap">
          <select id="cQ" aria-label="Pertanyaan"><option value="">Semua pertanyaan</option>${questions.map((q) => `<option>${esc(q)}</option>`).join('')}</select>
          <input id="cSearch" type="search" placeholder="Cari kata…" aria-label="Cari">
        </div>
      </div>
      <div class="grid-2 comments-top">
        <div><h3>Word cloud</h3><div class="chart h-260" id="cCloud"></div><div id="cWords" class="chips words"></div></div>
        <div><h3>Tema masukan</h3><div class="chart h-260" id="cThemeMap"></div></div>
      </div>
      <div id="cThemes" class="chips"></div>
      <div id="cList" class="comment-list"></div>`;

    let cloud = null, tmap = null;
    function drawTop() {
      const base = entries.filter((e) => !ui.q || e.q === ui.q);
      [cloud, tmap].forEach((c) => { if (c) { state.charts = state.charts.filter((x) => x !== c); c.dispose(); } });
      const words = A.wordFreq(base, 60);
      if (hasCloud && words.length) {
        $('#cWords').innerHTML = '';
        cloud = ec('cCloud', {
          tooltip: { formatter: (p) => `${esc(p.name)}: <b>${p.value}</b> masukan` },
          series: [{ type: 'wordCloud', shape: 'circle', gridSize: 6, sizeRange: [12, 44], rotationRange: [0, 0], width: '100%', height: '100%', drawOutOfBound: false,
            textStyle: { fontFamily: FONT, fontWeight: 700, color: () => PALETTE[Math.floor(Math.random() * PALETTE.length)] },
            emphasis: { textStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,.25)' } },
            data: words.map(([name, value]) => ({ name, value })) }],
        });
        if (cloud) cloud.on('click', (p) => { ui.word = ui.word === p.name ? '' : p.name; apply(); });
      } else {
        $('#cCloud').style.display = 'none';
        const max = words.length ? words[0][1] : 1;
        $('#cWords').innerHTML = words.slice(0, 24).map(([w, n], i) => `<button type="button" class="chip word" data-word="${esc(w)}" style="font-size:${(0.78 + (n / max) * 0.5).toFixed(2)}rem;color:${PALETTE[i % PALETTE.length]}">${esc(w)} <span>${n}</span></button>`).join('');
      }
      const tc = themeCount(base);
      tmap = ec('cThemeMap', {
        color: PALETTE,
        tooltip: { formatter: (p) => `${esc(p.name)}: <b>${p.value}</b> masukan` },
        series: [{ type: 'treemap', roam: false, nodeClick: false, breadcrumb: { show: false }, width: '100%', height: '100%',
          itemStyle: { borderColor: T.surface, borderWidth: 3, gapWidth: 3, borderRadius: 8 },
          label: { show: true, formatter: '{b}\n{c}', color: '#fff', fontWeight: 700, fontSize: 12, fontFamily: FONT },
          data: tc.map(([name, value], i) => ({ name, value, itemStyle: { color: name === 'Lainnya' ? '#94a3b8' : PALETTE[i % PALETTE.length] } })) }],
      });
      if (tmap) tmap.on('click', (p) => { ui.theme = ui.theme === p.name ? '' : p.name; apply(); });
    }

    function apply() {
      const s = A.norm(ui.search);
      const list = entries.filter((e) => (!ui.q || e.q === ui.q) && (!ui.theme || e.themes.includes(ui.theme)) && (!ui.word || A.norm(e.text).includes(ui.word)) && (!s || A.norm(e.text).includes(s)));
      const base = entries.filter((e) => !ui.q || e.q === ui.q);
      const active = [ui.theme && `Tema: ${ui.theme}`, ui.word && `Kata: “${ui.word}”`].filter(Boolean);
      $('#cThemes').innerHTML = themeCount(base).map(([t, n], i) => `<button type="button" class="chip ${ui.theme === t ? 'on' : ''}" data-theme="${esc(t)}"><i class="lg" style="background:${t === 'Lainnya' ? '#94a3b8' : PALETTE[i % PALETTE.length]}"></i>${esc(t)} <span>${n}</span></button>`).join('')
        + (active.length ? `<button type="button" class="chip clear" id="cClear">✕ Hapus filter (${esc(active.join(', '))})</button>` : '');
      const grouped = {};
      list.forEach((e) => { const t = ui.theme || e.themes[0]; (grouped[t] = grouped[t] || []).push(e); });
      $('#cList').innerHTML = list.length ? Object.entries(grouped).sort((a, b) => (a[0] === 'Lainnya') - (b[0] === 'Lainnya') || b[1].length - a[1].length).map(([t, es]) => `
        <div class="comment-group"><h4>${esc(t)} <span class="muted small">(${es.length})</span></h4>
          <ul>${es.map((e) => `<li style="--cc:${color}"><p>${highlight(e.text, ui.word || s)}</p><span class="meta">${esc(e.q)}${e.sub ? ' · ' + esc(e.sub) : ''} · ${esc(e.r.area)} · ${esc(e.r.div)} · ${esc(e.r.jab)}</span></li>`).join('')}</ul></div>`).join('')
        : '<p class="muted">Tidak ada masukan yang cocok.</p>';
      box.querySelectorAll('[data-theme]').forEach((b) => { b.onclick = () => { ui.theme = ui.theme === b.dataset.theme ? '' : b.dataset.theme; apply(); }; });
      box.querySelectorAll('[data-word]').forEach((b) => { b.onclick = () => { ui.word = ui.word === b.dataset.word ? '' : b.dataset.word; apply(); }; });
      const clr = $('#cClear');
      if (clr) clr.onclick = () => { ui.theme = ''; ui.word = ''; apply(); };
    }
    $('#cQ').onchange = (e) => { ui.q = e.target.value; ui.theme = ''; ui.word = ''; drawTop(); apply(); };
    $('#cSearch').oninput = (e) => { ui.search = e.target.value; apply(); };
    drawTop();
    apply();
  }

  function highlight(text, word) {
    const t = esc(text);
    if (!word) return t;
    const re = new RegExp('(' + esc(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return t.replace(re, '<mark>$1</mark>');
  }

  /* ───────── profil ───────── */
  function drawProfile(d, resp, color) {
    const count = (fn) => { const c = {}; resp.forEach((r) => { const k = fn(r) || '(tidak diisi)'; c[k] = (c[k] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]); };
    const pa = donut('cProfArea', count((r) => (r.area === 'Others' ? 'Others · ' + r.locRaw : r.area)), { rose: true, center: false, colors: AREA_COLOR.concat(['#8b5cf6', '#ec4899', '#f59e0b']) });
    if (pa) pa.on('click', (p) => setFilter('area', AREAS.includes(p.name) ? p.name : 'Others'));
    donut('cProfJab', count((r) => r.jab), { centerSub: 'responden' });
    const div = count((r) => r.div);
    const pd = lollipop('cProfDiv', div.map((e) => e[0]), div.map((e) => e[1]), PALETTE, { min: 0, fmt: (v) => `${v} org`, labelWidth: 110 });
    if (pd) pd.on('click', (p) => setFilter('div', div[p.dataIndex][0]));
    (d.profile || []).forEach((_, i) => donut('cProfX' + i, count((r) => r.profile[i]), { centerSub: 'responden', colors: PALETTE.slice(i * 3).concat(PALETTE) }));
  }

  /* ───────── init ───────── */
  function init() {
    buildTabs();
    window.addEventListener('hashchange', onRoute);
    let rt = null;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => state.charts.forEach((c) => c.resize()), 120); });
    ['fArea', 'fDiv'].forEach((id) => $('#' + id).addEventListener('change', (e) => {
      state.filters[{ fArea: 'area', fDiv: 'div' }[id]] = e.target.value;
      render(false);
    }));
    $('#btnReset').addEventListener('click', () => {
      state.filters = { area: '', div: '' };
      ['fArea', 'fDiv'].forEach((id) => { $('#' + id).value = ''; });
      render(false);
    });
    $('#btnRefresh').addEventListener('click', () => load());
    $('#filterNote').addEventListener('click', (e) => { const b = e.target.closest('[data-clear]'); if (b) setFilter(b.dataset.clear, state.filters[b.dataset.clear]); });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', () => { if (state.sheets) render(false); });
    new MutationObserver(() => { if (state.sheets) render(false); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    onRoute();
    load();
    const mins = CFG.SOURCE.autoRefreshMinutes;
    if (mins > 0) setInterval(() => { if (/live|publish/.test(state.source) && !document.hidden) load(); }, mins * 60000);
  }

  if (!window.echarts) document.getElementById('app').innerHTML = '<div class="empty">Library grafik gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.</div>';
  else init();
})();
