import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        dot: "gap-1.5 border-transparent bg-transparent px-0 py-0 font-medium text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

// Warna titik untuk varian "dot" — sinyal status data, bukan blok warna penuh.
// Nama kunci lama dipertahankan, nilainya palet status Arah C (globals.css):
// slate = draft/netral, emerald = disetujui/ok, rose = dikembalikan/error,
// blue = diajukan/info, amber = peringatan.
const dotColorClasses = {
  slate: "bg-st-draft",
  amber: "bg-warn",
  rose: "bg-st-dikembalikan",
  emerald: "bg-st-disetujui",
  blue: "bg-st-diajukan",
} as const;

// Pill: latar tint tipis + teks versi gelap (kontras >= 4,5).
const dotToneClasses = {
  slate: "bg-st-draft/12 text-st-draft-ink",
  amber: "bg-warn/12 text-warn-ink",
  rose: "bg-st-dikembalikan/10 text-st-dikembalikan-ink",
  emerald: "bg-st-disetujui/10 text-st-disetujui-ink",
  blue: "bg-st-diajukan/10 text-st-diajukan-ink",
} as const;

type DotColor = keyof typeof dotColorClasses;

function Badge({
  className,
  variant = "default",
  asChild = false,
  dotColor,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    /** Warna bulatan, hanya dipakai saat variant="dot" */
    dotColor?: DotColor;
  }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(
        badgeVariants({ variant }),
        variant === "dot" &&
          "rounded-full px-2 py-0.5 " + dotToneClasses[dotColor ?? "slate"],
        className,
      )}
      {...props}
    >
      {variant === "dot" && (
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            dotColorClasses[dotColor ?? "slate"],
          )}
        />
      )}
      {children}
    </Comp>
  );
}

export { Badge, badgeVariants };
export type { DotColor };
