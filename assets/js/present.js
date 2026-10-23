/*
 * Mode presentasi bergaya deck laporan: setiap slide 16:9 berukuran tetap 1280×720 (PowerPoint widescreen)
 * disusun khusus dari panel-panel ringkas dalam grid 4 kolom, sehingga satu slide memuat banyak analisis
 * dan jumlah slide sedikit (±2–3 slide per divisi). Seluruh angka & insight dihitung dari data terkini
 * dan mengikuti filter aktif.
 * Navigasi: → / Spasi = berikutnya, ← = sebelumnya, ↓ / ↑ = divisi berikutnya/sebelumnya, Home/End,
 * F = layar penuh, Esc = keluar.
 */
(function () {
  const CFG = window.SURVEY_CONFIG;
  const A = window.SurveyAnalytics;
  const AREAS = CFG.AREAS;
  const SLIDE_W = 1280, SLIDE_H = 720;
  const C = { ink: '#1f1416', ink2: '#5b4b4e', muted: '#8c7b7e', line: '#efe5e6', red: '#c8102e', prev: '#94a3b8' };
  const CAT = { 'cat-5': '#16a34a', 'cat-4': '#0ea5e9', 'cat-3': '#f59e0b', 'cat-2': '#f97316', 'cat-1': '#dc2626' };
  const PAL = ['#2563eb', '#f97316', '#14b8a6', '#8b5cf6', '#ec4899', '#22c55e', '#f59e0b', '#0ea5e9'];
  const LIKERT = ['#dc2626', '#fb923c', '#cbd5e1', '#60a5fa', '#2563eb'];
  const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
  const $id = (id) => document.getElementById(id);
  const stage = $id('slideStage'), frame = $id('slideFrame');
  const st = { on: false, idx: 0, slides: [], charts: [] };

  /* ───────── util ───────── */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f2 = (v) => (v == null || Number.isNaN(v) ? '–' : v.toFixed(2));
  const pct = (v) => (v == null ? '–' : Math.round(v * 100) + '%');
  const share = (n, t) => (t ? n / t : null);
  const catOf = (v) => A.category(v);
  const catColor = (v) => (v == null ? C.muted : CAT[catOf(v).cls]);
  const catLabel = (v) => (v == null ? '' : catOf(v).label);
  const badge = (v) => (v == null ? '' : `<span class="dk-badge" style="--bc:${catColor(v)}">${catLabel(v)}</span>`);
  function gap(cur, prev) {
    if (cur == null || prev == null) return '<span class="dk-gap na">–</span>';
    const g = Math.round((A.round2(cur) - A.round2(prev)) * 100) / 100;
    if (g > 0) return `<span class="dk-gap up">▲${g.toFixed(2)}</span>`;
    if (g < 0) return `<span class="dk-gap down">▼${Math.abs(g).toFixed(2)}</span>`;
    return '<span class="dk-gap na">►0.00</span>';
  }

  /* ───────── komponen panel ───────── */
  function panel(o) {
    return `<section class="dk-panel ${o.cls || ''}" style="grid-column:${o.col || 'auto'};grid-row:${o.row || 'auto'};--pc:${o.color || C.red}">
      <h3>${esc(o.title)}</h3>${o.sub ? `<p class="dk-sub">${o.sub}</p>` : ''}
      <div class="dk-pbody">${o.body}</div>
      ${o.insight ? `<div class="dk-insight"><b>Insight</b><p>${o.insight}</p></div>` : ''}
    </section>`;
  }

  // Daftar berperingkat dengan bar horizontal (gaya "pelatihan yang dibutuhkan").
  function bars(rows, o) {
    const opt = o || {};
    const vals = rows.filter((r) => !r.head && r.value != null).map((r) => r.value);
    const max = opt.max != null ? opt.max : Math.max(1, ...vals);
    const min = opt.min != null ? opt.min : 0;
    let n = 0;
    return `<ol class="dk-bars ${opt.cls || ''}" style="${opt.cols ? `column-count:${opt.cols}` : ''}">${rows.map((r, i) => {
      if (r.head) return `<li class="head"><span class="dk-lab">${esc(r.label)}</span>${r.right != null ? `<span class="dk-right">${r.right}</span>` : ''}</li>`;
      n++;
      const w = r.value == null ? 0 : Math.max(3, Math.min(100, ((r.value - min) / (max - min || 1)) * 100));
      const col = r.color || PAL[i % PAL.length];
      return `<li>${opt.rank ? `<span class="dk-rank" style="background:${col}">${n}</span>` : ''}<span class="dk-lab" title="${esc(r.label)}">${esc(r.label)}</span>
        <span class="dk-track"><span style="width:${w.toFixed(1)}%;background:${col}"></span></span>
        <span class="dk-val">${r.display != null ? r.display : f2(r.value)}</span>${r.right != null ? `<span class="dk-right">${r.right}</span>` : ''}</li>`;
    }).join('')}</ol>`;
  }

  function radial(p, color, label, size) {
    const sz = size || 66, r = (sz - 9) / 2, c = 2 * Math.PI * r, d = c * Math.max(0, Math.min(1, p || 0));
    return `<div class="dk-radial"><svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" role="img" aria-label="${esc(label)} ${pct(p)}">
      <circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" fill="none" stroke="#f3e8ea" stroke-width="8"/>
      <circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${d.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${sz / 2} ${sz / 2})"/>
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="${(sz / 4.6).toFixed(1)}" font-weight="800" fill="${C.ink}">${p == null ? '–' : Math.round(p * 100) + '%'}</text></svg>
      <span>${label}</span></div>`;
  }

  // Bar 100% komposisi jawaban, urut dari Sangat puas ke Sangat tidak puas. dist[k] = jumlah jawaban skor k+1.
  function stack(dist) {
    const labels = ['Sangat tidak puas', 'Tidak puas', 'Netral', 'Puas', 'Sangat puas'];
    const n = dist.reduce((a, b) => a + b, 0) || 1;
    const order = [4, 3, 2, 1, 0];
    return `<div class="dk-stack">${order.map((k) => (dist[k] ? `<span style="width:${(dist[k] / n) * 100}%;background:${LIKERT[k]}" title="${labels[k]}: ${Math.round((dist[k] / n) * 100)}%">${dist[k] / n >= 0.08 ? Math.round((dist[k] / n) * 100) + '%' : ''}</span>` : '')).join('')}</div>
      <div class="dk-legend">${order.map((k) => `<span><i style="background:${LIKERT[k]}"></i>${labels[k]}</span>`).join('')}</div>`;
  }

  function rankCards(list, unit) {
    const tot = list.reduce((a, b) => a + b[1], 0) || 1;
    return `<div class="dk-rankcards">${list.slice(0, 3).map(([name, v], i) => `<div class="dk-rc" style="--rc:${PAL[i]}"><b>#${i + 1}</b><span class="nm">${esc(name)}</span>
      <span class="bar"><span style="width:${(v / list[0][1]) * 100}%"></span></span><span class="pc">${Math.round((v / tot) * 100)}%</span><span class="ds">${v} ${unit}</span></div>`).join('')}</div>`;
  }

  /* ───────── grafik (ECharts, warna tetap terang karena slide selalu putih) ───────── */
  function chart(id, option) {
    const el = $id(id);
    if (!el || !window.echarts) return null;
    const c = echarts.init(el, null, { renderer: 'canvas' });
    c.setOption(Object.assign({ textStyle: { fontFamily: FONT, color: C.ink2 }, animationDuration: 600,
      tooltip: { backgroundColor: '#fff', borderColor: C.line, textStyle: { color: C.ink, fontSize: 12 } } }, option));
    st.charts.push(c);
    return c;
  }
  const ax = (o) => Object.assign({ axisLine: { lineStyle: { color: C.line } }, axisTick: { show: false }, axisLabel: { color: C.ink2, fontSize: 10 }, splitLine: { lineStyle: { color: C.line, type: 'dashed' } } }, o);

  function dumbbellChart(id, labels, prev, cur, colors) {
    const vals = prev.concat(cur).filter((v) => v != null);
    const min = vals.length ? Math.max(1, Math.floor((Math.min(...vals) - 0.15) * 4) / 4) : 1;
    chart(id, {
      grid: { left: 4, right: 34, top: 8, bottom: 4, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'none' }, formatter: (ps) => `<b>${esc(labels[ps[0].dataIndex])}</b><br>${CFG.prevYear}: ${f2(prev[ps[0].dataIndex])}<br>${CFG.year}: ${f2(cur[ps[0].dataIndex])}` },
      xAxis: ax({ type: 'value', min, max: 5, splitNumber: 3 }),
      yAxis: ax({ type: 'category', inverse: true, data: labels, splitLine: { show: false }, axisLine: { show: false }, axisLabel: { color: C.ink, fontSize: 11, fontWeight: 600 } }),
      series: [
        { type: 'custom', silent: true, renderItem: (p, api) => {
          const a = api.value(1), b = api.value(2);
          if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) return null;
          const p1 = api.coord([a, api.value(0)]), p2 = api.coord([b, api.value(0)]);
          return { type: 'line', shape: { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] }, style: { stroke: b >= a ? 'rgba(22,163,74,.55)' : 'rgba(245,158,11,.75)', lineWidth: 5, lineCap: 'round' } };
        }, encode: { y: 0, x: [1, 2] }, data: labels.map((_, i) => [i, prev[i], cur[i]]) },
        { type: 'scatter', symbolSize: 11, itemStyle: { color: C.prev, borderColor: '#fff', borderWidth: 2 }, data: prev.map((v, i) => [v, i]) },
        { type: 'scatter', symbolSize: 15, itemStyle: { borderColor: '#fff', borderWidth: 2 },
          label: { show: true, position: 'right', formatter: (p) => f2(p.value[0]), color: C.ink, fontWeight: 800, fontSize: 11 },
          data: cur.map((v, i) => ({ value: [v, i], itemStyle: { color: colors[i] } })) },
      ],
    });
  }

  function lineChart(id, years, series) {
    const vals = series.flatMap((s) => s.data).filter((v) => v != null);
    const min = vals.length ? Math.max(1, Math.floor((Math.min(...vals) - 0.1) * 4) / 4) : 1;
    chart(id, {
      color: series.map((s) => s.color),
      legend: { top: 0, itemWidth: 10, itemHeight: 8, textStyle: { fontSize: 10, color: C.ink2 } },
      grid: { left: 4, right: 14, top: 26, bottom: 2, containLabel: true },
      tooltip: { trigger: 'axis', valueFormatter: (v) => f2(v) },
      xAxis: ax({ type: 'category', data: years.map(String), boundaryGap: false }),
      yAxis: ax({ type: 'value', min, max: 5, splitNumber: 4 }),
      series: series.map((s, k) => ({ name: s.name, type: 'line', smooth: true, connectNulls: true, symbolSize: k === 0 ? 8 : 6, lineStyle: { width: k === 0 ? 3 : 2 },
        areaStyle: k === 0 ? { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: s.color + '55' }, { offset: 1, color: s.color + '05' }]) } : undefined, data: s.data })),
    });
  }

  /* ───────── data & susunan slide ───────── */
  function divisionTexts(r) {
    const entries = A.textEntries(r.prep, r.resp);
    const themes = Object.keys(r.d.themes || {}).concat('Lainnya').map((t) => [t, entries.filter((e) => e.themes.includes(t)).length]).filter((t) => t[1] > 0)
      .sort((a, b) => (a[0] === 'Lainnya') - (b[0] === 'Lainnya') || b[1] - a[1]);
    const words = A.wordFreq(entries, 14);
    const pickFrom = themes.filter((t) => !['Lainnya', 'Apresiasi'].includes(t[0])).map((t) => t[0]);
    const quotes = [];
    pickFrom.forEach((t) => {
      const q = entries.filter((e) => e.themes[0] === t && e.text.length >= 35 && e.text.length <= 190 && !quotes.includes(e)).sort((a, b) => b.text.length - a.text.length)[0];
      if (q && quotes.length < 4) quotes.push(q);
    });
    return { entries, themes, words, quotes };
  }

  function extrasData(r) {
    const resp = r.resp, prep = r.prep;
    const out = [];
    if (prep.gates.length) {
      out.push({ type: 'gates', title: 'Interaksi dengan layanan', vals: prep.gates.map((g) => {
        const ans = resp.map((x) => A.norm(x.row[g.col])).filter((v) => v && v !== 'none');
        return { label: g.label, p: share(ans.filter((v) => v === 'pernah').length, ans.length) };
      }) });
    }
    prep.extras.forEach((x) => {
      if (!x.cols.length) return;
      const title = x.label.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+—.*$/, '').trim();
      if (x.type === 'yesno') {
        const ans = resp.map((y) => A.norm(y.row[x.cols[0]])).filter((v) => v === 'ya' || v === 'tidak');
        out.push({ type: 'yesno', title, p: share(ans.filter((v) => v === 'ya').length, ans.length), n: ans.length, prev: x.prev ? x.prev.Ya : null });
      } else if (x.type === 'likert') {
        const sc = resp.map((y) => A.score(y.row[x.cols[0]])).filter((v) => v != null);
        out.push({ type: 'likert', title, mean: A.mean(sc), p: share(sc.filter((v) => v >= 4).length, sc.length) });
      } else if (x.type === 'nps') {
        const vals = resp.map((y) => String(y.row[x.cols[0]]).trim()).filter((v) => v !== '' && !Number.isNaN(Number(v.replace(',', '.')))).map((v) => Number(v.replace(',', '.'))).filter((v) => v >= 0 && v <= 10);
        const pro = vals.filter((v) => v >= 9).length, det = vals.filter((v) => v <= 6).length;
        out.push({ type: 'nps', title: 'Employee Net Promoter Score (eNPS)', n: vals.length, nps: vals.length ? Math.round(((pro - det) / vals.length) * 100) : null,
          pro: share(pro, vals.length), det: share(det, vals.length), pas: share(vals.length - pro - det, vals.length), mean: A.mean(vals),
          bins: Array.from({ length: 11 }, (_, i) => vals.filter((v) => Math.round(v) === i).length) });
      } else if (x.type === 'rank') {
        const pts = {};
        resp.forEach((y) => x.cols.forEach((col, rank) => {
          const v = String(y.row[col] || '').trim();
          if (!v || A.norm(v) === 'none') return;
          const key = v.replace(/\s*\(.*\)\s*$/, '');
          pts[key] = (pts[key] || 0) + (x.cols.length - rank);
        }));
        out.push({ type: 'rank', title: 'Preferensi tipe event HCGS', list: Object.entries(pts).sort((a, b) => b[1] - a[1]) });
      } else if (x.type === 'cat') {
        const all = A.countValues(null, x.cols, resp).filter(([k]) => !/^(-+|tidak ada.*|tdk ada|none|ok.*|sudah.*|belum ada)$/i.test(k));
        out.push({ type: 'cat', title, list: all.slice(0, 6), n: resp.length });
      }
    });
    return out;
  }

  function build() {
    const rows = window.SurveyApp.analyzeAll();
    const slides = [];
    const totalN = rows.reduce((s, r) => s + r.resp.length, 0);
    const withIdx = rows.filter((r) => r.an.index[0] != null);
    const avg = A.mean(withIdx.map((r) => r.an.index[0]));
    const ranked = withIdx.slice().sort((a, b) => b.an.index[0] - a.an.index[0]);
    const up = withIdx.filter((r) => r.prev[0] != null && A.round2(r.an.index[0]) > r.prev[0]).length;
    const down = withIdx.filter((r) => r.prev[0] != null && A.round2(r.an.index[0]) < r.prev[0]).length;

    /* Ringkasan 1 */
    slides.push({ route: 'ringkasan', eyebrow: 'Ringkasan', title: `Index pelayanan divisi ${CFG.year}`,
      subtitle: withIdx.length ? `Rata-rata index <b>${f2(avg)}</b> (${catLabel(avg).toLowerCase()}) dari <b>${totalN} respons</b> di ${rows.length} survey divisi. <b>${esc(ranked[0].d.name)}</b> tertinggi (${f2(ranked[0].an.index[0])}), <b>${esc(ranked[ranked.length - 1].d.name)}</b> terendah (${f2(ranked[ranked.length - 1].an.index[0])}); <b>${up} divisi naik</b> dan ${down} turun dibanding ${CFG.prevYear}.` : 'Belum ada data.',
      n: totalN,
      html: () => panel({ col: '1 / 3', row: '1 / 3', title: `Index ${CFG.year} per divisi`, sub: `Skala 1–5 · perubahan dibanding ${CFG.prevYear} · n = responden`,
        body: `<div class="dk-tiles">${rows.map((r) => `<div class="dk-tile" style="--dc:${r.color}"><span class="nm">${esc(r.d.name)}</span><span class="full">${esc(r.d.full)}</span>
          <span class="big" style="color:${catColor(r.an.index[0])}">${f2(r.an.index[0])}</span>${badge(r.an.index[0])}<span class="meta">${gap(r.an.index[0], r.prev[0])} <span>vs ${f2(r.prev[0])}</span> · n=${r.resp.length}</span>
          ${bars(AREAS.map((a, i) => ({ label: a === 'Simpang Dukuh' ? 'Simpang' : a, value: r.an.index[i + 1], color: catColor(r.an.index[i + 1]) })), { min: 3, max: 5 })}</div>`).join('')}</div>` })
        + panel({ col: '3', row: '1 / 3', title: `Perubahan ${CFG.prevYear} → ${CFG.year}`, sub: `Abu-abu = ${CFG.prevYear}, berwarna = ${CFG.year}; hijau naik, kuning turun.`, body: '<div class="dk-chart" id="dkDumb" style="height:400px"></div>' })
        + panel({ col: '4', row: '1 / 3', title: 'Index per area kerja', sub: 'Warna sel mengikuti kategori kepuasan.',
          body: `<table class="dk-heat"><thead><tr><th></th><th>Total</th>${AREAS.map((a) => `<th>${a === 'Simpang Dukuh' ? 'Simpang' : a}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr><th>${esc(r.d.name)}</th>${[0, 1, 2, 3].map((k) => `<td style="background:${r.an.index[k] == null ? '#f6eff0' : catColor(r.an.index[k])}">${f2(r.an.index[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
          insight: (() => { let lo = null; rows.forEach((r) => AREAS.forEach((a, i) => { const v = r.an.index[i + 1]; if (v != null && (!lo || v < lo.v)) lo = { v, a, d: r.d.name }; })); return lo ? `Skor area terendah: <b>${esc(lo.d)}</b> di ${lo.a} (${f2(lo.v)}).` : ''; })() }),
      after: () => dumbbellChart('dkDumb', rows.map((r) => r.d.name), rows.map((r) => r.prev[0] ?? null), rows.map((r) => A.round2(r.an.index[0])), rows.map((r) => r.color)),
    });

    /* Ringkasan 2 */
    const items = rows.flatMap((r) => r.an.items.filter((i) => !i.overall && i.stats.n >= 3).map((i) => ({ i, r })));
    const best = items.slice().sort((a, b) => b.i.stats.mean - a.i.stats.mean).slice(0, 8);
    const worst = items.slice().sort((a, b) => a.i.stats.mean - b.i.stats.mean).slice(0, 8);
    const dates = rows.flatMap((r) => r.resp.map((x) => x.date).filter(Boolean));
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const days = [...new Set(dates.map(iso))].sort();
    const perDay = days.map((d) => dates.filter((x) => iso(x) === d).length);
    const peak = perDay.length ? perDay.indexOf(Math.max(...perDay)) : -1;
    const years = [...new Set(rows.flatMap((r) => Object.keys(r.d.indexHistory).map(Number)))].sort().concat(CFG.year);
    slides.push({ route: 'ringkasan', eyebrow: 'Ringkasan', title: 'Peringkat, partisipasi & indikator kunci',
      subtitle: `${best[0] ? `Indikator tertinggi <b>${esc(best[0].i.label)}</b> (${esc(best[0].r.d.name)}, ${f2(best[0].i.stats.mean)}); terendah <b>${esc(worst[0].i.label)}</b> (${esc(worst[0].r.d.name)}, ${f2(worst[0].i.stats.mean)}). ` : ''}${peak >= 0 ? `Puncak pengisian <b>${perDay[peak]} respons</b> pada ${new Date(days[peak]).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}.` : ''}`,
      n: totalN,
      html: () => panel({ col: '1 / 3', row: '1', title: 'Peringkat divisi dari tahun ke tahun', sub: 'Posisi 1 = index tertinggi pada tahun tersebut.', body: '<div class="dk-chart" id="dkBump" style="height:186px"></div>' })
        + panel({ col: '1 / 3', row: '2', title: 'Respons harian per survey', sub: `${days.length} hari pengisian · ${totalN} respons`, body: '<div class="dk-chart" id="dkDaily" style="height:165px"></div>' })
        + panel({ col: '3', row: '1 / 3', title: 'Indikator tertinggi', sub: 'Skor rata-rata lintas divisi (min. 3 jawaban).',
          body: bars(best.map(({ i, r }) => ({ label: `${i.label} · ${r.d.name}`, value: i.stats.mean, color: r.color })), { rank: true, min: 3, max: 5, cls: 'two-line' }) })
        + panel({ col: '4', row: '1 / 3', title: 'Indikator terendah', sub: 'Kandidat prioritas perbaikan lintas divisi.',
          body: bars(worst.map(({ i, r }) => ({ label: `${i.label} · ${r.d.name}`, value: i.stats.mean, color: r.color })), { rank: true, min: 3, max: 5, cls: 'two-line' }) }),
      after: () => {
        const valueOf = (r, y) => (y === CFG.year ? r.an.index[0] : (r.d.indexHistory[y] || [])[0]);
        const ranks = {};
        years.forEach((y) => rows.filter((r) => valueOf(r, y) != null).sort((a, b) => valueOf(b, y) - valueOf(a, y)).forEach((r, i) => { (ranks[r.d.id] = ranks[r.d.id] || {})[y] = i + 1; }));
        chart('dkBump', {
          grid: { left: 26, right: 84, top: 8, bottom: 20 },
          tooltip: { trigger: 'item', formatter: (p) => `${esc(p.seriesName)} · ${years[p.dataIndex]}: #${p.value}` },
          xAxis: ax({ type: 'category', data: years.map(String), boundaryGap: false }),
          yAxis: ax({ type: 'value', inverse: true, min: 1, max: rows.length, interval: 1, axisLabel: { formatter: '#{value}', color: C.ink2, fontSize: 10 } }),
          series: rows.map((r) => ({ name: r.d.name, type: 'line', smooth: 0.3, symbolSize: 10, lineStyle: { width: 3, color: r.color }, itemStyle: { color: r.color },
            endLabel: { show: true, formatter: '{a}', color: r.color, fontWeight: 700, fontSize: 11 }, data: years.map((y) => (ranks[r.d.id] || {})[y] ?? null) })),
        });
        chart('dkDaily', {
          color: rows.map((r) => r.color),
          legend: { top: 0, itemWidth: 10, itemHeight: 8, textStyle: { fontSize: 10, color: C.ink2 } },
          grid: { left: 4, right: 8, top: 24, bottom: 2, containLabel: true },
          tooltip: { trigger: 'axis' },
          xAxis: ax({ type: 'category', data: days.map((d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })) }),
          yAxis: ax({ type: 'value', minInterval: 1 }),
          series: rows.map((r) => ({ name: r.d.name, type: 'bar', stack: 'x', barMaxWidth: 26, itemStyle: { borderColor: '#fff', borderWidth: 1 },
            data: days.map((d) => r.resp.filter((x) => x.date && iso(x.date) === d).length) })),
        });
      },
    });

    /* Per divisi */
    rows.forEach((r) => {
      const an = r.an, d = r.d, idx = an.index[0], prev = r.prev;
      const scored = an.items.filter((i) => !i.overall && i.stats.n > 0);
      const byMean = scored.slice().sort((a, b) => b.stats.mean - a.stats.mean);
      const t2b = A.mean(scored.map((i) => i.stats.top2));
      const ov = an.items.find((i) => i.overall && i.sub === 'Kepuasan keseluruhan' && i.stats.n);
      const g = prev[0] != null && idx != null ? A.round2(idx) - prev[0] : null;
      const eyebrow = `${d.name} · ${d.full}`;

      // Slide 1: index & skor per indikator
      const list = [];
      an.subs.forEach((sb) => {
        const its = sb.items.filter((i) => i.stats.n > 0).sort((a, b) => b.stats.mean - a.stats.mean);
        if (!its.length) return;
        if (an.subs.length > 1) list.push({ head: true, label: sb.overall ? `${sb.name} (di luar index)` : sb.name, right: sb.value ? `<b>${f2(sb.value[0])}</b> ${gap(sb.value[0], (sb.hist[CFG.prevYear] || [])[0])}` : '' });
        its.forEach((i) => list.push({ label: i.label, value: i.stats.mean, color: catColor(i.stats.mean), right: `${gap(i.stats.mean, i.b25 && i.b25[0])}<em>${pct(i.stats.top2)}</em>` }));
      });
      const cols = list.length <= 13 ? 1 : list.length <= 30 ? 2 : 3;
      const years2 = Object.keys(d.indexHistory).map(Number).sort().concat(CFG.year);
      slides.push({ route: d.id, eyebrow, title: `Index pelayanan ${d.name} ${CFG.year}`,
        subtitle: idx == null ? 'Belum ada jawaban untuk filter ini.' : `Index <b>${f2(idx)}</b> (${catLabel(idx).toLowerCase()})${g != null ? `, <b>${g > 0.004 ? 'naik' : g < -0.004 ? 'turun' : 'tetap'} ${Math.abs(g).toFixed(2)}</b> dari ${f2(prev[0])} di ${CFG.prevYear}` : ''} dari <b>${an.n} responden</b>. Tertinggi <b>${esc(byMean[0].label)}</b> (${f2(byMean[0].stats.mean)}); terendah <b>${esc(byMean[byMean.length - 1].label)}</b> (${f2(byMean[byMean.length - 1].stats.mean)}).`,
        n: an.n,
        html: () => panel({ col: '1', row: '1', title: `Index ${CFG.year}`, color: r.color,
          body: `<div class="dk-kpi"><span class="big" style="color:${catColor(idx)}">${f2(idx)}</span><div>${badge(idx)}<span class="meta">${gap(idx, prev[0])} vs ${CFG.prevYear} (${f2(prev[0])})</span><span class="meta">${an.n} responden · ${pct(ov ? ov.stats.top2 : t2b)} puas</span></div></div>
            ${bars(AREAS.map((a, i) => ({ label: a, value: an.index[i + 1], color: catColor(an.index[i + 1]), right: `<em>n=${an.areaN[i]}</em>` })), { min: 3, max: 5, cls: 'compact' })}` })
          + panel({ col: '1', row: '2', title: 'Tren index per area', sub: d.indexHistoryNote ? esc(d.indexHistoryNote) : `Total dan per area, ${years2[0]}–${CFG.year}.`, color: r.color, body: '<div class="dk-chart" id="dkTrend" style="height:170px"></div>' })
          + panel({ col: '2 / 5', row: '1 / 3', title: 'Skor per indikator', color: r.color,
            sub: `Diurutkan per sub-kategori · bar = skor ${CFG.year} (skala 3–5) · ▲▼ = perubahan vs ${CFG.prevYear} · % = responden puas`,
            body: bars(list, { min: 3, max: 5, cols, cls: cols === 1 ? 'roomy' : cols === 3 ? 'dense' : '' }) }),
        after: () => lineChart('dkTrend', years2, ['Total'].concat(AREAS).map((name, k) => ({ name, color: k === 0 ? r.color : ['#2563eb', '#f97316', '#14b8a6'][k - 1],
          data: years2.map((y) => (y === CFG.year ? A.round2(an.index[k]) : (d.indexHistory[y] || [])[k] ?? null)) }))),
      });

      // Slide 2: prioritas & suara karyawan
      const tx = divisionTexts(r);
      const prio = window.SurveyApp.priorityTop(an);
      const dist = [0, 0, 0, 0, 0];
      scored.forEach((i) => i.stats.dist.forEach((v, k) => { dist[k] += v; }));
      const distN = dist.reduce((a, b) => a + b, 0);
      const subs = an.subs.filter((s) => !s.overall && s.value && s.value[0] != null);
      const topTheme = tx.themes.find((t) => t[0] !== 'Lainnya');
      slides.push({ route: d.id, eyebrow, title: 'Prioritas perbaikan & suara karyawan',
        subtitle: `${prio[0] ? `Prioritas #1 <b>${esc(prio[0].label)}</b> (${f2(prio[0].stats.mean)}). ` : ''}${tx.entries.length} masukan tertulis${topTheme ? `; tema terbanyak <b>${esc(topTheme[0])}</b> (${topTheme[1]})` : ''}${tx.words.length ? `, kata yang sering muncul <b>“${esc(tx.words[0][0])}”</b>` : ''}.`,
        n: an.n,
        html: () => panel({ col: '1', row: '1', title: 'Komposisi jawaban', sub: `Seluruh indikator · ${distN} jawaban`, color: r.color,
          body: stack(dist) + `<div class="dk-radials">${radial(share(dist[3] + dist[4], distN), '#2563eb', 'Puas + sangat puas', 70)}${radial(share(dist[0] + dist[1], distN), '#dc2626', 'Tidak puas', 70)}</div>` })
          + panel({ col: '1', row: '2', title: subs.length > 1 ? 'Index sub-kategori' : 'Index per area', color: r.color,
            body: subs.length > 1 ? bars(subs.map((s) => ({ label: s.name, value: s.value[0], color: catColor(s.value[0]), right: gap(s.value[0], (s.hist[CFG.prevYear] || [])[0]) })), { min: 3, max: 5, cls: 'compact' })
              : bars(AREAS.map((a, i) => ({ label: a, value: an.index[i + 1], color: catColor(an.index[i + 1]), right: gap(an.index[i + 1], prev[i + 1]) })), { min: 3, max: 5, cls: 'compact' }) })
          + panel({ col: '2', row: '1 / 3', title: 'Prioritas perbaikan', sub: 'Skor rendah, turun dari tahun lalu, atau banyak responden tidak puas.', color: r.color,
            body: `<ol class="dk-prio">${prio.map((i, k) => {
              const why = [];
              if (i.stats.mean < 4.2) why.push('belum sangat puas');
              if (i.b25 && i.b25[0] != null && i.stats.mean < i.b25[0] - 0.005) why.push(`turun ${f2(i.b25[0] - i.stats.mean)}`);
              if (i.stats.bottom2 > 0) why.push(`${pct(i.stats.bottom2)} tidak puas`);
              return `<li style="--pc:${catColor(i.stats.mean)}"><span class="n">${k + 1}</span><span class="t"><b>${esc(i.label)}</b><em>${esc(i.sub)} · ${why.join(' · ') || 'skor relatif terendah'}</em></span><span class="v">${f2(i.stats.mean)}</span></li>`;
            }).join('')}</ol>` })
          + panel({ col: '3', row: '1 / 3', title: 'Tema kritik & saran', sub: `${tx.entries.length} masukan bermakna, dikelompokkan otomatis.`, color: r.color,
            body: bars(tx.themes.map(([t, n], i) => ({ label: t, value: n, display: `${n}`, color: t === 'Lainnya' ? '#b8a9ab' : PAL[i % PAL.length], right: `<em>${pct(share(n, tx.entries.length))}</em>` })), { cls: 'compact' })
              + `<p class="dk-mini">Kata yang sering muncul</p><div class="dk-words">${tx.words.map(([w, n], i) => `<span style="color:${PAL[i % PAL.length]};font-size:${(11 + (n / (tx.words[0] ? tx.words[0][1] : 1)) * 7).toFixed(1)}px">${esc(w)}</span>`).join('')}</div>` })
          + panel({ col: '4', row: '1 / 3', title: 'Suara karyawan', sub: 'Kutipan masukan dari tema utama.', color: r.color,
            body: `<div class="dk-quotes">${tx.quotes.map((q) => `<blockquote style="--qc:${r.color}">“${esc(q.text)}”<cite>${esc(q.themes[0])} · ${esc(q.r.area)} · ${esc(q.r.div)}</cite></blockquote>`).join('') || '<p class="dk-mini">Belum ada masukan tertulis.</p>'}</div>`,
            insight: prio[0] ? `Fokus perbaikan pada <b>${esc(prio[0].label)}</b>${prio[1] ? ` dan <b>${esc(prio[1].label)}</b>` : ''}.` : '' }),
      });

      // Slide 3: analisis khusus (hanya divisi yang punya pertanyaan tambahan)
      const ex = extrasData(r);
      if (ex.length) {
        const cells = [];
        let used = 0;
        ex.forEach((x) => {
          const span = x.type === 'nps' || x.type === 'gates' ? 2 : 1;
          used += span;
          if (x.type === 'gates') cells.push({ span, title: x.title, sub: '% responden yang pernah berinteraksi.', body: `<div class="dk-radials wrap">${x.vals.map((v, i) => radial(v.p, PAL[i % PAL.length], esc(v.label), 74)).join('')}</div>` });
          else if (x.type === 'yesno') cells.push({ span, title: x.title, body: `<div class="dk-radials">${radial(x.p, r.color, `Menjawab Ya · n=${x.n}`, 96)}</div>${x.prev != null && x.p != null ? `<p class="dk-mini c">${CFG.prevYear}: ${pct(x.prev)} · <span class="dk-gap ${x.p >= x.prev ? 'up' : 'down'}">${x.p >= x.prev ? '▲' : '▼'}${Math.abs(Math.round((x.p - x.prev) * 100))} poin</span></p>` : ''}` });
          else if (x.type === 'likert') cells.push({ span, title: x.title, body: `<div class="dk-radials">${radial(x.p, r.color, 'Penting + sangat penting', 96)}</div><p class="dk-mini c">Skor rata-rata <b>${f2(x.mean)}</b></p>` });
          else if (x.type === 'nps') cells.push({ span, title: x.title, sub: `Skala 0–10 · n=${x.n} · rata-rata ${f2(x.mean)}`,
            body: `<div class="dk-nps"><div class="score"><b>${x.nps == null ? '–' : (x.nps > 0 ? '+' : '') + x.nps}</b><span>eNPS</span></div>
              <div class="seg"><span style="width:${(x.det || 0) * 100}%;background:#dc2626">${pct(x.det)}</span><span style="width:${(x.pas || 0) * 100}%;background:#f59e0b">${pct(x.pas)}</span><span style="width:${(x.pro || 0) * 100}%;background:#16a34a">${pct(x.pro)}</span></div>
              <div class="dk-legend"><span><i style="background:#dc2626"></i>Detractor 0–6</span><span><i style="background:#f59e0b"></i>Passive 7–8</span><span><i style="background:#16a34a"></i>Promoter 9–10</span></div>
              <div class="hist">${x.bins.map((b, i) => `<span title="Skor ${i}: ${b}"><i style="height:${(b / Math.max(1, ...x.bins)) * 100}%;background:${i >= 9 ? '#16a34a' : i >= 7 ? '#f59e0b' : '#dc2626'}"></i><em>${i}</em></span>`).join('')}</div></div>` });
          else if (x.type === 'rank') cells.push({ span, title: x.title, sub: 'Skor peringkat (rank 1 = 5 poin).', body: rankCards(x.list, 'poin') + bars(x.list.slice(3).map(([nm, v]) => ({ label: nm, value: v, display: `${v}` })), { cls: 'compact', max: x.list[0] ? x.list[0][1] : 1 }) });
          else if (x.type === 'cat') cells.push({ span, title: x.title, body: bars(x.list.map(([nm, v], i) => ({ label: nm, value: v, display: `${v}`, color: PAL[i % PAL.length] })), { cls: 'compact' }) });
        });
        // Sisa sel diisi profil responden.
        const cnt = (fn) => { const c = {}; r.resp.forEach((y) => { const k = fn(y); c[k] = (c[k] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]); };
        const prof = [['Area kerja', cnt((y) => (y.area === 'Others' ? 'Others · ' + y.locRaw : y.area))], ['Jabatan responden', cnt((y) => y.jab)], ['Divisi responden', cnt((y) => y.div)]];
        prof.forEach(([t, l]) => { if (used < 8) { used++; cells.push({ span: 1, title: t, body: bars(l.slice(0, 7).map(([nm, v], i) => ({ label: nm, value: v, display: `${v}`, color: PAL[i % PAL.length], right: `<em>${pct(share(v, r.resp.length))}</em>` })), { cls: 'compact' }) }); } });
        // Panel terakhir diperlebar agar baris kedua terisi penuh.
        if (used > 4 && used < 8) cells[cells.length - 1].span += 8 - used;
        const first = ex[0];
        const sub = first.type === 'nps' ? `eNPS <b>${first.nps > 0 ? '+' : ''}${first.nps}</b>: ${pct(first.pro)} promoter, ${pct(first.det)} detractor.`
          : first.type === 'yesno' ? `<b>${pct(first.p)}</b> responden menjawab Ya${first.prev != null ? ` (${CFG.prevYear}: ${pct(first.prev)})` : ''}.`
          : first.type === 'gates' ? (() => { const s = first.vals.slice().sort((a, b) => (b.p || 0) - (a.p || 0)); return `Interaksi tertinggi dengan <b>${esc(s[0].label)}</b> (${pct(s[0].p)}), terendah <b>${esc(s[s.length - 1].label)}</b> (${pct(s[s.length - 1].p)}).`; })() : '';
        const rankX = ex.find((x) => x.type === 'rank');
        slides.push({ route: d.id, eyebrow, title: 'Analisis khusus & profil responden',
          subtitle: sub + (rankX && rankX.list[0] ? ` Event paling diminati <b>${esc(rankX.list[0][0])}</b>.` : ''), n: an.n,
          html: () => `<div class="dk-auto">${cells.map((c) => panel({ col: `span ${c.span}`, title: c.title, sub: c.sub, body: c.body, color: r.color })).join('')}</div>` });
      }
    });
    return slides;
  }

  /* ───────── render & navigasi ───────── */
  function routeOf(s) { return s ? s.route : 'ringkasan'; }
  const NAMES = Object.assign({ ringkasan: 'Ringkasan' }, Object.fromEntries(CFG.DIVISIONS.map((d) => [d.id, d.name])));

  function fitStage() {
    const bar = document.querySelector('.present-bar');
    const availH = window.innerHeight - (bar ? bar.offsetHeight + 16 : 0);
    const s = Math.min((window.innerWidth - 24) / SLIDE_W, (availH - 16) / SLIDE_H);
    frame.style.transform = `translate(-50%, -50%) scale(${s.toFixed(4)})`;
    frame.style.top = `${(availH / 2).toFixed(0)}px`;
  }

  function renderSlide() {
    st.charts.forEach((c) => c.dispose());
    st.charts = [];
    const s = st.slides[st.idx];
    if (!s) return;
    const r = routeOf(s);
    $id('sEyebrow').textContent = s.eyebrow;
    $id('sTitle').textContent = s.title;
    $id('sSubtitle').innerHTML = s.subtitle;
    $id('sTabs').innerHTML = ['ringkasan'].concat(CFG.DIVISIONS.map((d) => d.id)).map((id) => {
      const a = document.querySelector(`#tabs a[data-id="${id}"]`);
      return `<button type="button" class="s-tab ${id === r ? 'active' : ''}" data-go="${id}" style="${a ? a.getAttribute('style') : ''}"><span class="dot"></span>${esc(NAMES[id])}</button>`;
    }).join('');
    const body = $id('slideBody');
    body.innerHTML = `<div class="dk-grid">${s.html()}</div>`;
    $id('sPage').textContent = `${st.idx + 1} / ${st.slides.length}`;
    $id('pCount').innerHTML = `<b>${st.idx + 1}</b> / ${st.slides.length}`;
    $id('pSel').value = String(st.idx);
    $id('pPrev').disabled = st.idx === 0;
    $id('pNext').disabled = st.idx === st.slides.length - 1;
    const fa = $id('fArea').value, fd = $id('fDiv').value;
    $id('pScope').textContent = `${[fa, fd].filter(Boolean).join(' · ') || 'Semua responden'} · n = ${s.n}`;
    $id('sFilters').innerHTML = [fa && ['fArea', `Area: ${fa}`], fd && ['fDiv', `Divisi: ${fd}`]].filter(Boolean)
      .map(([id, t]) => `<button type="button" class="fchip" data-pclear="${id}" title="Hapus filter">${esc(t)} ✕</button>`).join('');
    fitStage();
    if (s.after) requestAnimationFrame(() => { try { s.after(); } catch (e) { console.warn('Grafik slide gagal:', e.message); } });
  }

  function rebuild(keepKey) {
    st.slides = build();
    $id('pSel').innerHTML = Object.entries(NAMES).map(([id, nm]) => {
      const opts = st.slides.map((s, i) => [s, i]).filter(([s]) => s.route === id);
      return opts.length ? `<optgroup label="${esc(nm)}">${opts.map(([s, i]) => `<option value="${i}">${i + 1}. ${esc(s.title)}</option>`).join('')}</optgroup>` : '';
    }).join('');
    if (keepKey) {
      const k = st.slides.findIndex((s) => s.route + s.title === keepKey);
      if (k >= 0) st.idx = k;
    }
    st.idx = Math.max(0, Math.min(st.idx, st.slides.length - 1));
    renderSlide();
  }

  function go(i) { if (i >= 0 && i < st.slides.length) { st.idx = i; renderSlide(); } }
  function jumpRoute(delta) {
    const routes = [...new Set(st.slides.map((s) => s.route))];
    const pos = routes.indexOf(routeOf(st.slides[st.idx])) + delta;
    if (pos >= 0 && pos < routes.length) go(st.slides.findIndex((s) => s.route === routes[pos]));
  }

  function enter() {
    st.on = true;
    const route = (location.hash.replace(/^#\/?/, '') || 'ringkasan').split(/[/?]/)[0];
    document.body.classList.add('presenting');
    stage.hidden = false;
    syncFilters();
    rebuild();
    const start = st.slides.findIndex((s) => s.route === route);
    go(start >= 0 ? start : 0);
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {});
  }

  function exit() {
    st.on = false;
    st.charts.forEach((c) => c.dispose());
    st.charts = [];
    const r = routeOf(st.slides[st.idx]);
    document.body.classList.remove('presenting');
    stage.hidden = true;
    $id('pFilterPop').hidden = true;
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    if (location.hash.replace('#', '') !== r) location.hash = '#' + r;
    setTimeout(() => document.dispatchEvent(new CustomEvent('survey:resize-charts')), 60);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  }

  function syncFilters() {
    [['pArea', 'fArea'], ['pDiv', 'fDiv']].forEach(([p, f]) => { $id(p).innerHTML = $id(f).innerHTML; $id(p).value = $id(f).value; });
  }
  function applyFilter(mainId, value) {
    const fs = $id(mainId);
    fs.value = value;
    fs.dispatchEvent(new Event('change'));
  }

  // Dashboard selesai digambar ulang (filter berubah / data di-refresh) → slide dihitung ulang.
  document.addEventListener('survey:rendered', () => {
    if (!st.on) return;
    const s = st.slides[st.idx];
    syncFilters();
    rebuild(s ? s.route + s.title : null);
  });

  document.addEventListener('keydown', (e) => {
    if (!st.on || e.target.closest('input, select, textarea')) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { e.preventDefault(); go(st.idx + 1); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); go(st.idx - 1); }
    else if (k === 'ArrowDown') { e.preventDefault(); jumpRoute(1); }
    else if (k === 'ArrowUp') { e.preventDefault(); jumpRoute(-1); }
    else if (k === 'Home') go(0);
    else if (k === 'End') go(st.slides.length - 1);
    else if (k === 'f' || k === 'F') toggleFullscreen();
    else if (k === 'Escape') { if (!$id('pFilterPop').hidden) $id('pFilterPop').hidden = true; else exit(); }
  });

  let touchX = null;
  document.addEventListener('touchstart', (e) => { if (st.on) touchX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!st.on || touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 60) go(st.idx + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  window.addEventListener('resize', () => { if (st.on) fitStage(); });

  $id('btnPresent').addEventListener('click', enter);
  $id('pExit').addEventListener('click', exit);
  $id('pPrev').addEventListener('click', () => go(st.idx - 1));
  $id('pNext').addEventListener('click', () => go(st.idx + 1));
  $id('pFull').addEventListener('click', toggleFullscreen);
  $id('pSel').addEventListener('change', (e) => go(Number(e.target.value)));
  $id('pFilterBtn').addEventListener('click', () => { const p = $id('pFilterPop'); p.hidden = !p.hidden; });
  $id('pArea').addEventListener('change', (e) => applyFilter('fArea', e.target.value));
  $id('pDiv').addEventListener('change', (e) => applyFilter('fDiv', e.target.value));
  $id('pReset').addEventListener('click', () => { applyFilter('fArea', ''); applyFilter('fDiv', ''); });
  $id('sFilters').addEventListener('click', (e) => { const b = e.target.closest('[data-pclear]'); if (b) applyFilter(b.dataset.pclear, ''); });
  $id('sTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(st.slides.findIndex((s) => s.route === b.dataset.go)); });
})();
