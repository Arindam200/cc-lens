import { cn } from "@/lib/utils";

export function DashboardSkeleton() {
	return (
		<div className="flex flex-1 flex-col gap-4">
			<div
				className={cn(
					"grid grid-cols-2 gap-4 lg:grid-cols-4",
					"*:min-h-48 *:w-full *:bg-muted *:dark:bg-muted/50"
				)}
			>
				<div className="rounded-lg" />
				<div className="rounded-lg" />
				<div className="rounded-lg" />
				<div className="rounded-lg" />
				<div className="rounded-lg col-span-2 min-h-114! lg:col-span-4" />
				<div className="rounded-lg col-span-2 min-h-92! lg:col-span-2" />
				<div className="rounded-lg col-span-2 min-h-92! lg:col-span-2" />
			</div>
		</div>
	);
}
