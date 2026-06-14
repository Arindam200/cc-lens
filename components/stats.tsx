import { cn } from "@/lib/utils";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";

type Stat = {
	label: string;
	value: string;
	delta: number;
	footnote: string;
	/** When true, a negative delta is treated as favorable (e.g. queue depth, reply time). */
	lowerIsBetter: boolean;
};

const stats: readonly Stat[] = [
	{
		label: "Open queue",
		value: "38",
		delta: -12.4,
		footnote: "vs yesterday",
		lowerIsBetter: true,
	},
	{
		label: "Active conversations",
		value: "126",
		delta: 5.2,
		footnote: "vs last week",
		lowerIsBetter: false,
	},
	{
		label: "Median first reply",
		value: "4.1m",
		delta: -8.0,
		footnote: "vs last week",
		lowerIsBetter: true,
	},
	{
		label: "CSAT (30d)",
		value: "94%",
		delta: 1.1,
		footnote: "vs prior 30d",
		lowerIsBetter: false,
	},
];

export function DashboardStats() {
	return (
		<>
			{stats.map((s) => (
				<Card className={cn("shadow-none dark:ring-0")} key={s.label}>
					<CardHeader>
						<CardTitle className="font-normal text-muted-foreground text-xs">
							{s.label}
						</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-2">
						<p className="font-semibold text-2xl tabular-nums">{s.value}</p>
						<div className="flex items-center gap-1 text-xs">
							<Delta value={s.delta}>
								<DeltaIcon />
								<DeltaValue />
							</Delta>
							<span className="text-muted-foreground">{s.footnote}</span>
						</div>
					</CardContent>
				</Card>
			))}
		</>
	);
}
