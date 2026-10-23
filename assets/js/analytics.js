/* Perhitungan index, distribusi jawaban, dan analisis teks. */
(function () {
  const CFG = window.SURVEY_CONFIG;
  const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

  const LIKERT_ORDER = ['Sangat puas', 'Puas', 'Antara iya dan tidak', 'Tidak puas', 'Sangat tidak puas'];

  function score(v) {
    const k = norm(v);
    if (!k || k === 'none' || k === 'null') return null;
    if (k in CFG.SCALE) return CFG.SCALE[k];
    const n = Number(k);
    if (!Number.isNaN(n) && n >= 1 && n <= 5) return n;
    return null;
  }

  function category(v) {
    if (v == null) return null;
    return CFG.CATEGORIES.find((c) => v < c.max) || CFG.CATEGORIES[CFG.CATEGORIES.length - 1];
  }

  function areaOf(loc) {
    const k = norm(loc);
    if (k.includes('simpang')) return 'Simpang Dukuh';
    if (k.includes('sedati')) return 'Sedati';
    return 'Others';
  }

  function titleCase(s) {
    return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  }

  function normJabatan(v) {
    const k = norm(v).replace(/\./g, '');
    if (!k || k === 'none') return '(tidak diisi)';
    if (k === 'staf' || k === 'staff' || k === 'karyawan') return 'Staff';
    if (k.startsWith('area sales deputy')) return 'Area Sales Deputy Dept. Head';
    if (k === 'dept head') return 'Dept. Head';
    return String(v).trim();
  }

  function parseDate(v) {
    const s = String(v || '').trim();
    if (!s) return null;
    let y, m, d, rest = '';
    let mm = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(.*)$/);
    if (mm) { y = +mm[1]; m = +mm[2]; d = +mm[3]; rest = mm[4]; }
    else if ((mm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(.*)$/))) { m = +mm[1]; d = +mm[2]; y = +mm[3]; rest = mm[4]; if (y < 100) y += 2000; }
    else { const t = new Date(s); return Number.isNaN(+t) ? null : t; }
    const tm = rest.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    const mk = (mo, da) => new Date(y, mo - 1, da, tm ? +tm[1] : 0, tm ? +tm[2] : 0, tm && tm[3] ? +tm[3] : 0);
    let dt = mk(m, d);
    // Spreadsheet kadang membaca tanggal 12/10 sebagai 10 Des — tukar bila jatuh di masa depan.
    if (dt > new Date(Date.now() + 864e5) && d <= 12) dt = mk(d, m);
    return dt;
  }

  /* Cari kolom: pencocokan awalan teks header, berurutan dari posisi `from`. */
  function findCol(header, h, from) {
    const key = norm(h);
    for (let i = from || 0; i < header.length; i++) if (norm(header[i]).startsWith(key)) return i;
    return -1;
  }
  function findCols(header, h, mode) {
    const key = norm(h);
    const out = [];
    header.forEach((x, i) => {
      const n = norm(x);
      if (mode === 'includes' ? n.includes(key) : n.startsWith(key)) out.push(i);
    });
    return out;
  }
  function metaCol(header, key) {
    return header.findIndex((x) => norm(x).includes(key));
  }

  /* Siapkan satu divisi dari baris sheet mentah. */
  function prepareDivision(div, rows) {
    if (!rows || !rows.length) return { div, respondents: [], items: [], missing: true };
    const header = rows[0];
    const cLoc = metaCol(header, 'lokasi kerja');
    const cDiv = metaCol(header, 'divisi lingkungan');
    const cJab = metaCol(header, 'jabatan');
    const cDate = metaCol(header, 'survey dimulai');
    const profCols = (div.profile || []).map((p) => metaCol(header, norm(p)));

    const respondents = rows.slice(1).map((r, idx) => ({
      id: idx,
      row: r,
      locRaw: cLoc >= 0 ? titleCase(String(r[cLoc] || '-')) : '-',
      area: areaOf(cLoc >= 0 ? r[cLoc] : ''),
      div: cDiv >= 0 && r[cDiv] && norm(r[cDiv]) !== 'none' ? String(r[cDiv]).trim() : '(tidak diisi)',
      jab: normJabatan(cJab >= 0 ? r[cJab] : ''),
      date: cDate >= 0 ? parseDate(r[cDate]) : null,
      profile: profCols.map((c) => (c >= 0 ? String(r[c] || '').trim() : '')),
    }));

    let pos = 0;
    const items = div.items.map((it) => {
      const col = findCol(header, it.h, pos);
      if (col >= 0) pos = col + 1;
      return Object.assign({}, it, { col });
    });
    const texts = (div.texts || []).map((t) => Object.assign({}, t, { cols: t.all ? findCols(header, t.h, 'includes') : findCols(header, t.h).slice(0, 1) }));
    const extras = (div.extras || []).map((x) => Object.assign({}, x, { cols: findCols(header, x.h) }));
    const gates = (div.gates || []).map((g) => Object.assign({}, g, { col: findCol(header, g.h, 0) }));
    return { div, header, respondents, items, texts, extras, gates };
  }

  function itemStats(item, resp) {
    const counts = {};
    let notExp = 0;
    const scores = [];
    const dist = [0, 0, 0, 0, 0];
    const byArea = { 'Simpang Dukuh': [], Sedati: [], Others: [] };
    resp.forEach((r) => {
      const raw = item.col >= 0 ? r.row[item.col] : '';
      const k = norm(raw);
      if (CFG.NOT_EXPERIENCED.includes(k)) { notExp++; return; }
      const s = score(raw);
      if (s == null) return;
      scores.push(s);
      dist[Math.round(s) - 1]++;
      byArea[r.area].push(s);
      const label = String(raw).trim();
      const lk = label[0].toUpperCase() + label.slice(1).toLowerCase();
      counts[lk] = (counts[lk] || 0) + 1;
    });
    const n = scores.length;
    return {
      n, notExp, counts, dist,
      mean: mean(scores),
      area: CFG.AREAS.map((a) => mean(byArea[a])),
      areaN: CFG.AREAS.map((a) => byArea[a].length),
      top2: n ? scores.filter((s) => s >= 4).length / n : null,
      bottom2: n ? scores.filter((s) => s <= 2).length / n : null,
    };
  }

  /* Hitung index total, per area, per sub-kategori. Index = rata-rata skor indikator. */
  function analyzeDivision(prep, resp) {
    const items = prep.items.map((it) => Object.assign({}, it, { stats: itemStats(it, resp) }));
    const idxItems = items.filter((it) => !it.overall && it.stats.n > 0);
    const agg = (list) => [mean(list.map((i) => i.stats.mean).filter((v) => v != null))]
      .concat(CFG.AREAS.map((_, a) => mean(list.map((i) => i.stats.area[a]).filter((v) => v != null))));
    const index = agg(idxItems);
    const subNames = [];
    items.forEach((it) => { if (!subNames.includes(it.sub)) subNames.push(it.sub); });
    const subs = subNames.map((name) => {
      const list = items.filter((i) => i.sub === name);
      const scored = list.filter((i) => !i.overall && i.stats.n > 0);
      const hist = (prep.div.subHistory || {})[name] || {};
      return { name, items: list, overall: list.every((i) => i.overall), value: scored.length ? agg(scored) : null, hist };
    });
    const groups = Object.entries(prep.div.groups || {}).map(([name, subList]) => {
      const scored = idxItems.filter((i) => subList.includes(i.sub));
      return { name, subs: subList, value: agg(scored), hist: (prep.div.groupHistory || {})[name] || {} };
    });
    return { items, index, subs, groups, n: resp.length, areaN: CFG.AREAS.map((a) => resp.filter((r) => r.area === a).length) };
  }

  /* ── Teks / kritik & saran ── */
  const EMPTY_RE = /^(-+|\.+|_+|0|x|none|null|n\/?a|no|nothing|tidak|tidak ada|tdk ada|tdk|gak ada|ga ada|nggak ada|belum ada|tidak ada saran|tidak ada kritik|cukup|cukup baik|sudah cukup|sudah baik|baik|puas|ok|oke|okey|aman|mantap|good|sudah|belum|sejauh ini baik|tidak ada\.?|nihil)[.!\s]*$/i;
  const STOP = new Set(('yang dan di ke dari untuk dengan agar lebih bisa dapat ada tidak sudah belum akan pada ini itu juga atau karena saat dalam kami saya kita mereka anda harus sangat semoga perlu masih sering kadang kurang mohon jika bila sebagai oleh adalah lagi apa sehingga tersebut terus setiap serta para hal secara tetap bagi tentang sama hanya baik buat jadi supaya mungkin banyak semua kalau tapi namun nya mau sih aja yg dgn utk tdk sdh blm krn dll dsb nya kak pak bu bapak ibu terima kasih tim divisi').split(' '));

  function textEntries(prep, resp) {
    const out = [];
    prep.texts.forEach((t) => {
      t.cols.forEach((c) => {
        resp.forEach((r) => {
          const v = String(r.row[c] || '').trim();
          if (!v || EMPTY_RE.test(v)) return;
          const sub = t.all ? String(prep.header[c]).replace(/\s*Mengapa.*$/i, '').trim() : '';
          out.push({ q: t.label, sub, text: v, r, themes: tagThemes(prep.div.themes || {}, v) });
        });
      });
    });
    return out;
  }

  function tagThemes(themes, text) {
    const t = ' ' + norm(text).replace(/[^\w\s-]/g, ' ') + ' ';
    const hits = Object.entries(themes).filter(([, kws]) => kws.some((k) => (k.length <= 3 ? t.includes(' ' + k + ' ') : t.includes(k)))).map(([n]) => n);
    return hits.length ? hits : ['Lainnya'];
  }

  function wordFreq(entries, top) {
    const f = {};
    entries.forEach((e) => {
      const seen = new Set();
      norm(e.text).replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).forEach((w) => {
        if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w) || seen.has(w)) return;
        seen.add(w);
        f[w] = (f[w] || 0) + 1;
      });
    });
    return Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, top || 30);
  }

  function countValues(prep, cols, resp) {
    const c = {};
    const shown = {};
    resp.forEach((r) => cols.forEach((col) => {
      const v = String(r.row[col] || '').trim().replace(/[:.]+$/, '');
      if (!v || norm(v) === 'none') return;
      const key = norm(v);
      if (!shown[key]) shown[key] = v[0].toUpperCase() + v.slice(1);
      c[key] = (c[key] || 0) + 1;
    }));
    return Object.entries(c).map(([k, n]) => [shown[k], n]).sort((a, b) => b[1] - a[1]);
  }

  window.SurveyAnalytics = {
    norm, mean, round2, score, category, parseDate, prepareDivision, analyzeDivision,
    textEntries, wordFreq, countValues, LIKERT_ORDER,
  };
})();
