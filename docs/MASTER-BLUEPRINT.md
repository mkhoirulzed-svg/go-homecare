# Master Blueprint Go Homecare

> Dokumen induk rancangan produk, teknis, keamanan, pengujian, dan peluncuran Go Homecare. Dokumen ini adalah sumber acuan perencanaan; bukan bukti bahwa fitur, aturan Firebase, integrasi, atau prosedur operasional sudah diterapkan.
>
> **Status:** Draft untuk ditinjau  
> **Versi:** 0.1.0  
> **Tanggal:** 2026-10-23  
> **Repository:** `mkhoirulzed-svg/go-homecare`  
> **Branch dokumen:** `docs/master-blueprint`

## 1. Tujuan dan prinsip

Go Homecare adalah aplikasi untuk membantu pengguna menemukan layanan perawatan di rumah, mengajukan pemesanan untuk diri sendiri atau orang lain, dan memantau proses layanan. Aplikasi juga menyediakan alur bagi praktisi/perawat untuk mengajukan akun dan mengelola pekerjaan, serta panel admin untuk verifikasi dan operasional.

Target akhir bukan sekadar halaman yang terlihat berfungsi. Aplikasi baru boleh dinyatakan siap digunakan setelah alur utama, keamanan akses, penanganan data pribadi, kesiapan tenaga layanan, prosedur operasional, dan pengujian lapangan semuanya tervalidasi.

### Prinsip wajib
1. **Audit sebelum mengubah:** periksa kode, struktur data, konfigurasi, dan perilaku aktual sebelum menyimpulkan penyebab masalah.
2. **Backup dan isolasi perubahan:** buat backup/branch sebelum pekerjaan yang berisiko; kembangkan melalui branch fitur.
3. **Perubahan kecil dan terukur:** satu tujuan per tahap, dengan kriteria penerimaan dan pengujian yang jelas.
4. **Tidak langsung ke `main`:** tinjau diff, jalankan pengujian yang tersedia, lalu minta persetujuan sebelum merge/penerapan.
5. **Keamanan di server/rules:** UI bukan batas keamanan. Validasi identitas, role, kepemilikan, dan transisi status harus ditegakkan oleh Firestore Rules atau backend tepercaya.
6. **Jangan klaim berhasil tanpa bukti:** bedakan kode di GitHub, aturan yang dipublikasikan, deployment, dan hasil tes nyata.
7. **Keselamatan pasien:** aplikasi pemesanan bukan layanan gawat darurat dan tidak menggantikan penilaian klinis.
8. **Minimasi data:** kumpulkan hanya data yang diperlukan, batasi akses, tetapkan retensi dan proses penghapusan sesuai kebijakan yang disetujui.

## 2. Kondisi repository saat dokumen dibuat

Audit awal berdasarkan struktur `main` dan dokumen yang tersedia. Ini adalah inventaris awal, bukan audit keamanan penuh.

### File yang ditemukan
- `index.html` — halaman awal/login dan pengalihan pengguna.
- `patient.html` — dashboard pasien dan pilihan layanan.
- `booking.html` — formulir pemesanan layanan.
- `profile.html`, `complete-profile.html` — profil dan penyelesaian profil.
- `nurse.html` — dashboard praktisi.
- `apply-practitioner.html` — pengajuan menjadi praktisi.
- `admin.html` — panel peninjauan permohonan praktisi.
- `firestore.rules` — aturan akses Firestore dalam repository.
- `firebase.json` — konfigurasi Firebase.
- `docs/homecare-booking-flow.md` — rancangan alur booking dan edit/batal.
- `docs/firestore-rules-review.md`, `docs/firestore-rules-tests.md` — catatan aturan dan pengujian.
- `tests/firestore.rules.test.js` — tes aturan lokal.
- `test.html`, `test2.html` — halaman yang perlu diklasifikasikan sebagai tes, prototipe, atau bagian aplikasi.

### Fakta dan risiko yang sudah terdokumentasi
- Pemesanan menggunakan koleksi `bookingRequests` dengan status awal `pending`.
- Model booking sudah mencakup nama/kontak/alamat pasien, layanan, waktu, area, catatan, informasi pemesan/perawat, sumber, dan timestamp.
- Pasien dapat mengedit atau membatalkan booking miliknya ketika status masih `pending`; pembatalan seharusnya mengubah status, bukan menghapus catatan.
- Booking keluarga perlu membedakan **akun pemesan** dari **orang yang menerima layanan**.
- Alur penugasan perawat dan perubahan status oleh pihak tepercaya belum dianggap selesai.
- Dokumen rules menyatakan aturan `users` yang lama masih terlalu longgar karena pengguna berpotensi mengubah role atau field verifikasi sendiri.
- Tes emulator lokal tidak membuktikan bahwa rules yang aktif di Firebase Console sama dengan file repository.
- Notifikasi WhatsApp/Cloud Functions disebut sebagai rencana, bukan integrasi yang sudah aktif.
- README saat ini belum menjelaskan aplikasi secara memadai.

### Pekerjaan audit berikutnya
- [ ] Petakan setiap halaman, modul JavaScript, event listener, dan navigasi.
- [ ] Cocokkan seluruh koleksi Firestore yang dipakai kode dengan rules.
- [ ] Identifikasi semua tempat yang dapat menulis role, status, verifikasi, assignment, dan notifikasi.
- [ ] Periksa status deployment Firebase Hosting dan konfigurasi proyek tanpa membocorkan kredensial.
- [ ] Klasifikasikan `test.html` dan `test2.html`; jangan hapus sebelum kegunaan dan referensinya dipastikan.
- [ ] Rekam baseline tes dan perilaku saat ini sebelum refactor.

## 3. Visi produk dan batas ruang lingkup

### Tujuan produk
- Memudahkan pemesanan layanan homecare yang jelas dan terjadwal.
- Mengizinkan keluarga membuat pemesanan untuk pasien lain secara eksplisit.
- Membuat status permintaan mudah dipahami oleh pemesan, pasien, perawat, dan admin yang berwenang.
- Mengurangi salah komunikasi melalui riwayat aktivitas dan notifikasi yang dapat ditelusuri.
- Menyediakan proses verifikasi praktisi sebelum mendapat akses operasional.

### Di luar ruang lingkup awal kecuali disetujui terpisah
- Diagnosis otomatis, triase klinis otomatis, atau rekomendasi pengobatan.
- Pengganti layanan gawat darurat atau konsultasi medis langsung.
- Rekam medis lengkap, resep elektronik, klaim asuransi, atau pembayaran online.
- Pelacakan lokasi perawat secara real-time.
- Janji bahwa layanan tersedia 24/7 sebelum kapasitas dan SOP operasional benar-benar tersedia.

## 4. Peran pengguna dan batas akses

| Peran | Tujuan | Akses utama | Batas penting |
|---|---|---|---|
| Pengunjung | Memahami layanan dan mendaftar | Halaman publik, login | Tidak dapat melihat data booking |
| Pasien/pemesan | Memesan untuk diri sendiri atau orang lain | Profil sendiri, pasien terkait, booking yang dibuat/diizinkan | Tidak dapat mengubah role, verifikasi, assignment, atau status operasional secara bebas |
| Praktisi/perawat | Menangani layanan yang ditugaskan | Profil profesional, booking yang ditugaskan, status kerja yang diizinkan | Tidak dapat membaca semua pasien atau mengambil booking orang lain |
| Admin verifikasi | Meninjau pengajuan praktisi | Pengajuan dan data minimum untuk verifikasi | Akses administratif harus dibatasi dan diaudit |
| Operator layanan | Mengatur permintaan, jadwal, assignment, eskalasi | Booking yang diperlukan untuk operasional | Pisahkan dari admin teknis bila memungkinkan |
| Admin teknis | Mengelola konfigurasi dan akses sistem | Operasi teknis yang diperlukan | Jangan gunakan akun bersama; setiap tindakan sensitif harus terlacak |

**Aturan desain:** jangan mempercayai `role` atau `isVerified` yang dikirim dari browser. Role istimewa harus ditetapkan oleh proses admin/backend yang tepercaya. Gunakan custom claims atau sumber otorisasi tepercaya bila sesuai arsitektur; perubahan ini harus dirancang agar tidak merusak onboarding yang ada.

## 5. Peta modul aplikasi

### A. Identitas dan onboarding
- Login/logout dengan Firebase Authentication.
- Penanganan sesi yang kadaluarsa, gagal login, dan akun yang dinonaktifkan.
- Pembuatan profil awal dan penyelesaian profil.
- Validasi kelengkapan profil sebelum pemesanan.
- Pengajuan praktisi, status pengajuan, penolakan dengan alasan yang aman, dan pengajuan ulang jika kebijakan mengizinkan.
- Verifikasi akun praktisi oleh admin yang berwenang.
- Pemulihan akses dan prosedur perubahan nomor kontak.

### B. Pengalaman pasien/pemesan
- Dashboard dan daftar layanan.
- Detail layanan: deskripsi, cakupan, syarat, durasi/perkiraan harga bila telah ditetapkan, area layanan, serta batasan layanan.
- Pemesanan untuk diri sendiri atau orang lain.
- Pemilihan pasien/penerima layanan dari profil tersimpan atau input yang tervalidasi.
- Alamat dan kontak penerima layanan yang jelas.
- Pemilihan jadwal, area, catatan kebutuhan, persetujuan, dan ringkasan sebelum kirim.
- Konfirmasi pengiriman yang tidak ambigu.
- Riwayat booking dan detail status.
- Edit/batal sesuai status dan kebijakan.
- Notifikasi status, pusat notifikasi, dan penanganan kegagalan pengiriman.
- Profil, pengaturan privasi, dan bantuan.

### C. Pengalaman perawat/praktisi
- Dashboard pekerjaan dan status ketersediaan.
- Daftar permintaan yang ditugaskan saja.
- Detail tugas dengan data minimum yang diperlukan.
- Terima/tolak tugas sesuai aturan operasional.
- Konfirmasi perjalanan/kedatangan bila diperlukan.
- Mulai layanan, tandai selesai, atau laporkan kendala.
- Catatan pelayanan hanya jika format, akses, retensi, dan tanggung jawab klinis sudah disepakati.
- Riwayat tugas dan profil profesional.
- Status verifikasi dan masa berlaku dokumen kredensial bila digunakan.

### D. Panel admin/operator
- Ringkasan permintaan dan antrean kerja.
- Verifikasi praktisi: tinjau, setujui, tolak, minta revisi.
- Manajemen booking: validasi, assignment, perubahan jadwal, pembatalan operasional, dan eskalasi.
- Manajemen katalog layanan, area, jam operasional, tarif, dan kapasitas.
- Pengelolaan pengguna dan status akun dengan kontrol akses berlapis.
- Riwayat aktivitas untuk tindakan sensitif.
- Pemantauan kegagalan notifikasi dan pekerjaan yang tertunda.
- Laporan operasional yang tidak membuka data pribadi secara berlebihan.

### E. Dukungan dan tata kelola
- FAQ, kontak bantuan, kebijakan privasi, syarat penggunaan, persetujuan pemrosesan data.
- Kanal pengaduan dan prosedur insiden.
- Kebijakan penyimpanan/penghapusan data.
- Panduan operator, perawat, dan admin.
- Prosedur saat layanan tidak tersedia, perawat terlambat, pasien tidak dapat dihubungi, atau kondisi pasien memburuk.

## 6. Alur utama pengguna

### 6.1 Pasien baru
1. Membuka halaman publik dan memahami layanan serta batasannya.
2. Login.
3. Melengkapi profil dan menyetujui pemberitahuan privasi yang relevan.
4. Memilih layanan.
5. Mengisi detail pemesanan.
6. Melihat ringkasan dan mengonfirmasi.
7. Menerima nomor/ID booking dan status awal.
8. Memantau status sampai layanan selesai atau permintaan ditutup.

### 6.2 Memesan untuk anggota keluarga
1. Pemesan memilih **untuk orang lain**, bukan hanya mengganti nama.
2. Aplikasi memisahkan identitas akun pemesan dari identitas penerima layanan.
3. Sistem mengumpulkan kontak penerima dan alamat layanan sesuai kebutuhan.
4. Pemesan mengonfirmasi bahwa ia berwenang memberikan data dan membuat permintaan, dengan wording persetujuan yang ditinjau secara hukum/privasi.
5. Riwayat terlihat oleh akun yang memang berwenang; akses tidak otomatis diberikan kepada semua anggota keluarga.
6. Perubahan dan pembatalan mengikuti status booking dan kebijakan layanan.

### 6.3 Edit atau batal oleh pemesan
- Hanya booking yang boleh dikelola oleh akun tersebut yang ditampilkan.
- Untuk status `pending`, pemesan dapat mengedit field yang diizinkan atau membatalkan sesuai kebijakan.
- Edit mempertahankan ID, pemilik, identitas pemesan, waktu pembuatan, dan field sistem yang tidak boleh diubah.
- Batal mengubah status menjadi `cancelled`; jangan menghapus dokumen.
- Jika booking sudah diproses/ditugaskan, arahkan pengguna ke operator atau kanal bantuan.
- Tampilkan indikator loading, sukses, atau error yang jelas; cegah pengiriman ganda.
- Jika update gagal, jangan menampilkan pesan sukses. Muat ulang status dari sumber data.

### 6.4 Praktisi
1. Mengajukan akun dan melengkapi informasi profesional.
2. Tetap pada role dasar sampai verifikasi disetujui.
3. Admin memeriksa data melalui proses yang terdokumentasi.
4. Setelah disetujui, akses praktisi diberikan oleh proses tepercaya.
5. Praktisi hanya melihat dan mengubah booking yang ditugaskan sesuai transisi yang diizinkan.

### 6.5 Admin/operator
1. Login dengan akun terpisah dan role yang telah diverifikasi.
2. Melihat antrean yang menjadi tanggung jawabnya.
3. Memvalidasi permintaan dan kapasitas.
4. Menetapkan praktisi melalui alur yang tepercaya.
5. Mencatat perubahan status dan alasan tindakan sensitif.
6. Menangani kegagalan, pembatalan, dan eskalasi dengan SOP.

## 7. Siklus status booking

Status berikut adalah **usulan untuk disepakati**, bukan izin untuk langsung mengubah nilai yang sudah dipakai aplikasi.

| Status | Makna | Aktor yang dapat memicu |
|---|---|---|
| `pending` | Permintaan baru menunggu peninjauan | Sistem saat booking dibuat |
| `reviewing` | Operator sedang memeriksa detail/ketersediaan | Operator tepercaya |
| `accepted` | Permintaan disetujui | Operator tepercaya |
| `assigned` | Praktisi sudah ditetapkan | Operator/backend tepercaya |
| `en_route` | Praktisi dalam perjalanan, bila fitur ini dipakai | Praktisi yang ditugaskan |
| `in_progress` | Layanan sedang dilakukan | Praktisi yang ditugaskan |
| `completed` | Layanan selesai | Praktisi/operator sesuai SOP |
| `rejected` | Permintaan ditolak dengan alasan yang sesuai | Operator tepercaya |
| `cancelled` | Permintaan dibatalkan | Pemesan pada status yang diizinkan atau operator |
| `no_show` | Layanan tidak terlaksana karena pihak terkait tidak hadir/tidak dapat dihubungi | Operator sesuai SOP |

### Ketentuan transisi
- Setiap transisi memiliki aktor, status asal, status tujuan, prasyarat, dan field yang boleh berubah.
- Browser tidak boleh bebas mengirim status tujuan.
- Transisi sensitif harus divalidasi oleh backend tepercaya atau rules yang dapat membuktikan seluruh prasyarat.
- Simpan `createdAt`, `updatedAt`, `createdByUid`, dan log peristiwa yang relevan.
- Hindari menyimpan data kesehatan sensitif dalam log teknis.
- Tentukan apakah status `reviewing` dan `assigned` benar-benar dibutuhkan sebelum implementasi; status yang terlalu banyak tanpa proses operasional hanya menambah kebingungan.

## 8. Model data Firestore — rancangan awal

Skema berikut perlu dicocokkan dengan dokumen yang sudah ada sebelum migrasi. Jangan mengganti nama field atau koleksi hanya karena rancangan ini terlihat lebih rapi.

### `users/{uid}`
Field yang mungkin diperlukan:
- `uid` (atau UID sebagai document ID)
- `displayName`, `phone`, `email`
- `role` yang ditetapkan melalui proses tepercaya
- `profileComplete` dengan validasi yang tepat
- `accountStatus`
- `createdAt`, `updatedAt`
- `privacyConsentVersion`, `privacyConsentAt` bila desain persetujuan sudah ditinjau

Jangan izinkan pengguna mengubah sendiri `role`, `isAdmin`, `isVerified`, status akun, atau field otorisasi.

### `patientProfiles/{profileId}` atau subkoleksi yang setara
- `ownerUid`: akun yang mengelola profil
- `displayName`, `phone`, `address` dan data minimum lain
- `relationshipToBooker` bila diperlukan
- metadata persetujuan dan timestamp sesuai kebutuhan

Keputusan penting: apakah pasien lain harus memiliki akun, apakah satu pemesan boleh mengelola beberapa profil, dan bagaimana akses dicabut. Pilih satu pola dan dokumentasikan aturan aksesnya.

### `bookingRequests/{bookingId}`
- `bookerUid`: akun yang mengajukan permintaan
- `patientProfileId` atau snapshot penerima layanan yang dibutuhkan
- `patientName`, `patientPhone`, `patientAddress` bila snapshot diperlukan untuk menjaga konsistensi pemesanan
- `serviceId` dan `serviceNameSnapshot`
- `scheduledAt` sebagai Firestore Timestamp
- `area`, `notes` dengan batas panjang dan petunjuk untuk tidak memasukkan data yang tidak diperlukan
- `status`
- `assignedPractitionerUid` dan snapshot minimum praktisi bila sudah ditugaskan
- `bookingSource`
- `createdAt`, `updatedAt`
- `cancelledAt`, `cancelledByUid`, `cancellationReason` bila diperlukan
- `schemaVersion` jika ada kebutuhan evolusi skema

Pertahankan kompatibilitas dengan field saat ini sampai penggunaan kode dan data lama telah dipetakan.

### `practitionerApplications/{applicationId}`
- `applicantUid`
- data profesional minimum yang dibutuhkan untuk verifikasi
- referensi dokumen verifikasi bila ada penyimpanan aman
- `status`: misalnya `submitted`, `under_review`, `approved`, `rejected`, `needs_revision`
- `reviewedByUid`, `reviewedAt`, `reviewNote` yang aman
- timestamp

Dokumen identitas/kredensial tidak boleh dipublikasikan melalui URL terbuka. Tentukan akses, masa simpan, dan proses penghapusan.

### `notifications/{notificationId}`
- `recipientUid`
- `type`
- `title`, `body` dengan informasi minimum
- `entityType`, `entityId`
- `readAt` atau `isRead` dengan pola konsisten
- `createdAt`
- `deliveryChannels` dan status pengiriman bila memakai backend

Notifikasi bukan sumber kebenaran status booking. Ketika dibuka, detail harus dimuat ulang dan aksesnya diverifikasi.

### `bookingEvents/{eventId}` atau audit log sejenis
- ID booking
- aktor tepercaya
- jenis peristiwa
- status sebelum/sesudah
- timestamp
- alasan minimum yang diperlukan

Akses tulis ke log harus dibatasi. Hindari menaruh catatan klinis lengkap, token, kredensial, atau data sensitif yang tidak diperlukan.

### `services/{serviceId}` dan `serviceAreas/{areaId}`
- nama dan deskripsi
- status aktif
- cakupan dan batasan layanan
- durasi/perkiraan harga bila telah disetujui
- area dan jam operasional
- kapasitas dan syarat pemesanan

Perubahan katalog sebaiknya dilakukan melalui peran operator/admin yang sesuai dan tercatat.

## 9. Keamanan dan privasi

### Kontrol minimum sebelum peluncuran
- [ ] Role istimewa tidak dapat ditetapkan atau diubah oleh pengguna biasa.
- [ ] Pengguna tidak dapat membaca atau mengubah booking milik pihak lain tanpa izin yang eksplisit.
- [ ] Praktisi hanya dapat membaca data yang dibutuhkan untuk tugas yang ditugaskan.
- [ ] Hanya proses tepercaya yang dapat menetapkan praktisi dan melakukan transisi status administratif.
- [ ] Validasi field yang diizinkan, tipe data, panjang teks, timestamp, nilai status, dan field wajib.
- [ ] Tolak field tak dikenal untuk operasi sensitif jika skema memang mengharuskannya.
- [ ] Rules diuji untuk pengguna anonim, pasien, pemesan keluarga, praktisi belum diverifikasi, praktisi terverifikasi, operator, dan admin.
- [ ] Periksa konfigurasi Firebase Authentication, domain yang diizinkan, aturan penyimpanan file, dan konfigurasi deployment.
- [ ] Tidak ada secret/API credential sensitif yang tertanam di repository.
- [ ] Logging dan pesan error tidak membocorkan data pribadi.
- [ ] Terapkan perlindungan spam/abuse, pembatasan frekuensi bila sesuai, dan pencegahan pemesanan ganda.
- [ ] Tinjau kebutuhan hukum dan kepatuhan di Indonesia, termasuk UU Perlindungan Data Pribadi, kewajiban sektor kesehatan yang relevan, persetujuan, retensi, akses, koreksi, dan penghapusan data.
- [ ] Sediakan prosedur respons insiden dan kontak penanggung jawab.

### Prinsip rules
- Gunakan default-deny.
- Aturan keamanan harus selaras dengan query yang benar-benar digunakan aplikasi; Firestore Rules bukan filter data.
- Jangan melonggarkan rules hanya untuk menghilangkan error `permission-denied`.
- Sebelum publish, simpan salinan rules aktif untuk rollback dan bandingkan dengan file repository.
- Jalankan Emulator Suite/Rules Unit Testing dan uji alur UI setelah rules berubah.
- Rules di GitHub **tidak otomatis menjadi rules aktif** sampai benar-benar dipublikasikan/deploy.

## 10. Notifikasi dan keandalan operasi

### Kanal yang dapat dipertimbangkan
1. Notifikasi dalam aplikasi sebagai dasar.
2. Email jika ada kebutuhan dan provider yang disetujui.
3. WhatsApp/SMS hanya setelah API, biaya, persetujuan penerima, template, privasi, dan prosedur kegagalan dipastikan.

### Peristiwa yang dapat memicu notifikasi
- Booking berhasil dibuat.
- Booking diedit atau dibatalkan.
- Booking mulai ditinjau.
- Booking disetujui/ditolak.
- Praktisi ditugaskan atau perubahan jadwal.
- Praktisi memulai/menyelesaikan layanan.
- Ada tindakan yang memerlukan respons pemesan.

### Pola implementasi yang disarankan
- Sumber status booking tetap dokumen booking.
- Notifikasi dibuat dari event/perubahan tepercaya, bukan hanya dari kode browser.
- Untuk integrasi eksternal, pertimbangkan pola outbox/retry/idempotency agar event tidak hilang atau terkirim berulang.
- Simpan status pengiriman dan jumlah percobaan tanpa menaruh rahasia.
- Bedakan “status tersimpan” dari “notifikasi berhasil dikirim”.
- UI menampilkan status sukses hanya setelah operasi utama dikonfirmasi; kegagalan notifikasi tidak boleh menyamarkan apakah booking berhasil disimpan.
- Tentukan kebijakan retry, dead-letter/manual retry, dan pemantauan kegagalan.

## 11. UX, aksesibilitas, dan responsivitas

- Utamakan tampilan mobile-first karena pengguna kemungkinan besar memakai ponsel.
- Konsisten menggunakan Bahasa Indonesia yang jelas.
- Setiap formulir memiliki label, validasi, petunjuk, dan ringkasan sebelum tindakan penting.
- Semua operasi async memiliki keadaan loading, sukses, gagal, dan empty state.
- Tombol yang memicu write dinonaktifkan saat proses berjalan untuk mengurangi duplikasi.
- Dialog pembatalan menjelaskan dampak dan meminta konfirmasi.
- Status ditampilkan dengan teks, bukan warna saja.
- Target sentuh nyaman, kontras memadai, fokus keyboard jelas, dan label pembaca layar.
- Tanggal/jam memakai zona waktu yang konsisten; simpan Timestamp, tampilkan waktu lokal yang benar, dan uji pergantian zona waktu.
- Hindari pesan teknis mentah kepada pengguna; simpan detail teknis aman di log.
- Sediakan fallback ketika jaringan lambat, koneksi terputus, atau sesi kedaluwarsa.

## 12. Arsitektur dan struktur kode

### Kondisi saat ini
Repository berbasis halaman HTML terpisah dan Firebase. Pertahankan struktur yang ada selama audit dan stabilisasi; refactor bertahap setelah tes regresi tersedia.

### Struktur target yang dapat dipertimbangkan
Jangan melakukan pemindahan file massal sekaligus. Struktur target berikut hanya usulan:

```text
/
├── index.html
├── patient.html
├── booking.html
├── profile.html
├── complete-profile.html
├── nurse.html
├── apply-practitioner.html
├── admin.html
├── assets/
│   ├── css/
│   ├── js/
│   │   ├── firebase-init.js
│   │   ├── auth.js
│   │   ├── permissions.js
│   │   ├── bookings.js
│   │   ├── notifications.js
│   │   └── ui/
│   └── images/
├── functions/                 # bila backend tepercaya dipilih
├── tests/
│   ├── firestore.rules.test.js
│   ├── booking-flow.test.js
│   └── fixtures/
├── docs/
│   ├── MASTER-BLUEPRINT.md
│   ├── architecture.md
│   ├── data-dictionary.md
│   ├── security-and-privacy.md
│   ├── operations-runbook.md
│   ├── test-plan.md
│   └── release-checklist.md
├── firebase.json
└── package.json
```

### Pedoman teknis
- Gunakan satu konfigurasi Firebase yang jelas; jangan menggandakan konfigurasi antarhalaman tanpa alasan.
- Pisahkan akses data, autentikasi/otorisasi, dan rendering UI secara bertahap.
- Gunakan fungsi bersama untuk menampilkan pesan status dan menangani error.
- Hindari inline handler yang membuat perilaku sulit diuji.
- Backend tepercaya diperlukan untuk operasi yang tidak aman dilakukan oleh browser, seperti role admin, assignment, transisi sensitif, dan integrasi notifikasi.
- Pilih teknologi backend setelah menilai biaya, kemampuan pemeliharaan, dan batas paket; jangan menambah infrastruktur tanpa kebutuhan.
- Jangan commit file konfigurasi rahasia atau kredensial layanan.

## 13. Pengujian dan kriteria penerimaan

### Jenis pengujian
1. Unit test fungsi validasi, pemetaan status, dan utilitas.
2. Firestore Rules Unit Tests di Emulator Suite.
3. Integrasi alur autentikasi dan Firestore.
4. Pengujian manual di ponsel dan desktop.
5. Pengujian regresi setelah perubahan UI/rules.
6. Pengujian keamanan negatif (akses yang harus ditolak).
7. Uji operasional: notifikasi gagal, jaringan terputus, sesi habis, duplikasi submit, dan pemulihan.
8. Uji penerimaan oleh operator/perawat menggunakan akun uji dan data fiktif.

### Matriks skenario minimum
- Pengunjung tidak bisa membuat booking.
- Pasien dengan profil belum lengkap tidak bisa melewati syarat onboarding yang ditentukan.
- Pasien dapat membuat booking untuk diri sendiri.
- Pemesan dapat membuat booking untuk orang lain hanya melalui alur yang eksplisit.
- Booking baru selalu berstatus awal yang sah.
- Pemesan tidak dapat menetapkan perawat atau memalsukan status.
- Pengguna A tidak dapat membaca/mengubah booking milik pengguna B.
- Pemesan dapat mengedit booking pending miliknya sesuai field yang diizinkan.
- Pemesan dapat membatalkan booking pending miliknya sesuai kebijakan.
- Booking yang sudah diproses tidak menampilkan edit/batal mandiri jika kebijakan melarangnya.
- Pembatalan tidak menghapus riwayat.
- Perawat belum diverifikasi tidak mendapat akses tugas.
- Perawat hanya mengakses booking yang ditugaskan.
- Pengguna tidak dapat menaikkan role sendiri.
- Admin tidak dapat bertindak melalui akun pasien biasa.
- UI tidak mengklaim sukses jika write gagal.
- Pengiriman ganda tidak membuat dua booking.
- Notifikasi yang gagal dapat diketahui dan ditangani.
- Logout dan sesi kedaluwarsa membatasi akses.
- Rules yang diuji identik dengan rules yang akan dipublikasikan.

### Definition of Done untuk setiap fitur
- [ ] Tujuan dan acceptance criteria tertulis.
- [ ] Dampak terhadap data/rules/halaman lain diperiksa.
- [ ] Diff ditinjau dan tidak berisi perubahan yang tidak terkait.
- [ ] Tes yang relevan lulus; keterbatasan tes dicatat.
- [ ] Skenario negatif penting diuji.
- [ ] Pesan loading/sukses/gagal jelas.
- [ ] Tidak ada secret atau data pasien nyata dalam tes/log.
- [ ] Dokumentasi diperbarui.
- [ ] Perubahan diuji di branch dan dipreview sebelum merge.
- [ ] Rollback atau langkah pemulihan diketahui.

## 14. Rencana pengerjaan bertahap

### Fase 0 — Inventaris dan baseline
- Audit semua file, alur halaman, koleksi Firestore, rules, konfigurasi, dan deployment.
- Petakan kondisi saat ini dan bug yang sudah diketahui.
- Pastikan backup/branch tersedia.
- Catat hasil tes awal.

**Gerbang selesai:** peta sistem aktual tersedia dan tidak ada asumsi besar yang belum ditandai.

### Fase 1 — Identitas dan kontrol akses
- Tetapkan model role dan status akun.
- Tutup celah perubahan role/verifikasi oleh pengguna.
- Perbaiki rules secara bertahap dengan tes emulator.
- Verifikasi onboarding, profil, login/logout, dan pengajuan praktisi.

**Gerbang selesai:** semua skenario akses yang harus ditolak benar-benar ditolak.

### Fase 2 — Siklus booking yang andal
- Finalisasi schema booking dan identitas booker/penerima.
- Selesaikan create, history/detail, edit, dan cancel.
- Implementasikan transisi status yang disetujui.
- Tambahkan pencegahan duplikasi dan penanganan error.

**Gerbang selesai:** alur booking diri sendiri dan keluarga lolos pengujian positif/negatif.

### Fase 3 — Operasional praktisi dan admin
- Verifikasi praktisi.
- Assignment booking dan kontrol akses per tugas.
- Workflow status, penjadwalan ulang, penolakan, dan eskalasi.
- Audit log untuk tindakan sensitif.

**Gerbang selesai:** operator dapat menjalankan alur end-to-end dengan akun uji tanpa manipulasi langsung di database.

### Fase 4 — Notifikasi
- Stabilkan notifikasi dalam aplikasi.
- Tentukan event, idempotency, retry, dan pemantauan.
- Tambahkan kanal eksternal hanya setelah persetujuan biaya, privasi, dan operasional.

**Gerbang selesai:** status booking dan status pengiriman notifikasi dapat dibedakan dan ditelusuri.

### Fase 5 — UX dan konten layanan
- Konsistensi desain dan navigasi.
- Validasi formulir, aksesibilitas, responsive layout, empty/error/loading state.
- Informasi layanan, area, jam operasional, batasan, bantuan, dan kebijakan.

**Gerbang selesai:** pengguna uji dapat menyelesaikan tugas utama tanpa bantuan pengembang.

### Fase 6 — Privasi, operasional, dan kesiapan peluncuran
- Tinjau hukum/privasi, persetujuan, retensi, akses dan penghapusan data.
- Tetapkan SOP layanan dan penanggung jawab.
- Siapkan monitoring, backup, pemulihan, dan respons insiden.
- Uji dengan data fiktif/staging sebelum data nyata.

**Gerbang selesai:** seluruh checklist pra-peluncuran disetujui oleh pemilik layanan dan pihak terkait.

### Fase 7 — Pilot terbatas dan rilis
- Jalankan pilot terbatas dengan area, jam, jenis layanan, dan kapasitas yang jelas.
- Kumpulkan bug dan umpan balik tanpa mengumpulkan data berlebihan.
- Perbaiki blocker, evaluasi operasional, lalu putuskan perluasan.
- Rilis bertahap dan siapkan rollback.

**Gerbang selesai:** hasil pilot memenuhi kriteria layanan, keamanan, dan pengalaman pengguna yang telah disepakati.

## 15. Kesiapan layanan nyata

Aplikasi teknis yang berfungsi belum tentu berarti layanan homecare siap beroperasi. Sebelum menerima pasien nyata, pemilik layanan perlu menetapkan:

- Badan/penanggung jawab operasional dan wilayah layanan.
- Daftar layanan yang benar-benar tersedia serta kompetensi tenaga yang diperlukan.
- Verifikasi identitas, STR/SIP atau kredensial profesional yang relevan sesuai aturan yang berlaku.
- SOP keselamatan, informed consent, dokumentasi, privasi, pengendalian infeksi, pengaduan, dan kejadian tidak diharapkan.
- Tarif, biaya transportasi, pembatalan, keterlambatan, refund bila ada, dan bukti transaksi bila pembayaran diaktifkan.
- Jam layanan, kapasitas, jadwal, pengganti praktisi, dan kontak eskalasi.
- Prosedur bila kondisi pasien memburuk atau mengarah ke keadaan darurat.
- Penanggung jawab akses data dan prosedur insiden.
- Persetujuan serta informasi privasi yang telah ditinjau secara profesional.

**Peringatan keselamatan:** tampilkan instruksi yang jelas bahwa Go Homecare bukan kanal penanganan kegawatdaruratan. Jika terjadi keadaan darurat, pengguna harus menghubungi layanan gawat darurat setempat atau menuju IGD. Jangan menjanjikan waktu respons atau ketersediaan yang belum dapat dipenuhi.

## 16. Monitoring, backup, dan pemulihan

- Pantau error autentikasi, permission-denied yang tidak diharapkan, kegagalan operasi booking, kegagalan notifikasi, dan antrean tertunda.
- Jangan mencatat isi catatan pasien, alamat lengkap, token, atau rahasia ke log umum.
- Tentukan siapa yang menerima alert dan batas waktu respons.
- Dokumentasikan backup data/configuration dan cara pemulihan yang sudah diuji.
- Simpan versi rules yang aktif dan prosedur rollback.
- Catat perubahan release, commit, tanggal deployment, hasil tes, dan siapa yang menyetujui.
- Lakukan pemeriksaan akses berkala serta pencabutan akses ketika praktisi/admin tidak lagi berwenang.

## 17. Keputusan yang harus dikonfirmasi

Daftar berikut tidak menghalangi audit kode, tetapi perlu dijawab sebelum desain operasional dikunci.

- [ ] Wilayah awal layanan dan jam operasional.
- [ ] Daftar layanan pertama yang benar-benar tersedia.
- [ ] Apakah booking memerlukan persetujuan operator sebelum diterima.
- [ ] Apakah pasien bisa memilih praktisi atau hanya menerima assignment.
- [ ] Siapa yang dapat mengedit/membatalkan booking setelah disetujui atau ditugaskan.
- [ ] Apakah satu akun dapat mengelola beberapa profil pasien dan bagaimana izin keluarga diberikan/dicabut.
- [ ] Apakah pembayaran masuk dalam rilis pertama.
- [ ] Kanal notifikasi yang disetujui dan siapa yang menanggung biaya.
- [ ] Data profesional apa yang wajib diverifikasi dan siapa yang bertanggung jawab.
- [ ] Kebijakan retensi, koreksi, ekspor, dan penghapusan data.
- [ ] Penanggung jawab klinis/operasional dan SOP eskalasi.
- [ ] Target pilot, ukuran keberhasilan, dan batas kapasitas awal.

Keputusan yang belum dijawab harus ditandai **TBD**; jangan mengarang kebijakan bisnis atau klinis.

## 18. Checklist pra-peluncuran

### Produk
- [ ] Semua alur utama punya acceptance criteria dan sudah diuji.
- [ ] Daftar layanan, cakupan, harga, jadwal, dan area akurat.
- [ ] Syarat, privasi, kontak bantuan, dan batasan layanan ditampilkan.

### Keamanan
- [ ] Rules aktif dibandingkan dengan rules yang diuji.
- [ ] Role dan verifikasi tidak dapat dipalsukan dari client.
- [ ] Akses lintas pengguna dan akses praktisi diuji.
- [ ] Konfigurasi dan secret diperiksa.
- [ ] Prosedur insiden dan pencabutan akses tersedia.

### Operasional
- [ ] Praktisi yang bertugas telah diverifikasi.
- [ ] Operator dan penanggung jawab eskalasi ditentukan.
- [ ] SOP pembatalan, keterlambatan, penolakan, dan kondisi darurat tersedia.
- [ ] Kapasitas layanan sesuai dengan janji di aplikasi.

### Teknis
- [ ] Tes emulator dan tes regresi lulus.
- [ ] Tes perangkat mobile dan desktop selesai.
- [ ] Monitoring, backup, dan rollback telah diuji.
- [ ] Tidak ada bug blocker yang belum diselesaikan.
- [ ] Deployment staging dan produksi dicatat terpisah.

### Persetujuan rilis
- [ ] Pemilik produk menyetujui alur dan konten.
- [ ] Penanggung jawab operasional menyetujui SOP.
- [ ] Penanggung jawab privasi/keamanan menyetujui pengelolaan data.
- [ ] Pilot terbatas disetujui sebelum perluasan.

## 19. Cara menggunakan dokumen ini

1. Baca dan koreksi blueprint ini sebelum mengubah arsitektur.
2. Setiap fitur baru harus menyebut bagian blueprint yang terkait.
3. Setelah keputusan dibuat, perbarui bagian yang relevan dan catat tanggal/alasannya.
4. Untuk perubahan skema atau rules, buat dokumen migrasi/tes tersendiri bila diperlukan.
5. Tandai item dengan `[x]` hanya setelah bukti pemeriksaan tersedia.
6. Jangan menganggap checklist selesai hanya karena kode telah di-commit.
7. Gunakan Pull Request untuk meninjau perubahan dan minta persetujuan sebelum merge ke `main`.

## 20. Riwayat perubahan

| Versi | Tanggal | Perubahan |
|---|---|---|
| 0.1.0 | 2026-10-23 | Blueprint awal berdasarkan inventaris repository dan dokumen yang tersedia. |

---

**Langkah berikut yang disarankan:** selesaikan Fase 0 dengan audit kode dan rules secara menyeluruh, lalu perbarui blueprint ini berdasarkan perilaku aktual sebelum memilih fitur pertama untuk diimplementasikan.
