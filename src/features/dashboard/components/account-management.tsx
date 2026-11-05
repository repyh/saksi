"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { FiCheck, FiCopy, FiEdit2, FiEye, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiUserX, FiX } from "react-icons/fi";
import { accountListResponseSchema, type AccountListItem } from "@/contracts/access/account-list.contract";
import type { ApiResult } from "@/contracts/shared/api.contract";
import { PERMISSION_ASSIGNMENT_POLICY, PERMISSION_CATALOG, PERMISSION_PRESETS } from "@/server/authorization/catalog";
import { AccountEditDialog } from "@/features/dashboard/components/account-edit-dialog";

type InviteResult = { id: string; email: string; expiresAt: string; inviteUrl: string; permissionPresetCode: string | null; permissionCodes: string[] };
type InviteAccessMode = "none" | "preset" | "permissions";

const grantablePermissionCodes = new Set<string>(PERMISSION_ASSIGNMENT_POLICY["access.permissions.assign"]);
const permissionGroups = [
  { label: "Laporan", prefix: "reports." },
  { label: "Analitik", prefix: "analytics." },
  { label: "Akses akun", prefix: "access." },
  { label: "Data", prefix: "sources." },
].map((group) => ({
  ...group,
  permissions: PERMISSION_CATALOG.filter(({ code }) => code.startsWith(group.prefix) && grantablePermissionCodes.has(code)),
}));

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

function permissionSummary(permissionCodes: string[]) {
  const codes = new Set(permissionCodes);
  const matchingPresets = PERMISSION_PRESETS.filter((preset) =>
    preset.permissions.length === codes.size && preset.permissions.every((code) => codes.has(code)),
  );
  if (matchingPresets.length > 0) return matchingPresets.map(({ name }) => name).join(", ");
  return codes.size ? `${codes.size} izin aktif` : "Tidak ada";
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

export function AccountManagement({ canInvite, canEdit, canApplyPresets, canAssignPermissions }: { canInvite: boolean; canEdit: boolean; canApplyPresets: boolean; canAssignPermissions: boolean }) {
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<AccountListItem | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteReason, setInviteReason] = useState("");
  const [inviteDays, setInviteDays] = useState(7);
  const [invitePermissionPreset, setInvitePermissionPreset] = useState("");
  const [inviteAccessMode, setInviteAccessMode] = useState<InviteAccessMode>("none");
  const [invitePermissionCodes, setInvitePermissionCodes] = useState<string[]>([]);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  const refreshAccounts = useCallback(() => {
    setIsLoading(true);
    setError("");
    setRefreshKey((value) => value + 1);
  }, []);

  const updateAccountName = useCallback((accountId: string, name: string) => {
    setAccounts((current) => current.map((account) => account.id === accountId ? { ...account, name } : account));
    setSelectedAccount((current) => current?.id === accountId ? { ...current, name } : current);
  }, []);

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

  const visibleAccounts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("id-ID");
    if (!normalized) return accounts;
    return accounts.filter((account) => `${account.name} ${account.email} ${permissionSummary(account.permissionCodes)} ${account.permissionCodes.join(" ")}`.toLocaleLowerCase("id-ID").includes(normalized));
  }, [accounts, query]);

  function openInvite() {
    setInviteEmail("");
    setInviteReason("");
    setInviteDays(7);
    setInvitePermissionPreset("");
    setInviteAccessMode("none");
    setInvitePermissionCodes([]);
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
        body: JSON.stringify({
          email: inviteEmail.trim(),
          expiresInDays: inviteDays,
          reason: inviteReason.trim(),
          permissionPresetCode: canApplyPresets && (!canAssignPermissions || inviteAccessMode === "preset") ? invitePermissionPreset || null : null,
          permissionCodes: canAssignPermissions && (!canApplyPresets || inviteAccessMode === "permissions") ? invitePermissionCodes : [],
        }),
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
              <th scope="col" className="px-4 py-3">Hak akses</th>
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
                <tr key={account.id} className="border-t border-border bg-white align-middle transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3.5 font-semibold">{account.name}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{account.email}</td>
                  <td className="px-4 py-3.5"><span className={`inline-flex items-center gap-1.5 text-xs ${account.emailVerified ? "text-emerald-800" : "text-amber-800"}`}><span className={`size-1.5 rounded-full ${account.emailVerified ? "bg-emerald-600" : "bg-amber-500"}`} />{account.emailVerified ? "Terverifikasi" : "Belum terverifikasi"}</span></td>
                  <td className="px-4 py-3.5 text-muted-foreground" title={account.permissionCodes.join(", ")}>{permissionSummary(account.permissionCodes)}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">{formatDate(account.createdAt)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-end gap-1.5">
                      <IconButton label={canEdit || canAssignPermissions ? "Lihat atau edit akun" : "Lihat akun"} onClick={() => { setNotice(""); setSelectedAccount(account); }}>
                        {canEdit || canAssignPermissions ? <FiEdit2 aria-hidden="true" className="size-4" /> : <FiEye aria-hidden="true" className="size-4" />}
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
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Aksi nonaktifkan dan hapus hanya tampilan mockup. Akun, izin, dan sesi tidak berubah.</p>

      {selectedAccount && (
        <AccountEditDialog
          account={selectedAccount}
          canEdit={canEdit}
          canAssignPermissions={canAssignPermissions}
          onClose={() => setSelectedAccount(null)}
          onAccountUpdated={updateAccountName}
          onAccessUpdated={refreshAccounts}
        />
      )}

      {inviteOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setInviteOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="invite-title" className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto border border-border bg-white p-5 shadow-xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><h3 id="invite-title" className="font-heading text-xl font-bold">Undang akun</h3><p className="mt-1 text-sm text-muted-foreground">Buat tautan pendaftaran satu kali untuk anggota tim.</p></div>
              <IconButton label="Tutup dialog undangan" onClick={() => setInviteOpen(false)}><FiX aria-hidden="true" className="size-4" /></IconButton>
            </div>
            {inviteResult ? (
              <div className="mt-6">
                <div className="bg-emerald-50 px-4 py-3 text-sm text-emerald-950"><p className="font-bold">Undangan dibuat untuk {inviteResult.email}</p><p className="mt-1">Berlaku hingga {formatDate(inviteResult.expiresAt)}.{inviteResult.permissionCodes.length ? ` ${inviteResult.permissionCodes.length} izin individual akan diberikan saat pendaftaran selesai${inviteResult.permissionPresetCode ? ` dari preset ${inviteResult.permissionPresetCode}` : ""}.` : " Akun tidak menerima izin otomatis."}</p></div>
                <label htmlFor="invite-url" className="mt-4 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Tautan pendaftaran</label>
                <div className="mt-1.5 flex gap-2"><input id="invite-url" readOnly value={inviteResult.inviteUrl} className="h-10 min-w-0 flex-1 border border-input bg-muted/30 px-3 text-xs" /><button type="button" onClick={() => void copyInvite()} className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90">{copied ? <FiCheck aria-hidden="true" className="size-4" /> : <FiCopy aria-hidden="true" className="size-4" />}{copied ? "Tersalin" : "Salin"}</button></div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">Bagikan tautan ini secara aman kepada penerima. Tautan hanya dapat digunakan sekali.</p>
                <div className="mt-6 flex justify-end"><button type="button" onClick={() => setInviteOpen(false)} className="h-10 cursor-pointer border border-border px-4 text-xs font-bold hover:bg-muted">Selesai</button></div>
              </div>
            ) : (
              <form onSubmit={(event) => void createInvite(event)} className="mt-6 grid gap-4">
                <label className="grid gap-1.5 text-xs font-bold">Email penerima<input type="email" autoComplete="email" required maxLength={254} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="nama@organisasi.id" className="h-10 border border-input px-3 text-sm font-normal outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20" /></label>
                <label className="grid gap-1.5 text-xs font-bold">Masa berlaku<select value={inviteDays} onChange={(event) => setInviteDays(Number(event.target.value))} className="h-10 cursor-pointer border border-input bg-white px-3 text-sm font-normal"><option value={1}>1 hari</option><option value={7}>7 hari</option><option value={14}>14 hari</option><option value={30}>30 hari</option></select></label>
                {(canApplyPresets || canAssignPermissions) && (
                  <fieldset className="grid gap-2">
                    <legend className="mb-1 text-xs font-bold">Akses awal</legend>
                    {canApplyPresets && canAssignPermissions && (
                      <div className="flex flex-wrap gap-1 border-b border-border pb-2" role="group" aria-label="Pilih cara menetapkan izin">
                        {([
                          ["none", "Tanpa akses"],
                          ["preset", "Paket izin"],
                          ["permissions", "Izin per fitur"],
                        ] as const).map(([mode, label]) => (
                          <button key={mode} type="button" aria-pressed={inviteAccessMode === mode} onClick={() => setInviteAccessMode(mode)} className={`min-h-8 cursor-pointer px-3 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${inviteAccessMode === mode ? "bg-primary text-primary-foreground" : "bg-muted/50 text-foreground hover:bg-muted"}`}>{label}</button>
                        ))}
                      </div>
                    )}
                    {canApplyPresets && (!canAssignPermissions || inviteAccessMode === "preset") && (
                      <label className="grid gap-1.5 text-xs font-bold">Paket izin<select value={invitePermissionPreset} onChange={(event) => { setInvitePermissionPreset(event.target.value); setInviteAccessMode(event.target.value ? "preset" : "none"); }} className="h-10 cursor-pointer border border-input bg-white px-3 text-sm font-normal"><option value="">Tanpa paket izin</option><option value="analyst">Analyst · akses analitik</option><option value="moderator">Moderator · tinjau laporan</option><option value="admin">Admin · seluruh izin</option></select></label>
                    )}
                    {canAssignPermissions && (!canApplyPresets || inviteAccessMode === "permissions") && (
                      <div className="max-h-56 overflow-y-auto border border-border bg-white p-3">
                        <p className="mb-3 text-xs leading-5 text-muted-foreground">Pilih izin yang diperlukan. Hak untuk menetapkan izin dan paket tidak dapat diberikan satu per satu.</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {permissionGroups.filter(({ permissions }) => permissions.length > 0).map((group) => (
                            <fieldset key={group.prefix} className="min-w-0">
                              <legend className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{group.label}</legend>
                              <div className="grid gap-1.5">
                                {group.permissions.map(({ code, description }) => (
                                  <label key={code} className="flex cursor-pointer items-start gap-2 py-0.5 text-xs leading-4">
                                    <input type="checkbox" checked={invitePermissionCodes.includes(code)} onChange={(event) => setInvitePermissionCodes((current) => event.target.checked ? [...current, code] : current.filter((item) => item !== code))} className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-primary" />
                                    <span className="min-w-0"><span className="block font-semibold">{code}</span><span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">{description}</span></span>
                                  </label>
                                ))}
                              </div>
                            </fieldset>
                          ))}
                        </div>
                      </div>
                    )}
                  </fieldset>
                )}
                {!canApplyPresets && !canAssignPermissions && <div className="bg-muted/45 px-3 py-2.5 text-xs leading-5 text-muted-foreground">Penerima tidak mendapat akses otomatis. Paket atau izin hanya dapat ditetapkan oleh pengelola yang memiliki kewenangan.</div>}
                <label className="grid gap-1.5 text-xs font-bold">Alasan undangan<textarea required minLength={8} maxLength={500} rows={3} value={inviteReason} onChange={(event) => setInviteReason(event.target.value)} placeholder="Contoh: anggota tim untuk peninjauan laporan" className="resize-none border border-input px-3 py-2 text-sm font-normal outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20" /></label>
                <p className="text-xs leading-5 text-muted-foreground">Tautan terikat pada email penerima dan hanya dapat digunakan satu kali. Akses terpilih baru aktif setelah pendaftaran berhasil.</p>
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
