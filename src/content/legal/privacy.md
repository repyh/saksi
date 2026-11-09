# Kebijakan Privasi

**Terakhir diperbarui: 5 November 2026**

SAKSI membantu pengguna menelusuri paket pekerjaan jalan dan menyusun laporan kerusakan yang dapat dikaitkan dengan wilayah atau paket pengadaan. Dokumen ini menjelaskan data yang digunakan oleh versi aplikasi saat ini, tujuan penggunaannya, dan batas perlindungan yang tersedia. SAKSI adalah prototipe proyek mahasiswa, bukan kanal resmi pemerintah.

## Data yang diproses

### Laporan kerusakan

Pengguna dapat membuat laporan tanpa masuk ke akun. Formulir dapat memuat foto kerusakan, jenis kerusakan, pilihan penyebab yang terlihat, ukuran kasar, keterangan hingga 500 karakter, wilayah RW/kelurahan, patokan lokasi opsional, dan rujukan paket RUP opsional. Keterangan dan patokan lokasi dapat memuat informasi pribadi jika pengguna menuliskannya; hindari memasukkan nama, nomor telepon, NIK, atau informasi pribadi orang lain.

Foto diperkecil dan dikodekan ulang di perangkat untuk pratinjau, lalu diperiksa dan dikodekan ulang lagi di server saat dikirim. Berkas yang diterima disimpan sebagai WebP pada bucket Supabase Storage privat; metadata berkas seperti ukuran dan dimensi disimpan di basis data. Pemrosesan ini menghapus metadata gambar yang tertanam, tetapi **tidak** otomatis memburamkan wajah atau pelat nomor. Periksa foto dan samarkan bagian tersebut sendiri sebelum mengirim.

Jika pengguna memilih **Gunakan lokasi saya**, browser meminta izin lokasi. Koordinat perangkat dipakai untuk menentukan wilayah administrasi, lalu koordinat tersebut tidak menjadi bagian dari laporan yang disimpan. Laporan menyimpan wilayah kasar yang dipilih atau ditemukan, bukan titik GPS presisi. Patokan teks dan wilayah tetap dapat mempersempit lokasi, jadi jangan sertakan detail yang tidak perlu.

Rujukan RUP adalah pilihan pengguna. Tautan itu mencatat paket yang dipilih sebagai konteks laporan, bukan bukti bahwa paket tersebut menyebabkan kerusakan atau bertanggung jawab memperbaikinya.

### Akun

Pendaftaran akun dibatasi melalui undangan. Untuk akun, SAKSI memproses nama tampilan, alamat email, kredensial autentikasi yang dikelola Better Auth, sesi, dan izin akses staf bila diberikan. Password tidak disimpan sebagai teks biasa. Laporan yang dibuat saat pengguna masuk dapat ditautkan ke akun; kiriman anonim tidak ditautkan dan tidak muncul di riwayat akun.

### Data operasional

Permintaan pengiriman laporan dibatasi untuk mengurangi penyalahgunaan. Aplikasi menggunakan penanda berbasis HMAC dari alamat IP untuk pembatasan laju, bukan menyimpan alamat IP mentah pada rekaman laporan. Infrastruktur hosting atau penyedia jaringan dapat memproses alamat IP dan data koneksi sesuai konfigurasi mereka. Catatan keamanan dan audit tertentu juga dapat merekam tindakan staf.

## Tujuan dan akses

Data digunakan untuk menerima dan mengelola laporan, menampilkan riwayat kepada pemilik akun, mencocokkan laporan dengan wilayah atau rujukan paket yang dipilih, menjaga keamanan layanan, dan menjalankan tinjauan internal. Antarmuka antrean staf saat ini hanya menampilkan metadata terbatas seperti status, kategori kerusakan, waktu, wilayah kasar, dan rujukan paket. Antrean tersebut tidak menampilkan identitas pelapor, foto, patokan lokasi, penyebab, atau keterangan.

Foto laporan berada di penyimpanan privat. Akses bukti, tindakan moderasi, penerbitan laporan ke publik, serta portal pencarian berdasarkan kode laporan belum tersedia. Jangan menganggap laporan sudah ditinjau atau terlihat oleh instansi hanya karena formulir menampilkan tanda terima.

## Penyedia layanan

SAKSI menggunakan Supabase untuk basis data PostgreSQL dan penyimpanan objek, serta Better Auth untuk autentikasi. Aplikasi juga bergantung pada penyedia hosting dan infrastruktur yang dipilih saat penerapan. Data dapat diproses oleh penyedia tersebut untuk menjalankan layanan. Pengaturan wilayah pemrosesan, daftar lengkap subprosesor, dan mekanisme transfer data lintas wilayah harus dikonfirmasi oleh pengelola sebelum layanan digunakan secara produksi.

## Penyimpanan dan penghapusan

Laporan yang dikirim tersimpan di basis data dan bukti foto berada di bucket privat. **Jangka waktu penyimpanan, prosedur penghapusan laporan/foto, dan jadwal pembersihan berkas yatim belum ditetapkan atau diotomatisasi dalam prototipe ini.** Karena itu kami tidak menjanjikan periode penghapusan tertentu. Pengelola perlu menetapkan jadwal retensi dan jalur permintaan penghapusan sebelum layanan dibuka untuk penggunaan publik.

Draft yang belum dikirim hanya berada di memori halaman pada implementasi saat ini dan tidak disimpan ke server. Menutup atau memuat ulang halaman dapat menghilangkan draft tersebut.

## Pilihan dan tanggung jawab pengguna

- Laporan dapat dikirim tanpa akun; jika masuk, laporan dapat terhubung dengan akun tersebut.
- Berikan izin lokasi hanya jika ingin menggunakannya untuk menentukan wilayah.
- Sebelum mengirim foto, samarkan wajah dan pelat nomor yang tidak perlu terlihat.
- Isi laporan dengan pengamatan yang relevan dan hindari data pribadi pihak lain.
- Jangan menyimpulkan identitas atau kesalahan seseorang dari data paket atau laporan.

## Perubahan kebijakan dan kontak

Kebijakan ini dapat diperbarui ketika perilaku aplikasi atau pengelolaan data berubah. Perubahan tanggal dan isi akan dicatat pada halaman ini. Prototipe belum menetapkan alamat khusus untuk permintaan privasi atau pengaduan; pengelola proyek perlu menyediakan kontak yang aktif sebelum peluncuran publik.

Dokumen ini menjelaskan implementasi prototipe dan bukan nasihat hukum. Pengelola harus meninjau dasar pemrosesan, retensi, hak subjek data, kontak, dan kewajiban hukum yang berlaku sebelum layanan produksi.
