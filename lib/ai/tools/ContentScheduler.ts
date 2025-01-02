type SupportedTimezone = "UTC" | "America/New_York" | "America/Los_Angeles" | "Europe/London" | "Asia/Tokyo";

interface ScheduleConfig {
	bestTime: string;
	bestDay: string;
	frequency: string;
	socialMedia: {
		twitter: string[];
		facebook: string[];
		linkedin: string[];
		instagram: string[];
	};
}

export class ContentScheduler {
	async suggest(topic: string): Promise<Record<SupportedTimezone, ScheduleConfig>> {
		const baseSchedule: ScheduleConfig = {
			bestTime: "10:00",
			bestDay: "Tuesday",
			frequency: "weekly",
			socialMedia: {
				twitter: ["9:00", "15:00", "19:00"],
				facebook: ["11:00", "16:00"],
				linkedin: ["8:00", "14:00"],
				instagram: ["12:00", "18:00"],
			},
		};

		return {
			UTC: baseSchedule,
			"America/New_York": {
				...baseSchedule,
				bestTime: "9:00",
			},
			"America/Los_Angeles": {
				...baseSchedule,
				bestTime: "8:00",
			},
			"Europe/London": {
				...baseSchedule,
				bestTime: "11:00",
			},
			"Asia/Tokyo": {
				...baseSchedule,
				bestTime: "10:00",
				bestDay: "Wednesday",
			},
		};
	}
}
