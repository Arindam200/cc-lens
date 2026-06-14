"use client";
import { cn } from "@/lib/utils";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { MinusIcon, TrendingUpIcon, ArrowUpIcon, ChevronUpIcon, TrendingDownIcon, ArrowDownIcon, ChevronDownIcon } from "lucide-react";

type DeltaIconVariant = "default" | "trend" | "arrow";
type DeltaVariant = "default" | "badge";

type DeltaContextValue = {
	value: number;
};

const DeltaContext = React.createContext<DeltaContextValue | null>(null);

function useDeltaValue() {
	const context = React.useContext(DeltaContext);

	if (!context) {
		throw new Error(
			"DeltaIcon and DeltaValue must be used inside a `Delta` component."
		);
	}

	return context.value;
}

function Delta({
	className,
	value,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & {
	value: number;
	variant?: DeltaVariant;
}) {
	return (
		<DeltaContext.Provider value={{ value }}>
			{variant === "badge" ? (
				<Badge
					className={cn(
						"gap-1 border-none tabular-nums [&_svg]:size-4 [&_svg]:shrink-0",
						value > 0
							? "bg-emerald-500/10 text-emerald-500"
							: "bg-red-500/10 text-red-500",
						className
					)}
					data-slot="delta"
					variant="secondary"
					{...(props as React.ComponentProps<typeof Badge>)}
				/>
			) : (
				<div
					className={cn(
						"inline-flex items-center gap-1 text-muted-foreground tabular-nums",
						"[&_svg]:size-3 [&_svg]:shrink-0",
						value > 0 ? "text-emerald-600 dark:text-emerald-400" : "",
						value < 0 ? "text-rose-600 dark:text-rose-400" : "",
						className
					)}
					data-slot="delta"
					{...props}
				/>
			)}
		</DeltaContext.Provider>
	);
}

function FilledShell({
	value,
	children,
}: {
	value: number;
	children: React.ReactNode;
}) {
	return (
		<span
			className={cn(
				"inline-flex size-3 shrink-0 items-center justify-center rounded-full",
				"[&_svg]:size-2! [&_svg]:shrink-0 [&_svg]:stroke-3! [&_svg]:text-background",
				value > 0 && "bg-emerald-500",
				value < 0 && "bg-red-500",
				(!value || value === 0) && "bg-muted-foreground"
			)}
			data-slot="delta-icon"
		>
			{children}
		</span>
	);
}

function DeltaIcon({
	variant = "default",
	filled = false,
	className,
	...props
}: Omit<React.ComponentProps<"svg">, "fill"> & {
	variant?: DeltaIconVariant;
	filled?: boolean;
}) {
	const resolvedValue = useDeltaValue();

	const mergedClassName = cn(className);

	const shell = (node: React.ReactElement) =>
		filled ? <FilledShell value={resolvedValue}>{node}</FilledShell> : node;

	const slotProps = filled ? {} : { "data-slot": "delta-icon" as const };

	if (!resolvedValue || resolvedValue === 0) {
		return shell(
			<MinusIcon {...slotProps} className={mergedClassName} {...props} />
		);
	}

	if (resolvedValue > 0) {
		if (variant === "trend") {
			return shell(
				<TrendingUpIcon {...slotProps} className={mergedClassName} {...props} />
			);
		}

		if (variant === "arrow") {
			return shell(
				<ArrowUpIcon {...slotProps} className={mergedClassName} {...props} />
			);
		}

		return shell(
			<ChevronUpIcon {...slotProps} className={mergedClassName} {...props} />
		);
	}

	if (variant === "trend") {
		return shell(
			<TrendingDownIcon {...slotProps} className={mergedClassName} {...props} />
		);
	}

	if (variant === "arrow") {
		return shell(
			<ArrowDownIcon {...slotProps} className={mergedClassName} {...props} />
		);
	}

	return shell(
		<ChevronDownIcon {...slotProps} className={mergedClassName} {...props} />
	);
}

function DeltaValue({
	className,
	precision = 1,
	suffix = "%",
	absolute = true,
	...props
}: React.ComponentProps<"span"> & {
	precision?: number;
	suffix?: string;
	absolute?: boolean;
}) {
	const resolvedValue = useDeltaValue();

	const formattedValue = (
		absolute ? Math.abs(resolvedValue) : resolvedValue
	).toFixed(precision);

	return (
		<span
			className={cn("tabular-nums", className)}
			data-slot="delta-value"
			{...props}
		>
			{formattedValue}
			{suffix}
		</span>
	);
}
export { Delta, DeltaIcon, DeltaValue };
