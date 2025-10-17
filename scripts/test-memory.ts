#!/usr/bin/env tsx
/**
 * Quick manual test script for Personal Memory System
 * 
 * Usage:
 *   DATABASE_URL=... AITUNNEL_API_KEY=... npx tsx scripts/test-memory.ts
 * 
 * Or set variables in your shell:
 *   export DATABASE_URL=postgres://...
 *   export AITUNNEL_API_KEY=sk-...
 *   npx tsx scripts/test-memory.ts
 */

import { db } from "@/db";
import { memoryEntries, messages, sessions, turns } from "@/db/schema";
import { retrieveMemories } from "@/lib/agents/memory";
import {
	extractMemoryFromTurn,
	storeMemory,
} from "@/lib/agents/memory-storage";
import { analyzeMemoryNeed } from "@/lib/memory/heuristic";
import { eq } from "drizzle-orm";

const TEST_SESSION_ID = `test-memory-manual-${Date.now()}`;

async function cleanup(sessionId: number) {
	console.log("\n🧹 Cleaning up test data...");
	await db.delete(sessions).where(eq(sessions.id, sessionId));
	console.log("✅ Cleanup complete");
}

async function main() {
	console.log("🧪 Personal Memory System - Manual Test\n");

	// Step 1: Create test session
	console.log("📝 Creating test session...");
	const [session] = await db
		.insert(sessions)
		.values({
			externalId: TEST_SESSION_ID,
			locale: "ru",
			setting: "medieval_fantasy",
		})
		.returning();
	console.log(`✅ Session created: ${session.id}\n`);

	try {
		// Step 2: Test Heuristic Gate
		console.log("🔍 Testing Heuristic Gate...");
		const testInputs = [
			"Я возвращаюсь в таверну Золотой Дракон",
			"Помнишь, кто такой Иван?",
			"Я иду налево",
			"Расскажи о драконе",
		];

		for (const input of testInputs) {
			const result = analyzeMemoryNeed(input, []);
			console.log(`  Input: "${input}"`);
			console.log(`  → Should retrieve: ${result.shouldRetrieve}`);
			console.log(`  → Triggers: ${result.triggers.join(", ")}`);
			console.log(`  → Entities: ${result.entities.join(", ")}`);
			console.log(`  → Confidence: ${result.confidence}\n`);
		}

		// Step 3: Create and store memories
		console.log("💾 Creating test memories...");
		const testMemories = [
			{
				player: "Я прибываю в город Новгород",
				gm: "Ты входишь в большой город Новгород. Улицы полны людей и торговцев.",
			},
			{
				player: "Я встречаю торговца по имени Иван",
				gm: "Торговец Иван приветствует тебя. Он предлагает купить зелье здоровья.",
			},
			{
				player: "Я нахожу древний меч с рунами",
				gm: "Ты находишь древний меч с светящимися рунами. Он излучает магическую энергию.",
			},
			{
				player: "Я получаю квест от старейшины деревни",
				gm: "Старейшина просит тебя найти пропавших детей в тёмном лесу.",
			},
		];

		for (let i = 0; i < testMemories.length; i++) {
			const mem = testMemories[i];

			// Create messages
			const [playerMsg] = await db
				.insert(messages)
				.values({
					sessionId: session.id,
					role: "player",
					content: mem.player,
				})
				.returning();

			const [gmMsg] = await db
				.insert(messages)
				.values({
					sessionId: session.id,
					role: "gm",
					content: mem.gm,
				})
				.returning();

			// Create turn
			const [turn] = await db
				.insert(turns)
				.values({
					sessionId: session.id,
					playerMessageId: playerMsg.id,
					gmMessageId: gmMsg.id,
					meta: "",
				})
				.returning();

			// Extract and store memory
			const extraction = extractMemoryFromTurn(mem.player, mem.gm, i + 1);

			if (extraction.shouldStore) {
				await storeMemory(session.id, turn.id, i + 1, extraction);
				console.log(`  ✅ Memory ${i + 1} stored:`);
				console.log(`     Type: ${extraction.type}`);
				console.log(`     Summary: ${extraction.summary?.slice(0, 60)}...`);
				console.log(
					`     Entities: ${JSON.stringify(extraction.entities)}\n`,
				);
			} else {
				console.log(`  ⏭️  Memory ${i + 1} skipped (not important)\n`);
			}
		}

		// Step 4: Verify stored memories
		console.log("📊 Checking stored memories in database...");
		const stored = await db
			.select()
			.from(memoryEntries)
			.where(eq(memoryEntries.sessionId, session.id));

		console.log(`  Found ${stored.length} memories in database:`);
		for (const mem of stored) {
			console.log(`    - [${mem.type}] Turn ${mem.turnNumber}: ${mem.summary.slice(0, 50)}...`);
		}
		console.log();

		// Step 5: Test retrieval
		console.log("🔎 Testing memory retrieval...");
		const testQueries = [
			"Где находится город Новгород?",
			"Кто такой Иван?",
			"Что я нашел в пещере?",
			"Какой квест дал старейшина?",
		];

		for (const query of testQueries) {
			console.log(`  Query: "${query}"`);
			const result = await retrieveMemories(session.id, query, {
				limit: 3,
				similarityThreshold: 0.5,
				timeoutMs: 5000,
			});

			console.log(`  → Found ${result.memories.length} memories`);
			console.log(`  → Retrieval time: ${result.retrievalTimeMs}ms`);

			if (result.memories.length > 0) {
				console.log("  → Top results:");
				for (const mem of result.memories) {
					console.log(
						`     [${mem.type}] Similarity: ${mem.similarity?.toFixed(3)} - ${mem.summary.slice(0, 50)}...`,
					);
				}
			}
			console.log();
		}

		// Step 6: Test with low similarity threshold
		console.log("🎯 Testing with different similarity thresholds...");
		const testQuery = "таверна";

		for (const threshold of [0.5, 0.7, 0.9]) {
			const result = await retrieveMemories(session.id, testQuery, {
				limit: 5,
				similarityThreshold: threshold,
			});
			console.log(
				`  Threshold ${threshold}: ${result.memories.length} memories found`,
			);
		}
		console.log();

		// Success summary
		console.log("✅ All tests completed successfully!\n");
		console.log("📋 Summary:");
		console.log(`  - Session ID: ${session.id}`);
		console.log(`  - Memories stored: ${stored.length}`);
		console.log(`  - Heuristic triggers tested: 4`);
		console.log(`  - Retrieval queries tested: ${testQueries.length}`);
		console.log();
	} finally {
		// Cleanup
		await cleanup(session.id);
	}
}

main()
	.then(() => {
		console.log("🎉 Test script finished");
		process.exit(0);
	})
	.catch((err) => {
		console.error("❌ Test failed:", err);
		process.exit(1);
	});
