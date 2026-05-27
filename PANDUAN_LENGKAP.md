# STOCK OPNAME PWA - PANDUAN LENGKAP

## DAFTAR ISI
1. Workflow Aplikasi
2. Cara Install di HP (Android & iPhone)
3. Deploy ke Production (Vercel)
4. Update & Maintenance

---

## 1. WORKFLOW APLIKASI

### ALUR KERJA HARIAN

```
MULAI SHIFT
    |
    v
[Login] --> Username bebas + Password: BLP123
    |
    v
[Pilih Tab]
    |
    +---> [PRODUCT IN] ----------------------+
    |         |                              |
    |         v                              |
    |     Cari Product (ketik SKU/nama)      |
    |         |                              |
    |         v                              |
    |     Pilih dari dropdown                |
    |     (auto-fill: Barcode, SKU,          |
    |      Product, Batch, SKU+Batch)        |
    |         |                              |
    |         v                              |
    |     Isi Qty (bisa: 10+5, 20*3)        |
    |         |                              |
    |         v                              |
    |     Pilih Tanggal (default: hari ini)  |
    |         |                              |
    |         v                              |
    |     Simpan --> masuk ke sheet          |
    |     "Product In" di Spreadsheet        |
    |                                        |
    +---> [CYCLE COUNT] ---------------------|
              |                              |
              v                              |
          Cari Product                       |
              |                              |
              v                              |
          Pilih dari dropdown                |
              |                              |
              v                              |
          Isi Qty Fisik (hasil hitung fisik) |
              |                              |
              v                              |
          Pilih Tanggal                      |
              |                              |
              v                              |
          Simpan --> masuk ke sheet          |
          "Cycle Count" di Spreadsheet       |
```

### FITUR KALKULATOR QTY
Langsung ketik ekspresi di field Qty:
- `10+5`   --> 15  (tambah)
- `20*3`   --> 60  (kali, cocok untuk box x pcs)
- `100-25` --> 75  (kurang)
- `200/4`  --> 50  (bagi)
- `12*24+6`--> 294 (kombinasi)

Tekan Tab atau klik di luar field --> otomatis dihitung.

### FITUR GANTI TANGGAL
- Klik chip tanggal (📅 5/27/2026) di pojok kanan atas
- Pilih Bulan, Tanggal, Tahun
- History otomatis reload untuk tanggal tersebut
- Berguna untuk input data hari sebelumnya

### STRUKTUR DATA SPREADSHEET

Sheet "Daftar Product" (Master):
| Barcode | SKU | Product | Batch |

Sheet "Product In":
| Row ID | Date | Barcode | SKU | Product | Batch | SKU+BATCH | Qty | Status | User |

Sheet "Cycle Count":
| Row ID | Date | Barcode | SKU | Product | Batch | SKU+BATCH | Qty | User |

---

## 2. CARA INSTALL DI HP

### ANDROID (Chrome)

1. Buka Chrome di HP Android
2. Buka URL aplikasi:
   - Local:      http://[IP-KOMPUTER]:8000/index-vanilla.html
   - Production: https://[domain-vercel].vercel.app/index-vanilla.html

3. Tunggu halaman load penuh
4. Tap ikon titik tiga (⋮) di pojok kanan atas Chrome
5. Tap "Add to Home screen" atau "Tambahkan ke layar utama"
6. Beri nama: "Stock Opname"
7. Tap "Add" / "Tambah"
8. Ikon muncul di home screen
9. Buka dari ikon --> tampil fullscreen tanpa browser bar

### iPHONE / iPAD (Safari)

1. Buka Safari (HARUS Safari, bukan Chrome)
2. Buka URL aplikasi
3. Tunggu halaman load penuh
4. Tap ikon Share (kotak dengan panah ke atas)
5. Scroll ke bawah --> tap "Add to Home Screen"
6. Beri nama: "Stock Opname"
7. Tap "Add" di pojok kanan atas
8. Ikon muncul di home screen
9. Buka dari ikon --> tampil fullscreen

### CATATAN PWA
- Setelah install, bisa dibuka offline (data cached)
- Sync otomatis saat ada koneksi internet
- Tampil seperti native app (fullscreen, no browser bar)
- Bisa di-uninstall seperti app biasa

---

## 3. DEPLOY KE PRODUCTION (VERCEL)

### PERSIAPAN

Pastikan file-file ini ada:
- index-vanilla.html  (halaman utama)
- app-vanilla.js      (logic aplikasi)
- manifest.json       (PWA config)
- sw.js               (Service Worker)
- vercel.json         (Vercel config)

### LANGKAH DEPLOY

#### A. Install Vercel CLI
```
npm install -g vercel
```

#### B. Login ke Vercel
```
vercel login
```
Pilih metode login (GitHub/Email)

#### C. Deploy
```
cd C:\Users\BLP-BAGAS\.kiro\Stock-Opname-Online-PWA
vercel --prod
```

Jawab pertanyaan:
- Set up and deploy? --> Y
- Which scope? --> pilih akun Anda
- Link to existing project? --> N (pertama kali)
- Project name? --> stock-opname-pwa
- Directory? --> ./ (enter)
- Override settings? --> N

#### D. URL Production
Setelah deploy, Vercel akan berikan URL:
```
https://stock-opname-pwa.vercel.app
```

#### E. Update manifest.json untuk Production
Ubah start_url di manifest.json:
```json
"start_url": "/index-vanilla.html"
```

### VERCEL.JSON (sudah ada)
```json
{
  "rewrites": [{ "source": "/", "destination": "/index-vanilla.html" }]
}
```

### CUSTOM DOMAIN (Opsional)
1. Buka https://vercel.com/dashboard
2. Pilih project
3. Settings --> Domains
4. Add domain: stockopname.perusahaan.com
5. Update DNS sesuai instruksi Vercel

### DEPLOY ULANG SETELAH UPDATE
```
vercel --prod
```
Atau push ke GitHub --> auto deploy.

---

## 4. UPDATE & MAINTENANCE

### UPDATE CODE FRONTEND
1. Edit file di folder ini
2. Jalankan: `vercel --prod`
3. Selesai (tidak perlu redeploy GAS)

### UPDATE GOOGLE APPS SCRIPT (Backend)
Kapan perlu redeploy GAS:
- Ubah struktur kolom spreadsheet
- Tambah fitur baru di backend
- Fix bug di Code-FIXED.gs

Cara redeploy:
1. Buka https://script.google.com
2. Edit code
3. Deploy > Manage deployments > Edit > New version > Deploy
4. Update URL baru di app-vanilla.js (CONFIG.SCRIPT_URL)
5. Deploy ulang ke Vercel

### BACKUP DATA
Data tersimpan di Google Spreadsheet:
- ID: 16kGt5RM2bpAA8iDqlqS1SgATEHYN1X5B8JaLCz29Wvo
- Buka: https://docs.google.com/spreadsheets/d/16kGt5RM2bpAA8iDqlqS1SgATEHYN1X5B8JaLCz29Wvo

### TAMBAH USER
Tidak perlu setup -- username bebas, password BLP123.
Untuk ganti password: edit CONFIG.LOGIN_PASSWORD di app-vanilla.js

### MONITORING
- Cek error: buka aplikasi --> F12 --> Console
- Cek API: buka /debug-api.html
- Cek data: buka Google Spreadsheet langsung

---

## RINGKASAN URL PENTING

| Item | URL |
|------|-----|
| Aplikasi Local | http://localhost:8000/index-vanilla.html |
| Google Apps Script | https://script.google.com |
| Spreadsheet | https://docs.google.com/spreadsheets/d/16kGt5RM2bpAA8iDqlqS1SgATEHYN1X5B8JaLCz29Wvo |
| API Endpoint | https://script.google.com/macros/s/AKfycbyCfyQdUj9saS8hBrVoiPM4Se-ywCQze1N4mT_aYNqkDokcyiZ8FDrfodiXGWuhUUVp/exec |
| Debug API | http://localhost:8000/debug-api.html |
| Vercel Dashboard | https://vercel.com/dashboard |

---

## CHECKLIST SEBELUM PRODUCTION

- [ ] Test login berhasil
- [ ] Test search product muncul dropdown
- [ ] Test simpan Product In --> cek di spreadsheet
- [ ] Test simpan Cycle Count --> cek di spreadsheet
- [ ] Test kalkulator (10+5 = 15)
- [ ] Test ganti tanggal
- [ ] Test edit & hapus data
- [ ] Test install PWA di Android
- [ ] Test install PWA di iPhone
- [ ] Deploy ke Vercel
- [ ] Test dari URL Vercel
- [ ] Install dari URL Vercel di HP

