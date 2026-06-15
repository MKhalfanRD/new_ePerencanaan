"use client";

import { useEffect, useState } from "react";
import { Plus, Search, UserCheck, UserX, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { useAuthStore } from "@/store/auth";
import { UserFormDialog } from "@/components/users/user-form-dialog";

interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  nip?: string;
  phone?: string;
  status: "ACTIVE" | "INACTIVE";
  role?: { code: string; name: string };
  balai?: { id: number; name: string; shortName?: string };
  createdAt: string;
}

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.role?.name.toLowerCase().includes(search.toLowerCase()),
  );

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
          Tambah Pengguna
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Cari nama, username, atau role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-border">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/3" />
                      <div className="h-3 bg-muted rounded w-1/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-sm font-medium">
                Tidak ada pengguna ditemukan
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-4 p-4 hover:bg-accent/40 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary font-semibold text-sm">
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <Badge
                        variant={
                          u.status === "ACTIVE" ? "default" : "secondary"
                        }
                        className="text-xs shrink-0"
                      >
                        {u.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        @{u.username}
                      </span>
                      {u.role && (
                        <span className="text-xs text-muted-foreground">
                          · {u.role.name}
                        </span>
                      )}
                      {u.balai && (
                        <span className="text-xs text-muted-foreground">
                          · {u.balai.shortName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
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
                      className={`h-8 w-8 ${
                        u.status === "ACTIVE"
                          ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          : "text-green-600 hover:text-green-700 hover:bg-green-50"
                      }`}
                      onClick={() => handleToggleStatus(u)}
                      disabled={u.id === currentUser?.id}
                    >
                      {u.status === "ACTIVE" ? (
                        <UserX size={14} />
                      ) : (
                        <UserCheck size={14} />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteId(u.id)}
                      disabled={u.id === currentUser?.id}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
