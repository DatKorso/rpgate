#!/usr/bin/env tsx
/**
 * Backfill World Knowledge Script
 *
 * Extracts world entities and relationships from existing game turns.
 * Processes turns in batches with rate limiting and progress tracking.
 *
 * Usage:
 *   DATABASE_URL=... OPENROUTER_API_KEY=... npx tsx scripts/backfill-world-knowledge.ts [options]
 *
 * Options:
 *   --session-id <id>     Process specific session only
 *   --batch-size <n>      Number of turns per batch (default: 10)
 *   --delay <ms>          Delay between batches in ms (default: 1000)
 *   --resume              Resume from last checkpoint
 *   --dry-run             Show what would be processed without making changes
 */

import { db } from "@/db";
import { messages, sessions, turns, worldEntities } from "@/db/schema";
import { updateWorldKnowledge } from "@/lib/agents/world-knowledge-updater";
import { persistWorldKnowledge } from "@/lib/knowledge/world-persistence";
import { eq } from "drizzle-orm";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface BackfillOptions {
	sessionId?: number;
	batchSize: number;
	delayMs: number;
	resume: boolean;
	dryRun: boolean;
}

interface ProgressCheckpoint {
	sessionId: number;
	lastProcessedTurnId: number;
	processedTurns: number;
	entitiesCreated: number;
	entitiesUpdated: number;
	relationshipsCreated: number;
	errors: number;
	timestamp: string;
}

interface TurnData {
	id: number;
	sessionId: number;
	turnNumber: number;
	playerMessage: string;
	gmMessage: string;
}

const CHECKPOINT_FILE = join(process.cwd(), ".backfill-world-checkpoint.json");

async function main() {
	console.log("🌍 World Knowledge Backfill Script\n");

	// Validate environment variables
	if (!process.env.DATABASE_URL) {
		console.error("❌ DATABASE_URL not found in environment");
		process.exit(1);
	}

	if (!process.env.OPENROUTER_API_KEY) {
		console.error("❌ OPENROUTER_API_KEY not found in environment");
		process.exit(1);
	}

	// Parse command line options
	const options = parseOptions();

	console.log("📋 Configuration:");
	console.log(`  Session ID: ${options.sessionId ?? "all"}`);
	console.log(`  Batch size: ${options.batchSize}`);
	console.log(`  Delay: ${options.delayMs}ms`);
	console.log(`  Resume: ${options.resume}`);
	console.log(`  Dry run: ${options.dryRun}`);
	console.log();

	// Load checkpoint if resuming
	let checkpoint: ProgressCheckpoint | null = null;
	if (options.resume) {
		checkpoint = loadCheckpoint();
		if (checkpoint) {
			console.log("📍 Resuming from checkpoint:");
			console.log(`  Session: ${checkpoint.sessionId}`);
			console.log(`  Last turn: ${checkpoint.lastProcessedTurnId}`);
			console.log(`  Processed: ${checkpoint.processedTurns} turns`);
			console.log();
		} else {
			console.log("ℹ️  No checkpoint found, starting fresh\n");
		}
	}

	// Get sessions to process
	const sessionsToProcess = await getSessions(options.sessionId);

	if (sessionsToProcess.length === 0) {
		console.log("ℹ️  No sessions found to process");
		return;
	}

	console.log(`📊 Found ${sessionsToProcess.length} session(s) to process\n`);

	// Process each session
	let totalStats = {
		sessions: 0,
		turns: 0,
		entitiesCreated: 0,
		entitiesUpdated: 0,
		relationshipsCreated: 0,
		errors: 0,
	};

	for (const session of sessionsToProcess) {
		// Skip if resuming and this session was already completed
		if (checkpoint && checkpoint.sessionId > session.id) {
			console.log(`⏭️  Skipping session ${session.id} (already processed)`);
			continue;
		}

		const sessionStats = await processSession(
			session.id,
			options,
			checkpoint?.sessionId === session.id ? checkpoint : null,
		);

		totalStats.sessions++;
		totalStats.turns += sessionStats.turns;
		totalStats.entitiesCreated += sessionStats.entitiesCreated;
		totalStats.entitiesUpdated += sessionStats.entitiesUpdated;
		totalStats.relationshipsCreated += sessionStats.relationshipsCreated;
		totalStats.errors += sessionStats.errors;
	}

	// Print summary
	console.log("\n✅ Backfill complete!\n");
	console.log("📊 Summary:");
	console.log(`  Sessions processed: ${totalStats.sessions}`);
	console.log(`  Turns processed: ${totalStats.turns}`);
	console.log(`  Entities created: ${totalStats.entitiesCreated}`);
	console.log(`  Entities updated: ${totalStats.entitiesUpdated}`);
	console.log(`  Relationships created: ${totalStats.relationshipsCreated}`);
	console.log(`  Errors: ${totalStats.errors}`);
	console.log();

	// Clean up checkpoint file if successful
	if (!options.dryRun && totalStats.errors === 0) {
		try {
			const fs = await import("node:fs");
			if (fs.existsSync(CHECKPOINT_FILE)) {
				fs.unlinkSync(CHECKPOINT_FILE);
				console.log("🧹 Checkpoint file cleaned up");
			}
		} catch (error) {
			// Ignore cleanup errors
		}
	}
}

async function processSession(
	sessionId: number,
	options: BackfillOptions,
	checkpoint: ProgressCheckpoint | null,
): Promise<{
	turns: number;
	entitiesCreated: number;
	entitiesUpdated: number;
	relationshipsCreated: number;
	errors: number;
}> {
	console.log(`\n🎮 Processing session ${sessionId}...`);

	// Get all turns for this session
	const allTurns = await getTurnsForSession(
		sessionId,
		checkpoint?.lastProcessedTurnId,
	);

	if (allTurns.length === 0) {
		console.log(`  ℹ️  No turns to process`);
		return {
			turns: 0,
			entitiesCreated: 0,
			entitiesUpdated: 0,
			relationshipsCreated: 0,
			errors: 0,
		};
	}

	console.log(`  📝 Found ${allTurns.length} turn(s) to process`);

	// Check existing entities
	const existingEntities = await db
		.select()
		.from(worldEntities)
		.where(eq(worldEntities.sessionId, sessionId));

	console.log(`  📦 Existing entities: ${existingEntities.length}`);

	if (options.dryRun) {
		console.log(`  🔍 DRY RUN: Would process ${allTurns.length} turns`);
		return {
			turns: allTurns.length,
			entitiesCreated: 0,
			entitiesUpdated: 0,
			relationshipsCreated: 0,
			errors: 0,
		};
	}

	// Process in batches
	const stats = {
		turns: 0,
		entitiesCreated: 0,
		entitiesUpdated: 0,
		relationshipsCreated: 0,
		errors: 0,
	};

	for (let i = 0; i < allTurns.length; i += options.batchSize) {
		const batch = allTurns.slice(i, i + options.batchSize);
		const batchNum = Math.floor(i / options.batchSize) + 1;
		const totalBatches = Math.ceil(allTurns.length / options.batchSize);

		console.log(
			`\n  📦 Batch ${batchNum}/${totalBatches} (${batch.length} turns)`,
		);

		for (const turn of batch) {
			try {
				// Extract world knowledge
				const update = await updateWorldKnowledge(
					turn.sessionId,
					turn.turnNumber,
					turn.playerMessage,
					turn.gmMessage,
					{ timeoutMs: 10000 }, // Longer timeout for backfill
				);

				// Persist to database
				if (update.entities.length > 0 || update.relationships.length > 0) {
					const result = await persistWorldKnowledge(turn.sessionId, update);

					stats.entitiesCreated += result.entitiesCreated;
					stats.entitiesUpdated += result.entitiesUpdated;
					stats.relationshipsCreated += result.relationshipsCreated;
					stats.errors += result.errors.length;

					console.log(
						`    ✓ Turn ${turn.turnNumber}: +${result.entitiesCreated} entities, +${result.relationshipsCreated} relationships`,
					);
				} else {
					console.log(`    ⏭️  Turn ${turn.turnNumber}: no knowledge extracted`);
				}

				stats.turns++;

				// Save checkpoint
				saveCheckpoint({
					sessionId: turn.sessionId,
					lastProcessedTurnId: turn.id,
					processedTurns: stats.turns,
					entitiesCreated: stats.entitiesCreated,
					entitiesUpdated: stats.entitiesUpdated,
					relationshipsCreated: stats.relationshipsCreated,
					errors: stats.errors,
					timestamp: new Date().toISOString(),
				});
			} catch (error) {
				console.error(
					`    ❌ Turn ${turn.turnNumber} failed:`,
					error instanceof Error ? error.message : String(error),
				);
				stats.errors++;
			}
		}

		// Rate limiting delay between batches
		if (i + options.batchSize < allTurns.length) {
			console.log(`  ⏳ Waiting ${options.delayMs}ms before next batch...`);
			await sleep(options.delayMs);
		}
	}

	console.log(`\n  ✅ Session ${sessionId} complete:`);
	console.log(`    Turns: ${stats.turns}`);
	console.log(`    Entities created: ${stats.entitiesCreated}`);
	console.log(`    Entities updated: ${stats.entitiesUpdated}`);
	console.log(`    Relationships: ${stats.relationshipsCreated}`);
	console.log(`    Errors: ${stats.errors}`);

	return stats;
}

async function getSessions(sessionId?: number) {
	if (sessionId) {
		const result = await db
			.select()
			.from(sessions)
			.where(eq(sessions.id, sessionId));
		return result;
	}

	return await db.select().from(sessions);
}

async function getTurnsForSession(
	sessionId: number,
	afterTurnId?: number,
): Promise<TurnData[]> {
	// Get all turns with their messages
	const turnsData = await db
		.select({
			turnId: turns.id,
			sessionId: turns.sessionId,
			playerMessageId: turns.playerMessageId,
			gmMessageId: turns.gmMessageId,
		})
		.from(turns)
		.where(eq(turns.sessionId, sessionId))
		.orderBy(turns.id);

	// Filter by checkpoint if provided
	const filteredTurns = afterTurnId
		? turnsData.filter((t) => t.turnId > afterTurnId)
		: turnsData;

	// Load messages for each turn
	const result: TurnData[] = [];

	for (let i = 0; i < filteredTurns.length; i++) {
		const turn = filteredTurns[i];

		// Get player message
		const playerMsg = await db
			.select()
			.from(messages)
			.where(eq(messages.id, turn.playerMessageId))
			.limit(1);

		if (playerMsg.length === 0) {
			console.warn(`  ⚠️  Turn ${turn.turnId}: player message not found`);
			continue;
		}

		// Get GM message
		if (!turn.gmMessageId) {
			console.warn(`  ⚠️  Turn ${turn.turnId}: GM message not found`);
			continue;
		}

		const gmMsg = await db
			.select()
			.from(messages)
			.where(eq(messages.id, turn.gmMessageId))
			.limit(1);

		if (gmMsg.length === 0) {
			console.warn(`  ⚠️  Turn ${turn.turnId}: GM message not found`);
			continue;
		}

		result.push({
			id: turn.turnId,
			sessionId: turn.sessionId,
			turnNumber: i + 1,
			playerMessage: playerMsg[0].content,
			gmMessage: gmMsg[0].content,
		});
	}

	return result;
}

function parseOptions(): BackfillOptions {
	const args = process.argv.slice(2);
	const options: BackfillOptions = {
		batchSize: 10,
		delayMs: 1000,
		resume: false,
		dryRun: false,
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		switch (arg) {
			case "--session-id":
				options.sessionId = Number.parseInt(args[++i], 10);
				break;
			case "--batch-size":
				options.batchSize = Number.parseInt(args[++i], 10);
				break;
			case "--delay":
				options.delayMs = Number.parseInt(args[++i], 10);
				break;
			case "--resume":
				options.resume = true;
				break;
			case "--dry-run":
				options.dryRun = true;
				break;
			default:
				console.warn(`Unknown option: ${arg}`);
		}
	}

	return options;
}

function loadCheckpoint(): ProgressCheckpoint | null {
	try {
		const data = readFileSync(CHECKPOINT_FILE, "utf-8");
		return JSON.parse(data) as ProgressCheckpoint;
	} catch (error) {
		return null;
	}
}

function saveCheckpoint(checkpoint: ProgressCheckpoint): void {
	try {
		writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
	} catch (error) {
		console.error("Failed to save checkpoint:", error);
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

main()
	.then(() => {
		console.log("🎉 Script finished");
		process.exit(0);
	})
	.catch((err) => {
		console.error("❌ Script failed:", err);
		process.exit(1);
	});
