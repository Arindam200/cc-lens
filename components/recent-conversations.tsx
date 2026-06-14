import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { MailIcon, MessageCircleIcon, ArrowRightIcon } from "lucide-react";

type Conversation = {
	customer: string;
	subject: string;
	channel: "email" | "chat";
	waitMinutes: number;
	state: "waiting" | "open" | "snoozed";
};

const rows: Conversation[] = [
	{
		customer: "Northwind Labs",
		subject: "Billing portal access",
		channel: "email",
		waitMinutes: 6,
		state: "waiting",
	},
	{
		customer: "Blue River Co.",
		subject: "Shipment ETA",
		channel: "chat",
		waitMinutes: 1,
		state: "open",
	},
	{
		customer: "Oak Street Studio",
		subject: "API rate limits",
		channel: "email",
		waitMinutes: 58,
		state: "snoozed",
	},
	{
		customer: "Harbor Freight LLC",
		subject: "Workspace SSO",
		channel: "chat",
		waitMinutes: 3,
		state: "open",
	},
];

function formatWaitTime(minutes: number): string {
	if (minutes <= 0) {
		return "Just now";
	}
	if (minutes === 1) {
		return "1 minute";
	}
	if (minutes < 55) {
		return `${minutes} minutes`;
	}
	if (minutes < 60) {
		return "Almost an hour";
	}
	if (minutes < 75) {
		return "About an hour";
	}
	if (minutes < 120) {
		return "Over an hour";
	}
	const hours = Math.round(minutes / 60);
	return hours === 1 ? "About an hour" : `About ${hours} hours`;
}

function statusVariant(
	state: Conversation["state"]
): ComponentProps<typeof Badge>["variant"] {
	if (state === "waiting") {
		return "destructive";
	}
	if (state === "snoozed") {
		return "outline";
	}
	return "secondary";
}

function statusLabel(state: Conversation["state"]): string {
	if (state === "waiting") {
		return "In queue";
	}
	if (state === "snoozed") {
		return "Snoozed";
	}
	return "Active";
}

function channelIcon(channel: Conversation["channel"]) {
	if (channel === "email") {
		return (
			<MailIcon className="size-3.5 shrink-0" />
		);
	}
	return (
		<MessageCircleIcon className="size-3.5 shrink-0" />
	);
}

export function RecentConversations({
	className,
	...props
}: ComponentProps<typeof Card>) {
	return (
		<Card
			className={cn("gap-0 shadow-none md:col-span-2 dark:ring-0", className)}
			{...props}
		>
			<CardHeader className="border-b">
				<CardTitle>Recent conversations</CardTitle>
				<CardDescription>Latest 4 threads from your inbox</CardDescription>
			</CardHeader>
			<CardContent className="p-0">
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead className="pl-6">Customer</TableHead>
							<TableHead className="hidden sm:table-cell">Topic</TableHead>
							<TableHead>Channel</TableHead>
							<TableHead className="text-right">Wait</TableHead>
							<TableHead className="pr-6 text-right">Status</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((r) => {
							return (
								<TableRow
									className="h-14 hover:bg-transparent"
									key={`${r.customer}-${r.subject}`}
								>
									<TableCell className="max-w-36 truncate pl-6 font-medium">
										{r.customer}
									</TableCell>
									<TableCell className="hidden max-w-32 sm:table-cell">
										<span className="line-clamp-1 text-muted-foreground text-sm">
											{r.subject}
										</span>
									</TableCell>
									<TableCell>
										<span className="inline-flex items-center gap-2 font-medium text-sm capitalize">
											{channelIcon(r.channel)}
											{r.channel}
										</span>
									</TableCell>
									<TableCell className="text-right text-muted-foreground text-sm">
										{formatWaitTime(r.waitMinutes)}
									</TableCell>
									<TableCell className="pr-6 text-right">
										<Badge variant={statusVariant(r.state)}>
											{statusLabel(r.state)}
										</Badge>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
				<div className="flex justify-center border-t py-3">
					<Button asChild size="sm" variant="ghost">
						<a href="#/inbox">
							View all conversations
							<ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
						</a>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
