"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Lock, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AngkaInput } from "@/components/proyek/paket-dialog";
import { SUMBER_DANA, type SumberDana } from "@/components/proyek/paket-template";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatRupiahShort } from "@/lib/format-rupiah";
import { LABEL_SD, WARNA_SD, useSaldoKegiatan, type SaldoTahun } from "./saldo-kegiatan";

type Isian = { total?: number; pecah: Partial<Record<SumberDana, number | undefined>> };

const dariServer = (s: SaldoTahun): Isian => ({
  total: s.saldo?.total,
  pecah: Object.fromEntries(
    SUMBER_DANA.filter((k) => s.saldo?.[k] != null).map((k) => [k, s.saldo![k]!]),
  ),
});
const jumlahPecah = (i: Isian) => SUMBER_DANA.reduce((n, k) => n + (i.pecah[k] ?? 0), 0);

/** Admin menetapkan saldo 1 kegiatan untuk semua tahun periode (hi-fi HfAnggaranSet2). */
export function TetapkanSaldoSheet({
  kegiatan,
  dari,
  sampai,
  onClose,
  onSaved,
}: {
  kegiatan: { id: string; nama: string } | null;
  dari: number;
  sampai: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const data = useSaldoKegiatan(kegiatan?.id, dari, sampai, undefined, !!kegiatan);
  const [isian, setIsian] = useState<Record<number, Isian>>({});
  const [buka, setBuka] = useState<Set<number>>(new Set());
  const [alasan, setAlasan] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setIsian(Object.fromEntries(data.map((s) => [s.tahun, dariServer(s)])));
    setBuka(new Set(data.filter((s) => SUMBER_DANA.some((k) => s.saldo?.[k] != null)).map((s) => s.tahun)));
    setAlasan("");
  }, [data]);

  const ubah = (t: number, patch: Partial<Isian>) =>
    setIsian((cur) => ({ ...cur, [t]: { ...cur[t], ...patch } }));
  const ubahPecah = (t: number, k: SumberDana, v: number | undefined) =>
    setIsian((cur) => ({ ...cur, [t]: { ...cur[t], pecah: { ...cur[t].pecah, [k]: v } } }));
  const hapusPecah = (t: number, k: SumberDana) =>
    setIsian((cur) => {
      const pecah = { ...cur[t].pecah };
      delete pecah[k];
      return { ...cur, [t]: { ...cur[t], pecah } };
    });

  const pecahLebih = (data ?? []).filter((s) => {
    const i = isian[s.tahun];
    return i?.total != null && jumlahPecah(i) > i.total;
  });

  const simpan = async () => {
    if (!kegiatan || !data) return;
    if (alasan.trim().length < 3) return toast.error("Isi alasan perubahan");
    if (pecahLebih.length)
      return toast.error(`Pecahan sumber dana ${pecahLebih.map((s) => s.tahun).join(", ")} melebihi saldo total`);
    const turun = data.filter((s) => {
      const t = isian[s.tahun]?.total;
      return t != null && t < s.terpakai.total;
    });
    if (
      turun.length &&
      !window.confirm(
        `Saldo ${turun.map((s) => s.tahun).join(", ")} lebih kecil dari yang sudah terpakai. ` +
          "Paket yang sudah ada tetap tersimpan, tapi alokasinya tidak bisa ditambah. Tetap simpan?",
      )
    )
      return;
    setSaving(true);
    try {
      await api.patch(`/saldo-kegiatan/${kegiatan.id}`, {
        alasan: alasan.trim(),
        tahun: data.map((s) => {
          const i = isian[s.tahun];
          return {
            tahun: s.tahun,
            total: i?.total ?? null,
            ...Object.fromEntries(SUMBER_DANA.map((k) => [k, i?.total == null ? null : (i.pecah[k] ?? null)])),
          };
        }),
      });
      toast.success("Saldo kegiatan disimpan");
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Gagal menyimpan saldo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={!!kegiatan} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[44rem] max-w-[44rem] !p-0">
        <SheetHeader>
          <SheetTitle>Tetapkan saldo</SheetTitle>
          <SheetDescription>
            <span className="font-mono text-xs">{kegiatan?.id}</span> · {kegiatan?.nama} · {dari}–{sampai}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4 px-5 py-4">
          {!data ? (
            <p className="text-sm text-muted-foreground">Memuat saldo…</p>
          ) : (
            <>
              <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_5.5rem_5.5rem] gap-3 text-xs font-semibold text-muted-foreground">
                <span>Tahun</span>
                <span>Saldo total (Rp) · wajib</span>
                <span className="text-right">Terpakai</span>
                <span className="text-right">Sisa</span>
              </div>
              {data.map((s) => {
                const i = isian[s.tahun] ?? { pecah: {} };
                const sisa = i.total == null ? null : i.total - s.terpakai.total;
                const dipecah = SUMBER_DANA.filter((k) => k in i.pecah);
                const belumDipecah = SUMBER_DANA.filter((k) => !(k in i.pecah));
                const o = buka.has(s.tahun);
                return (
                  <div key={s.tahun} className="space-y-1.5">
                    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_5.5rem_5.5rem] items-center gap-3 text-sm">
                      <b>{s.tahun}</b>
                      <AngkaInput
                        aria-label={`Saldo ${s.tahun}`}
                        className={cn("h-9", sisa != null && sisa < 0 && "border-destructive")}
                        placeholder="Belum ditetapkan"
                        value={i.total}
                        onChange={(v) => ubah(s.tahun, { total: v })}
                      />
                      <span className="text-right text-xs tabular-nums text-muted-foreground">
                        {formatRupiahShort(s.terpakai.total)}
                      </span>
                      <span
                        className={cn(
                          "text-right text-xs font-semibold tabular-nums",
                          sisa != null && sisa < 0 && "text-destructive",
                        )}
                      >
                        {sisa == null ? "—" : sisa < 0 ? `− ${formatRupiahShort(-sisa)}` : formatRupiahShort(sisa)}
                      </span>
                    </div>
                    {i.total == null ? (
                      <p className="flex items-center gap-1.5 pl-[4.25rem] text-xs text-destructive">
                        <Lock size={12} aria-hidden />
                        Alokasi paket {s.tahun} di semua proyek kegiatan ini terkunci sampai saldo diisi
                      </p>
                    ) : (
                      <div className="pl-[4.25rem]">
                        <button
                          type="button"
                          aria-expanded={o}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary-ink hover:underline"
                          onClick={() =>
                            setBuka((cur) => {
                              const n = new Set(cur);
                              if (n.has(s.tahun)) n.delete(s.tahun);
                              else n.add(s.tahun);
                              return n;
                            })
                          }
                        >
                          <ChevronDown size={13} className={cn("transition-transform", o && "rotate-180")} />
                          {o ? "Sembunyikan pecahan" : dipecah.length ? `Pecahan sumber dana (${dipecah.length})` : "Pecah ke sumber dana"}
                        </button>
                        {!o && !dipecah.length && (
                          <span className="ml-2 text-xs text-muted-foreground">tidak dipecah · dicek terhadap total</span>
                        )}
                        {o && (
                          <div className="mt-2 space-y-2 rounded-lg border border-dashed bg-tier-2 p-3">
                            <p className="text-xs font-semibold">
                              Pecahan sumber dana <span className="font-normal text-muted-foreground">(opsional)</span>
                            </p>
                            {dipecah.map((k) => (
                              <div key={k} className="grid grid-cols-[4.5rem_minmax(0,1fr)_5rem_1.5rem] items-center gap-2 text-xs">
                                <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                                  <i aria-hidden className={cn("h-2 w-2 rounded-[2px]", WARNA_SD[k])} />
                                  {LABEL_SD[k]}
                                </span>
                                <AngkaInput
                                  aria-label={`Saldo ${LABEL_SD[k]} ${s.tahun}`}
                                  className="h-8 text-xs"
                                  placeholder="0"
                                  value={i.pecah[k]}
                                  onChange={(v) => ubahPecah(s.tahun, k, v)}
                                />
                                <span className="text-right tabular-nums text-muted-foreground">
                                  pakai {formatRupiahShort(s.terpakai[k])}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Hapus pecahan ${LABEL_SD[k]}`}
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() => hapusPecah(s.tahun, k)}
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ))}
                            {belumDipecah.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {belumDipecah.map((k) => (
                                  <Button
                                    key={k}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1 text-xs"
                                    onClick={() => ubahPecah(s.tahun, k, undefined)}
                                  >
                                    <Plus size={12} />
                                    {LABEL_SD[k]}
                                  </Button>
                                ))}
                              </div>
                            )}
                            <p
                              className={cn(
                                "border-t pt-2 text-xs",
                                jumlahPecah(i) > i.total ? "font-medium text-destructive" : "text-muted-foreground",
                              )}
                            >
                              Dipecah {formatRupiahShort(jumlahPecah(i))} dari total {formatRupiahShort(i.total)}
                              {jumlahPecah(i) > i.total
                                ? " — melebihi total"
                                : ` · belum dipecah ${formatRupiahShort(i.total - jumlahPecah(i))}`}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Sumber dana yang tidak dipecah cukup dicek terhadap sisa total.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="alasan-saldo">
                  Alasan perubahan <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="alasan-saldo"
                  placeholder="Mis. penyesuaian pagu indikatif 2026"
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Terpakai = rencana paket semua proyek di kegiatan ini, termasuk Draft. Perubahan saldo tercatat di log
                aktivitas.
              </p>
            </>
          )}
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="button" onClick={simpan} disabled={saving || !data || pecahLebih.length > 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
