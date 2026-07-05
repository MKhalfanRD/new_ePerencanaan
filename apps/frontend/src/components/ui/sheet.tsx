"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

function Sheet({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/20 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * SheetContent — panel geser dari kanan.
 *
 * layer="1"  → drawer utama (~660px), dipakai untuk Detail Proyek.
 * layer="2"  → drawer turunan (~440px), menumpuk di atas layer 1
 *              (form Alokasi / form Lokasi).
 *
 * Saat sebuah drawer layer="2" terbuka, drawer layer="1" di baliknya
 * diberi class "pushed" (lihat util `sheetPushedClass` di bawah) untuk
 * memberi efek "terdorong" — bukan drawer baru yang menutupi total.
 */
function SheetContent({
  className,
  children,
  side = "right",
  layer = "1",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  side?: "right" | "left";
  layer?: "1" | "2";
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay className={cn(layer === "2" && "bg-black/10")} />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        data-layer={layer}
        className={cn(
          "fixed inset-y-0 z-50 flex h-full flex-col gap-0 bg-background text-sm shadow-xl outline-none duration-200",
          side === "right" ? "right-0" : "left-0",
          side === "right"
            ? "data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right"
            : "data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left",
          layer === "1" &&
            "w-[660px] max-w-[92vw] transition-transform transition-filter duration-200 ease-out data-[pushed=true]:-translate-x-8 data-[pushed=true]:scale-[0.98] data-[pushed=true]:brightness-[.94] max-sm:w-full max-sm:max-w-full",
          layer === "2" &&
            "w-[440px] max-w-[92vw] border-l shadow-2xl max-sm:w-full max-sm:max-w-full",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="sheet-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-3 right-3"
              size="icon-sm"
            >
              <XIcon />
              <span className="sr-only">Tutup</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "flex shrink-0 flex-col gap-1.5 border-b bg-background px-5 py-4 pr-12",
        className,
      )}
      {...props}
    />
  );
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("flex-1 overflow-y-auto", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "sticky bottom-0 flex shrink-0 flex-col-reverse gap-2 border-t bg-background/95 px-5 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-base leading-none font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * SheetBreadcrumb — breadcrumb navigasi di header tiap drawer.
 * Segmen terakhir non-clickable (halaman saat ini), segmen lain clickable.
 *
 * items: array segmen. Segmen dengan `onClick` akan dirender sebagai tombol.
 *
 * Sengaja SATU BARIS (tidak wrap) — di Sheet lapis-2 yang sempit (440px),
 * breadcrumb 3 segmen + nama proyek panjang dulu pernah bikin "›" nyangkut
 * sendirian di baris terpisah. Sekarang segmen tengah/terakhir yang panjang
 * di-truncate (ellipsis), segmen pertama ("Daftar Planning") selalu utuh
 * karena itu jangkarnya.
 */
function SheetBreadcrumb({
  items,
  className,
}: {
  items: { label: string; onClick?: () => void }[];
  className?: string;
}) {
  return (
    <nav
      data-slot="sheet-breadcrumb"
      aria-label="breadcrumb"
      className={cn(
        "flex items-center gap-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {items.map((item, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <span className="text-muted-foreground/50 shrink-0">›</span>
            )}
            {item.onClick && !isLast ? (
              <button
                type="button"
                title={item.label}
                onClick={item.onClick}
                className={cn(
                  "truncate rounded-sm text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50",
                  isFirst ? "shrink-0" : "min-w-0",
                )}
              >
                {item.label}
              </button>
            ) : (
              <span
                title={item.label}
                className={cn(
                  "truncate",
                  isLast ? "min-w-0 font-medium text-foreground" : "shrink-0",
                )}
              >
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/** Util: class yang diterapkan ke SheetContent layer 1 saat drawer layer 2 terbuka. */
function sheetPushedProps(pushed: boolean) {
  return { "data-pushed": pushed ? "true" : "false" } as const;
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetBreadcrumb,
  SheetPortal,
  SheetOverlay,
  sheetPushedProps,
};
