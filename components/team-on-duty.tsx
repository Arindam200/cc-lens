"use client";

import { cn } from "@/lib/utils";
import { type ComponentProps, useState } from "react";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusIndicator } from "@/components/indicator";
import { EllipsisIcon, SendIcon, ListChecksIcon } from "lucide-react";

type Teammate = {
	id: string;
	name: string;
	status: "Online" | "Away";
	/** Conversations currently assigned to this teammate */
	open: number;
	image?: string;
};

const INITIAL_TEAMMATES: readonly Teammate[] = [
	{
		id: "amelia",
		name: "Amelia Park",
		status: "Online",
		open: 9,
		image: "https://avatar.vercel.sh/ameliapark",
	},
	{
		id: "noah",
		name: "Noah Ibarra",
		status: "Online",
		open: 7,
		image: "https://avatar.vercel.sh/noahi",
	},
	{
		id: "priya",
		name: "Priya Desai",
		status: "Away",
		open: 4,
		image: "https://avatar.vercel.sh/priyadesai",
	},
	{
		id: "marcus",
		name: "Marcus Chen",
		status: "Online",
		open: 11,
		image: "https://avatar.vercel.sh/marcuschen",
	},
	{
		id: "emily",
		name: "Emily Johnson",
		status: "Away",
		open: 2,
		image: "https://avatar.vercel.sh/emilyjohnson",
	},
];

function getInitials(name: string) {
	return name
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase())
		.join("");
}

export function TeamOnDuty({
	className,
	...props
}: ComponentProps<typeof Card>) {
	const [teammates, setTeammates] = useState<Teammate[]>(() => [
		...INITIAL_TEAMMATES,
	]);

	function pullNextConversation(id: string) {
		setTeammates((prev) =>
			prev.map((t) =>
				t.id === id ? { ...t, open: Math.max(0, t.open - 1) } : t
			)
		);
	}

	return (
		<Card className={cn("shadow-none dark:ring-0", className)} {...props}>
			<CardHeader className="border-b">
				<CardTitle>Team on duty</CardTitle>
				<CardDescription>Who is carrying the queue right now</CardDescription>
			</CardHeader>
			<CardContent className="p-0">
				<ul className="flex flex-col divide-y divide-border">
					{teammates.map((t) => (
						<li
							className="flex items-center gap-2 p-3 first:pt-0 last:pb-0 sm:gap-3"
							key={t.id}
						>
							<Avatar className="size-8">
								<AvatarImage alt={t.name} src={t.image} />
								<AvatarFallback>{getInitials(t.name)}</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1 pr-1">
								<p className="truncate font-medium text-foreground text-sm leading-snug">
									{t.name}
								</p>
								<p className="flex items-center gap-2 text-[10px] leading-snug">
									<span className="flex shrink-0 items-center gap-1">
										<StatusIndicator
											color={t.status === "Online" ? "emerald" : "amber"}
											pulse={t.status === "Online"}
										/>
										{t.status}
									</span>
									<span className="inline-flex size-1 rounded-full bg-foreground/80" />
									<span className="tabular-nums">{t.open} assigned</span>
								</p>
							</div>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										aria-label={`Actions for ${t.name}`}
										size="icon-xs"
										variant="ghost"
									>
										<EllipsisIcon
										/>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="min-w-52">
									<DropdownMenuLabel className="font-normal text-muted-foreground text-xs">
										{t.name}
									</DropdownMenuLabel>
									<DropdownMenuSeparator />
									<DropdownMenuItem className="gap-2">
										<SendIcon className="size-4 opacity-70" />
										Message
									</DropdownMenuItem>
									<DropdownMenuItem
										className="gap-2"
										disabled={t.open === 0}
										onSelect={() => {
											pullNextConversation(t.id);
										}}
									>
										<ListChecksIcon className="size-4 opacity-70" />
										Pull next conversation
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
