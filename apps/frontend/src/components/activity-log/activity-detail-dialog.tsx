"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ActivityLogRow,
  buildTargetLink,
  ceritakanAktivitas,
  labelField,
  formatNilai,
} from "@/lib/activity-log";

interface Props {
  row: ActivityLogRow | null;
  onClose: () => void;
}

/** Modal detail satu baris log — tabel perbandingan field + tautan ke record terkait (kalau ada). */
export function ActivityDetailDialog({ row, onClose }: Props) {
  if (!row) return null;
  const changes = row.meta?.changes ?? [];
  const target = buildTargetLink(row);

  return (
    <Dialog open={!!row} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="!max-w-2xl">
        <DialogHeader>
          <DialogTitle>{ceritakanAktivitas(row)}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {row.user?.name ?? row.username} ·{" "}
            {new Date(row.createdAt).toLocaleString("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </DialogHeader>

        {target && (
          <Button asChild size="sm" variant="outline" className="w-fit">
            <Link href={target.href}>
              <ExternalLink size={13} className="mr-1.5" /> {target.label}
            </Link>
          </Button>
        )}

        {changes.length > 0 ? (
          <div className="max-h-[50vh] overflow-y-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/60">
                <tr>
                  <th className="px-3 py-1.5 text-left font-semibold">Field</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Sebelum</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Sesudah</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {changes.map((c) => (
                  <tr key={c.field}>
                    <td className="px-3 py-1.5 font-medium">
                      {labelField(row.entity, c.field)}
                    </td>
                    <td className="px-3 py-1.5 text-red-600">
                      {formatNilai(c.before)}
                    </td>
                    <td className="px-3 py-1.5 text-emerald-700">
                      {formatNilai(c.after)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Tidak ada rincian perubahan field untuk aktivitas ini.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
