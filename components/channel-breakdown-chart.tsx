"use client";

import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { LabelList, Pie, PieChart } from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
} from "@/components/ui/chart";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";

type ChannelKey = "direct" | "email" | "social";

type ChannelDatum = {
	channel: ChannelKey;
	share: number;
	fill: string;
};

const chartData: ChannelDatum[] = [
	{ channel: "direct", share: 44, fill: "var(--color-direct)" },
	{ channel: "email", share: 36, fill: "var(--color-email)" },
	{ channel: "social", share: 20, fill: "var(--color-social)" },
];

const chartConfig = {
	share: {
		label: "Share",
	},
	direct: {
		label: "Direct",
		color: "var(--chart-1)",
	},
	email: {
		label: "Email",
		color: "var(--chart-3)",
	},
	social: {
		label: "Social",
		color: "var(--chart-5)",
	},
} satisfies ChartConfig;

export function ChannelBreakdownChart({
	className,
	...props
}: ComponentProps<typeof Card>) {
	return (
		<Card
			className={cn("flex flex-col shadow-none dark:ring-0", className)}
			{...props}
		>
			<CardHeader className="items-center space-y-1 pb-0 sm:items-start">
				<div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
					<CardTitle>Traffic by channel</CardTitle>
					<Delta value={2.4} variant="badge">
						<DeltaIcon variant="trend" />
						<DeltaValue suffix="pp" />
					</Delta>
				</div>
				<CardDescription>
					Share of new conversations in last 7 days
				</CardDescription>
			</CardHeader>
			<CardContent className="my-auto">
				<ChartContainer
					className="mx-auto aspect-square max-h-72 w-full"
					config={chartConfig}
				>
					<PieChart accessibilityLayer>
						<Pie
							cornerRadius={8}
							data={chartData}
							dataKey="share"
							innerRadius={36}
							nameKey="channel"
							outerRadius="88%"
							stroke="var(--card)"
							strokeWidth={4}
						>
							<LabelList
								className="fill-background font-medium"
								dataKey="share"
								fill="currentColor"
								fontWeight={500}
								formatter={(label) => {
									const n = Number(label);
									return Number.isFinite(n) ? `${n}%` : String(label ?? "");
								}}
								position="inside"
								stroke="none"
							/>
						</Pie>
						<ChartLegend content={<ChartLegendContent nameKey="channel" />} />
					</PieChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
