import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ShieldCheckIcon, LayersIcon, WandIcon, UsersRoundIcon, ArrowRightIcon } from "lucide-react";

const items = [
	{
		title: "SLA warning cleared for Oak Street Studio",
		time: "12 min ago",
		icon: (
			<ShieldCheckIcon
			/>
		),
	},
	{
		title: "Conversation escalated to Tier 2",
		time: "28 min ago",
		icon: (
			<LayersIcon
			/>
		),
	},
	{
		title: "Macro “Refund approved” updated",
		time: "1 hr ago",
		icon: (
			<WandIcon
			/>
		),
	},
	{
		title: "New customer segment synced from CRM",
		time: "3 hr ago",
		icon: (
			<UsersRoundIcon
			/>
		),
	},
] as const;

export function SupportActivity({
	className,
	...props
}: ComponentProps<typeof Card>) {
	return (
		<Card className={cn("gap-0 shadow-none dark:ring-0", className)} {...props}>
			<CardHeader className="border-b">
				<CardTitle>Workspace activity</CardTitle>
				<CardDescription>Operational signals.</CardDescription>
			</CardHeader>
			<CardContent className="px-0">
				<ul className="flex flex-col divide-y divide-border">
					{items.map((item) => (
						<li className="flex h-18 items-center gap-3 px-3" key={item.title}>
							<span
								aria-hidden="true"
								className="flex size-10 shrink-0 items-center justify-center [&_svg]:size-4"
							>
								{item.icon}
							</span>
							<div className="min-w-0 flex-1 space-y-1">
								<p className="line-clamp-2 text-pretty text-foreground text-xs leading-snug">
									{item.title}
								</p>
								<p className="text-muted-foreground text-xs tabular-nums">
									{item.time}
								</p>
							</div>
						</li>
					))}
				</ul>
			</CardContent>
			<div className="flex items-center justify-center">
				<Button asChild size="sm" variant="ghost">
					<a href="/#">
						View All
						<ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
					</a>
				</Button>
			</div>
		</Card>
	);
}
