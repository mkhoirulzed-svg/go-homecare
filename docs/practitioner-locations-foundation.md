# Fondasi Lokasi Praktisi dan Katalog Layanan Go Homecare

Status dokumen: rancangan Tahap 1. Belum mengubah aplikasi frontend atau data Firestore yang sudah ada.

## Keputusan produk

- Satu akun praktisi dapat memiliki beberapa tempat praktik.
- Praktisi dapat menawarkan kunjungan rumah, tempat praktik, atau keduanya.
- Setiap lokasi nantinya mempunyai layanan, tarif, dan jadwal sendiri.
- Pasien memilih praktisi, layanan, lokasi, dan jadwal sebelum mengirim permintaan.
- Permintaan berstatus `pending` sampai praktisi yang dipilih menekan Terima Pesanan.
- WhatsApp hanya saluran notifikasi. Firestore tetap sumber status pesanan.
- Rating/ulasan belum diaktifkan sampai ada mekanisme ulasan setelah layanan selesai.

## Tahap 1: dokumen lokasi

Koleksi baru: `practitionerLocations/{locationId}`

Skema awal yang diizinkan:

| Field | Tipe | Keterangan |
|---|---|---|
| `ownerUid` | string | UID praktisi pemilik; tidak boleh diganti oleh praktisi |
| `name` | string | Nama lokasi atau label layanan kunjungan rumah |
| `locationType` | string | `practice` atau `home_visit` |
| `address` | string | Alamat tempat praktik; boleh kosong untuk kunjungan rumah |
| `area` | string | Wilayah yang dilayani |
| `city` | string | Kota/kabupaten |
| `province` | string | Provinsi |
| `status` | string | `draft`, `pending_review`, `published`, `rejected`, atau `paused` |
| `createdAt` | timestamp | Waktu dibuat |
| `updatedAt` | timestamp | Waktu perubahan terakhir |

Praktisi terverifikasi dapat membuat lokasi berstatus `draft`, mengedit draft, lalu mengajukannya untuk ditinjau. Admin mengatur status publikasi. Dokumen yang dipublikasikan hanya dapat dibaca oleh pasien yang profilnya lengkap, pemilik, atau admin; daftar publik harus difilter dengan status `published`.

Lokasi kunjungan rumah bukan alamat rumah praktisi atau pasien. Simpan cakupan wilayah, bukan alamat pasien di dokumen lokasi.

## Tahap 2: layanan dan tarif per lokasi

Subkoleksi yang mulai diterapkan pada tahap ini:

`practitionerLocations/{locationId}/services/{serviceId}`

| Field | Tipe | Keterangan |
|---|---|---|
| `name` | string | Nama layanan |
| `description` | string | Deskripsi singkat |
| `price` | integer | Tarif rupiah, tidak boleh negatif |
| `durationMinutes` | integer | Perkiraan durasi 5–1440 menit |
| `status` | string | `draft`, `pending_review`, `published`, `rejected`, atau `paused` |
| `createdAt` | timestamp | Waktu dibuat |
| `updatedAt` | timestamp | Waktu perubahan terakhir |
| `reviewedBy`, `reviewedAt`, `reviewNote` | opsional | Metadata tinjauan admin |

Aturan layanan memeriksa kepemilikan lokasi induk dan status verifikasi praktisi. Praktisi hanya dapat membuat layanan berstatus draft dan mengedit draft/layanan yang ditolak. Pasien hanya dapat membaca layanan published di bawah lokasi published. Admin dapat meninjau layanan, dan tidak dapat memublikasikan layanan jika lokasi induknya belum published. Penghapusan layanan dinonaktifkan agar riwayat/rujukan tidak hilang secara tidak sengaja.

Jadwal per lokasi tetap tahap berikutnya. Pola hari/jam dan slot tanggal harus dirancang terpisah agar tidak menciptakan konflik jadwal atau menerima pemesanan pada waktu yang sudah lewat.

## Perubahan pemesanan berikutnya

Tambahkan ke `bookingRequests` setelah frontend dan Rules siap bersamaan:

- `practitionerUid` dan snapshot nama praktisi
- `locationId` dan snapshot nama/jenis/alamat lokasi yang relevan
- `serviceId`, snapshot nama layanan, dan `agreedPrice`
- snapshot rincian biaya jika ada
- status konfirmasi praktisi

Pertahankan field `nurseUid`, `nurseName`, dan `nursePhone` untuk kompatibilitas dengan pesanan lama selama migrasi. Jangan mengganti semua dokumen lama sekaligus atau mengasumsikan pesanan lama memiliki lokasi/harga snapshot.

## Keamanan dan migrasi

1. Perubahan Rules harus aditif terlebih dahulu; jangan mengubah aturan lama `bookingRequests` sebelum alur frontend baru siap.
2. Jangan membuka `users` secara publik. Katalog nantinya memerlukan proyeksi profil publik yang aman atau dokumen profil publik yang dikelola dengan aturan khusus.
3. Praktisi hanya mengelola dokumen lokasi miliknya dan tidak boleh mengubah status verifikasi akun.
4. Admin meninjau lokasi sebelum publikasi. Jenis layanan yang memerlukan kompetensi/perizinan atau persyaratan fasilitas khusus harus diverifikasi sebelum ditampilkan.
5. Sebelum Rules diterapkan ke Firebase, uji di Firebase Emulator: praktisi terverifikasi membuat/mengedit lokasi sendiri; praktisi lain tidak dapat membaca draft atau mengubah lokasi tersebut; pasien hanya membaca lokasi published; pengguna belum terverifikasi tidak dapat membuat lokasi; admin dapat meninjau status.
6. Tahap ini tidak mengirim WhatsApp dan tidak mengubah alur pemesanan yang sedang berjalan.

## Urutan implementasi

1. Skema dan Rules koleksi lokasi (PR ini).
2. UI praktisi untuk membuat/mengedit/mengajukan lokasi.
3. Koleksi layanan, tarif, dan jadwal plus Rules.
4. Katalog publik praktisi/lokasi yang aman.
5. Alur booking baru dengan harga snapshot dan penerimaan praktisi.
6. Notifikasi WhatsApp backend, retry, dan eskalasi admin.
