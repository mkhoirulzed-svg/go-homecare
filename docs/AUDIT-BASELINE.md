# Audit Baseline Go Homecare

> Audit statis awal berdasarkan file pada branch `main`. Dokumen ini mencatat temuan dari pembacaan kode; temuan belum semuanya diverifikasi melalui runtime, Firebase Emulator, atau proyek Firebase aktif.
>
> **Status:** Audit awal — perlu validasi tes  
> **Tanggal:** 2026-10-23  
> **Branch dokumen:** `docs/master-blueprint`  
> **Perubahan kode aplikasi/rules:** Tidak dilakukan dalam audit ini

## 1. Ringkasan eksekutif

Repository sudah memiliki kerangka aplikasi HTML/Firebase untuk login, profil pasien, booking, riwayat booking, pengajuan praktisi, verifikasi admin, dashboard perawat, serta Firestore Rules dan tes emulator.

Namun, aplikasi belum dapat dinyatakan siap produksi. Area risiko utama:
1. Ketidaksesuaian helper tes booking dengan field wajib di Firestore Rules.
2. Definisi identitas pemesan versus penerima layanan keluarga yang masih ambigu.
3. Akses operator/admin untuk booking dan workflow status/assignment belum tampak dirancang secara lengkap.
4. Ada lebih dari satu jalur onboarding/pengajuan praktisi yang perlu disatukan atau setidaknya diuji sebagai satu alur.
5. Perubahan beberapa dokumen dalam onboarding/persetujuan dilakukan berurutan; jika operasi di tengah gagal, data bisa berada pada kondisi parsial.
6. Rules di repository belum membuktikan bahwa rules yang sedang aktif di Firebase sama.
7. `test.html` dan `test2.html` perlu diklasifikasikan dan tidak boleh dipakai sebagai sumber perilaku produksi tanpa verifikasi.

## 2. Ruang lingkup dan metode

File yang ditinjau:
- `index.html`
- `patient.html`
- `booking.html`
- `profile.html`
- `complete-profile.html`
- `nurse.html`
- `apply-practitioner.html`
- `admin.html`
- `firestore.rules`
- `firebase.json`
- `package.json`
- `tests/firestore.rules.test.js`
- `docs/homecare-booking-flow.md`
- `docs/firestore-rules-review.md`
- `docs/firestore-rules-tests.md`
- `test.html` dan `test2.html`

Metode: pembacaan statis file dan perbandingan kontrak data antarhalaman, rules, dan tes. Belum dilakukan pengujian browser, tes emulator, pemeriksaan rules aktif pada Firebase Console, pengujian produksi, atau validasi dengan data nyata.

## 3. Temuan prioritas

### A-01 — Helper tes booking tidak sesuai dengan field wajib rules

**Prioritas:** P1 — harus dikonfirmasi sebelum mengandalkan hasil tes.

Dalam `firestore.rules`, pembuatan `bookingRequests` mewajibkan field:
- `patientUid`, `bookerUid`, `bookerName`, `bookingFor`, `relationship`
- data pasien, layanan, jadwal, area, catatan
- field perawat, status, sumber, dan timestamp

Namun helper `validBooking()` di `tests/firestore.rules.test.js` yang ditinjau tidak menyertakan `bookerUid`, `bookerName`, `bookingFor`, dan `relationship`. Test yang berlabel “complete signed-in patient can create” kemungkinan gagal pada rules yang ada sekarang.

**Tindakan yang disarankan:**
1. Jalankan `npm install` dan `npm run test:rules` pada lingkungan lokal yang mendukung Firebase Emulator.
2. Rekam output tes aktual sebelum mengubah apa pun.
3. Jika terkonfirmasi, perbarui helper dan fixture agar sesuai kontrak yang telah disepakati.
4. Tambahkan tes untuk booking diri sendiri dan booking keluarga.

### A-02 — Identitas pemesan dan penerima layanan perlu dipisahkan secara konsisten

**Prioritas:** P1 — keputusan skema diperlukan sebelum memperluas fitur keluarga.

Rules mewajibkan `patientUid == request.auth.uid` dan `bookerUid == request.auth.uid`. Ini membuat `patientUid` berfungsi seperti UID pemesan meskipun nama/kontak pasien dapat merujuk ke anggota keluarga.

**Risiko:** istilah “patient UID” dapat disalahartikan sebagai identitas akun pasien penerima layanan. Ini dapat menyulitkan akses keluarga, berbagi riwayat secara terkontrol, dan pemisahan antara akun yang memesan dengan orang yang menerima layanan.

**Tindakan yang disarankan:**
1. Tentukan makna setiap field secara eksplisit.
2. Pertimbangkan penggunaan `bookerUid` sebagai identitas akun yang mengajukan.
3. Tentukan apakah penerima layanan harus memiliki akun atau cukup memiliki profil yang dikelola pemesan.
4. Pertahankan akses hanya untuk pihak yang berwenang; jangan memberi akses otomatis kepada seluruh anggota keluarga.
5. Migrasikan skema hanya setelah seluruh query dan data lama dipetakan.

### A-03 — Akses operator/admin terhadap booking belum tampak tersedia di rules

**Prioritas:** P1 — blocker untuk workflow operasional yang memerlukan panel admin.

Rules `bookingRequests` memberikan `get/list` kepada pengguna terautentikasi jika `patientUid` atau `nurseUid` cocok dengan UID pengguna. Fungsi `isAdmin()` tidak terlihat dipakai dalam aturan booking tersebut. Karena itu, panel admin yang memerlukan akses langsung ke booking kemungkinan akan ditolak oleh rules saat ini.

**Tindakan yang disarankan:**
1. Definisikan peran operator/admin dan ruang lingkup aksesnya.
2. Tentukan apakah operasi dilakukan melalui backend tepercaya atau rules yang membatasi field dan transisi secara ketat.
3. Jangan membuka semua booking kepada semua pengguna yang memiliki role dari profil client.
4. Tambahkan tes admin/operator untuk membaca, menugaskan, mengubah status, dan menolak akses yang tidak sah.

### A-04 — Workflow booking dan assignment belum lengkap

**Prioritas:** P1 sebelum pilot layanan.

Aturan pembuatan booking mengharuskan field perawat null dan status `pending`. Aturan update pasien hanya mengizinkan edit field tertentu atau pembatalan saat `pending`. Ini adalah batas awal yang baik untuk mencegah manipulasi status oleh pasien, tetapi belum menyediakan workflow tepercaya untuk peninjauan, penerimaan, penugasan perawat, mulai layanan, penyelesaian, atau penolakan.

**Tindakan yang disarankan:**
1. Finalisasi daftar status yang benar-benar diperlukan.
2. Tentukan aktor yang berwenang untuk setiap transisi.
3. Implementasikan operasi administratif melalui jalur tepercaya.
4. Uji semua transisi yang sah dan tidak sah.
5. Jangan menambah status baru sebelum aturan operasionalnya disepakati.

### A-05 — Pengajuan praktisi memiliki lebih dari satu jalur

**Prioritas:** P1 — perlu tes regresi.

`apply-practitioner.html` menulis permohonan ke `practitionerApplications/{uid}`. `complete-profile.html` juga memiliki logika pengajuan praktisi dan menulis ke koleksi tersebut setelah beberapa operasi update pada dokumen pengguna.

**Risiko:** alur ganda meningkatkan risiko validasi atau pesan status yang berbeda. Pada `complete-profile.html`, update profil dilakukan sebelum pembuatan permohonan; jika penulisan permohonan gagal setelah update profil berhasil, akun dapat berada pada kondisi parsial.

**Tindakan yang disarankan:**
1. Pilih satu alur pengajuan utama dan arahkan jalur lain ke sana.
2. Jika beberapa penulisan harus konsisten, pertimbangkan transaksi Firestore atau backend tepercaya sesuai batasan teknis.
3. Tambahkan tes untuk kegagalan setiap langkah, permohonan ganda, pengajuan ulang setelah ditolak, dan permohonan pending.
4. Pastikan role tetap `pasien` sampai proses persetujuan resmi berhasil.

### A-06 — Proses persetujuan admin menulis ke beberapa dokumen

**Prioritas:** P1 — perlu uji kegagalan parsial.

`admin.html` saat menyetujui permohonan melakukan update dokumen `users/{uid}`, kemudian update `practitionerApplications/{id}`. Kedua operasi tersebut bukan satu transaksi atomik. Jika update profil berhasil tetapi update permohonan gagal, data pengguna dan status permohonan bisa berbeda.

**Tindakan yang disarankan:**
1. Uji kegagalan operasi kedua dan proses pemulihan.
2. Pertimbangkan Cloud Function/backend tepercaya atau transaksi yang sesuai.
3. Catat siapa yang meninjau dan kapan, dengan aturan akses yang konsisten.
4. Pastikan penolakan dan persetujuan tidak meninggalkan status campuran.

### A-07 — Jalur admin perlu dipusatkan dan diuji konsistensinya

**Prioritas:** P1 — penting untuk otorisasi.

Rules memakai UID admin tetap dalam fungsi `isAdmin()`; `admin.html` juga memiliki konstanta UID admin. Duplikasi konfigurasi ini bisa menimbulkan perbedaan jika salah satu diubah. Rules adalah batas keamanan sebenarnya; pemeriksaan di halaman saja tidak cukup.

**Tindakan yang disarankan:**
1. Bandingkan UID admin yang dipakai oleh halaman dan rules.
2. Dokumentasikan proses penambahan/pencabutan admin.
3. Uji akun admin yang sah dan akun biasa.
4. Pertimbangkan mekanisme role tepercaya yang mudah dikelola, tanpa mengizinkan pengguna mengubah role sendiri.

### A-08 — Rules aktif belum diverifikasi

**Prioritas:** P1 — harus diketahui sebelum rilis.

Dokumen repository secara eksplisit menjelaskan bahwa rules yang ada di GitHub tidak otomatis diterapkan ke Firebase. Audit ini hanya membaca `firestore.rules` di branch `main`; tidak ada klaim bahwa isinya sama dengan konfigurasi live.

**Tindakan yang disarankan:**
1. Simpan salinan rules aktif dari Firebase Console.
2. Bandingkan dengan file repository.
3. Jalankan tes emulator terhadap file yang hendak dipublikasikan.
4. Publikasikan hanya setelah review dan rollback tersedia.

### A-09 — Status edit/batal perlu dibedakan dari status notifikasi

**Prioritas:** P2 — penting untuk keandalan dan pengalaman pengguna.

Halaman pasien membatalkan booking dengan update status lalu memuat ulang riwayat dan progres. Halaman booking memiliki alur verifikasi hasil penyimpanan. Ini membantu, tetapi status penyimpanan booking harus tetap terpisah dari status pengiriman notifikasi.

**Tindakan yang disarankan:**
1. Pertahankan indikator loading/sukses/gagal untuk write utama.
2. Jangan tampilkan sukses bila write belum terkonfirmasi.
3. Pastikan notifikasi gagal tidak membuat pengguna mengira booking gagal jika data sebenarnya sudah tersimpan.
4. Tambahkan tes jaringan terputus, submit ganda, dan retry.

### A-10 — Halaman tes/prototipe belum diklasifikasikan

**Prioritas:** P2 — perlu diselesaikan saat audit struktur.

`test.html` dan `test2.html` ada pada branch utama. `test2.html` tampak memiliki alur profil lama yang berbeda dan dapat menyimpan field yang tidak sesuai dengan rules saat ini.

**Tindakan yang disarankan:**
1. Cari referensi dan penggunaan halaman ini.
2. Tandai sebagai tes/prototipe atau pindahkan ke lokasi yang jelas setelah dampaknya diketahui.
3. Jangan hapus atau mengubahnya sebelum memastikan tidak digunakan dalam deployment atau pengujian manual.

## 4. Temuan positif yang perlu dipertahankan

- Rules membuat akun baru dengan role awal `pasien`.
- Perubahan role dan verifikasi pengguna biasa dibatasi pada aturan `users`.
- Booking baru diwajibkan mulai pada status `pending` dengan field assignment perawat null.
- Penghapusan booking dilarang melalui client.
- Edit pasien dibatasi pada field tertentu ketika status masih pending.
- Pembatalan mempertahankan dokumen dan mengubah status.
- UI riwayat pasien melakukan query dengan `patientUid == currentPatientUid`, sejalan dengan pola Firestore Rules yang bukan filter otomatis.
- Tes rules lokal sudah tersedia sebagai fondasi, meskipun helper/fixture harus diselaraskan.

## 5. Matriks verifikasi berikutnya

| ID | Pemeriksaan | Status | Bukti yang dibutuhkan |
|---|---|---|---|
| T-01 | Jalankan tes Firestore Rules di emulator | Belum dijalankan | Output lengkap `npm run test:rules` |
| T-02 | Cocokkan rules live dengan repository | Belum diverifikasi | Salinan rules aktif dan hasil diff |
| T-03 | Uji login pasien dan onboarding baru | Belum diverifikasi | Langkah dan hasil uji |
| T-04 | Uji booking untuk diri sendiri | Belum diverifikasi | Dokumen uji dan status UI |
| T-05 | Uji booking untuk anggota keluarga | Belum diverifikasi | Dokumen uji dengan identitas pemesan/penerima yang jelas |
| T-06 | Uji edit dan batal booking pending | Belum diverifikasi | Hasil UI dan rules |
| T-07 | Uji pembacaan lintas akun | Belum diverifikasi | Tes harus ditolak |
| T-08 | Uji pengajuan praktisi dan persetujuan admin | Belum diverifikasi | Status aplikasi dan profil konsisten |
| T-09 | Uji akses booking admin/operator | Belum diverifikasi | Tes izin baca/tulis sesuai role |
| T-10 | Uji assignment dan transisi status | Belum diimplementasikan/dikonfirmasi | Workflow dan tes negatif |
| T-11 | Klasifikasi `test.html` dan `test2.html` | Belum diverifikasi | Referensi file dan keputusan pemeliharaan |
| T-12 | Uji kegagalan notifikasi dan write | Belum diverifikasi | Perilaku UI dan rekaman event aman |

## 6. Urutan tindakan yang disarankan

1. Jalankan tes rules yang sudah ada tanpa mengubah kode; simpan output.
2. Periksa kontrak data booking pada `booking.html` dan bandingkan dengan rules dan helper tes.
3. Sepakati makna `patientUid`, `bookerUid`, dan model profil keluarga.
4. Rancang matriks izin lengkap untuk pasien, pemesan keluarga, praktisi, operator, dan admin.
5. Perbaiki tes terlebih dahulu, kemudian rules melalui branch terpisah dengan review.
6. Satukan alur pengajuan praktisi dan rancang operasi admin yang konsisten.
7. Verifikasi rules aktif sebelum deployment.
8. Baru setelah itu lanjutkan fitur notifikasi dan workflow layanan.

## 7. Batasan dan pernyataan audit

- Tidak ada perubahan pada file aplikasi, rules, atau data Firebase dalam audit ini.
- Tidak ada tes emulator yang dijalankan selama pemeriksaan statis ini.
- Tidak ada akses langsung yang diverifikasi ke konfigurasi rules aktif Firebase.
- Tidak ada klaim bahwa aplikasi siap menerima data pasien nyata.
- Semua prioritas adalah penilaian awal dan perlu diperbarui setelah hasil runtime dan keputusan pemilik produk tersedia.

---

Dokumen ini harus diperbarui saat bukti pengujian baru tersedia. Jangan tandai temuan selesai hanya karena file telah diubah; gunakan hasil tes dan verifikasi yang dapat diulang.
