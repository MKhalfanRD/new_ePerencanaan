"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import { Balai } from "@/types";

interface Role {
  id: string;
  code: string;
  name: string;
}

interface UserData {
  id: string;
  username: string;
  name: string;
  email?: string;
  nip?: string;
  phone?: string;
  status: string;
  role?: { code: string; name: string };
  balai?: { id: number; name: string };
}

const createSchema = z.object({
  username: z.string().min(3, "Username minimal 3 karakter"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  name: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Email tidak valid").optional().or(z.literal("")),
  nip: z.string().optional(),
  phone: z.string().optional(),
  roleCode: z.string().min(1, "Role wajib dipilih"),
  balaiId: z.number().optional(),
});

const editSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Email tidak valid").optional().or(z.literal("")),
  nip: z.string().optional(),
  phone: z.string().optional(),
  roleCode: z.string().min(1, "Role wajib dipilih"),
  balaiId: z.number().optional(),
  password: z.string().min(6).optional().or(z.literal("")),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm = z.infer<typeof editSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData?: UserData | null;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
          {title}
        </p>
        <div className="flex-1 h-px bg-border" />
      </div>
      {children}
    </div>
  );
}

export function UserFormDialog({ open, onClose, onSuccess, editData }: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [balaiList, setBalaiList] = useState<Balai[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(false);
  const isEdit = !!editData;

  const schema = isEdit ? editSchema : createSchema;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", nip: "", phone: "", password: "" },
  });

  useEffect(() => {
    if (!open) return;
    setLoadingMaster(true);
    Promise.all([
      api.get("/users").then(() => api.get("/master/balai")),
      api.get("/master/balai"),
    ])
      .then(([, b]) => {
        setBalaiList(b.data);
      })
      .catch(() => {});

    // Fetch roles dari backend
    api
      .get("/master/balai")
      .then((b) => setBalaiList(b.data))
      .catch(() => {});

    // Hardcode roles karena tidak ada endpoint khusus
    setRoles([
      { id: "1", code: "ADMINISTRATOR", name: "Administrator" },
      { id: "2", code: "VERIFICATOR", name: "Verifikator" },
      { id: "3", code: "SATKER", name: "Satuan Kerja" },
      { id: "4", code: "OPERATOR", name: "Operator" },
      { id: "5", code: "MONITORING", name: "Monitoring" },
    ]);

    setLoadingMaster(false);
  }, [open]);

  useEffect(() => {
    if (editData) {
      reset({
        name: editData.name,
        email: editData.email || "",
        nip: editData.nip || "",
        phone: editData.phone || "",
        roleCode: editData.role?.code || "",
        balaiId: editData.balai?.id,
        password: "",
      });
    } else {
      reset({ email: "", nip: "", phone: "", password: "" });
    }
  }, [editData, open]);

  const onSubmit = async (data: any) => {
    try {
      const payload = { ...data };
      if (isEdit && !payload.password) delete payload.password;
      if (payload.email === "") delete payload.email;

      if (isEdit) {
        await api.patch(`/users/${editData!.id}`, payload);
        toast.success("Pengguna berhasil diperbarui");
      } else {
        await api.post("/users", payload);
        toast.success("Pengguna berhasil ditambahkan");
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent
        className="max-w-lg max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>
            {isEdit ? "Edit Pengguna" : "Tambah Pengguna Baru"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isEdit
              ? "Perbarui informasi pengguna"
              : "Isi informasi pengguna baru"}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Akun */}
          <Section title="Informasi Akun">
            {!isEdit && (
              <div className="space-y-1.5">
                <Label>
                  Username <span className="text-destructive">*</span>
                </Label>
                <Input placeholder="username" {...register("username")} />
                {errors.username && (
                  <p className="text-destructive text-xs">
                    {String(errors.username.message)}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>
                {isEdit ? "Password Baru" : "Password"}{" "}
                {!isEdit && <span className="text-destructive">*</span>}
              </Label>
              <Input
                type="password"
                placeholder={
                  isEdit ? "Kosongkan jika tidak diubah" : "Minimal 6 karakter"
                }
                {...register("password")}
              />
              {errors.password && (
                <p className="text-destructive text-xs">
                  {String(errors.password.message)}
                </p>
              )}
            </div>
          </Section>

          {/* Profil */}
          <Section title="Profil">
            <div className="space-y-1.5">
              <Label>
                Nama Lengkap <span className="text-destructive">*</span>
              </Label>
              <Input placeholder="Nama lengkap" {...register("name")} />
              {errors.name && (
                <p className="text-destructive text-xs">
                  {String(errors.name.message)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>NIP</Label>
                <Input placeholder="NIP" {...register("nip")} />
              </div>
              <div className="space-y-1.5">
                <Label>No. Telepon</Label>
                <Input placeholder="08xx" {...register("phone")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="email@example.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-destructive text-xs">
                  {String(errors.email.message)}
                </p>
              )}
            </div>
          </Section>

          {/* Role & Balai */}
          <Section title="Akses & Unit Kerja">
            <div className="space-y-1.5">
              <Label>
                Role <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch("roleCode")}
                onValueChange={(v) => setValue("roleCode", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.roleCode && (
                <p className="text-destructive text-xs">
                  {String(errors.roleCode.message)}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Balai</Label>
              <Select
                value={watch("balaiId")?.toString() || ""}
                onValueChange={(v) => setValue("balaiId", Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih balai (opsional)" />
                </SelectTrigger>
                <SelectContent>
                  {balaiList.map((b) => (
                    <SelectItem key={b.id} value={b.id.toString()}>
                      <span className="font-medium">{b.shortName}</span>
                      <span className="text-muted-foreground ml-2">
                        — {b.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Section>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Simpan Perubahan" : "Tambah Pengguna"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
