/*
 * Mode presentasi: setiap bagian halaman tampil sebagai satu slide layar penuh.
 * Navigasi: → / Spasi / PageDown = berikutnya, ← / PageUp = sebelumnya, Home/End, F = layar penuh, Esc = keluar.
 * Setelah slide terakhir sebuah halaman, presentasi lanjut ke divisi berikutnya.
 */
(function () {
  const CFG = window.SURVEY_CONFIG;
  const ROUTES = ['ringkasan'].concat(CFG.DIVISIONS.map((d) => d.id));
  const NAMES = Object.assign({ ringkasan: 'Ringkasan' }, Object.fromEntries(CFG.DIVISIONS.map((d) => [d.id, d.name])));
  const app = document.getElementById('app');
  const st = { on: false, idx: 0, route: null, toEnd: false, list: [] };

  const currentRoute = () => {
    const r = (location.hash.replace(/^#\/?/, '') || 'ringkasan').split(/[/?]/)[0];
    return ROUTES.includes(r) ? r : 'ringkasan';
  };

  // Bagian berisi banyak kartu (mis. analisis tambahan) dipecah per dua kartu agar tetap terbaca.
  function buildSlides() {
    const list = [];
    Array.from(app.children).forEach((el) => {
      if (el.classList.contains('alert')) return;
      if (el.classList.contains('extras') && el.children.length > 2) {
        const kids = Array.from(el.children);
        for (let i = 0; i < kids.length; i += 2) list.push({ el, kids: kids.slice(i, i + 2) });
      } else list.push({ el, kids: null });
    });
    return list;
  }

  function clearHidden() {
    app.querySelectorAll('.slide-hidden').forEach((x) => x.classList.remove('slide-hidden'));
    Array.from(app.children).forEach((x) => { x.style.transform = ''; });
  }

  // Skala slide agar memenuhi layar: diperkecil bila terlalu tinggi, diperbesar (maks 1.6×) bila isinya sedikit, lalu ditengahkan.
  function fit(el) {
    el.style.transform = '';
    const bar = document.querySelector('.present-bar');
    const availH = window.innerHeight - (bar ? bar.offsetHeight : 0) - 64;
    const availW = window.innerWidth - 48;
    const h = Math.max(1, el.scrollHeight), w = Math.max(1, el.offsetWidth);
    const s = Math.min(availH / h, availW / w, 1.6);
    const dy = Math.max(0, (availH - h * s) / 2);
    el.style.transform = `translateY(${dy.toFixed(0)}px) scale(${s.toFixed(3)})`;
  }

  function show() {
    st.list = buildSlides();
    if (!st.list.length) return;
    st.idx = Math.max(0, Math.min(st.idx, st.list.length - 1));
    clearHidden();
    Array.from(app.children).forEach((x) => x.classList.add('slide-hidden'));
    const s = st.list[st.idx];
    s.el.classList.remove('slide-hidden');
    if (s.kids) Array.from(s.el.children).forEach((k) => k.classList.toggle('slide-hidden', !s.kids.includes(k)));
    window.scrollTo({ top: 0 });
    // Grafik menyesuaikan ukuran setelah bagian ditampilkan, baru kemudian diskalakan agar muat satu layar.
    window.dispatchEvent(new Event('resize'));
    setTimeout(() => fit(s.el), 180);
    updateBar();
  }

  function updateBar() {
    const r = currentRoute();
    const pos = ROUTES.indexOf(r);
    document.getElementById('pTitle').textContent = NAMES[r] || '';
    document.getElementById('pCount').textContent = `${st.idx + 1} / ${st.list.length}`;
    document.getElementById('pPrev').disabled = pos === 0 && st.idx === 0;
    document.getElementById('pNext').disabled = pos === ROUTES.length - 1 && st.idx === st.list.length - 1;
    document.getElementById('pProgress').style.width = `${((pos + (st.idx + 1) / st.list.length) / ROUTES.length) * 100}%`;
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

  function jumpRoute(delta) {
    const pos = ROUTES.indexOf(currentRoute()) + delta;
    if (pos < 0 || pos >= ROUTES.length) return;
    st.toEnd = false;
    location.hash = '#' + ROUTES[pos];
  }

  function enter() {
    st.on = true;
    st.idx = 0;
    st.route = currentRoute();
    document.body.classList.add('presenting');
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {});
    show();
  }

  function exit() {
    st.on = false;
    document.body.classList.remove('presenting');
    clearHidden();
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    window.dispatchEvent(new Event('resize'));
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
    clearTimeout(rt);
    rt = setTimeout(() => { const s = st.list[st.idx]; if (s) fit(s.el); }, 220);
  });

  document.getElementById('btnPresent').addEventListener('click', enter);
  document.getElementById('pExit').addEventListener('click', exit);
  document.getElementById('pPrev').addEventListener('click', () => go(-1));
  document.getElementById('pNext').addEventListener('click', () => go(1));
  document.getElementById('pFull').addEventListener('click', toggleFullscreen);
})();
