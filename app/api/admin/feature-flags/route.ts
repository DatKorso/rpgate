/**
 * Admin API for Feature Flag Management
 *
 * Provides endpoints to read and update feature flags globally and per-session.
 * Includes basic authentication via API key.
 */

import {
	type FeatureFlags,
	clearSessionFeatureFlags,
	getAllSessionOverrides,
	getGlobalFeatureFlags,
	setGlobalFeatureFlags,
	setSessionFeatureFlags,
} from "@/lib/feature-flags";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Simple API key authentication
 * In production, use a more robust auth system
 */
function checkAuth(req: Request): boolean {
	const authHeader = req.headers.get("authorization");
	const apiKey = process.env.ADMIN_API_KEY;

	// If no API key is configured, allow access (dev mode)
	if (!apiKey) {
		console.warn(
			"[Admin API] ADMIN_API_KEY not configured, allowing unauthenticated access",
		);
		return true;
	}

	// Check Bearer token format
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return false;
	}

	const token = authHeader.substring(7);
	return token === apiKey;
}

/**
 * GET /api/admin/feature-flags
 *
 * Returns current global feature flags and all session overrides
 */
export async function GET(req: Request) {
	// Check authentication
	if (!checkAuth(req)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const globalFlags = getGlobalFeatureFlags();
		const sessionOverrides = getAllSessionOverrides();

		return NextResponse.json({
			global: globalFlags,
			sessionOverrides,
			totalSessions: sessionOverrides.length,
		});
	} catch (err) {
		console.error("[Admin API] Error reading feature flags:", err);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

const updateSchema = z.object({
	scope: z.enum(["global", "session"]),
	sessionId: z.number().optional(),
	flags: z
		.object({
			enableMemoryAgent: z.boolean().optional(),
			enableWorldKnowledge: z.boolean().optional(),
			enablePlayerKnowledge: z.boolean().optional(),
		})
		.optional(),
	action: z.enum(["set", "clear"]).optional(),
});

/**
 * POST /api/admin/feature-flags
 *
 * Updates feature flags globally or for a specific session
 *
 * Body examples:
 * - Set global flags: { "scope": "global", "flags": { "enableMemoryAgent": false } }
 * - Set session flags: { "scope": "session", "sessionId": 123, "flags": { "enableWorldKnowledge": false } }
 * - Clear session flags: { "scope": "session", "sessionId": 123, "action": "clear" }
 */
export async function POST(req: Request) {
	// Check authentication
	if (!checkAuth(req)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await req.json().catch(() => null);
		const parsed = updateSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{
					error: "Invalid request body",
					details: parsed.error.errors,
				},
				{ status: 400 },
			);
		}

		const { scope, sessionId, flags, action } = parsed.data;

		if (scope === "global") {
			// Update global flags
			if (!flags) {
				return NextResponse.json(
					{ error: "flags required for global scope" },
					{ status: 400 },
				);
			}

			setGlobalFeatureFlags(flags);

			return NextResponse.json({
				success: true,
				scope: "global",
				flags: getGlobalFeatureFlags(),
			});
		}

		if (scope === "session") {
			// Update session-specific flags
			if (!sessionId) {
				return NextResponse.json(
					{ error: "sessionId required for session scope" },
					{ status: 400 },
				);
			}

			if (action === "clear") {
				// Clear session overrides
				clearSessionFeatureFlags(sessionId);

				return NextResponse.json({
					success: true,
					scope: "session",
					sessionId,
					action: "cleared",
					message: "Session will use global defaults",
				});
			}

			// Set session overrides
			if (!flags) {
				return NextResponse.json(
					{ error: "flags required for set action" },
					{ status: 400 },
				);
			}

			setSessionFeatureFlags(sessionId, flags);

			return NextResponse.json({
				success: true,
				scope: "session",
				sessionId,
				flags,
			});
		}

		return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
	} catch (err) {
		console.error("[Admin API] Error updating feature flags:", err);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
