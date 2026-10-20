"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, UserCheck, UserX, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import api from "@/lib/api";
import { useRowSelection } from "@/lib/use-row-selection";
import { useAuthStore } from "@/store/auth";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { RoleScopePanel } from "@/components/users/role-scope-panel";

interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  nip?: string;
  phone?: string;
  status: "ACTIVE" | "INACTIVE";
  role?: { code: string; name: string };
  balai?: { id: number; name: string };
  satker?: { id: string; kode: string; name: string };
  createdAt: string;
}

// Radix Select tidak menerima value "" — opsi "Semua …" memakai penanda ini.
const SEMUA = "__semua";
// centang | avatar | nama | role | unit kerja | status | aksi
const KOLOM =
  "grid grid-cols-[1.5rem_2rem_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_6.5rem_7rem] items-center gap-3 px-4";
const inisial = (nama: string) =>
  nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((k) => k[0]!.toUpperCase())
    .join("");
/** Tingkat akun: satker > balai > pusat (lihat User.balaiId/satkerId). */
const unitKerja = (u: User) =>
  u.satker ? `Satker ${u.satker.name}` : u.balai ? `Balai · ${u.balai.name}` : "Pusat";

export default function UsersPage() {
  return (
    <Suspense>
      <UsersPageInner />
    </Suspense>
  );
}

function UsersPageInner() {
  const { user: currentUser } = useAuthStore();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  // Deep-link dari Log Aktivitas (`/users?q=...`) — isi kotak pencarian
  // langsung dengan username/nama record yang mau dicari.
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get<User[]>("/users");
      setUsers(res.data);
    } catch {
      toast.error("Gagal memuat data pengguna");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const daftarRole = [...new Map(users.filter((u) => u.role).map((u) => [u.role!.code, u.role!.name])).entries()].sort(
    (a, b) => a[1].localeCompare(b[1], "id"),
  );
  const q = search.toLowerCase();
  const filtered = users.filter(
    (u) =>
      (!filterRole || u.role?.code === filterRole) &&
      (!filterStatus || u.status === filterStatus) &&
      (u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        !!u.role?.name.toLowerCase().includes(q)),
  );

  // id akun sendiri tidak bisa dihapus — dikeluarkan dari "pilih semua".
  const selectableIds = filtered
    .filter((u) => u.id !== currentUser?.id)
    .map((u) => u.id);
  const sel = useRowSelection(selectableIds);

  useEffect(() => {
    sel.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterRole, filterStatus, users]);

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const res = await api.post("/users/bulk-delete", {
        ids: Array.from(sel.selected),
      });
      toast.success(res.data?.message || "Pengguna terpilih berhasil dihapus");
      sel.clear();
      setBulkOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const newStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await api.patch(`/users/${user.id}/status`, { status: newStatus });
      toast.success(
        `User berhasil ${newStatus === "ACTIVE" ? "diaktifkan" : "dinonaktifkan"}`,
      );
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengubah status");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteId}`);
      toast.success("User berhasil dihapus");
      setDeleteId(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus user");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pengguna</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {users.length} pengguna terdaftar
          </p>
        </div>
        <Button
          onClick={() => {
            setEditData(null);
            setShowForm(true);
          }}
        >
          <Plus size={16} className="mr-2" />
          Tambah pengguna
        </Button>
      </div>

      <RoleScopePanel />

      {/* Cari + filter role & status + aksi massal (hi-fi HfPengguna) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Cari nama, username, atau role…"
            aria-label="Cari pengguna"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <Select value={filterRole || SEMUA} onValueChange={(v) => setFilterRole(v === SEMUA ? "" : v)}>
          <SelectTrigger aria-label="Role" className="h-9 w-44 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEMUA}>Semua role</SelectItem>
            {daftarRole.map(([kode, nama]) => (
              <SelectItem key={kode} value={kode}>
                {nama}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus || SEMUA} onValueChange={(v) => setFilterStatus(v === SEMUA ? "" : v)}>
          <SelectTrigger aria-label="Status" className="h-9 w-36 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEMUA}>Semua status</SelectItem>
            <SelectItem value="ACTIVE">Aktif</SelectItem>
            <SelectItem value="INACTIVE">Nonaktif</SelectItem>
          </SelectContent>
        </Select>
        {sel.selected.size > 0 && (
          <Button variant="destructive" size="sm" className="ml-auto" onClick={() => setBulkOpen(true)}>
            <Trash2 size={14} className="mr-1.5" />
            Hapus ({sel.selected.size})
          </Button>
        )}
      </div>

      {/* Tabel pengguna */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <div className="min-w-[46rem]">
          <div className={cn(KOLOM, "border-b py-2.5 text-[13px] font-semibold text-muted-foreground")}>
            <span>
              {selectableIds.length > 0 && (
                <input
                  type="checkbox"
                  aria-label="Pilih semua pengguna"
                  checked={sel.allSelected}
                  onChange={sel.toggleAll}
                  className="h-4 w-4 rounded border-muted-foreground/40"
                />
              )}
            </span>
            <span />
            <span>Nama</span>
            <span>Role</span>
            <span>Unit kerja</span>
            <span>Status</span>
            <span />
          </div>
          {loading ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="border-b px-4 py-4 last:border-b-0">
                <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Tidak ada pengguna yang cocok. Ubah pencarian atau filter.
            </p>
          ) : (
            filtered.map((u) => {
              const bisaPilih = u.id !== currentUser?.id;
              const idx = selectableIds.indexOf(u.id);
              const aktif = u.status === "ACTIVE";
              return (
                <div key={u.id} className={cn(KOLOM, "border-b py-3 text-sm last:border-b-0 hover:bg-accent/40")}>
                  <span>
                    <input
                      type="checkbox"
                      aria-label={`Pilih ${u.name}`}
                      className="h-4 w-4 rounded border-muted-foreground/40 disabled:opacity-0"
                      checked={sel.selected.has(u.id)}
                      disabled={!bisaPilih}
                      onMouseDown={(e) => {
                        sel.shiftRef.current = e.shiftKey;
                      }}
                      onChange={() => sel.toggleOne(u.id, idx, sel.shiftRef.current)}
                    />
                  </span>
                  <span
                    aria-hidden
                    className="grid h-8 w-8 place-items-center rounded-full bg-tier-1 text-[12.5px] font-semibold"
                  >
                    {inisial(u.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{u.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">@{u.username}</span>
                  </span>
                  <span className="truncate">{u.role?.name ?? "—"}</span>
                  <span className="text-[13px] text-muted-foreground">{unitKerja(u)}</span>
                  <span>
                    <Badge variant="dot" dotColor={aktif ? "emerald" : "slate"}>
                      {aktif ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </span>
                  <span className="flex justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Edit ${u.name}`}
                      title="Edit"
                      onClick={() => {
                        setEditData(u);
                        setShowForm(true);
                      }}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={aktif ? `Nonaktifkan ${u.name}` : `Aktifkan ${u.name}`}
                      title={aktif ? "Nonaktifkan" : "Aktifkan"}
                      onClick={() => handleToggleStatus(u)}
                      disabled={!bisaPilih}
                    >
                      {aktif ? <UserX size={14} /> : <UserCheck size={14} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Hapus ${u.name}`}
                      title="Hapus"
                      onClick={() => setDeleteId(u.id)}
                      disabled={!bisaPilih}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Form Dialog */}
      <UserFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          setShowForm(false);
          fetchUsers();
        }}
        editData={editData}
      />

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pengguna?</AlertDialogTitle>
            <AlertDialogDescription>
              Pengguna yang dihapus tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirm */}
      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Hapus {sel.selected.size} pengguna?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sel.selected.size} pengguna terpilih akan dihapus permanen dan
              tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {bulkDeleting
                ? "Menghapus..."
                : `Hapus ${sel.selected.size} pengguna`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
