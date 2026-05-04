import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-[4px] border px-2 py-[3px] font-mono text-[11px] font-medium tracking-[0.14em] uppercase w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:ring-ring/35 focus-visible:ring-[3px] aria-invalid:ring-destructive/30 aria-invalid:border-destructive transition-[color,background-color,border-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary-soft)] border-[rgba(99,102,241,0.30)] text-primary [a&]:hover:bg-[var(--primary-glow)]",
        secondary:
          "bg-secondary border-border text-secondary-foreground [a&]:hover:bg-[var(--surface-2)]",
        destructive:
          "bg-[rgba(239,68,68,0.10)] border-[rgba(239,68,68,0.30)] text-destructive",
        outline:
          "border-border bg-transparent text-foreground [a&]:hover:border-primary",
        ghost: "border-transparent bg-transparent text-muted-foreground [a&]:hover:text-foreground",
        link: "border-transparent bg-transparent text-primary underline-offset-4 [a&]:hover:underline",
        live:
          "bg-[var(--primary-soft)] border-[rgba(99,102,241,0.30)] text-primary",
        wip:
          "bg-[var(--surface-2)] border-border text-[var(--subtle-foreground)]",
        beta:
          "bg-[rgba(224,179,65,0.10)] border-[rgba(224,179,65,0.28)] text-[var(--warning)]",
        tag:
          "bg-[var(--surface-2)] border-border text-muted-foreground normal-case tracking-normal",
        success:
          "bg-[rgba(34,197,94,0.10)] border-[rgba(34,197,94,0.30)] text-[var(--success)]",
        warning:
          "bg-[rgba(224,179,65,0.10)] border-[rgba(224,179,65,0.28)] text-[var(--warning)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
