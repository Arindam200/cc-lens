import { ChannelBreakdownChart } from "@/components/channel-breakdown-chart";
import { ConversationVolumeChart } from "@/components/conversation-volume-chart";
import { CsatResponsesChart } from "@/components/csat-responses-chart";
import { FirstReplyTimeChart } from "@/components/first-reply-time-chart";
import { RecentConversations } from "@/components/recent-conversations";
import { DashboardStats } from "@/components/stats";
import { SupportActivity } from "@/components/support-activity";
import { TeamOnDuty } from "@/components/team-on-duty";

export function Dashboard() {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<DashboardStats />
			<ConversationVolumeChart />
			<ChannelBreakdownChart />
			<CsatResponsesChart />
			<FirstReplyTimeChart />
			<TeamOnDuty />
			<RecentConversations />
			<SupportActivity />
		</div>
	);
}
