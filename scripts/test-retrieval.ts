#!/usr/bin/env tsx
/**
 * Test memory retrieval for specific query
 */

import { retrieveMemories } from "@/lib/agents/memory";

const SESSION_ID = 126;
const QUERY = "город Новиград";

async function main() {
	console.log(`Testing retrieval for session ${SESSION_ID}`);
	console.log(`Query: "${QUERY}"\n`);

	const result = await retrieveMemories(SESSION_ID, QUERY, {
		limit: 5,
		similarityThreshold: 0.5,
	});

	console.log(`Found ${result.memories.length} memories:`);
	console.log(`Retrieval time: ${result.retrievalTimeMs}ms\n`);

	if (result.memories.length > 0) {
		result.memories.forEach((m, i) => {
			console.log(`${i + 1}. [${m.type}] Turn ${m.turnNumber}`);
			console.log(`   Similarity: ${m.similarity?.toFixed(3)}`);
			console.log(`   Summary: ${m.summary.slice(0, 100)}...`);
			console.log(`   Entities:`, m.entities);
			console.log();
		});
	} else {
		console.log("No memories found above threshold 0.5");
	}
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Error:", err);
		process.exit(1);
	});
