/**
 * Memory Metrics API Endpoint
 *
 * Provides access to memory system metrics and recent logs for monitoring.
 * In production, this should be protected with authentication.
 */

import { getMemoryMetrics, getRecentLogs } from "@/lib/memory/logger";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const includeRecentLogs = searchParams.get("logs") === "true";
	const logLimit = Number.parseInt(searchParams.get("limit") || "10", 10);

	const metrics = getMemoryMetrics();

	const response: {
		metrics: ReturnType<typeof getMemoryMetrics>;
		recentLogs?: ReturnType<typeof getRecentLogs>;
	} = {
		metrics,
	};

	if (includeRecentLogs) {
		response.recentLogs = getRecentLogs(logLimit);
	}

	return NextResponse.json(response);
}
