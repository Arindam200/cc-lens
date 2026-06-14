import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

const statusIndicatorVariants = cva(
	[
		"relative flex size-2 shrink-0 items-center justify-center rounded-full",
		"*:rounded-full *:bg-current",
		"[&_[data-slot=indicator-dot]]:size-[75%]",
		"[&_[data-slot=indicator-ping]]:absolute [&_[data-slot=indicator-ping]]:size-full",
	],
	{
		variants: {
			color: {
				emerald: "text-emerald-500",
				rose: "text-rose-500",
				amber: "text-amber-500",
				sky: "text-sky-500",
			},
			pulse: {
				true: "[&_[data-slot=indicator-ping]]:animate-ping",
				false: "[&_[data-slot=indicator-ping]]:hidden",
			},
		},
		defaultVariants: {
			color: "emerald",
			pulse: true,
		},
	}
);

export type StatusIndicatorProps = ComponentProps<"span"> &
	VariantProps<typeof statusIndicatorVariants>;

export function StatusIndicator({
	className,
	color,
	pulse,
	...props
}: StatusIndicatorProps) {
	return (
		<span
			className={cn(statusIndicatorVariants({ color, pulse }), className)}
			{...props}
		>
			<span aria-hidden data-slot="indicator-ping" />
			<span aria-hidden data-slot="indicator-dot" />
		</span>
	);
}
