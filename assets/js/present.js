/*
 * Mode presentasi: setiap bagian halaman tampil sebagai slide 16:9 berukuran tetap 1280×720
 * (sama dengan PowerPoint widescreen 13,33" × 7,5"), lalu seluruh slide diskalakan pas ke layar.
 * Setiap slide berisi: logo + tab divisi (bisa diklik) + filter aktif, judul, insight, isi, dan footer.
 * Navigasi: → / Spasi / PageDown = berikutnya, ← / PageUp = sebelumnya, ↓ / ↑ = divisi berikutnya/sebelumnya,
 * Home/End, F = layar penuh, Esc = keluar.
 */
(function () {
  const CFG = window.SURVEY_CONFIG;
  const SLIDE_W = 1280, SLIDE_H = 720;
  const ROUTES = ['ringkasan'].concat(CFG.DIVISIONS.map((d) => d.id));
  const NAMES = Object.assign({ ringkasan: 'Ringkasan' }, Object.fromEntries(CFG.DIVISIONS.map((d) => [d.id, d.name])));
  const app = document.getElementById('app');
  const appHome = { parent: app.parentNode, next: app.nextSibling };
  const stage = document.getElementById('slideStage');
  const frame = document.getElementById('slideFrame');
  const body = document.getElementById('slideBody');
  const st = { on: false, idx: 0, route: null, toEnd: false, list: [] };
  const $id = (id) => document.getElementById(id);

  const currentRoute = () => {
    const r = (location.hash.replace(/^#\/?/, '') || 'ringkasan').split(/[/?]/)[0];
    return ROUTES.includes(r) ? r : 'ringkasan';
  };

  // Susunan slide: beberapa bagian digabung dalam satu slide agar ruang terpakai maksimal dan jumlah slide sedikit.
  const PLAN = {
    ringkasan: [['ov-band', 'ov-cards'], ['ov-change', 'ov-area'], ['ov-river', 'ov-rank'], ['ov-insight', 'ov-table']],
    divisi: [['dv-band', 'dv-insight'], ['dv-trend', 'dv-prio'], ['dv-items'], ['dv-extras'], ['dv-comments', 'dv-profile'], ['dv-table']],
  };
  const EXTRAS_PER_SLIDE = 4;

  function buildSlides() {
    const plan = PLAN[currentRoute() === 'ringkasan' ? 'ringkasan' : 'divisi'];
    const byKey = (k) => app.querySelector(`:scope > [data-s="${k}"]`);
    const list = [];
    const used = new Set();
    plan.forEach((keys) => {
      const els = keys.map(byKey).filter(Boolean);
      els.forEach((e) => used.add(e));
      if (!els.length) return;
      if (els.length === 1 && els[0].classList.contains('extras') && els[0].children.length > EXTRAS_PER_SLIDE) {
        const kids = Array.from(els[0].children);
        for (let i = 0; i < kids.length; i += EXTRAS_PER_SLIDE) list.push({ els, kids: kids.slice(i, i + EXTRAS_PER_SLIDE) });
      } else list.push({ els, kids: null });
    });
    // Bagian yang tidak ada di rencana tetap tampil sebagai slide sendiri.
    Array.from(app.children).forEach((el) => { if (!used.has(el) && !el.classList.contains('alert')) list.push({ els: [el], kids: null }); });
    return list;
  }

  function clearHidden() {
    app.querySelectorAll('.slide-hidden').forEach((x) => x.classList.remove('slide-hidden'));
    app.style.transform = '';
    app.style.width = '';
  }

  // Slide 1280×720 diskalakan utuh agar pas di layar (letterbox), seperti tampilan slideshow PowerPoint.
  function fitStage() {
    const s = Math.min(window.innerWidth / SLIDE_W, window.innerHeight / SLIDE_H);
    frame.style.transform = `translate(-50%, -50%) scale(${s.toFixed(4)})`;
  }

  // Isi slide memenuhi area konten: bila terlalu tinggi, lebar tata letak diperlebar dulu (grafik ikut melebar)
  // supaya setelah diperkecil tetap memenuhi lebar slide; bila isinya sedikit, diperbesar (maks 1.4×) dan ditengahkan.
  let fitToken = 0;
  function fitContent() {
    const token = ++fitToken;
    const cs = getComputedStyle(body);
    const availH = body.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 6;
    const availW = body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    app.style.transform = '';
    app.style.width = availW + 'px';
    const s0 = availH / Math.max(1, app.scrollHeight);
    const place = () => {
      if (token !== fitToken) return;
      const h = Math.max(1, app.scrollHeight), w = Math.max(1, app.offsetWidth);
      const s = Math.min(availH / h, availW / w, 1.4);
      const dx = (availW - w * s) / 2, dy = Math.max(0, (availH - h * s) / 2);
      app.style.transform = `translate(${dx.toFixed(0)}px, ${dy.toFixed(0)}px) scale(${s.toFixed(3)})`;
    };
    if (s0 < 1) {
      app.style.width = Math.min(availW / s0, availW * 1.9).toFixed(0) + 'px';
      document.dispatchEvent(new CustomEvent('survey:resize-charts'));
      setTimeout(place, 120);
    } else place();
  }

  function show() {
    st.list = buildSlides();
    if (!st.list.length) return;
    st.idx = Math.max(0, Math.min(st.idx, st.list.length - 1));
    clearHidden();
    Array.from(app.children).forEach((x) => x.classList.add('slide-hidden'));
    const s = st.list[st.idx];
    s.els.forEach((el) => el.classList.remove('slide-hidden'));
    if (s.kids) Array.from(s.els[0].children).forEach((k) => k.classList.toggle('slide-hidden', !s.kids.includes(k)));
    compactItems();
    updateHead(s);
    updateFoot();
    fitStage();
    // Grafik menyesuaikan lebar area slide dulu, baru isi diskalakan.
    document.dispatchEvent(new CustomEvent('survey:resize-charts'));
    setTimeout(fitContent, 160);
  }

  // Grafik skor per indikator: label dipotong satu baris agar banyak indikator muat di tinggi slide.
  function compactItems() {
    const el = document.getElementById('cItems');
    const inst = el && window.echarts && echarts.getInstanceByDom(el);
    if (!inst || el.closest('.slide-hidden')) return;
    const y = (inst.getOption().yAxis || [])[0];
    if (y && y.type === 'category') inst.setOption({ yAxis: { axisLabel: { overflow: 'truncate', width: 300, lineHeight: 12, fontSize: 11 } } });
  }

  // Tab divisi di setiap slide: sama dengan tab navigasi dashboard, klik untuk lompat ke divisi itu.
  function renderTabs() {
    const r = currentRoute();
    $id('sTabs').innerHTML = Array.from(document.querySelectorAll('#tabs a')).map((a) =>
      `<button type="button" class="s-tab ${a.dataset.id === r ? 'active' : ''}" data-go="${a.dataset.id}" style="${a.getAttribute('style') || ''}"><span class="dot"></span>${a.textContent}</button>`).join('');
  }

  // Judul & insight diambil dari data-title / data-insight yang diisi dashboard dari data terkini.
  function updateHead(s) {
    let title = s.els.map((e) => e.dataset.title).filter(Boolean).join(' · ');
    let insight = s.els.map((e) => e.dataset.insight).filter(Boolean).join(' ');
    if (s.kids) {
      const parts = st.list.filter((x) => x.kids && x.els[0] === s.els[0]);
      if (parts.length > 1) title += ` (${parts.indexOf(s) + 1}/${parts.length})`;
      insight = s.kids.map((k) => k.dataset.insight || '').filter(Boolean).join(' ');
    }
    renderTabs();
    $id('sTitle').textContent = title;
    const ins = $id('sInsight');
    ins.innerHTML = insight ? '<span class="bulb" aria-hidden="true">💡</span>' + insight : '';
    ins.hidden = !insight;
    const fa = $id('fArea').value, fd = $id('fDiv').value;
    $id('sFilters').innerHTML = [fa && ['fArea', `Area: <b>${fa}</b>`], fd && ['fDiv', `Divisi: <b>${fd}</b>`]].filter(Boolean)
      .map(([id, t]) => `<button type="button" class="fchip" data-pclear="${id}" title="Hapus filter">${t} ✕</button>`).join('');
  }

  function updateFoot() {
    const r = currentRoute();
    const pos = ROUTES.indexOf(r);
    $id('sPage').textContent = `${NAMES[r]} · ${st.idx + 1} / ${st.list.length}`;
    $id('pCount').textContent = `${st.idx + 1} / ${st.list.length}`;
    $id('pTitle').textContent = NAMES[r] || '';
    $id('pPrev').disabled = pos === 0 && st.idx === 0;
    $id('pNext').disabled = pos === ROUTES.length - 1 && st.idx === st.list.length - 1;
    $id('sProgress').style.width = `${((pos + (st.idx + 1) / st.list.length) / ROUTES.length) * 100}%`;
  }

  // Filter di bar presentasi & chip slide meneruskan pilihan ke filter utama dashboard.
  function syncFilters() {
    [['pArea', 'fArea'], ['pDiv', 'fDiv']].forEach(([p, f]) => {
      const ps = $id(p), fs = $id(f);
      ps.innerHTML = fs.innerHTML;
      ps.value = fs.value;
    });
  }
  function applyFilter(mainId, value) {
    const fs = $id(mainId);
    fs.value = value;
    fs.dispatchEvent(new Event('change'));
  }

  function go(delta) {
    if (!st.on) return;
    const next = st.idx + delta;
    if (next >= 0 && next < st.list.length) { st.idx = next; show(); return; }
    const pos = ROUTES.indexOf(currentRoute()) + (delta > 0 ? 1 : -1);
    if (pos < 0 || pos >= ROUTES.length) return;
    st.toEnd = delta < 0;
    location.hash = '#' + ROUTES[pos];
  }
  function goRoute(id) {
    st.toEnd = false;
    if (id === currentRoute()) { st.idx = 0; show(); } else location.hash = '#' + id;
  }
  function jumpRoute(delta) {
    const pos = ROUTES.indexOf(currentRoute()) + delta;
    if (pos >= 0 && pos < ROUTES.length) goRoute(ROUTES[pos]);
  }

  function enter() {
    st.on = true;
    st.idx = 0;
    st.route = currentRoute();
    body.appendChild(app);
    document.body.classList.add('presenting');
    stage.hidden = false;
    syncFilters();
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {});
    show();
  }

  function exit() {
    st.on = false;
    clearHidden();
    appHome.parent.insertBefore(app, appHome.next);
    document.body.classList.remove('presenting');
    stage.hidden = true;
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    // Gambar ulang dashboard agar grafik kembali ke ukuran & label normal.
    $id('fArea').dispatchEvent(new Event('change'));
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  }

  // Dipanggil setiap kali dashboard selesai digambar ulang (ganti halaman, filter, atau refresh data).
  document.addEventListener('survey:rendered', () => {
    if (!st.on) return;
    const r = currentRoute();
    if (r !== st.route) { st.idx = st.toEnd ? 1e9 : 0; st.route = r; }
    st.toEnd = false;
    syncFilters();
    show();
  });

  document.addEventListener('keydown', (e) => {
    if (!st.on || e.target.closest('input, select, textarea')) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { e.preventDefault(); go(1); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); go(-1); }
    else if (k === 'ArrowDown') { e.preventDefault(); jumpRoute(1); }
    else if (k === 'ArrowUp') { e.preventDefault(); jumpRoute(-1); }
    else if (k === 'Home') { st.idx = 0; show(); }
    else if (k === 'End') { st.idx = st.list.length - 1; show(); }
    else if (k === 'f' || k === 'F') toggleFullscreen();
    else if (k === 'Escape') exit();
  });

  let touchX = null;
  document.addEventListener('touchstart', (e) => { if (st.on) touchX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!st.on || touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
    touchX = null;
  });

  let rt = null;
  window.addEventListener('resize', () => {
    if (!st.on) return;
    fitStage();
    clearTimeout(rt);
    rt = setTimeout(() => { if (st.list[st.idx]) { document.dispatchEvent(new CustomEvent('survey:resize-charts')); setTimeout(fitContent, 120); } }, 220);
  });

  $id('btnPresent').addEventListener('click', enter);
  $id('pExit').addEventListener('click', exit);
  $id('pPrev').addEventListener('click', () => go(-1));
  $id('pNext').addEventListener('click', () => go(1));
  $id('pFull').addEventListener('click', toggleFullscreen);
  $id('pArea').addEventListener('change', (e) => applyFilter('fArea', e.target.value));
  $id('pDiv').addEventListener('change', (e) => applyFilter('fDiv', e.target.value));
  $id('sFilters').addEventListener('click', (e) => { const b = e.target.closest('[data-pclear]'); if (b) applyFilter(b.dataset.pclear, ''); });
  $id('sTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) goRoute(b.dataset.go); });
})();
