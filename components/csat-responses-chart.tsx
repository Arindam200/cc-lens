"use client";

import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { Bar, BarChart, Rectangle, XAxis } from "recharts";
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

const chartData = [
	{ day: "Apr 8", direct: 11, email: 9, social: 4 },
	{ day: "Apr 9", direct: 15, email: 11, social: 5 },
	{ day: "Apr 10", direct: 13, email: 10, social: 5 },
	{ day: "Apr 11", direct: 16, email: 12, social: 5 },
	{ day: "Apr 12", direct: 12, email: 10, social: 5 },
	{ day: "Apr 13", direct: 14, email: 10, social: 6 },
	{ day: "Apr 14", direct: 11, email: 9, social: 5 },
	{ day: "Apr 15", direct: 16, email: 7, social: 4 },
	{ day: "Apr 16", direct: 13, email: 11, social: 5 },
	{ day: "Apr 17", direct: 15, email: 11, social: 6 },
] as const;

const chartConfig = {
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

/** Half of bar width (8) so ends read as fully rounded “caps”. */
const BAR_RADIUS = 5;

/**
 *  column hover background.
 */
function ColumnHoverCursor(props: React.ComponentProps<typeof Rectangle>) {
	return (
		<Rectangle
			fill="var(--muted)"
			fillOpacity={0.5}
			radius={BAR_RADIUS * 2}
			stroke="none"
			{...props}
		/>
	);
}

export function CsatResponsesChart({
	className,
	...props
}: ComponentProps<typeof Card>) {
	return (
		<Card
			className={cn("shadow-none md:col-span-2 dark:ring-0", className)}
			{...props}
		>
			<CardHeader>
				<CardTitle>CSAT responses</CardTitle>
				<CardDescription>
					Post-resolution surveys submitted per day by channel, last 10 days.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer className="aspect-video w-full" config={chartConfig}>
					<BarChart accessibilityLayer data={[...chartData]}>
						<XAxis
							axisLine={false}
							dataKey="day"
							interval={0}
							minTickGap={8}
							tickFormatter={(value) => String(value)}
							tickLine={false}
							tickMargin={10}
						/>
						<ChartTooltip
							content={<ChartTooltipContent hideLabel />}
							cursor={<ColumnHoverCursor />}
						/>
						<Bar
							background={{
								fill: "var(--muted)",
								radius: BAR_RADIUS,
							}}
							barSize={8}
							dataKey="social"
							fill="var(--color-social)"
							overflow="visible"
							radius={[0, 0, BAR_RADIUS, BAR_RADIUS]}
							stackId="csat"
						/>
						<Bar
							barSize={8}
							dataKey="email"
							fill="var(--color-email)"
							overflow="visible"
							radius={0}
							stackId="csat"
						/>
						<Bar
							barSize={8}
							dataKey="direct"
							fill="var(--color-direct)"
							overflow="visible"
							radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
							stackId="csat"
						/>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
