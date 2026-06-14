"use client";

import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { CartesianGrid, LabelList, Line, LineChart, XAxis } from "recharts";
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
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";

type ReplyRow = {
	day: string;
	minutes: number;
};

const chartRows: ReplyRow[] = [
	{ day: "Mon", minutes: 5.4 },
	{ day: "Tue", minutes: 4.9 },
	{ day: "Wed", minutes: 5.2 },
	{ day: "Thu", minutes: 4.7 },
	{ day: "Fri", minutes: 4.5 },
	{ day: "Sat", minutes: 5.0 },
	{ day: "Sun", minutes: 4.1 },
];

const firstMinutes = chartRows[0]?.minutes ?? 0;
const lastMinutes = chartRows.at(-1)?.minutes ?? firstMinutes;

/** Positive when median first reply faster Mon → Sun. */
const replyImprovementPct =
	firstMinutes > 0 ? ((firstMinutes - lastMinutes) / firstMinutes) * 100 : 0;

const chartConfig = {
	minutes: {
		label: "Minutes",
		color: "var(--chart-2)",
	},
} satisfies ChartConfig;

export function FirstReplyTimeChart({
	className,
	...props
}: ComponentProps<typeof Card>) {
	return (
		<Card
			className={cn("shadow-none md:col-span-2 dark:ring-0", className)}
			{...props}
		>
			<CardHeader className="space-y-1">
				<div className="flex flex-wrap items-center gap-2">
					<CardTitle>Median first reply</CardTitle>
					<Delta value={replyImprovementPct} variant="badge">
						<DeltaIcon variant="trend" />
						<DeltaValue />
					</Delta>
				</div>
				<CardDescription>
					Minutes to first agent message, last 7 days.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer className="aspect-video w-full" config={chartConfig}>
					<LineChart
						accessibilityLayer
						data={chartRows}
						margin={{ top: 24, left: 20, right: 12, bottom: 8 }}
					>
						<CartesianGrid className="stroke-border" vertical={false} />
						<XAxis
							axisLine={false}
							dataKey="day"
							interval={0}
							tickFormatter={(value) => String(value).slice(0, 3)}
							tickLine={false}
							tickMargin={8}
						/>
						<ChartTooltip
							content={<ChartTooltipContent indicator="line" />}
							cursor={false}
						/>
						<Line
							activeDot={{ r: 6 }}
							dataKey="minutes"
							dot={{ fill: "var(--color-minutes)" }}
							stroke="var(--color-minutes)"
							strokeWidth={2}
							type="natural"
						>
							<LabelList
								className="fill-foreground"
								dataKey="minutes"
								fontSize={12}
								formatter={(label) => {
									const n = Number(label);
									return Number.isFinite(n)
										? `${n.toFixed(1)}m`
										: String(label ?? "");
								}}
								offset={12}
								position="top"
							/>
						</Line>
					</LineChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
