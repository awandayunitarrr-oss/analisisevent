/* Tampilan dashboard: routing, filter, tabel index, grafik, kritik & saran. */
(function () {
  const CFG = window.SURVEY_CONFIG;
  const A = window.SurveyAnalytics;
  const D = window.SurveyData;
  const $ = (s, el) => (el || document).querySelector(s);
  const AREAS = CFG.AREAS;

  const COLORS = {
    prev: '#86b6ef', cur: '#1c5cab',
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
    likert: ['#b8302f', '#ee8f8e', '#cfccc6', '#86b6ef', '#2a78d6'],
    grid: '#e6e4df', text: '#52514e',
  };

  const state = { sheets: null, source: '', loadedAt: null, prepared: {}, filters: { area: '', div: '', jab: '' }, charts: [], route: 'ringkasan', ui: {} };

  /* ───────── util ───────── */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f2 = (v) => (v == null || Number.isNaN(v) ? '–' : v.toFixed(2));
  const pct = (v) => (v == null ? '–' : Math.round(v * 100) + '%');
  function gapHtml(cur, prev) {
    if (cur == null || prev == null) return '<span class="gap gap-na">–</span>';
    const g = A.round2(cur) - A.round2(prev);
    const r = Math.round(g * 100) / 100;
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
  function fmtDate(d) {
    return d ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '–';
  }
  function destroyCharts() { state.charts.forEach((c) => c.destroy()); state.charts = []; }
  function chart(el, cfg) { if (!el) return null; const c = new Chart(el, cfg); state.charts.push(c); return c; }

  if (window.Chart) {
    Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = COLORS.text;
    Chart.defaults.borderColor = COLORS.grid;
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.plugins.legend.labels.boxHeight = 12;
    Chart.defaults.plugins.tooltip.backgroundColor = '#1f2a37';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.maintainAspectRatio = false;
  }

  /* ───────── data & filter ───────── */
  function prepareAll() {
    state.prepared = {};
    CFG.DIVISIONS.forEach((d) => { state.prepared[d.id] = A.prepareDivision(d, state.sheets[d.sheet]); });
    fillFilterOptions();
  }

  function filtered(prep) {
    const f = state.filters;
    return prep.respondents.filter((r) => (!f.area || r.area === f.area) && (!f.div || r.div === f.div) && (!f.jab || r.jab === f.jab));
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
    fill($('#fJab'), uniq('jab'), 'Semua jabatan');
  }

  function filterLabel() {
    const f = state.filters;
    const parts = [f.area, f.div, f.jab].filter(Boolean);
    return parts.length ? 'Filter aktif: ' + parts.join(' · ') : '';
  }

  /* ───────── load ───────── */
  async function load(mode, file) {
    const status = $('#sourceStatus');
    status.className = 'pill pill-muted';
    status.textContent = 'Memuat data…';
    let res;
    try {
      if (mode === 'file') res = await D.loadFile(file);
      else res = await D.loadLive();
    } catch (e) {
      console.warn('Gagal memuat data live:', e.message);
      try { res = D.loadSnapshot(); res.warn = e.message; } catch (e2) { $('#app').innerHTML = `<div class="empty">Data tidak dapat dimuat: ${esc(e2.message)}</div>`; return; }
    }
    const first = !state.sheets;
    if (res.partial && state.sheets) res.sheets = Object.assign({}, state.sheets, res.sheets);
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
    $('#tabs').innerHTML = tabs.map((t) => `<a href="#/${t.id}" data-id="${t.id}">${esc(t.name)}</a>`).join('');
  }
  function onRoute() {
    const id = (location.hash.replace(/^#\/?/, '') || 'ringkasan').split('/')[0];
    state.route = id;
    document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('active', a.dataset.id === id));
    if (state.sheets) render(true);
  }

  function render(scrollTop) {
    destroyCharts();
    $('#filterNote').textContent = filterLabel();
    const div = CFG.DIVISIONS.find((d) => d.id === state.route);
    if (div) renderDivision(div); else renderOverview();
    if (scrollTop) window.scrollTo({ top: 0 });
  }

  /* ───────── RINGKASAN ───────── */
  function renderOverview() {
    const rows = CFG.DIVISIONS.map((d) => {
      const prep = state.prepared[d.id];
      const resp = filtered(prep);
      const an = A.analyzeDivision(prep, resp);
      const prev = (d.indexHistory[CFG.prevYear] || []);
      const ov = an.items.find((i) => i.overall && i.sub === 'Kepuasan keseluruhan');
      return { d, prep, resp, an, prev, ov };
    });
    const totalN = rows.reduce((s, r) => s + r.resp.length, 0);
    const withIdx = rows.filter((r) => r.an.index[0] != null);
    const avgIdx = A.mean(withIdx.map((r) => r.an.index[0]));
    const up = withIdx.filter((r) => r.prev[0] != null && A.round2(r.an.index[0]) > r.prev[0]).length;
    const down = withIdx.filter((r) => r.prev[0] != null && A.round2(r.an.index[0]) < r.prev[0]).length;
    const dates = rows.flatMap((r) => r.resp.map((x) => x.date).filter(Boolean)).sort((a, b) => a - b);

    const allItems = rows.flatMap((r) => r.an.items.filter((i) => !i.overall && i.stats.n >= 3).map((i) => ({ ...i, divName: r.d.name, divId: r.d.id })));
    const sorted = allItems.slice().sort((a, b) => b.stats.mean - a.stats.mean);
    const best = sorted.slice(0, 5);
    const worst = sorted.slice(-5).reverse();
    const best2 = withIdx.slice().sort((a, b) => b.an.index[0] - a.an.index[0]);

    const insights = [];
    if (withIdx.length) {
      insights.push(`Rata-rata index seluruh layanan ${CFG.year} sebesar <b>${f2(avgIdx)}</b> (${A.category(avgIdx).label.toLowerCase()}) dari <b>${totalN}</b> respons di ${rows.length} survey divisi.`);
      insights.push(`Index tertinggi: <b>${esc(best2[0].d.name)}</b> (${f2(best2[0].an.index[0])}); terendah: <b>${esc(best2[best2.length - 1].d.name)}</b> (${f2(best2[best2.length - 1].an.index[0])}).`);
      insights.push(`Dibanding ${CFG.prevYear}: <b>${up}</b> divisi naik, <b>${down}</b> divisi turun.`);
      if (worst[0]) insights.push(`Indikator dengan skor terendah lintas divisi: <b>${esc(worst[0].label)}</b> (${esc(worst[0].divName)}, ${f2(worst[0].stats.mean)}).`);
    }

    $('#app').innerHTML = `
      <section class="hero">
        <div>
          <p class="eyebrow">Survey Pengukuran Kepuasan Divisi · kepada Karyawan MPM ${CFG.year}</p>
          <h1>Ringkasan Index Pelayanan Divisi ${CFG.year}</h1>
          <p class="muted">Periode respons: ${dates.length ? fmtDate(dates[0]) + ' – ' + fmtDate(dates[dates.length - 1]) : '–'} · Sumber: ${esc(state.source)}</p>
        </div>
      </section>
      <section class="kpis">
        ${kpi('Total respons', totalN, `${rows.length} survey divisi`)}
        ${kpi('Rata-rata index ' + CFG.year, f2(avgIdx), catBadge(avgIdx))}
        ${kpi('Divisi naik vs ' + CFG.prevYear, up, `▼ ${down} divisi turun`)}
        ${kpi('Respons hari terakhir', dates.length ? dates.filter((d) => d.toDateString() === dates[dates.length - 1].toDateString()).length : 0, dates.length ? fmtDate(dates[dates.length - 1]) : '')}
      </section>
      <section class="card insight"><h2>Temuan utama</h2><ul>${insights.map((i) => `<li>${i}</li>`).join('')}</ul></section>

      <section class="card">
        <div class="card-head"><h2>Index pelayanan per divisi</h2><p class="muted">Klik baris untuk melihat detail divisi. Warna sel mengikuti kategori kepuasan.</p></div>
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
                  <td class="left"><b>${esc(r.d.name)}</b><br><span class="muted small">${esc(r.d.full)}</span></td>
                  <td class="num">${nPrev ? nPrev.reduce((a, b) => a + b, 0) : '–'}</td>
                  <td class="num"><b>${r.resp.length}</b></td>
                  ${scoreCell((r.d.indexHistory[2024] || [])[0])}
                  ${scoreCell(r.prev[0])}
                  ${scoreCell(r.an.index[0], 'style="font-weight:700"')}
                  <td class="num">${gapHtml(r.an.index[0], r.prev[0])}</td>
                  <td>${catBadge(r.an.index[0])}</td>
                  ${AREAS.map((_, i) => scoreCell(r.an.index[i + 1])).join('')}
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <p class="note">${CFG.DIVISIONS.filter((d) => d.indexHistoryNote).map((d) => `${esc(d.name)}: ${esc(d.indexHistoryNote)}`).join(' ')}</p>
      </section>

      <section class="grid-2">
        <div class="card"><h2>Index ${CFG.prevYear} vs ${CFG.year}</h2><div class="chart-box h-300"><canvas id="cOverview"></canvas></div></div>
        <div class="card"><h2>Progres respons harian</h2><div class="chart-box h-300"><canvas id="cTimeline"></canvas></div></div>
      </section>

      <section class="grid-2">
        <div class="card"><h2>5 indikator tertinggi</h2>${rankList(best)}</div>
        <div class="card"><h2>5 indikator terendah</h2>${rankList(worst)}</div>
      </section>
    `;

    document.querySelectorAll('[data-go]').forEach((tr) => tr.addEventListener('click', () => { location.hash = '#/' + tr.dataset.go; }));

    chart($('#cOverview'), {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.d.name),
        datasets: [
          { label: String(CFG.prevYear), data: rows.map((r) => r.prev[0] ?? null), backgroundColor: COLORS.prev, borderRadius: 4, maxBarThickness: 22 },
          { label: String(CFG.year), data: rows.map((r) => A.round2(r.an.index[0])), backgroundColor: COLORS.cur, borderRadius: 4, maxBarThickness: 22 },
        ],
      },
      options: { scales: { y: { min: 3, max: 5, ticks: { stepSize: 0.5 } }, x: { grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${f2(c.raw)}` } } } },
    });

    const days = [...new Set(dates.map((d) => d.toDateString()))].map((s) => new Date(s)).sort((a, b) => a - b);
    chart($('#cTimeline'), {
      type: 'bar',
      data: {
        labels: days.map((d) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })),
        datasets: rows.map((r, i) => ({
          label: r.d.name,
          data: days.map((day) => r.resp.filter((x) => x.date && x.date.toDateString() === day.toDateString()).length),
          backgroundColor: COLORS.series[i], borderColor: '#fff', borderWidth: 1, borderRadius: 2, maxBarThickness: 28,
        })),
      },
      options: { scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, title: { display: true, text: 'Jumlah respons' } } }, plugins: { tooltip: { mode: 'index' } } },
    });
  }

  function kpi(label, value, sub) {
    return `<div class="kpi"><span class="kpi-label">${label}</span><span class="kpi-value">${value}</span><span class="kpi-sub">${sub || ''}</span></div>`;
  }
  function rankList(list) {
    if (!list.length) return '<p class="muted">Belum ada data.</p>';
    return `<ol class="rank">${list.map((i) => `<li><a href="#/${i.divId}"><span class="rank-label">${esc(i.label)}<span class="muted small"> · ${esc(i.divName)} · n=${i.stats.n}</span></span><span class="rank-val">${f2(i.stats.mean)}</span></a></li>`).join('')}</ol>`;
  }

  /* ───────── HALAMAN DIVISI ───────── */
  function renderDivision(d) {
    const prep = state.prepared[d.id];
    if (!prep || prep.missing) { $('#app').innerHTML = `<div class="empty">Sheet "${esc(d.sheet)}" tidak ditemukan di sumber data.</div>`; return; }
    const resp = filtered(prep);
    const an = A.analyzeDivision(prep, resp);
    const prev = d.indexHistory[CFG.prevYear] || [];
    const ov = an.items.find((i) => i.overall && i.sub === 'Kepuasan keseluruhan');
    const scored = an.items.filter((i) => !i.overall && i.stats.n > 0);
    const t2b = A.mean(scored.map((i) => i.stats.top2));
    const missingCols = an.items.filter((i) => i.col < 0).map((i) => i.label);

    $('#app').innerHTML = `
      <section class="hero">
        <div>
          <p class="eyebrow">Survey Pengukuran Kepuasan · ${esc(d.full)}</p>
          <h1>Index Pelayanan ${esc(d.name)} ${CFG.year}</h1>
          <p class="muted">${resp.length} responden${resp.length !== prep.respondents.length ? ` (dari ${prep.respondents.length}, sesuai filter)` : ''} · Sumber: ${esc(state.source)}</p>
        </div>
      </section>
      ${missingCols.length ? `<div class="alert">Kolom tidak ditemukan di sheet: ${missingCols.map(esc).join('; ')}. Periksa judul kolom pada spreadsheet.</div>` : ''}
      <section class="kpis">
        ${kpi('Index ' + CFG.year, f2(an.index[0]), catBadge(an.index[0]))}
        ${kpi('Perubahan vs ' + CFG.prevYear, prev[0] != null ? gapHtml(an.index[0], prev[0]) : '–', prev[0] != null ? `Index ${CFG.prevYear}: ${f2(prev[0])}` : 'Belum ada pembanding')}
        ${kpi('Responden', resp.length, AREAS.map((a, i) => `${a}: ${an.areaN[i]}`).join(' · '))}
        ${ov ? kpi('Kepuasan keseluruhan', f2(ov.stats.mean), `${pct(ov.stats.top2)} puas/sangat puas`) : kpi('Responden puas', pct(t2b), 'rata-rata % jawaban Puas + Sangat puas')}
      </section>
      <section class="card insight"><h2>Temuan utama</h2><ul>${divisionInsights(d, an, prev).map((i) => `<li>${i}</li>`).join('')}</ul></section>

      <details class="card outline" ${state.ui.outlineOpen ? 'open' : ''}>
        <summary><h2>Outline survey</h2></summary>
        ${outlineHtml(d, an)}
      </details>

      <section class="card">
        <div class="card-head row">
          <div><h2>Index pelayanan ${esc(d.name)}</h2><p class="muted">Skor rata-rata per indikator, total dan per area kerja. Gap = ${CFG.year} − ${CFG.prevYear}.</p></div>
          <label class="inline">Urutkan
            <select id="sortSel">
              <option value="sub">Per sub-kategori</option>
              <option value="desc">Skor tertinggi</option>
              <option value="asc">Skor terendah</option>
              <option value="gap">Penurunan terbesar</option>
            </select>
          </label>
        </div>
        <div class="table-wrap" id="idxTable"></div>
      </section>

      <section class="grid-2">
        <div class="card"><h2>Tren index per area</h2><div class="chart-box h-280"><canvas id="cTrend"></canvas></div>${d.indexHistoryNote ? `<p class="note">${esc(d.indexHistoryNote)}</p>` : ''}</div>
        <div class="card"><h2>Index per sub-kategori</h2><div class="chart-box h-280"><canvas id="cSubs"></canvas></div></div>
      </section>

      <section class="card">
        <div class="card-head row">
          <div><h2>Skor per indikator</h2><p class="muted">Batang gelap = ${CFG.year}, batang terang = ${CFG.prevYear} (bila ada pembanding).</p></div>
          <div class="seg" role="tablist">
            <button type="button" class="seg-btn active" data-view="score">Skor</button>
            <button type="button" class="seg-btn" data-view="dist">Distribusi jawaban</button>
          </div>
        </div>
        <div class="chart-box" id="itemBox" style="height:${Math.max(260, scored.length * 34 + 80)}px"><canvas id="cItems"></canvas></div>
      </section>

      ${extrasHtml(prep, resp)}

      <section class="card">
        <h2>Prioritas perbaikan</h2>
        <p class="muted">Indikator dengan skor terendah, penurunan terbesar, atau porsi responden tidak puas tertinggi — bahan <i>problem identification</i> &amp; <i>corrective action</i>.</p>
        ${priorityHtml(an)}
      </section>

      <section class="card" id="comments"></section>

      <section class="card">
        <h2>Profil responden</h2>
        <div class="grid-3">
          <div><h3>Area kerja</h3><div class="chart-box h-220"><canvas id="cProfArea"></canvas></div></div>
          <div><h3>Divisi responden</h3><div class="chart-box h-220"><canvas id="cProfDiv"></canvas></div></div>
          <div><h3>Jabatan</h3><div class="chart-box h-220"><canvas id="cProfJab"></canvas></div></div>
          ${(d.profile || []).map((p, i) => `<div><h3>${esc(p)}</h3><div class="chart-box h-220"><canvas id="cProfX${i}"></canvas></div></div>`).join('')}
        </div>
      </section>
    `;

    $('details.outline').addEventListener('toggle', (e) => { state.ui.outlineOpen = e.target.open; });
    const sortSel = $('#sortSel');
    sortSel.value = state.ui.sort || 'sub';
    const drawTable = () => { $('#idxTable').innerHTML = indexTableHtml(d, an, sortSel.value); };
    sortSel.addEventListener('change', () => { state.ui.sort = sortSel.value; drawTable(); });
    drawTable();

    drawTrend(d, an);
    drawSubs(d, an);
    let itemChart = drawItems(an, 'score');
    document.querySelectorAll('.seg-btn').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('active', x === b));
      if (itemChart) { itemChart.destroy(); state.charts = state.charts.filter((c) => c !== itemChart); }
      itemChart = drawItems(an, b.dataset.view);
    }));
    drawExtras(prep, resp);
    renderComments(prep, resp);
    drawProfile(d, resp);
  }

  function divisionInsights(d, an, prev) {
    const out = [];
    const idx = an.index[0];
    if (idx == null) return ['Belum ada jawaban untuk filter ini.'];
    let s = `Index Pelayanan ${esc(d.name)} ${CFG.year} sebesar <b>${f2(idx)}</b> dan berada dalam kategori <b>${A.category(idx).label.toLowerCase()}</b>`;
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
    const subs = an.subs.filter((s) => !s.overall && s.value && s.value[0] != null && an.subs.filter((x) => !x.overall).length > 1);
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
        ${[0, 1, 2, 3].map((k) => {
          const cur = k === 0 ? st.mean : st.area[k - 1];
          return `<td class="num prev">${f2(b[k])}</td>${scoreCell(cur)}<td class="num">${gapHtml(cur, b[k])}</td>`;
        }).join('')}
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
      const list = an.items.filter((i) => !i.overall);
      const key = { desc: (a, b) => (b.stats.mean ?? -1) - (a.stats.mean ?? -1), asc: (a, b) => (a.stats.mean ?? 9) - (b.stats.mean ?? 9),
        gap: (a, b) => ((a.b25 && a.b25[0] != null && a.stats.mean != null) ? a.stats.mean - a.b25[0] : 9) - ((b.b25 && b.b25[0] != null && b.stats.mean != null) ? b.stats.mean - b.b25[0] : 9) }[sort];
      list.slice().sort(key).forEach((it) => { body += row(it); });
    }
    return `<table class="idx-table">${head}<tbody>${totalRow}${body}</tbody></table>`;
  }

  function drawTrend(d, an) {
    const years = Object.keys(d.indexHistory).map(Number).sort().concat(CFG.year);
    const labels = ['Total'].concat(AREAS);
    chart($('#cTrend'), {
      type: 'line',
      data: {
        labels: years,
        datasets: labels.map((l, k) => ({
          label: l,
          data: years.map((y) => (y === CFG.year ? A.round2(an.index[k]) : (d.indexHistory[y] || [])[k] ?? null)),
          borderColor: k === 0 ? '#0d366b' : COLORS.series[k - 1], backgroundColor: k === 0 ? '#0d366b' : COLORS.series[k - 1],
          borderWidth: k === 0 ? 3 : 2, pointRadius: 4, pointHoverRadius: 6, spanGaps: true, tension: 0.2,
        })),
      },
      options: { interaction: { mode: 'index', intersect: false }, scales: { y: { suggestedMin: 3, suggestedMax: 5 } }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${f2(c.raw)}` } } } },
    });
  }

  function drawSubs(d, an) {
    const list = an.groups.map((g) => ({ name: g.name, value: g.value, hist: g.hist }))
      .concat(an.subs.filter((s) => !s.overall && s.value));
    chart($('#cSubs'), {
      type: 'bar',
      data: {
        labels: list.map((s) => s.name),
        datasets: [
          { label: String(CFG.prevYear), data: list.map((s) => (s.hist[CFG.prevYear] || [])[0] ?? null), backgroundColor: COLORS.prev, borderRadius: 4, maxBarThickness: 16 },
          { label: String(CFG.year), data: list.map((s) => A.round2(s.value[0])), backgroundColor: COLORS.cur, borderRadius: 4, maxBarThickness: 16 },
        ],
      },
      options: { indexAxis: 'y', scales: { x: { min: axisMin(list.flatMap((s) => [(s.hist[CFG.prevYear] || [])[0], s.value[0]])), max: 5 }, y: { grid: { display: false }, ticks: { callback(v) { return wrap(this.getLabelForValue(v), 26); } } } },
        plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${f2(c.raw)}` } } } },
    });
  }

  // Batas bawah sumbu skor: kelipatan 0.5 di bawah nilai terendah (min 1) agar beda antar indikator terlihat.
  function axisMin(values) {
    const v = values.filter((x) => x != null);
    return v.length ? Math.max(1, Math.floor((Math.min(...v) - 0.25) * 2) / 2) : 1;
  }

  function wrap(s, n) {
    const words = String(s).split(' ');
    const lines = [];
    let cur = '';
    words.forEach((w) => { if ((cur + ' ' + w).trim().length > n) { if (cur) lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
    if (cur) lines.push(cur);
    return lines.length > 2 ? [lines[0], lines[1] + '…'] : lines;
  }

  function drawItems(an, view) {
    const items = an.items.filter((i) => i.stats.n > 0 && (!i.overall || i.sub === 'Kepuasan keseluruhan'));
    const labels = items.map((i) => i.label);
    const yTicks = { grid: { display: false }, ticks: { autoSkip: false, callback(v) { return wrap(this.getLabelForValue(v), 48); } } };
    if (view === 'dist') {
      const names = ['Sangat tidak puas (1)', 'Tidak puas (2)', 'Antara (3)', 'Puas (4)', 'Sangat puas (5)'];
      return chart($('#cItems'), {
        type: 'bar',
        data: {
          labels,
          datasets: names.map((nm, k) => ({ label: nm, data: items.map((i) => (i.stats.n ? (i.stats.dist[k] / i.stats.n) * 100 : 0)), backgroundColor: COLORS.likert[k], borderColor: '#fff', borderWidth: 1, maxBarThickness: 20, _counts: items.map((i) => i.stats.dist[k]) })),
        },
        options: { indexAxis: 'y', scales: { x: { stacked: true, max: 100, ticks: { callback: (v) => v + '%' } }, y: Object.assign({ stacked: true }, yTicks) },
          plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${Math.round(c.raw)}% (${c.dataset._counts[c.dataIndex]} org)` } } } },
      });
    }
    return chart($('#cItems'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: String(CFG.prevYear), data: items.map((i) => (i.b25 ? i.b25[0] : null)), backgroundColor: COLORS.prev, borderRadius: 4, maxBarThickness: 12 },
          { label: String(CFG.year), data: items.map((i) => A.round2(i.stats.mean)), backgroundColor: COLORS.cur, borderRadius: 4, maxBarThickness: 12 },
        ],
      },
      options: { indexAxis: 'y', scales: { x: { min: axisMin(items.flatMap((i) => [i.b25 && i.b25[0], i.stats.mean])), max: 5 }, y: yTicks },
        plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${f2(c.raw)}`, afterBody: (ctx) => { const it = items[ctx[0].dataIndex]; return [`n = ${it.stats.n}`, `% puas = ${pct(it.stats.top2)}`].concat(it.note ? [it.note] : []); } } } } },
    });
  }

  function priorityHtml(an) {
    const items = an.items.filter((i) => !i.overall && i.stats.n > 0);
    if (!items.length) return '<p class="muted">Belum ada data.</p>';
    const scoreOf = (i) => {
      let p = (4.2 - i.stats.mean) * 2;
      if (i.b25 && i.b25[0] != null) p += Math.max(0, i.b25[0] - i.stats.mean) * 3;
      p += (i.stats.bottom2 || 0) * 4;
      return p;
    };
    const top = items.slice().sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, 5);
    return `<div class="prio">${top.map((i, k) => {
      const reasons = [];
      if (i.stats.mean < 4.2) reasons.push(`skor ${f2(i.stats.mean)} belum “sangat puas”`);
      if (i.b25 && i.b25[0] != null && i.stats.mean < i.b25[0] - 0.005) reasons.push(`turun ${f2(i.b25[0] - i.stats.mean)} dari ${CFG.prevYear}`);
      if (i.stats.bottom2 > 0) reasons.push(`${pct(i.stats.bottom2)} responden tidak puas`);
      const lowArea = AREAS.map((a, x) => ({ a, v: i.stats.area[x] })).filter((x) => x.v != null).sort((a, b) => a.v - b.v)[0];
      if (lowArea && lowArea.v < i.stats.mean - 0.15) reasons.push(`terendah di ${lowArea.a} (${f2(lowArea.v)})`);
      if (!reasons.length) reasons.push('skor relatif paling rendah');
      return `<div class="prio-item"><span class="prio-n">${k + 1}</span><div><b>${esc(i.label)}</b><span class="muted small"> · ${esc(i.sub)}</span><p>${reasons.join(' · ')}</p></div><span class="prio-val">${f2(i.stats.mean)}</span></div>`;
    }).join('')}</div>`;
  }

  /* ───────── ekstra per divisi ───────── */
  function extrasHtml(prep, resp) {
    const parts = [];
    if (prep.gates.length) {
      parts.push(`<div class="card"><h2>Interaksi dengan layanan</h2><p class="muted">Persentase responden yang pernah berinteraksi dengan masing-masing unit.</p><div class="chart-box h-220"><canvas id="cGates"></canvas></div></div>`);
    }
    prep.extras.forEach((x, k) => {
      if (!x.cols.length) return;
      if (x.type === 'nps') parts.push(`<div class="card"><h2>${esc(x.label)}</h2><div id="xNps${k}"></div><div class="chart-box h-220"><canvas id="cX${k}"></canvas></div></div>`);
      else if (x.type === 'cat' || x.type === 'rank') parts.push(`<div class="card"><h2>${esc(x.label)}</h2><div class="chart-box" style="height:${x.type === 'rank' ? 240 : 260}px"><canvas id="cX${k}"></canvas></div></div>`);
      else parts.push(`<div class="card"><h2>${esc(x.label)}</h2><div id="xTxt${k}"></div><div class="chart-box h-160"><canvas id="cX${k}"></canvas></div></div>`);
    });
    return parts.length ? `<section class="grid-2 extras">${parts.join('')}</section>` : '';
  }

  function drawExtras(prep, resp) {
    if (prep.gates.length) {
      const vals = prep.gates.map((g) => {
        const ans = resp.map((r) => A.norm(r.row[g.col])).filter((v) => v && v !== 'none');
        return { label: g.label, yes: ans.filter((v) => v === 'pernah').length, n: ans.length };
      });
      chart($('#cGates'), {
        type: 'bar',
        data: { labels: vals.map((v) => v.label), datasets: [{ label: '% pernah berinteraksi', data: vals.map((v) => (v.n ? (v.yes / v.n) * 100 : 0)), backgroundColor: COLORS.cur, borderRadius: 4, maxBarThickness: 18 }] },
        options: { indexAxis: 'y', scales: { x: { max: 100, ticks: { callback: (v) => v + '%' } }, y: { grid: { display: false } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${Math.round(c.raw)}% (${vals[c.dataIndex].yes} dari ${vals[c.dataIndex].n})` } } } },
      });
    }
    prep.extras.forEach((x, k) => {
      if (!x.cols.length) return;
      const el = $('#cX' + k);
      if (x.type === 'yesno') {
        const ans = resp.map((r) => A.norm(r.row[x.cols[0]])).filter((v) => v === 'ya' || v === 'tidak');
        const ya = ans.filter((v) => v === 'ya').length;
        $('#xTxt' + k).innerHTML = `<p class="big-stat"><b>${pct(ans.length ? ya / ans.length : null)}</b> menjawab <b>Ya</b> <span class="muted small">(${ya} dari ${ans.length})${x.prev ? ` · ${CFG.prevYear}: ${pct(x.prev.Ya)}` : ''}</span></p>`;
        chart(el, {
          type: 'bar',
          data: { labels: [String(CFG.year)].concat(x.prev ? [String(CFG.prevYear)] : []), datasets: [
            { label: 'Ya', data: [ans.length ? (ya / ans.length) * 100 : 0].concat(x.prev ? [x.prev.Ya * 100] : []), backgroundColor: COLORS.series[0], borderColor: '#fff', borderWidth: 1, maxBarThickness: 26 },
            { label: 'Tidak', data: [ans.length ? ((ans.length - ya) / ans.length) * 100 : 0].concat(x.prev ? [(1 - x.prev.Ya) * 100] : []), backgroundColor: COLORS.series[1], borderColor: '#fff', borderWidth: 1, maxBarThickness: 26 },
          ] },
          options: { indexAxis: 'y', scales: { x: { stacked: true, max: 100, ticks: { callback: (v) => v + '%' } }, y: { stacked: true, grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${Math.round(c.raw)}%` } } } },
        });
      } else if (x.type === 'likert') {
        const st = { mean: null };
        const scores = resp.map((r) => A.score(r.row[x.cols[0]])).filter((v) => v != null);
        st.mean = A.mean(scores);
        const dist = [1, 2, 3, 4, 5].map((s) => scores.filter((v) => v === s).length);
        $('#xTxt' + k).innerHTML = `<p class="big-stat">Skor rata-rata <b>${f2(st.mean)}</b> <span class="muted small">(n=${scores.length})</span></p>`;
        const names = ['Sangat tidak penting', 'Tidak penting', 'Antara', 'Penting', 'Sangat penting'];
        chart(el, {
          type: 'bar',
          data: { labels: ['Jawaban'], datasets: names.map((nm, i) => ({ label: nm, data: [scores.length ? (dist[i] / scores.length) * 100 : 0], backgroundColor: COLORS.likert[i], borderColor: '#fff', borderWidth: 1, maxBarThickness: 30 })) },
          options: { indexAxis: 'y', scales: { x: { stacked: true, max: 100, ticks: { callback: (v) => v + '%' } }, y: { stacked: true, display: false } }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${Math.round(c.raw)}%` } } } },
        });
      } else if (x.type === 'nps') {
        const vals = resp.map((r) => Number(String(r.row[x.cols[0]]).replace(',', '.'))).filter((v) => !Number.isNaN(v) && String(v) !== '' && v >= 0 && v <= 10);
        const pro = vals.filter((v) => v >= 9).length, det = vals.filter((v) => v <= 6).length, pas = vals.length - pro - det;
        const nps = vals.length ? Math.round(((pro - det) / vals.length) * 100) : null;
        $('#xNps' + k).innerHTML = `<div class="nps"><div><span class="kpi-label">eNPS</span><span class="kpi-value">${nps == null ? '–' : (nps > 0 ? '+' : '') + nps}</span></div>
          <div><span class="kpi-label">Rata-rata skor</span><span class="kpi-value">${f2(A.mean(vals))}</span></div>
          <div class="nps-split"><span class="legend-dot" style="background:${COLORS.series[0]}"></span>Promoter (9–10) ${pct(vals.length ? pro / vals.length : null)}
          <span class="legend-dot" style="background:#cfccc6"></span>Passive (7–8) ${pct(vals.length ? pas / vals.length : null)}
          <span class="legend-dot" style="background:${COLORS.likert[0]}"></span>Detractor (0–6) ${pct(vals.length ? det / vals.length : null)}</div></div>`;
        const bins = Array.from({ length: 11 }, (_, i) => vals.filter((v) => Math.round(v) === i).length);
        chart(el, {
          type: 'bar',
          data: { labels: bins.map((_, i) => String(i)), datasets: [{ label: 'Responden', data: bins, backgroundColor: bins.map((_, i) => (i >= 9 ? COLORS.series[0] : i >= 7 ? '#cfccc6' : COLORS.likert[0])), borderRadius: 4, maxBarThickness: 26 }] },
          options: { scales: { x: { grid: { display: false }, title: { display: true, text: 'Skor rekomendasi' } }, y: { ticks: { precision: 0 } } }, plugins: { legend: { display: false } } },
        });
      } else if (x.type === 'cat') {
        const all = A.countValues(null, x.cols, resp).filter(([k2]) => !/^(-+|tidak ada.*|tdk ada|none|ok.*|sudah.*|belum ada)$/i.test(k2));
        const c = all.slice(0, 8);
        const rest = all.slice(8).reduce((sum, v) => sum + v[1], 0);
        if (rest) c.push([`Jawaban lain (${all.length - 8} variasi)`, rest]);
        chart(el, {
          type: 'bar',
          data: { labels: c.map((v) => v[0]), datasets: [{ label: 'Responden', data: c.map((v) => v[1]), backgroundColor: COLORS.cur, borderRadius: 4, maxBarThickness: 18 }] },
          options: { indexAxis: 'y', scales: { x: { ticks: { precision: 0 } }, y: { grid: { display: false }, ticks: { autoSkip: false, callback(v) { return wrap(this.getLabelForValue(v), 34); } } } }, plugins: { legend: { display: false } } },
        });
      } else if (x.type === 'rank') {
        const pts = {};
        resp.forEach((r) => x.cols.forEach((col, rank) => {
          const v = String(r.row[col] || '').trim();
          if (!v || A.norm(v) === 'none') return;
          const key = v.replace(/\s*\(.*\)\s*$/, '');
          pts[key] = (pts[key] || 0) + (x.cols.length - rank);
        }));
        const list = Object.entries(pts).sort((a, b) => b[1] - a[1]);
        chart(el, {
          type: 'bar',
          data: { labels: list.map((v) => v[0]), datasets: [{ label: 'Skor preferensi', data: list.map((v) => v[1]), backgroundColor: COLORS.cur, borderRadius: 4, maxBarThickness: 18 }] },
          options: { indexAxis: 'y', scales: { y: { grid: { display: false } } }, plugins: { legend: { display: false } } },
        });
      }
    });
  }

  /* ───────── kritik & saran ───────── */
  function renderComments(prep, resp) {
    const entries = A.textEntries(prep, resp);
    const box = $('#comments');
    const themes = Object.keys(prep.div.themes || {}).concat('Lainnya');
    const questions = [...new Set(entries.map((e) => e.q))];
    const ui = { q: '', theme: '', word: '', search: '' };
    const themeCount = (list) => themes.map((t) => [t, list.filter((e) => e.themes.includes(t)).length]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]);

    box.innerHTML = `
      <div class="card-head row">
        <div><h2>Kritik &amp; saran karyawan</h2><p class="muted">${entries.length} masukan bermakna (jawaban kosong / “tidak ada” / “-” disaring). Tema dikelompokkan otomatis berdasarkan kata kunci.</p></div>
        <div class="row gap-s wrap">
          <select id="cQ" aria-label="Pertanyaan"><option value="">Semua pertanyaan</option>${questions.map((q) => `<option>${esc(q)}</option>`).join('')}</select>
          <input id="cSearch" type="search" placeholder="Cari kata…" aria-label="Cari">
        </div>
      </div>
      <div class="grid-comments">
        <div>
          <h3>Tema</h3><div id="cThemes" class="chips"></div>
          <h3>Kata yang sering muncul</h3><div id="cWords" class="chips words"></div>
        </div>
        <div><div id="cList" class="comment-list"></div></div>
      </div>`;

    function apply() {
      const s = A.norm(ui.search);
      const list = entries.filter((e) => (!ui.q || e.q === ui.q) && (!ui.theme || e.themes.includes(ui.theme)) && (!ui.word || A.norm(e.text).includes(ui.word)) && (!s || A.norm(e.text).includes(s)));
      const base = entries.filter((e) => !ui.q || e.q === ui.q);
      $('#cThemes').innerHTML = themeCount(base).sort((a, b) => (a[0] === 'Lainnya') - (b[0] === 'Lainnya')).map(([t, n]) => `<button type="button" class="chip ${ui.theme === t ? 'on' : ''}" data-theme="${esc(t)}">${esc(t)} <span>${n}</span></button>`).join('') || '<span class="muted">–</span>';
      const words = A.wordFreq(base, 24);
      const max = words.length ? words[0][1] : 1;
      $('#cWords').innerHTML = words.map(([w, n]) => `<button type="button" class="chip word ${ui.word === w ? 'on' : ''}" data-word="${esc(w)}" style="font-size:${(0.78 + (n / max) * 0.5).toFixed(2)}rem">${esc(w)} <span>${n}</span></button>`).join('');
      const grouped = {};
      list.forEach((e) => { const t = ui.theme || e.themes[0]; (grouped[t] = grouped[t] || []).push(e); });
      $('#cList').innerHTML = list.length ? Object.entries(grouped).sort((a, b) => (a[0] === 'Lainnya') - (b[0] === 'Lainnya') || b[1].length - a[1].length).map(([t, es]) => `
        <div class="comment-group"><h4>${esc(t)} <span class="muted small">(${es.length})</span></h4>
          <ul>${es.map((e) => `<li><p>${highlight(e.text, ui.word || s)}</p><span class="meta">${esc(e.q)}${e.sub ? ' · ' + esc(e.sub) : ''} · ${esc(e.r.area)} · ${esc(e.r.div)} · ${esc(e.r.jab)}</span></li>`).join('')}</ul></div>`).join('')
        : '<p class="muted">Tidak ada masukan yang cocok.</p>';
      box.querySelectorAll('[data-theme]').forEach((b) => b.onclick = () => { ui.theme = ui.theme === b.dataset.theme ? '' : b.dataset.theme; apply(); });
      box.querySelectorAll('[data-word]').forEach((b) => b.onclick = () => { ui.word = ui.word === b.dataset.word ? '' : b.dataset.word; apply(); });
    }
    $('#cQ').onchange = (e) => { ui.q = e.target.value; ui.theme = ''; ui.word = ''; apply(); };
    $('#cSearch').oninput = (e) => { ui.search = e.target.value; apply(); };
    apply();
  }

  function highlight(text, word) {
    const t = esc(text);
    if (!word) return t;
    const re = new RegExp('(' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return t.replace(re, '<mark>$1</mark>');
  }

  /* ───────── profil ───────── */
  function drawProfile(d, resp) {
    const bar = (el, entries) => chart(el, {
      type: 'bar',
      data: { labels: entries.map((e) => e[0]), datasets: [{ label: 'Responden', data: entries.map((e) => e[1]), backgroundColor: COLORS.cur, borderRadius: 4, maxBarThickness: 16 }] },
      options: { indexAxis: 'y', scales: { x: { ticks: { precision: 0 } }, y: { grid: { display: false }, ticks: { autoSkip: false, callback(v) { return wrap(this.getLabelForValue(v), 22); } } } }, plugins: { legend: { display: false } } },
    });
    const count = (fn) => { const c = {}; resp.forEach((r) => { const k = fn(r) || '(tidak diisi)'; c[k] = (c[k] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]); };
    bar($('#cProfArea'), count((r) => (r.area === 'Others' ? 'Others · ' + r.locRaw : r.area)));
    bar($('#cProfDiv'), count((r) => r.div));
    bar($('#cProfJab'), count((r) => r.jab));
    (d.profile || []).forEach((_, i) => bar($('#cProfX' + i), count((r) => r.profile[i])));
  }

  /* ───────── init ───────── */
  function init() {
    buildTabs();
    window.addEventListener('hashchange', onRoute);
    ['fArea', 'fDiv', 'fJab'].forEach((id) => $('#' + id).addEventListener('change', (e) => {
      state.filters[{ fArea: 'area', fDiv: 'div', fJab: 'jab' }[id]] = e.target.value;
      render();
    }));
    $('#btnReset').addEventListener('click', () => {
      state.filters = { area: '', div: '', jab: '' };
      ['fArea', 'fDiv', 'fJab'].forEach((id) => { $('#' + id).value = ''; });
      render();
    });
    $('#btnRefresh').addEventListener('click', () => load('live'));
    $('#fileInput').addEventListener('change', (e) => { if (e.target.files[0]) load('file', e.target.files[0]); e.target.value = ''; });
    onRoute();
    load('live');
    const mins = CFG.SOURCE.autoRefreshMinutes;
    if (mins > 0) setInterval(() => { if (/live|publish/.test(state.source) && !document.hidden) load('live'); }, mins * 60000);
  }

  if (!window.Chart) {
    document.getElementById('app').innerHTML = '<div class="empty">Library grafik gagal dimuat. Periksa koneksi internet.</div>';
  } else init();
})();
