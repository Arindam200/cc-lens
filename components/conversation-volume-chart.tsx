"use client";

import { cn } from "@/lib/utils";
import { type ComponentProps, useId, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
	formatChartAxisTick,
	formatChartTooltipDate,
	parseIsoCalendarDate,
} from "@/components/formater";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";

type PeriodDays = 7 | 30 | 60;

type VolumeRow = {
	date: string;
	conversations: number;
};

/**
 * Demo data.
 */
const chartData: VolumeRow[] = [
	{ date: "2026-02-18", conversations: 162 },
	{ date: "2026-02-19", conversations: 162 },
	{ date: "2026-02-20", conversations: 162 },
	{ date: "2026-02-21", conversations: 162 },
	{ date: "2026-02-22", conversations: 162 },
	{ date: "2026-02-23", conversations: 162 },
	{ date: "2026-02-24", conversations: 161 },
	{ date: "2026-02-25", conversations: 161 },
	{ date: "2026-02-26", conversations: 160 },
	{ date: "2026-02-27", conversations: 160 },
	{ date: "2026-02-28", conversations: 159 },
	{ date: "2026-03-01", conversations: 158 },
	{ date: "2026-03-02", conversations: 158 },
	{ date: "2026-03-03", conversations: 157 },
	{ date: "2026-03-04", conversations: 157 },
	{ date: "2026-03-05", conversations: 157 },
	{ date: "2026-03-06", conversations: 157 },
	{ date: "2026-03-07", conversations: 157 },
	{ date: "2026-03-08", conversations: 157 },
	{ date: "2026-03-09", conversations: 157 },
	{ date: "2026-03-10", conversations: 157 },
	{ date: "2026-03-11", conversations: 157 },
	{ date: "2026-03-12", conversations: 157 },
	{ date: "2026-03-13", conversations: 157 },
	{ date: "2026-03-14", conversations: 156 },
	{ date: "2026-03-15", conversations: 156 },
	{ date: "2026-03-16", conversations: 155 },
	{ date: "2026-03-17", conversations: 155 },
	{ date: "2026-03-18", conversations: 154 },
	{ date: "2026-03-19", conversations: 153 },
	{ date: "2026-03-20", conversations: 152 },
	{ date: "2026-03-21", conversations: 151 },
	{ date: "2026-03-22", conversations: 150 },
	{ date: "2026-03-23", conversations: 149 },
	{ date: "2026-03-24", conversations: 149 },
	{ date: "2026-03-25", conversations: 150 },
	{ date: "2026-03-26", conversations: 147 },
	{ date: "2026-03-27", conversations: 151 },
	{ date: "2026-03-28", conversations: 147 },
	{ date: "2026-03-29", conversations: 145 },
	{ date: "2026-03-30", conversations: 143 },
	{ date: "2026-03-31", conversations: 141 },
	{ date: "2026-04-01", conversations: 139 },
	{ date: "2026-04-02", conversations: 137 },
	{ date: "2026-04-03", conversations: 137 },
	{ date: "2026-04-04", conversations: 137 },
	{ date: "2026-04-05", conversations: 137 },
	{ date: "2026-04-06", conversations: 137 },
	{ date: "2026-04-07", conversations: 137 },
	{ date: "2026-04-08", conversations: 136 },
	{ date: "2026-04-09", conversations: 134 },
	{ date: "2026-04-10", conversations: 132 },
	{ date: "2026-04-11", conversations: 129 },
	{ date: "2026-04-12", conversations: 127 },
	{ date: "2026-04-13", conversations: 125 },
	{ date: "2026-04-14", conversations: 124 },
	{ date: "2026-04-15", conversations: 124 },
	{ date: "2026-04-16", conversations: 124 },
	{ date: "2026-04-17", conversations: 124 },
	{ date: "2026-04-18", conversations: 124 },
	{ date: "2026-04-19", conversations: 124 },
	{ date: "2026-04-20", conversations: 122 },
	{ date: "2026-04-21", conversations: 120 },
	{ date: "2026-04-22", conversations: 118 },
	{ date: "2026-04-23", conversations: 115 },
	{ date: "2026-04-24", conversations: 113 },
	{ date: "2026-04-25", conversations: 112 },
	{ date: "2026-04-26", conversations: 111 },
	{ date: "2026-04-27", conversations: 114 },
	{ date: "2026-04-28", conversations: 110 },
	{ date: "2026-04-29", conversations: 113 },
	{ date: "2026-04-30", conversations: 111 },
	{ date: "2026-05-01", conversations: 111 },
	{ date: "2026-05-02", conversations: 107 },
	{ date: "2026-05-03", conversations: 109 },
	{ date: "2026-05-04", conversations: 105 },
	{ date: "2026-05-05", conversations: 103 },
	{ date: "2026-05-06", conversations: 101 },
	{ date: "2026-05-07", conversations: 98 },
	{ date: "2026-05-08", conversations: 100 },
	{ date: "2026-05-09", conversations: 97 },
	{ date: "2026-05-10", conversations: 101 },
	{ date: "2026-05-11", conversations: 99 },
	{ date: "2026-05-12", conversations: 100 },
	{ date: "2026-05-13", conversations: 94 },
	{ date: "2026-05-14", conversations: 102 },
	{ date: "2026-05-15", conversations: 99 },
	{ date: "2026-05-16", conversations: 107 },
	{ date: "2026-05-17", conversations: 104 },
	{ date: "2026-05-18", conversations: 118 },
	{ date: "2026-05-19", conversations: 127 },
];

const lastChartRow = chartData.at(-1);
if (lastChartRow === undefined) {
	throw new Error(
		"ConversationVolumeChart: chartData must include at least one row"
	);
}
const volumeChartReferenceDate = parseIsoCalendarDate(lastChartRow.date);

const chartConfig = {
	conversations: {
		label: "New threads",
		color: "var(--chart-2)",
	},
} satisfies ChartConfig;

export function ConversationVolumeChart({
	className,
	...props
}: ComponentProps<typeof Card>) {
	const chartUid = useId().replace(/:/g, "");
	const idAreaGradient = `conversation-volume-area-grad-${chartUid}`;

	const [periodDays, setPeriodDays] = useState<PeriodDays>(30);

	const chartRows = useMemo(() => {
		const startDate = new Date(volumeChartReferenceDate);
		startDate.setDate(startDate.getDate() - periodDays);
		return chartData.filter(
			(item) => parseIsoCalendarDate(item.date) >= startDate
		);
	}, [periodDays]);

	const growthPctNum = useMemo(() => {
		const first = chartRows[0];
		if (!first) {
			return 0;
		}
		const last = chartRows.at(-1);
		if (!last) {
			return 0;
		}
		const a = first.conversations;
		const b = last.conversations;
		if (!a) {
			return 0;
		}
		return ((b - a) / a) * 100;
	}, [chartRows]);

	let xAxisMinTickGap: number | undefined;
	if (periodDays <= 7) {
		xAxisMinTickGap = undefined;
	} else if (periodDays >= 60) {
		xAxisMinTickGap = 20;
	} else {
		xAxisMinTickGap = 28;
	}

	return (
		<Card
			className={cn(
				"shadow-none md:col-span-2 lg:col-span-3 dark:ring-0",
				className
			)}
			{...props}
		>
			<CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0 space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<CardTitle>Conversation volume</CardTitle>
						<Delta value={growthPctNum} variant="badge">
							<DeltaIcon variant="trend" />
							<DeltaValue />
						</Delta>
					</div>
					<CardDescription>
						New threads per day for the selected window.
					</CardDescription>
				</div>
				<Select
					onValueChange={(v) => {
						const n = Number(v);
						setPeriodDays(n as PeriodDays);
					}}
					value={String(periodDays)}
				>
					<SelectTrigger
						aria-label="Conversation volume time range"
						className="w-full min-w-36 sm:w-fit"
						size="sm"
					>
						<SelectValue placeholder="Range" />
					</SelectTrigger>
					<SelectContent align="end">
						<SelectItem value="7">Last 7 days</SelectItem>
						<SelectItem value="30">Last 30 days</SelectItem>
						<SelectItem value="60">Last 60 days</SelectItem>
					</SelectContent>
				</Select>
			</CardHeader>
			<CardContent>
				<ChartContainer className="aspect-22/8 w-full" config={chartConfig}>
					<AreaChart
						accessibilityLayer
						data={chartRows}
						margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
					>
						<defs>
							<linearGradient id={idAreaGradient} x1="0" x2="0" y1="0" y2="1">
								<stop
									offset="0%"
									stopColor="var(--color-conversations)"
									stopOpacity={0.45}
								/>
								<stop
									offset="55%"
									stopColor="var(--color-conversations)"
									stopOpacity={0.12}
								/>
								<stop
									offset="100%"
									stopColor="var(--color-conversations)"
									stopOpacity={0}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid className="stroke-border" vertical={false} />
						<XAxis
							axisLine={false}
							dataKey="date"
							interval={periodDays <= 7 ? 0 : "preserveStartEnd"}
							minTickGap={xAxisMinTickGap}
							tickFormatter={(value) =>
								formatChartAxisTick(String(value), periodDays)
							}
							tickLine={false}
							tickMargin={8}
						/>
						<YAxis
							axisLine={false}
							tick={{ className: "tabular-nums" }}
							tickLine={false}
							tickMargin={8}
							width={36}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									className="min-w-34"
									indicator="line"
									labelFormatter={(_, payload) => {
										const row = payload?.[0]?.payload as VolumeRow | undefined;
										if (!row?.date) {
											return "";
										}
										return formatChartTooltipDate(row.date, "long");
									}}
								/>
							}
							cursor={false}
						/>
						<Area
							dataKey="conversations"
							dot={false}
							fill={`url(#${idAreaGradient})`}
							stroke="var(--color-conversations)"
							strokeWidth={2}
							type="natural"
						/>
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
