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
- **Filter dinamis & interaktif** – area kerja dan divisi responden; klik area/divisi pada heatmap, sunburst, atau grafik profil untuk memfilter, chip filter aktif bisa dihapus dengan sekali klik (berlaku untuk semua angka & grafik).
- **Data live** dari Google Sheets (refresh otomatis tiap 5 menit), dengan cadangan snapshot lokal. Tombol cetak/PDF.

## Mode presentasi

Klik **▶ Presentasi** di header. Presentasi berbentuk deck laporan **16:9 berukuran 1280×720** (sama dengan PowerPoint widescreen):
setiap slide disusun dari panel ringkas dalam grid 4 kolom (daftar berperingkat dengan bar, kartu #1–#3, radial progress,
kutipan, kotak INSIGHT), sehingga total hanya ±17 slide:

| Bagian | Slide |
|---|---|
| Ringkasan | 1. Index per divisi + perubahan 2025→2026 + index per area · 2. Peringkat, respons harian, indikator tertinggi & terendah |
| Setiap divisi | 1. Index, tren per area & skor semua indikator · 2. Komposisi jawaban, prioritas perbaikan, tema kritik & saran, kutipan karyawan |
| Divisi dengan pertanyaan khusus (Helpdesk, HCGS, CORPSEC) | 3. Analisis khusus (eNPS, preferensi event, interaksi unit, dll.) & profil responden |

Judul, subjudul, dan insight dihitung dari data terkini dan mengikuti filter. Bar bawah: ◀ nomor slide ▶, pilihan slide,
jumlah responden, **Filter** (area & divisi responden), **Layar penuh**, **Keluar**. Tab divisi di setiap slide bisa diklik untuk lompat.

| Tombol | Fungsi |
|---|---|
| → / Spasi | slide berikutnya |
| ← | slide sebelumnya |
| ↓ / ↑ | lompat ke divisi berikutnya / sebelumnya |
| F | layar penuh |
| Esc | keluar |

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
