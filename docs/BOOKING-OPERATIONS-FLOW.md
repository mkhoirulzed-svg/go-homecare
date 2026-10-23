# Go Homecare — Alur Operasional Pesanan

Status dokumen: rancangan implementasi, belum menjadi perilaku aplikasi aktif.

## Tujuan tahap

Menyelesaikan siklus pesanan setelah pasien mengirim permintaan: admin meninjau dan menugaskan praktisi, praktisi melihat tugas yang ditugaskan kepadanya, lalu status layanan diperbarui secara terbatas. Perubahan ini tidak boleh menghapus atau melemahkan pembatasan akses pasien yang sudah ada.

## Kondisi saat ini

- Pasien dapat membuat, membaca, mengedit, dan membatalkan pesanan miliknya selama status masih `pending`, sesuai Firestore Rules.
- `admin.html` saat ini hanya meninjau permohonan praktisi dan akun praktisi lama; belum ada panel pesanan.
- `nurse.html` adalah dashboard awal; belum ada daftar tugas.
- Firestore Rules mengizinkan pasien membaca pesanan miliknya dan praktisi membaca pesanan yang `nurseUid`-nya sama dengan UID praktisi.
- Saat ini belum ada alur assignment atau transisi status pesanan yang aktif. Jangan menganggap alur di bawah sudah tersedia hanya karena dokumen ini ada.

## Model identitas pasien dan pemesan

Untuk tahap ini, `patientUid` tetap merupakan UID akun yang membuat dan mengelola pesanan, termasuk ketika pemesan mengisi data anggota keluarga. `bookerUid` juga harus sama dengan UID akun tersebut. Nama dan kontak orang yang menerima layanan disimpan terpisah pada `patientName`, `patientPhone`, dan `patientAddress`; `bookingFor` bernilai `self` atau `family`, dengan `relationship` sebagai hubungan pemesan dengan pasien.

Konsekuensi: nama pasien yang menerima layanan tidak otomatis berarti orang tersebut memiliki akun atau hak akses Firestore. Akun pemesan tetap pemilik pesanan. Jangan membuka akses berdasarkan nama, nomor telepon, atau hubungan keluarga saja.

## Siklus status yang diusulkan

| Status | Makna | Aksi yang diizinkan |
| --- | --- | --- |
| `pending` | Menunggu ditinjau admin | Pasien boleh edit/batalkan; admin boleh menerima dengan penugasan praktisi atau menolak |
| `accepted` | Diterima dan ditugaskan kepada praktisi | Praktisi yang ditugaskan boleh memulai layanan |
| `in_progress` | Layanan sedang berlangsung | Praktisi yang ditugaskan boleh menyelesaikan layanan |
| `completed` | Layanan selesai | Tidak ada perubahan status rutin |
| `rejected` | Permintaan ditolak admin | Status akhir; tidak dapat diedit atau diaktifkan kembali oleh klien |
| `cancelled` | Dibatalkan pasien saat masih pending | Status akhir; tidak dapat diedit atau diaktifkan kembali oleh klien |

Transisi yang diizinkan:
- `pending -> accepted`: admin saja, wajib mengisi UID, nama, dan telepon praktisi yang telah diverifikasi.
- `pending -> rejected`: admin saja, tidak boleh menugaskan praktisi pada pesanan yang ditolak.
- `pending -> cancelled`: pemilik pesanan saja.
- `accepted -> in_progress`: hanya praktisi terverifikasi yang ditugaskan pada pesanan tersebut.
- `in_progress -> completed`: hanya praktisi terverifikasi yang sama.
- Tidak ada transisi lain pada MVP. Perubahan setelah status akhir memerlukan prosedur operasional terpisah, bukan edit langsung oleh klien.

## Matriks kewenangan

| Aktor | Baca | Ubah data permintaan | Ubah status / penugasan |
| --- | --- | --- | --- |
| Pasien/pemesan | Hanya pesanan miliknya | Hanya saat `pending`, pada field formulir yang diizinkan | Hanya membatalkan saat `pending` |
| Admin | Semua pesanan untuk operasional | Tidak mengubah rincian klinis/kontak tanpa prosedur audit | Menugaskan dan menerima, atau menolak pesanan `pending` |
| Praktisi | Hanya pesanan yang ditugaskan kepadanya | Tidak boleh mengubah rincian permintaan atau identitas | `accepted -> in_progress -> completed` untuk pesanan yang ditugaskan kepadanya |
| Pengguna lain / belum login | Tidak ada akses | Tidak diizinkan | Tidak diizinkan |

Pemeriksaan UI bukan batas keamanan. Semua hak baca dan perubahan wajib ditegakkan oleh Firestore Rules atau backend tepercaya.

## Aturan implementasi keamanan

1. Jangan memperluas query atau izin baca pasien secara umum; setiap query pasien harus tetap dibatasi dengan `patientUid == auth.uid`.
2. Admin hanya dikenali oleh pemeriksaan server-side di Firestore Rules/backend, bukan oleh konstanta UID atau tombol di browser saja.
3. Penugasan hanya boleh menunjuk dokumen `users/{nurseUid}` dengan `role == "praktisi"` dan `isVerified == true`.
4. Pada transisi status, validasi status lama, status baru, aktor, UID penugasan, serta daftar field yang berubah. Field formulir pasien, identitas pemilik, `createdAt`, dan `bookingSource` tidak boleh ikut berubah saat status diperbarui.
5. Gunakan `serverTimestamp()` untuk `updatedAt`; jangan mempercayai waktu yang dikirim klien.
6. Jangan mengirim data pesanan kepada praktisi yang belum ditugaskan. Query daftar tugas harus memakai `nurseUid == auth.uid`.
7. Jangan menghapus pesanan; pertahankan status akhir untuk jejak operasional.
8. Uji Rules di emulator untuk jalur yang diizinkan dan ditolak sebelum memperbarui UI.
9. Verifikasi bahwa Rules di Firebase Console sama dengan file repo sebelum pengujian terintegrasi. CI yang lulus hanya membuktikan Rules dalam repo yang diuji.

## Urutan implementasi

1. Tambahkan test emulator untuk hak baca admin, penugasan, penolakan, mulai layanan, penyelesaian, serta percobaan manipulasi oleh pasien/praktisi yang salah.
2. Implementasikan Rules dengan transisi ketat dan periksa semua test yang sudah ada tetap lulus.
3. Tambahkan panel daftar/detail dan aksi admin pada `admin.html`.
4. Tambahkan daftar tugas dan aksi status pada `nurse.html`.
5. Perbarui dokumentasi data kontrak, lalu lakukan smoke test dengan akun uji pasien, admin, dan dua praktisi (yang ditugaskan dan yang tidak).
6. Jangan gabungkan ke `main` atau gunakan dengan data pasien sungguhan sebelum review dan verifikasi konfigurasi Rules produksi.

## Kriteria selesai

- Pasien hanya dapat melihat pesanan miliknya dan hanya dapat mengedit/membatalkan pesanan pending miliknya.
- Admin dapat meninjau semua pesanan dan melakukan hanya transisi admin yang ditentukan.
- Praktisi hanya dapat melihat pesanan yang ditugaskan kepadanya dan tidak dapat mengubah data permintaan.
- Praktisi yang tidak ditugaskan, pasien lain, dan pengguna anonim gagal melakukan baca/perubahan yang tidak diizinkan.
- Semua transisi ilegal dan perubahan field sensitif ditolak oleh emulator.
- Semua test lama dan baru lulus; UI menampilkan hasil sukses/gagal secara jelas.
