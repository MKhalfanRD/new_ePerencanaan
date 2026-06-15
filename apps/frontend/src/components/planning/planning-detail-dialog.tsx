"use client";

import { useState } from "react";
import {
  Edit,
  Send,
  CheckCircle,
  XCircle,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Planning } from "@/types";

const statusConfig = {
  DRAFT: {
    label: "Draft",
    className: "bg-slate-100 text-slate-600 border border-slate-200",
  },
  SUBMITTED: {
    label: "Menunggu Review",
    className: "bg-blue-100 text-blue-700 border border-blue-200",
  },
  REVISION: {
    label: "Perlu Revisi",
    className: "bg-amber-100 text-amber-700 border border-amber-200",
  },
  REJECTED: {
    label: "Ditolak",
    className: "bg-red-100 text-red-700 border border-red-200",
  },
  APPROVED: {
    label: "Disetujui",
    className: "bg-green-100 text-green-700 border border-green-200",
  },
};

const dokumenStatusLabel = {
  TIDAK_PERLU: "Tidak Perlu",
  BELUM_ADA: "Belum Ada",
  SUDAH_ADA: "Sudah Ada",
};

const formatRupiah = (val: string | number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(val));

interface Props {
  open: boolean;
  planning: Planning;
  onClose: () => void;
  onEdit: (p: Planning) => void;
  onRefresh: () => void;
}

export function PlanningDetailDialog({
  open,
  planning,
  onClose,
  onEdit,
  onRefresh,
}: Props) {
  const { user } = useAuthStore();
  const [reviewAction, setReviewAction] = useState("");
  const [reviewCatatan, setReviewCatatan] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canEdit =
    (user?.role === "SATKER" || user?.role === "ADMINISTRATOR") &&
    (planning.status === "DRAFT" || planning.status === "REVISION");

  const canSubmit =
    user?.role === "SATKER" &&
    (planning.status === "DRAFT" || planning.status === "REVISION");

  const canReview =
    (user?.role === "VERIFICATOR" || user?.role === "ADMINISTRATOR") &&
    planning.status === "SUBMITTED";

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.patch(`/plannings/${planning.id}/submit`);
      toast.success("Planning berhasil diajukan");
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengajukan planning");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async () => {
    if (!reviewAction) return toast.error("Pilih aksi review terlebih dahulu");
    setSubmitting(true);
    try {
      await api.patch(`/plannings/${planning.id}/review`, {
        action: reviewAction,
        catatan: reviewCatatan,
      });
      toast.success("Review berhasil disimpan");
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyimpan review");
    } finally {
      setSubmitting(false);
    }
  };

  // Group alokasi by tahun
  const alokasiByTahun = planning.alokasi.reduce<
    Record<number, typeof planning.alokasi>
  >((acc, a) => {
    if (!acc[a.tahun]) acc[a.tahun] = [];
    acc[a.tahun].push(a);
    return acc;
  }, {});

  const cfg = statusConfig[planning.status];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base leading-snug pr-4">
                {planning.projectName}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.className}`}
                >
                  {cfg.icon} {cfg.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {planning.balai.shortName} · {planning.periode.label}
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(planning)}
                >
                  <Edit size={14} className="mr-1.5" /> Edit
                </Button>
              )}
              {canSubmit && (
                <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                  ) : (
                    <Send size={14} className="mr-1.5" />
                  )}
                  Ajukan
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Info utama */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {[
              ["Balai", planning.balai.name],
              ["Periode", planning.periode.label],
              [
                "Masa Pelaksanaan",
                planning.masaPelaksanaan === "SINGLE_YEAR"
                  ? "Single Year"
                  : "Multi Year",
              ],
              ["Kewenangan", planning.kewenangan],
              ["Wilayah Sungai", planning.wilayahSungai?.name || "-"],
              ["Kebutuhan Tanah", planning.kebutuhanTanah ? "Ada" : "Tidak"],
              ["Sesuai RTRW", planning.sesuaiRTRW || "-"],
              ["No. Perda RTRW", planning.nomorPerdaRTRW || "-"],
              ["Sesuai Pola SDA", planning.sesuaiPolaSDA || "-"],
              ["No. Kepmen PUPR", planning.nomorKepmenPUPR || "-"],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <span className="text-muted-foreground w-36 shrink-0">
                  {label}
                </span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>

          {/* Catatan verificator */}
          {planning.catatan && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <p className="font-medium mb-1">Catatan Verifikator:</p>
              <p>{planning.catatan}</p>
            </div>
          )}

          <Separator />

          {/* Kriteria Dokumen */}
          {planning.kriteriaDokumen.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Kriteria Dokumen</p>
              <div className="space-y-1.5">
                {planning.kriteriaDokumen.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/40"
                  >
                    <span className="text-muted-foreground">{k.jenis}</span>
                    <div className="flex items-center gap-2">
                      {k.tahun && (
                        <span className="text-xs text-muted-foreground">
                          {k.tahun}
                        </span>
                      )}
                      <Badge
                        variant={
                          k.status === "SUDAH_ADA" ? "default" : "secondary"
                        }
                        className="text-xs"
                      >
                        {dokumenStatusLabel[k.status]}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Alokasi */}
          <div>
            <p className="text-sm font-medium mb-3">Alokasi Anggaran</p>
            {Object.keys(alokasiByTahun).length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada alokasi</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(alokasiByTahun)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([tahun, alokasi]) => (
                    <div key={tahun}>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        Tahun {tahun}
                      </p>
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-2 font-medium">
                                Status
                              </th>
                              <th className="text-left p-2 font-medium">RO</th>
                              <th className="text-right p-2 font-medium">
                                Total
                              </th>
                              <th className="text-right p-2 font-medium">
                                Output
                              </th>
                              <th className="text-right p-2 font-medium">
                                Outcome
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {alokasi.map((a) => (
                              <tr
                                key={a.id}
                                className={
                                  a.status === "RENCANA" ? "bg-blue-50/50" : ""
                                }
                              >
                                <td className="p-2">
                                  <Badge
                                    variant={
                                      a.status === "RENCANA"
                                        ? "default"
                                        : "secondary"
                                    }
                                    className="text-xs"
                                  >
                                    {a.status === "RENCANA"
                                      ? "Rencana"
                                      : "Realisasi"}
                                  </Badge>
                                </td>
                                <td className="p-2 text-muted-foreground">
                                  {a.ro.kro.kegiatan.program.code} ·{" "}
                                  {a.ro.kro.code} · {a.ro.code}
                                </td>
                                <td className="p-2 text-right font-medium">
                                  {formatRupiah(a.total)}
                                </td>
                                <td className="p-2 text-right text-muted-foreground">
                                  {a.outputTarget
                                    ? `${a.outputTarget} ${a.outputUnit || ""}`
                                    : "-"}
                                </td>
                                <td className="p-2 text-right text-muted-foreground">
                                  {a.outcomeTarget
                                    ? `${a.outcomeTarget} ${a.outcomeUnit || ""}`
                                    : "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Prioritas */}
          {planning.prioritas.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Prioritas</p>
                <div className="space-y-1">
                  {planning.prioritas.map((p) => (
                    <div
                      key={p.id}
                      className="text-xs text-muted-foreground p-2 rounded-lg bg-muted/40"
                    >
                      <span className="font-medium text-foreground">
                        Tahun {p.tahun}
                      </span>
                      {" · "}
                      {[
                        p.proyekPrioritas && "Proyek Prioritas",
                        p.proyekRPIW && "RPIW",
                        p.kegiatanBaru && "Kegiatan Baru",
                        p.kegiatanWajib && "Kegiatan Wajib",
                      ]
                        .filter(Boolean)
                        .join(", ") || "Tidak ada prioritas"}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Histori Review */}
          {planning.reviews.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Histori Review</p>
                <div className="space-y-2">
                  {planning.reviews.map((r) => (
                    <div key={r.id} className="flex items-start gap-3 text-sm">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        {r.action === "approve" ? (
                          <CheckCircle size={14} className="text-green-600" />
                        ) : r.action === "reject" ? (
                          <XCircle size={14} className="text-destructive" />
                        ) : (
                          <RotateCcw size={14} className="text-amber-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {r.reviewer.name}{" "}
                          <span className="font-normal text-muted-foreground">
                            — {r.action}
                          </span>
                        </p>
                        {r.catatan && (
                          <p className="text-muted-foreground text-xs mt-0.5">
                            {r.catatan}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(r.createdAt).toLocaleDateString("id-ID", {
                            dateStyle: "medium",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Review action */}
          {canReview && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium">Review Planning</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Aksi</Label>
                    <Select
                      value={reviewAction}
                      onValueChange={setReviewAction}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih aksi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approve">✅ Setujui</SelectItem>
                        <SelectItem value="revision">
                          🔄 Minta Revisi
                        </SelectItem>
                        <SelectItem value="reject">❌ Tolak</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Catatan (opsional)</Label>
                    <Input
                      placeholder="Catatan untuk satker..."
                      value={reviewCatatan}
                      onChange={(e) => setReviewCatatan(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleReview}
                  disabled={!reviewAction || submitting}
                  className="w-full"
                >
                  {submitting && (
                    <Loader2 size={14} className="mr-2 animate-spin" />
                  )}
                  Kirim Review
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
