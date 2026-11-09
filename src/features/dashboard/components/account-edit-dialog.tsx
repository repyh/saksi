"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { FiCheck, FiPlus, FiShield, FiTrash2, FiX } from "react-icons/fi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { accountPermissionGrantsResponseSchema, type AccountPermissionGrant } from "@/contracts/access/account-permissions.contract";
import type { AccountListItem } from "@/contracts/access/account-list.contract";
import type { ApiResult } from "@/contracts/shared/api.contract";
import { PERMISSION_ASSIGNMENT_POLICY, PERMISSION_CATALOG } from "@/server/authorization/catalog";

const assignableCodes = new Set<string>(PERMISSION_ASSIGNMENT_POLICY["access.permissions.assign"]);
const permissionGroups = [
  { label: "Laporan", prefix: "reports." },
  { label: "Analitik", prefix: "analytics." },
  { label: "Akses akun", prefix: "access." },
  { label: "Data", prefix: "sources." },
].map((group) => ({
  ...group,
  permissions: PERMISSION_CATALOG.filter(({ code }) => code.startsWith(group.prefix) && assignableCodes.has(code)),
}));
const permissionGroupsWithOptions = permissionGroups.filter(({ permissions }) => permissions.length > 0);
const activeCatalogCodes = new Set<string>(PERMISSION_CATALOG.map(({ code }) => code));

function formatDate(value: string | null) {
  if (!value) return "Tidak kedaluwarsa";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

function DialogIconButton({ label, onClick, children, disabled = false, danger = false }: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`inline-flex size-9 cursor-pointer items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45 ${danger ? "border-red-200 text-red-700 hover:bg-red-50" : "border-border text-primary hover:bg-muted"}`}>
      {children}
    </button>
  );
}

export function AccountEditDialog({ account, canEdit, canAssignPermissions, onClose, onAccountUpdated, onAccessUpdated }: {
  account: AccountListItem;
  canEdit: boolean;
  canAssignPermissions: boolean;
  onClose: () => void;
  onAccountUpdated: (accountId: string, name: string) => void;
  onAccessUpdated: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [name, setName] = useState(account.name);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [grants, setGrants] = useState<AccountPermissionGrant[]>([]);
  const [loadedGrantsKey, setLoadedGrantsKey] = useState<string | null>(null);
  const [grantsRefreshKey, setGrantsRefreshKey] = useState(0);
  const [grantError, setGrantError] = useState("");
  const [grantsLoadError, setGrantsLoadError] = useState("");
  const [permissionCodes, setPermissionCodes] = useState<string[]>([]);
  const [permissionReason, setPermissionReason] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [accessMessage, setAccessMessage] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      if (dialog?.open) dialog.close();
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "access") return;
    const controller = new AbortController();
    const requestKey = `${account.id}:${grantsRefreshKey}`;
    void fetch(`/api/access/accounts/${encodeURIComponent(account.id)}/permissions`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    }).then(async (response) => {
      const result = await response.json() as ApiResult<unknown>;
      if (!response.ok || result.error) throw new Error(result.error?.message ?? "Izin akun belum dapat dimuat.");
      const parsed = accountPermissionGrantsResponseSchema.safeParse(result.data);
      if (!parsed.success) throw new Error("Format izin akun tidak dikenali.");
      setGrants(parsed.data.grants);
      setGrantsLoadError("");
    }).catch((cause: unknown) => {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setGrantsLoadError(cause instanceof Error ? cause.message : "Izin akun belum dapat dimuat.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoadedGrantsKey(requestKey);
    });
    return () => controller.abort();
  }, [activeTab, account.id, grantsRefreshKey]);

  const activeCodes = useMemo(() => new Set(grants.map(({ permissionCode }) => permissionCode)), [grants]);
  const hasProfileChanges = name.trim() !== account.name;
  const canChangeAccess = canAssignPermissions && !account.isCurrentUser;
  const isLoadingGrants = activeTab === "access" && loadedGrantsKey !== `${account.id}:${grantsRefreshKey}`;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !hasProfileChanges || isSavingProfile) return;
    setIsSavingProfile(true);
    setProfileError("");
    setProfileMessage("");
    try {
      const response = await fetch(`/api/access/accounts/${encodeURIComponent(account.id)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const result = await response.json() as ApiResult<{ id: string; name: string }>;
      if (!response.ok || result.error) throw new Error(result.error?.message ?? "Nama akun belum dapat diperbarui.");
      onAccountUpdated(account.id, result.data.name);
      setName(result.data.name);
      setProfileMessage("Perubahan profil tersimpan.");
    } catch (cause) {
      setProfileError(cause instanceof Error ? cause.message : "Nama akun belum dapat diperbarui.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function grantSelectedPermissions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canChangeAccess || permissionCodes.length === 0 || permissionReason.trim().length < 8 || isSavingAccess) return;
    setIsSavingAccess(true);
    setGrantError("");
    setAccessMessage("");
    try {
      const grantedCount = permissionCodes.length;
      const expiresAt = expiresInDays
        ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const response = await fetch(`/api/access/accounts/${encodeURIComponent(account.id)}/permissions`, {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ permissionCodes, reason: permissionReason.trim(), expiresAt }),
      });
      const result = await response.json() as ApiResult<unknown>;
      if (!response.ok || result.error) throw new Error(result.error?.message ?? "Izin akun belum dapat diberikan.");
      setPermissionCodes([]);
      setPermissionReason("");
      setExpiresInDays("");
      setAccessMessage(`${grantedCount} izin diberikan.`);
      setGrantsRefreshKey((current) => current + 1);
      onAccessUpdated();
    } catch (cause) {
      setGrantError(cause instanceof Error ? cause.message : "Izin akun belum dapat diberikan.");
    } finally {
      setIsSavingAccess(false);
    }
  }

  async function revokePermission(grant: AccountPermissionGrant) {
    if (!canChangeAccess || revokeReason.trim().length < 8 || isSavingAccess) return;
    setIsSavingAccess(true);
    setGrantError("");
    setAccessMessage("");
    try {
      const response = await fetch(`/api/access/accounts/${encodeURIComponent(account.id)}/permissions/${encodeURIComponent(grant.id)}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ reason: revokeReason.trim() }),
      });
      const result = await response.json() as ApiResult<unknown>;
      if (!response.ok || result.error) throw new Error(result.error?.message ?? "Izin akun belum dapat dicabut.");
      setRevokeReason("");
      setConfirmRevokeId(null);
      setAccessMessage(`${grant.permissionCode} dicabut.`);
      setGrantsRefreshKey((current) => current + 1);
      onAccessUpdated();
    } catch (cause) {
      setGrantError(cause instanceof Error ? cause.message : "Izin akun belum dapat dicabut.");
    } finally {
      setIsSavingAccess(false);
    }
  }

  function closeDialog() {
    if ((hasProfileChanges || permissionCodes.length > 0 || permissionReason.trim() || revokeReason.trim() || confirmRevokeId) && !window.confirm("Tutup tanpa menyimpan perubahan yang belum dikirim?")) return;
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="account-dialog-title"
      onClose={onClose}
      onCancel={(event) => { event.preventDefault(); closeDialog(); }}
      onClick={(event) => { if (event.target === dialogRef.current) closeDialog(); }}
      className="m-auto max-h-[min(90dvh,52rem)] w-[min(100%-2rem,58rem)] max-w-none overflow-hidden border border-border bg-white p-0 text-foreground shadow-xl backdrop:bg-slate-950/55"
    >
      <div className="flex max-h-[min(90dvh,52rem)] flex-col">
        <header className="flex items-start justify-between gap-5 px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <h2 id="account-dialog-title" className="font-heading text-xl font-bold">Kelola akun</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">{account.name} · {account.email}</p>
          </div>
          <DialogIconButton label="Tutup pengelolaan akun" onClick={closeDialog}><FiX aria-hidden="true" className="size-4" /></DialogIconButton>
        </header>

        <Tabs value={activeTab} onValueChange={(value) => value && setActiveTab(value)} className="min-h-0 flex-1">
          <div className="px-5 pt-3 sm:px-7">
            <TabsList className="h-10 gap-1 border-0 bg-transparent p-0">
              <TabsTrigger value="profile" className="px-4">Profil</TabsTrigger>
              <TabsTrigger value="access" className="px-4">Hak akses</TabsTrigger>
            </TabsList>
          </div>
          <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-5 pb-5 pt-3 sm:px-7 sm:pb-6 sm:pt-3">
            <TabsContent value="profile" className="m-0">
              <form onSubmit={(event) => void saveProfile(event)} className="grid gap-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-bold">Nama tampilan
                    <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} readOnly={!canEdit} className="h-11 border border-input bg-white px-3 text-sm font-normal outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 read-only:bg-muted/30" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold">Email
                    <input value={account.email} readOnly className="h-11 border border-input bg-muted/30 px-3 text-sm font-normal text-muted-foreground" />
                  </label>
                </div>
                <div className="grid gap-x-6 gap-y-3 bg-muted/35 px-4 py-3 sm:grid-cols-3">
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Verifikasi email</p><p className="mt-1 text-sm font-semibold">{account.emailVerified ? "Terverifikasi" : "Belum terverifikasi"}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Terdaftar</p><p className="mt-1 text-sm font-semibold">{formatDate(account.createdAt)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">ID akun</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{account.id}</p></div>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">Perubahan email memerlukan proses verifikasi terpisah.</p>
                {(profileError || profileMessage) && <p role={profileError ? "alert" : "status"} className={`text-sm ${profileError ? "text-red-800" : "text-emerald-800"}`}>{profileError || profileMessage}</p>}
                {canEdit && <div className="flex justify-end"><button type="submit" disabled={!hasProfileChanges || !name.trim() || isSavingProfile} className="inline-flex h-10 cursor-pointer items-center gap-2 bg-primary px-4 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45">{isSavingProfile ? "Menyimpan…" : <><FiCheck aria-hidden="true" className="size-4" /> Simpan profil</>}</button></div>}
              </form>
            </TabsContent>

            <TabsContent value="access" className="m-0">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><h3 className="font-heading text-lg font-bold">Izin aktif</h3><p className="mt-1 text-sm text-muted-foreground">{new Set(grants.filter(({ permissionCode }) => activeCatalogCodes.has(permissionCode)).map(({ permissionCode }) => permissionCode)).size} izin · {grants.filter(({ permissionCode }) => activeCatalogCodes.has(permissionCode)).length} pemberian aktif</p></div>
                <p className="text-xs text-muted-foreground">Berlaku umum; batas per paket belum tersedia.</p>
              </div>
              {account.isCurrentUser && <p className="mt-4 bg-muted/50 px-3 py-2.5 text-xs leading-5 text-muted-foreground">Izin akun sendiri tidak dapat diubah dari panel ini.</p>}
              {isLoadingGrants ? <p className="mt-5 text-sm text-muted-foreground">Memuat izin…</p> : grantsLoadError ? <p role="alert" className="mt-5 bg-red-50 px-3 py-2.5 text-sm text-red-900">{grantsLoadError}</p> : (
                <div className="mt-4">
                  {grantError && <p role="alert" className="mb-4 bg-red-50 px-3 py-2.5 text-sm text-red-900">{grantError}</p>}
                  {grants.length > 0 ? (
                    <div className="divide-y divide-border border-y border-border">
                      {grants.map((grant) => (
                        <div key={grant.id} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="text-sm font-bold">{grant.permissionCode}</p>{activeCatalogCodes.has(grant.permissionCode) ? grant.sensitive && <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-amber-800">Sensitif</span> : <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Nonaktif</span>}</div>
                            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{grant.description}</p>
                            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Diberikan oleh {grant.grantedByName} · {formatDate(grant.grantedAt)} · berakhir {formatDate(grant.expiresAt)}{grant.reason ? ` · ${grant.reason}` : ""}</p>
                          </div>
                          {canChangeAccess && confirmRevokeId !== grant.id && <DialogIconButton label={`Cabut ${grant.permissionCode}`} onClick={() => { setGrantError(""); setRevokeReason(""); setConfirmRevokeId(grant.id); }} disabled={isSavingAccess} danger><FiTrash2 aria-hidden="true" className="size-4" /></DialogIconButton>}
                          {canChangeAccess && confirmRevokeId === grant.id && (
                            <div className="col-span-full grid gap-2 rounded-sm bg-red-50/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                              <label className="grid gap-1.5 text-xs font-bold text-red-950">Alasan pencabutan
                                <input value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} minLength={8} maxLength={500} placeholder="Tulis alasan, minimal 8 karakter" className="h-10 border border-red-200 bg-white px-3 text-sm font-normal text-foreground outline-none focus-visible:border-red-700 focus-visible:ring-2 focus-visible:ring-red-700/15" />
                              </label>
                              <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => { setConfirmRevokeId(null); setRevokeReason(""); }} className="h-10 cursor-pointer border border-border bg-white px-3 text-xs font-bold hover:bg-muted">Batal</button>
                                <button type="button" onClick={() => void revokePermission(grant)} disabled={isSavingAccess || revokeReason.trim().length < 8} className="h-10 cursor-pointer bg-red-700 px-4 text-xs font-bold text-white transition-colors hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-45">{isSavingAccess ? "Mencabut…" : "Cabut izin"}</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : <p className="border-y border-border py-4 text-sm text-muted-foreground">Tidak ada izin aktif.</p>}

                  {canChangeAccess && (
                    <form onSubmit={(event) => void grantSelectedPermissions(event)} className="mt-6 grid gap-4">
                      <div className="flex items-center gap-2"><FiPlus aria-hidden="true" className="size-4 text-primary" /><h4 className="font-heading text-base font-bold">Berikan izin</h4></div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {permissionGroupsWithOptions.map((group) => (
                          <fieldset key={group.prefix} className="min-w-0">
                            <legend className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{group.label}</legend>
                            <div className="grid gap-1.5">
                              {group.permissions.map(({ code, description }) => {
                                const alreadyActive = activeCodes.has(code);
                                return (
                                  <label key={code} className={`flex items-start gap-2 py-1 text-xs leading-4 ${alreadyActive ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                                    <input type="checkbox" checked={permissionCodes.includes(code)} disabled={alreadyActive} onChange={(event) => setPermissionCodes((current) => event.target.checked ? [...current, code] : current.filter((item) => item !== code))} className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed" />
                                    <span className="min-w-0"><span className="block font-semibold">{code}{alreadyActive ? " · aktif" : ""}</span><span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">{description}</span></span>
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>
                        ))}
                      </div>
                      <label className="grid gap-1.5 text-xs font-bold">Alasan pemberian izin
                        <textarea value={permissionReason} onChange={(event) => setPermissionReason(event.target.value)} minLength={8} maxLength={500} rows={2} placeholder="Contoh: ditugaskan meninjau laporan wilayah" className="resize-none border border-input px-3 py-2 text-sm font-normal outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20" />
                      </label>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
                          <label className="grid gap-1.5 text-xs font-bold">Masa aktif izin
                            <select value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} className="h-10 w-56 cursor-pointer border border-input bg-white px-3 text-sm font-normal"><option value="">Tanpa kedaluwarsa</option><option value="7">7 hari</option><option value="30">30 hari</option><option value="90">90 hari</option></select>
                          </label>
                          <p className="max-w-56 pb-2 text-[11px] leading-4 text-muted-foreground">Izin baru dicabut otomatis saat durasi berakhir.</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                          <p className="text-xs text-muted-foreground">{permissionCodes.length} izin dipilih</p>
                          <button type="submit" disabled={isSavingAccess || permissionCodes.length === 0 || permissionReason.trim().length < 8} className="inline-flex h-10 cursor-pointer items-center gap-2 bg-red-700 px-4 text-xs font-bold text-white transition-colors hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-45"><FiShield aria-hidden="true" className="size-4" />{isSavingAccess ? "Menyimpan…" : "Berikan izin terpilih"}</button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}
              {accessMessage && <p role="status" className="mt-4 text-sm text-emerald-800">{accessMessage}</p>}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </dialog>
  );
}
