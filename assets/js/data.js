/* Pemuatan data: Google Sheets (live) → snapshot lokal. */
(function () {
  const CFG = window.SURVEY_CONFIG;
  const TIMEOUT_MS = 15000;

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
    ]);
  }

  function cleanRows(rows) {
    const out = rows.map((r) => r.map((v) => (v == null ? '' : String(v).trim())));
    return out.length ? [out[0]].concat(out.slice(1).filter((r) => r.some((v) => v !== ''))) : [];
  }

  function workbookToSheets(wb) {
    const sheets = {};
    wb.SheetNames.forEach((name) => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' });
      sheets[name] = cleanRows(rows);
    });
    return sheets;
  }

  async function fetchXlsx(url) {
    const res = await withTimeout(fetch(url, { cache: 'no-store' }), TIMEOUT_MS);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = await res.arrayBuffer();
    return workbookToSheets(XLSX.read(buf, { type: 'array', cellDates: false }));
  }

  async function fetchGvizCsv(id, sheet) {
    const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(sheet)}`;
    const res = await withTimeout(fetch(url, { cache: 'no-store' }), TIMEOUT_MS);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    if (/^\s*<(!doctype|html)/i.test(text)) throw new Error('Sheet tidak publik');
    return cleanRows(Papa.parse(text, { skipEmptyLines: true }).data);
  }

  async function loadLive() {
    const src = CFG.SOURCE;
    const errors = [];
    if (src.publishedXlsxUrl) {
      try { return { sheets: await fetchXlsx(src.publishedXlsxUrl), source: 'Google Sheets (publish to web)' }; }
      catch (e) { errors.push('publish: ' + e.message); }
    }
    try {
      const sheets = await fetchXlsx(`https://docs.google.com/spreadsheets/d/${src.spreadsheetId}/export?format=xlsx`);
      return { sheets, source: 'Google Sheets (live)' };
    } catch (e) { errors.push('export: ' + e.message); }
    try {
      const names = CFG.DIVISIONS.map((d) => d.sheet);
      const results = await Promise.all(names.map((n) => fetchGvizCsv(src.spreadsheetId, n)));
      const sheets = {};
      names.forEach((n, i) => { sheets[n] = results[i]; });
      return { sheets, source: 'Google Sheets (live)' };
    } catch (e) { errors.push('gviz: ' + e.message); }
    throw new Error(errors.join(' | '));
  }

  function loadSnapshot() {
    const s = window.SURVEY_SNAPSHOT;
    if (!s) throw new Error('Snapshot tidak tersedia');
    return { sheets: s.sheets, source: 'Snapshot lokal', stamp: s.generatedAt };
  }

  window.SurveyData = { loadLive, loadSnapshot };
})();
