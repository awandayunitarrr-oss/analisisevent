# Dashboard Survey Layanan Internal 2026

Website interaktif untuk analisis **Survey Pengukuran Kepuasan Layanan Divisi 2026** (IT, Helpdesk, SIMO, HCGS, CORPSEC, Purchasing).
Struktur analisis mengikuti *Report Survey Pelayanan Divisi 2025*: outline survey, index per indikator (total & per area Simpang Dukuh / Sedati / Others),
gap vs 2025, sub-kategori, tren index per area, kritik & saran, serta prioritas perbaikan.

## Fitur

- **Ringkasan lintas divisi** – index 2024/2025/2026 + gap + kategori, index per area, progres respons harian, 5 indikator tertinggi/terendah.
- **Halaman per divisi** – KPI, temuan utama otomatis, outline survey (n 2021–2026), tabel index ala report 2025 (bisa diurutkan),
  tren index per area, radar sub-kategori, dumbbell 2025→2026, distribusi jawaban, heatmap area, matriks prioritas.
- **Analisis khusus** – eNPS, preferensi event (ranking), mentoring/coaching (HCGS); kesesuaian kategori prioritas (Helpdesk);
  tingkat interaksi per unit (CORPSEC).
- **Kritik & saran** – word cloud, treemap tema otomatis, penyaringan jawaban kosong, pencarian.
- **Grafik** – ECharts: gauge, dumbbell, bump chart, streamgraph, heatmap, sunburst, radar, waffle, rose, lollipop, treemap.
- **Filter dinamis** – area kerja dan divisi responden (berlaku untuk semua angka & grafik).
- **Data live** dari Google Sheets (refresh otomatis tiap 5 menit), dengan cadangan snapshot lokal. Tombol cetak/PDF.

## Mode presentasi

Klik **▶ Presentasi** di header. Setiap bagian halaman tampil sebagai satu slide layar penuh, berurutan dari Ringkasan lalu tiap divisi.

| Tombol | Fungsi |
|---|---|
| → / Spasi / PageDown | slide berikutnya (lanjut ke divisi berikutnya setelah slide terakhir) |
| ← / PageUp | slide sebelumnya |
| ↓ / ↑ | lompat ke divisi berikutnya / sebelumnya |
| Home / End | slide pertama / terakhir divisi ini |
| F | layar penuh |
| Esc | keluar |

Di ponsel/tablet: geser kiri/kanan. Filter area & divisi yang aktif tetap berlaku selama presentasi.

## Sumber data

Data dibaca langsung dari spreadsheet *Monitoring Survey Layanan 2026* (ID di `assets/js/config.js` → `SOURCE.spreadsheetId`).
Agar browser bisa membaca data live, spreadsheet harus dibagikan **“Siapa saja yang memiliki link – Viewer”**
(atau isi `SOURCE.publishedXlsxUrl` dengan link *File → Bagikan → Publikasikan ke web* format `.xlsx`).
Jika gagal, dashboard otomatis memakai `data/snapshot.js` (label kuning “Snapshot” di pojok kanan atas).

Memperbarui snapshot (nama responden, GPS & link dibuang):

```bash
python tools/build_snapshot.py "Monitoring Survey Layanan 2026.xlsx"
```

## Menjalankan & deploy

Website statis tanpa build: buka `index.html` di browser.

**Vercel** (disarankan): di [vercel.com/new](https://vercel.com/new) pilih *Import Git Repository* → repo ini →
Framework Preset **Other**, Build Command & Output Directory dikosongkan → **Deploy**.
Setiap push ke `main` otomatis ter-deploy ulang. Pengaturan cache ada di `vercel.json`.

**GitHub Pages**: Settings → Pages → Deploy from branch → `main` / `(root)`.

## Menyesuaikan

Semua indikator, pengelompokan sub-kategori, angka pembanding 2023–2025, dan kata kunci tema kritik & saran ada di
`assets/js/config.js`. Kolom spreadsheet dicocokkan berdasarkan awalan judul pertanyaan, sehingga urutan kolom boleh berubah.

Perhitungan: Sangat puas = 5, Puas = 4, Antara iya dan tidak = 3, Tidak puas = 2, Sangat tidak puas = 1; “Tidak pernah” tidak dihitung.
Index = rata-rata skor indikator (pertanyaan kepuasan keseluruhan ditampilkan terpisah, tidak masuk index).
Kategori: < 1.8 Tidak puas · 1.8–2.6 Kurang puas · 2.6–3.4 Antara · 3.4–4.2 Puas · > 4.2 Sangat puas.
