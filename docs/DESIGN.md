# DESIGN SYSTEM & GUIDELINES — SAKSI
*Sistem Akuntabilitas & Komparasi Spasial Infrastruktur*

Dokumen ini mendefinisikan identitas visual, palet warna, tipografi, aturan komponen, serta aturan tegas **Anti-AI-Slop** dan **Zero-Exposition** untuk platform **SAKSI**.

---

## 1. Prinsip Konten & Tata Letak: "Zero-Exposition / No-Shit-Sherlock Rule"

Setiap elemen visual maupun teks yang masuk ke antarmuka **wajib** lulus uji fungsional berikut:

1. **Wajib Menjawab *"Apa Tujuan Elemen Ini?"*:**
   - Setiap komponen, teks, angka, atau ikon harus memiliki fungsi informasi baru atau aksi nyata yang tidak diwakili oleh elemen lain di layar yang sama.
2. **Dilarang Menambah Konten Hanya untuk Estetika atau Mengisi Ruang Kosong:**
   - Jika ruang kosong terlihat lega, biarkan menjadi *whitespace* struktural. Jangan menaruh subjudul berulang, ikon dekoratif tanpa fungsi, atau paragraf basa-basi hanya agar kartu terlihat penuh.
3. **Dilarang Over-Exposition (*"No-Shit-Sherlock"* Copy):**
   - Jangan menulis kalimat yang menjelaskan kembali angka yang sudah terpampang jelas di sebelahnya (misal: menulis *"Terdapat 3.602 paket jalan TA 2025–2026"* di paragraf padahal kartu di sebelahnya sudah bertuliskan `3.602 Paket · 2025–2026`).
   - Jangan memberi judul/deskripsi redundan pada komponen yang fungsinya sudah jelas secara visual (misal: menulis *"Peta OpenStreetMap — Geser dan zoom untuk menjelajahi"* di atas peta interaktif).
   - Jangan menduplikasi tombol navigasi yang sudah ada di Navbar pada posisi yang berdekatan tanpa konteks spesifik paket.

---

## 2. Palet Warna Resmi (White, Yellow & Blue Dominant Palette)

Sistem warna menggunakan *architectural color-blocking* **Putih (`#FFFFFF`), Kuning (`#FFDA1A`), dan Biru (`#0058A3`)** — tanpa ornamen chip/pill kecil yang bertebaran:

| Warna | Hex Code | Peran Semantik | Penggunaan di Antarmuka |
|---|---|---|---|
| **Crisp White** | `#FFFFFF` | **Primary Surface / Canvas** | Latar belakang halaman (`body`), header navigasi minimalis, dan permukaan kartu utama. |
| **Nordic Cobalt Blue** | `#0058A3` | **Primary Structural Block** | Blok kartu utama (*Total Pagu Jalan*), indikator tab aktif, teks brand `SAKSI`, dan segmen utama bar presisi (`Titik Desa`). |
| **Signal Yellow** | `#FFDA1A` | **Secondary Architectural Block** | Blok kartu sekunder (*Sebaran Wilayah*), teks aksen kontras di atas blok biru, dan segmen `Garis Koridor`. |
| **Deep Navy Ink** | `#0A192F` | **Foreground / Body Text** | Teks utama dan angka di atas latar putih maupun kuning. |
| **Muted Slate** | `#475569` | **Secondary Metadata** | Teks keterangan sekunder dan label pendukung. |
| **Structural Border** | `#CBD5E1` | **Divider / Hairline** | Garis batas tipis antar seksi dan pembatas vertikal. |
| **Crimson Alert** | `#D9381E` | **Destructive / Status Kritis** | Khusus untuk indikator *"Diduga Tidak Sesuai"*. |

### Pemetaan Variabel CSS (`src/app/globals.css`)
```css
:root {
  --background: #FFFFFF;
  --foreground: #0A192F;
  --card: #FFFFFF;
  --card-foreground: #0A192F;
  --popover: #FFFFFF;
  --popover-foreground: #0A192F;
  --primary: #0058A3;
  --primary-foreground: #FFFFFF;
  --secondary: #FFDA1A;
  --secondary-foreground: #0A192F;
  --muted: #F1F5F9;
  --muted-foreground: #475569;
  --accent: #FFDA1A;
  --accent-foreground: #0A192F;
  --destructive: #D9381E;
  --destructive-foreground: #FFFFFF;
  --border: #CBD5E1;
  --input: #CBD5E1;
  --ring: #0058A3;
  --radius: 0.25rem;
}
```

---

## 3. Tipografi Resmi: Raleway & Open Sans (Google Fonts)

Diambil dari `next/font/google` di [layout.tsx](file:///c:/Users/LENOVO/Documents/web/lomba-mia/src/app/layout.tsx):
- **Raleway (`--font-heading`):** Digunakan untuk seluruh heading (`h1`–`h6`), identitas `S A K S I`, dan angka metrik utama (`Rp848,60 Miliar`, `251`, `92,5%`).
- **Open Sans (`--font-sans`):** Digunakan untuk teks body, tabel data, navigasi, dan metadata teknis.

---

## 4. Komponen Antarmuka (shadcn-First & `react-icons`)

- **shadcn/ui:** Gunakan komponen dari `src/components/ui/` (`Button`, `Card`, `Badge`).
- **Ikon (`react-icons`):** Hanya gunakan `react-icons` (utamanya `react-icons/fi`) dan **hanya jika ikon tersebut memiliki fungsi semantik/interaktif**, bukan pemanis sudut kartu. Dilarang menggunakan `lucide-react` atau emoji.
- **Tanpa Chip-Slop:** Jangan membungkus subjudul atau teks metadata dengan kotak/pill berwarna (`bg-* px-* py-* rounded-*`). Gunakan hierarki tipografi dan garis vertikal tipis (`w-px`).

---

> [!IMPORTANT]
> ## ANTI-AI-SLOP RULES (Wajib Dipatuhi)
>
> ### 1. The Seven Cardinal Sins (P0 — Terlarang Keras)
> 1. **Dilarang memakai default Tailwind indigo/violet sebagai aksen:** `#6366f1`, `#4f46e5`, `#4338ca`, `#3730a3`, `#8b5cf6`, `#7c3aed`, `#a855f7`.
> 2. **Dilarang memakai gradien 2-stop "trust" di Hero:** (ungu→biru, biru→cyan, indigo→pink).
> 3. **Dilarang memakai Emoji sebagai ikon fitur:** `✨`, `🚀`, `🎯`, `⚡`, `🔥`, `💡`.
> 4. **Dilarang memakai font acak di luar Raleway & Open Sans.**
> 5. **Dilarang membuat kartu rounded dengan border-kiri berwarna tebal** (*AI dashboard tile*).
> 6. **Dilarang mengarang metrik palsu:** Gunakan angka riil dataset (`3.602`, `Rp848,60 Miliar`, `92,5%`, `251`).
> 7. **Dilarang menulis over-exposition / filler copy:** Jangan mengulang angka yang sudah tampil di kartu sebelahnya atau menjelaskan cara kerja dasar peta ("Pan and zoom to explore").
>
> ### 2. Soft Tells (P1 — Hindari Pola Template)
> - **Jangan membungkus subjudul/metadata dalam chip/pill dekoratif.**
> - **Jangan memajang deretan kartu KPI simetris 6-kolom dengan ukuran identik.**
> - **Jangan menaruh ikon dekoratif di pojok kartu yang tidak bisa diklik.**
