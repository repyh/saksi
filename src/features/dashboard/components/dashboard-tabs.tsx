"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiArrowUpRight, FiBriefcase, FiEdit2, FiFileText, FiLogOut, FiMap, FiX } from "react-icons/fi";
import type { DashboardAccount } from "@/contracts/account/dashboard.contract";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";

const workspaces = [
  {
    href: "/project",
    title: "Peta pekerjaan",
    description: "Telusuri paket jalan, anggaran, dan wilayah pekerjaan.",
    Icon: FiMap,
  },
  {
    href: "/penyedia",
    title: "Penyedia & kontrak",
    description: "Lihat penyedia dan nilai kontrak dari sumber pengadaan.",
    Icon: FiBriefcase,
  },
  {
    href: "/laporan",
    title: "Laporkan jalan",
    description: "Catat kerusakan dan tautkan ke paket yang relevan.",
    Icon: FiFileText,
  },
];

export function DashboardTabs({ account }: { account: DashboardAccount }) {
  const router = useRouter();
  const [name, setName] = useState(account.name);
  const [email, setEmail] = useState(account.email);
  const [editingField, setEditingField] = useState<"name" | "email" | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const hasProfileChanges = name.trim() !== account.name || email.trim().toLowerCase() !== account.email.toLowerCase();

  function resetProfile() {
    setName(account.name);
    setEmail(account.email);
    setEditingField(null);
    setProfileError("");
    setProfileStatus("");
  }

  function cancelFieldEdit(field: "name" | "email") {
    if (field === "name") setName(account.name);
    if (field === "email") setEmail(account.email);
    setEditingField(null);
    setProfileError("");
    setProfileStatus("");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasProfileChanges || isSavingProfile) return;

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedName || normalizedName.length > 100) {
      setProfileError("Nama harus diisi dan maksimal 100 karakter.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setProfileError("Masukkan alamat email yang valid.");
      return;
    }

    setIsSavingProfile(true);
    setProfileError("");
    setProfileStatus("");
    try {
      const emailChanged = normalizedEmail !== account.email.toLowerCase();
      if (emailChanged) {
        const emailResult = await authClient.changeEmail({ newEmail: normalizedEmail, callbackURL: "/dashboard" });
        if (emailResult.error) {
          setProfileError("Email belum diubah. Perubahan email memerlukan layanan verifikasi alamat baru.");
          return;
        }
        setProfileStatus("Permintaan perubahan email dibuat. Periksa kotak masuk alamat baru untuk verifikasi.");
        setEmail(account.email);
      }

      if (normalizedName !== account.name) {
        const nameResult = await authClient.updateUser({ name: normalizedName });
        if (nameResult.error) {
          setProfileError("Nama belum dapat disimpan. Coba lagi.");
          return;
        }
      }

      setEditingField(null);
      router.refresh();
    } catch {
      setProfileError("Tidak dapat menyimpan perubahan akun. Coba lagi.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function signOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setSignOutError("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setSignOutError("Tidak dapat keluar. Coba lagi.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setSignOutError("Tidak dapat terhubung ke layanan akun. Coba lagi.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <Tabs defaultValue="workspace" orientation="horizontal" className="min-w-0">
      <TabsList aria-label="Bagian dashboard" className="flex h-auto w-full justify-start gap-2 overflow-x-auto border-b border-border bg-transparent p-0">
          <TabsTrigger value="workspace" className="h-12 shrink-0 rounded-none border-b-[3px] border-transparent bg-transparent px-4 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground data-[active]:border-secondary data-[active]:bg-transparent data-[active]:text-primary">
            Telusuri
          </TabsTrigger>
          <TabsTrigger value="reports" className="h-12 shrink-0 rounded-none border-b-[3px] border-transparent bg-transparent px-4 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground data-[active]:border-secondary data-[active]:bg-transparent data-[active]:text-primary">
            Laporan Saya
          </TabsTrigger>
          <TabsTrigger value="account" className="h-12 shrink-0 rounded-none border-b-[3px] border-transparent bg-transparent px-4 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground data-[active]:border-secondary data-[active]:bg-transparent data-[active]:text-primary">
            Akun Saya
          </TabsTrigger>
      </TabsList>

      <div className="mt-6 grid min-h-[440px] min-w-0 gap-6 lg:grid-cols-[minmax(270px,0.72fr)_minmax(0,1.8fr)] lg:gap-8">
        <div className="min-w-0 self-start">
          <aside aria-label="Informasi akun" className="flex min-h-[220px] h-fit flex-col bg-primary p-5 text-white sm:min-h-[250px] sm:p-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-secondary">Akun aktif</p>
            <h2 className="mt-6 font-heading text-2xl leading-tight font-bold tracking-[-0.025em] sm:mt-8 sm:text-[27px]">
              {account.name}
            </h2>
            <p className="mt-2 break-all text-sm leading-5 text-white/80">{account.email}</p>
          </aside>
          <div className="mt-3 flex min-h-12 items-center justify-between gap-3 bg-muted/55 px-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Aksi cepat</span>
            <button
              type="button"
              onClick={signOut}
              disabled={isSigningOut}
              aria-label={isSigningOut ? "Sedang keluar dari akun" : "Keluar dari akun"}
              title={isSigningOut ? "Sedang keluar dari akun" : "Keluar dari akun"}
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-primary/25 bg-white text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
            >
              <FiLogOut aria-hidden="true" className="size-3.5" />
            </button>
          </div>
          {signOutError && <p role="alert" className="mt-2 text-sm text-destructive">{signOutError}</p>}
        </div>

      <section className="min-w-0 lg:pt-1">
        <TabsContent value="workspace" className="m-0">
          <h2 className="font-heading text-xl font-bold tracking-[-0.02em] sm:text-2xl">Telusuri</h2>
          <div className="mt-4 border-t border-border">
            {workspaces.map(({ href, title, description, Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex min-h-[88px] items-center gap-4 border-b border-border py-4 text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary sm:gap-6 sm:px-3"
              >
                <Icon aria-hidden="true" className="size-5 shrink-0 text-primary sm:size-6" />
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-base font-bold leading-6 sm:text-lg">{title}</span>
                  <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span>
                </span>
                <FiArrowUpRight aria-hidden="true" className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="reports" className="m-0">
          <h2 className="font-heading text-xl font-bold tracking-[-0.02em] sm:text-2xl">Laporan Saya</h2>
          <div className="mt-4 flex min-h-[400px] flex-col items-center justify-center border-t border-border px-4 py-12 text-center">
            <span className="flex size-14 items-center justify-center bg-muted text-primary">
              <FiFileText aria-hidden="true" className="size-6" />
            </span>
            <h3 className="mt-5 font-heading text-lg font-bold">Riwayat laporan belum tersedia</h3>
            <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
              Formulir laporan masih berupa prototipe dan belum menyimpan kiriman ke akun atau server.
            </p>
            <Link
              href="/laporan"
              className="mt-6 inline-flex min-h-11 items-center gap-3 bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Buat laporan
              <FiArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="account" className="m-0">
          <h2 className="font-heading text-xl font-bold tracking-[-0.02em] sm:text-2xl">Akun Saya</h2>
          <form onSubmit={saveProfile}>
            <dl className="mt-4 border-t border-border">
              <div className="grid gap-1 border-b border-border py-5 sm:grid-cols-[180px_1fr] sm:gap-6">
                <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Nama</dt>
                <dd className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  {editingField === "name" ? (
                    <>
                      <input
                        autoFocus
                        aria-label="Ubah nama"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={100}
                        className="h-10 min-w-0 flex-1 border border-input bg-white px-3 text-sm font-normal focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                      />
                      <button
                        type="button"
                        onClick={() => cancelFieldEdit("name")}
                        aria-label="Batalkan edit nama"
                        title="Batalkan edit"
                        className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <FiX aria-hidden="true" className="size-4" />
                      </button>
                    </>
                  ) : <span className="min-w-0 flex-1 break-words">{name}</span>}
                  {editingField !== "name" && (
                    <button
                      type="button"
                      onClick={() => { setEditingField("name"); setProfileError(""); setProfileStatus(""); }}
                      aria-label="Edit nama"
                      title="Edit nama"
                      className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center text-primary transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <FiEdit2 aria-hidden="true" className="size-4" />
                    </button>
                  )}
                </dd>
              </div>
              <div className="grid gap-1 border-b border-border py-5 sm:grid-cols-[180px_1fr] sm:gap-6">
                <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Email</dt>
                <dd className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  {editingField === "email" ? (
                    <>
                      <input
                        autoFocus
                        aria-label="Ubah email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="h-10 min-w-0 flex-1 border border-input bg-white px-3 text-sm font-normal focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                      />
                      <button
                        type="button"
                        onClick={() => cancelFieldEdit("email")}
                        aria-label="Batalkan edit email"
                        title="Batalkan edit"
                        className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <FiX aria-hidden="true" className="size-4" />
                      </button>
                    </>
                  ) : <span className="min-w-0 flex-1 break-all">{email}</span>}
                  {editingField !== "email" && (
                    <button
                      type="button"
                      onClick={() => { setEditingField("email"); setProfileError(""); setProfileStatus(""); }}
                      aria-label="Edit email"
                      title="Edit email"
                      className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center text-primary transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <FiEdit2 aria-hidden="true" className="size-4" />
                    </button>
                  )}
                </dd>
              </div>
            <div className="grid gap-1 border-b border-border py-5 sm:grid-cols-[180px_1fr] sm:gap-6">
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Terdaftar</dt>
              <dd className="text-sm font-semibold">{account.createdAtLabel}</dd>
            </div>
            </dl>
            {(profileError || profileStatus) && (
              <p role={profileError ? "alert" : "status"} className={`mt-3 text-sm leading-5 ${profileError ? "text-destructive" : "text-muted-foreground"}`}>
                {profileError || profileStatus}
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={resetProfile}
                disabled={!hasProfileChanges || isSavingProfile}
                className="min-h-11 cursor-pointer border border-border px-4 text-sm font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45"
              >
                Atur ulang
              </button>
              <button
                type="submit"
                disabled={!hasProfileChanges || isSavingProfile}
                className="min-h-11 cursor-pointer bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isSavingProfile ? "Menyimpan…" : "Simpan perubahan"}
              </button>
            </div>
          </form>
          <div className="mt-7">
            <h3 className="font-heading text-base font-bold">Akses aktif</h3>
            {account.accessBundles.length > 0 ? (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {account.accessBundles.map((bundle) => (
                  <li key={bundle.code} className="bg-muted/55 px-4 py-3.5">
                    <p className="text-sm font-bold leading-5">{bundle.name}</p>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{bundle.description}</p>
                    {bundle.expiresAtLabel && <p className="mt-2 text-[11px] font-semibold text-primary">Berlaku hingga {bundle.expiresAtLabel}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Belum ada paket akses aktif.</p>
            )}
          </div>
        </TabsContent>
      </section>
      </div>
    </Tabs>
  );
}
