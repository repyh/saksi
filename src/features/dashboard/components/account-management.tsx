"use client";

import { Fragment, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { FiCheck, FiCopy, FiEdit2, FiEye, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiUserX, FiX } from "react-icons/fi";
import { accountListResponseSchema, type AccountListItem } from "@/contracts/access/account-list.contract";
import type { ApiResult } from "@/contracts/shared/api.contract";

type InviteResult = { id: string; email: string; expiresAt: string; inviteUrl: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

function IconButton({ label, children, onClick, disabled = false, tone = "default" }: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex size-9 cursor-pointer items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 ${tone === "danger" ? "border-red-200 text-red-700 hover:bg-red-50" : "border-border text-primary hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}

export function AccountManagement({ canInvite, canEdit }: { canInvite: boolean; canEdit: boolean }) {
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteReason, setInviteReason] = useState("");
  const [inviteDays, setInviteDays] = useState(7);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/access/accounts", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }).then(async (response) => {
        const result = await response.json() as ApiResult<unknown>;
        if (!response.ok || result.error) throw new Error(result.error?.message ?? "Daftar akun belum dapat dimuat.");
        const parsed = accountListResponseSchema.safeParse(result.data);
        if (!parsed.success) throw new Error("Format daftar akun tidak dikenali.");
        setAccounts(parsed.data.accounts);
        setError("");
      }).catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Daftar akun belum dapat dimuat.");
      }).finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey]);

  function refreshAccounts() {
    setIsLoading(true);
    setError("");
    setRefreshKey((value) => value + 1);
  }

  const visibleAccounts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("id-ID");
    if (!normalized) return accounts;
    return accounts.filter((account) => `${account.name} ${account.email} ${account.accessBundles.map((bundle) => bundle.name).join(" ")}`.toLocaleLowerCase("id-ID").includes(normalized));
  }, [accounts, query]);

  function openInvite() {
    setInviteEmail("");
    setInviteReason("");
    setInviteDays(7);
    setInviteError("");
    setInviteResult(null);
    setCopied(false);
    setInviteOpen(true);
  }

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreatingInvite) return;
    setIsCreatingInvite(true);
    setInviteError("");
    try {
      const response = await fetch("/api/access/invites", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), expiresInDays: inviteDays, reason: inviteReason.trim() }),
      });
      const result = await response.json() as ApiResult<unknown>;
      if (!response.ok || result.error) throw new Error(result.error?.message ?? "Undangan belum dapat dibuat.");
      const invite = result.data as InviteResult;
      if (!invite?.inviteUrl || !invite.email || !invite.expiresAt) throw new Error("Tanggapan undangan tidak dikenali.");
      setInviteResult(invite);
    } catch (cause) {
      setInviteError(cause instanceof Error ? cause.message : "Undangan belum dapat dibuat.");
    } finally {
      setIsCreatingInvite(false);
    }
  }

  async function copyInvite() {
    if (!inviteResult) return;
    try {
      await navigator.clipboard.writeText(inviteResult.inviteUrl);
      setCopied(true);
    } catch {
      setInviteError("Tautan tidak dapat disalin. Salin tautan secara manual.");
    }
  }

  function beginEdit(account: AccountListItem) {
    setNotice("");
    setEditingId((current) => current === account.id ? null : account.id);
    setEditName(account.name);
  }

  async function saveName(account: AccountListItem) {
    if (!canEdit || !editName.trim() || editName.trim() === account.name || isSaving) return;
    setIsSaving(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch(`/api/access/accounts/${encodeURIComponent(account.id)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const result = await response.json() as ApiResult<{ id: string; name: string }>;
      if (!response.ok || result.error) throw new Error(result.error?.message ?? "Nama akun belum dapat diperbarui.");
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, name: result.data.name } : item));
      setEditingId(null);
      setNotice("Nama akun berhasil diperbarui.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nama akun belum dapat diperbarui.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-white p-3 sm:px-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {canInvite && (
            <button type="button" onClick={openInvite} className="inline-flex h-10 cursor-pointer items-center gap-2 bg-primary px-4 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <FiPlus aria-hidden="true" className="size-4" /> Undang akun
            </button>
          )}
          <label className="relative min-w-[210px] flex-1 sm:max-w-sm">
            <FiSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau email" aria-label="Cari akun" className="h-10 w-full border border-input bg-white pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20" />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{isLoading ? "Memuat akun…" : `${visibleAccounts.length} dari ${accounts.length} akun`}</span>
          <IconButton label="Muat ulang daftar akun" onClick={refreshAccounts} disabled={isLoading}>
            <FiRefreshCw aria-hidden="true" className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          </IconButton>
        </div>
      </div>

      {(error || notice) && <p role={error ? "alert" : "status"} className={`mt-3 px-4 py-3 text-sm ${error ? "bg-red-50 text-red-900" : "bg-muted/60 text-foreground"}`}>{error || notice}</p>}

      <div className="mt-3 overflow-x-auto border border-border">
        <table className="w-full min-w-[780px] border-collapse text-left text-sm">
          <thead className="bg-muted/45 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">Akun</th>
              <th scope="col" className="px-4 py-3">Email</th>
              <th scope="col" className="px-4 py-3">Verifikasi</th>
              <th scope="col" className="px-4 py-3">Paket izin</th>
              <th scope="col" className="px-4 py-3">Terdaftar</th>
              <th scope="col" className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && accounts.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">Memuat daftar akun…</td></tr>
            ) : visibleAccounts.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">{accounts.length ? "Tidak ada akun yang cocok dengan pencarian." : "Belum ada akun untuk ditampilkan."}</td></tr>
            ) : visibleAccounts.map((account) => (
              <Fragment key={account.id}>
                <tr className="border-t border-border bg-white align-middle transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3.5 font-semibold">{account.name}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{account.email}</td>
                  <td className="px-4 py-3.5"><span className={`inline-flex items-center gap-1.5 text-xs ${account.emailVerified ? "text-emerald-800" : "text-amber-800"}`}><span className={`size-1.5 rounded-full ${account.emailVerified ? "bg-emerald-600" : "bg-amber-500"}`} />{account.emailVerified ? "Terverifikasi" : "Belum terverifikasi"}</span></td>
                  <td className="px-4 py-3.5 text-muted-foreground">{account.accessBundles.length ? account.accessBundles.map((bundle) => bundle.name).join(", ") : "Tidak ada"}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">{formatDate(account.createdAt)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-end gap-1.5">
                      <IconButton label={editingId === account.id ? "Tutup detail akun" : canEdit ? "Lihat atau edit akun" : "Lihat akun"} onClick={() => beginEdit(account)}>
                        {editingId === account.id ? <FiX aria-hidden="true" className="size-4" /> : canEdit ? <FiEdit2 aria-hidden="true" className="size-4" /> : <FiEye aria-hidden="true" className="size-4" />}
                      </IconButton>
                      <IconButton label="Nonaktifkan akun (mockup)" tone="danger" onClick={() => setNotice("Mockup: akun tidak dinonaktifkan dan sesi tidak dicabut.")}>
                        <FiUserX aria-hidden="true" className="size-4" />
                      </IconButton>
                      <IconButton label="Hapus akun (mockup)" tone="danger" onClick={() => setNotice("Mockup: akun dan riwayatnya tidak dihapus.")}>
                        <FiTrash2 aria-hidden="true" className="size-4" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
                {editingId === account.id && (
                  <tr className="border-t border-border bg-muted/25">
                    <td colSpan={6} className="px-4 py-4 sm:px-5">
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.75fr)] md:items-end">
                        <div>
                          <label htmlFor={canEdit ? `account-name-${account.id}` : undefined} className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Nama tampilan</label>
                          {canEdit ? <input id={`account-name-${account.id}`} value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={100} className="h-10 w-full border border-input bg-white px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20" /> : <p className="flex h-10 items-center border border-border bg-white px-3 text-sm">{account.name}</p>}
                          <p className="mt-1.5 text-xs text-muted-foreground">Email: {account.email} · Perubahan email memerlukan verifikasi.</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <span className="mr-auto text-xs text-muted-foreground">ID {account.id}</span>
                          {canEdit && <button type="button" onClick={() => void saveName(account)} disabled={isSaving || !editName.trim() || editName.trim() === account.name} className="h-10 cursor-pointer bg-primary px-4 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45">{isSaving ? "Menyimpan…" : "Simpan nama"}</button>}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Aksi nonaktifkan dan hapus hanya tampilan mockup. Akun, izin, dan sesi tidak berubah.</p>

      {inviteOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setInviteOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="invite-title" className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto border border-border bg-white p-5 shadow-xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Akses terbatas</p><h3 id="invite-title" className="mt-2 font-heading text-xl font-bold">Undang akun</h3><p className="mt-1 text-sm text-muted-foreground">Buat tautan pendaftaran satu kali untuk anggota tim.</p></div>
              <IconButton label="Tutup dialog undangan" onClick={() => setInviteOpen(false)}><FiX aria-hidden="true" className="size-4" /></IconButton>
            </div>
            {inviteResult ? (
              <div className="mt-6">
                <div className="bg-emerald-50 px-4 py-3 text-sm text-emerald-950"><p className="font-bold">Undangan dibuat untuk {inviteResult.email}</p><p className="mt-1">Berlaku hingga {formatDate(inviteResult.expiresAt)}.</p></div>
                <label htmlFor="invite-url" className="mt-4 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Tautan pendaftaran</label>
                <div className="mt-1.5 flex gap-2"><input id="invite-url" readOnly value={inviteResult.inviteUrl} className="h-10 min-w-0 flex-1 border border-input bg-muted/30 px-3 text-xs" /><button type="button" onClick={() => void copyInvite()} className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90">{copied ? <FiCheck aria-hidden="true" className="size-4" /> : <FiCopy aria-hidden="true" className="size-4" />}{copied ? "Tersalin" : "Salin"}</button></div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">Bagikan tautan ini secara aman kepada penerima. Tautan hanya dapat digunakan sekali.</p>
                <div className="mt-6 flex justify-end"><button type="button" onClick={() => setInviteOpen(false)} className="h-10 cursor-pointer border border-border px-4 text-xs font-bold hover:bg-muted">Selesai</button></div>
              </div>
            ) : (
              <form onSubmit={(event) => void createInvite(event)} className="mt-6 grid gap-4">
                <label className="grid gap-1.5 text-xs font-bold">Email penerima<input type="email" autoComplete="email" required maxLength={254} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="nama@organisasi.id" className="h-10 border border-input px-3 text-sm font-normal outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20" /></label>
                <label className="grid gap-1.5 text-xs font-bold">Masa berlaku<select value={inviteDays} onChange={(event) => setInviteDays(Number(event.target.value))} className="h-10 cursor-pointer border border-input bg-white px-3 text-sm font-normal"><option value={1}>1 hari</option><option value={7}>7 hari</option><option value={14}>14 hari</option><option value={30}>30 hari</option></select></label>
                <label className="grid gap-1.5 text-xs font-bold">Alasan undangan<textarea required minLength={8} maxLength={500} rows={3} value={inviteReason} onChange={(event) => setInviteReason(event.target.value)} placeholder="Contoh: anggota tim untuk peninjauan laporan" className="resize-y border border-input px-3 py-2 text-sm font-normal outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20" /></label>
                <p className="text-xs leading-5 text-muted-foreground">Undangan hanya mengizinkan pendaftaran dengan email yang dituju. Paket izin diberikan terpisah oleh pengelola.</p>
                {inviteError && <p role="alert" className="bg-red-50 px-3 py-2 text-sm text-red-900">{inviteError}</p>}
                <div className="flex justify-end gap-2 border-t border-border pt-4"><button type="button" onClick={() => setInviteOpen(false)} className="h-10 cursor-pointer border border-border px-4 text-xs font-bold hover:bg-muted">Batal</button><button type="submit" disabled={isCreatingInvite || !inviteEmail.trim() || inviteReason.trim().length < 8} className="h-10 cursor-pointer bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45">{isCreatingInvite ? "Membuat…" : "Buat undangan"}</button></div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
