import { db } from "@/db";
import { characters, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
	sessionId: z.string().optional(),
	className: z.string().optional(),
	bio: z.string().optional(),
	abilities: z
		.object({
			str: z.number(),
			dex: z.number(),
			con: z.number(),
			int: z.number(),
			wis: z.number(),
			cha: z.number(),
		})
		.optional(),
	skills: z.record(z.number()).optional(),
});

export async function GET() {
	const externalId = cookies().get("rpg_session")?.value;
	if (!externalId) {
		return NextResponse.json({ character: null });
	}

	const sess = await db
		.select()
		.from(sessions)
		.where(eq(sessions.externalId, externalId))
		.limit(1);

	if (!sess[0]) {
		return NextResponse.json({ character: null });
	}

	const [character] = await db
		.select()
		.from(characters)
		.where(eq(characters.sessionId, sess[0].id))
		.limit(1);

	return NextResponse.json({ character: character || null });
}

export async function POST(req: Request) {
	const body = await req.json().catch(() => null);
	const parsed = schema.safeParse(body);
	if (!parsed.success)
		return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

	const externalId =
		parsed.data.sessionId || cookies().get("rpg_session")?.value || "anon";
	let sess = await db
		.select()
		.from(sessions)
		.where(eq(sessions.externalId, externalId))
		.limit(1);
	if (!sess[0]) {
		// lazily create a session for this cookie if not exists
		const created = (
			await db
				.insert(sessions)
				.values({ externalId, locale: "ru", setting: "medieval_fantasy" })
				.returning()
		)[0];
		sess = [created];
	}

	const [existing] = await db
		.select()
		.from(characters)
		.where(eq(characters.sessionId, sess[0].id))
		.limit(1);
	if (!existing) {
		const created = (
			await db
				.insert(characters)
				.values({
					sessionId: sess[0].id,
					className: parsed.data.className ?? "",
					bio: parsed.data.bio ?? "",
					...(parsed.data.abilities
						? {
							strMod: parsed.data.abilities.str,
							dexMod: parsed.data.abilities.dex,
							conMod: parsed.data.abilities.con,
							intMod: parsed.data.abilities.int,
							wisMod: parsed.data.abilities.wis,
							chaMod: parsed.data.abilities.cha,
						}
						: {}),
					...(parsed.data.skills ? { skills: parsed.data.skills } : {}),
				})
				.returning()
		)[0];
		return NextResponse.json(created);
	}

	const update: Partial<typeof existing> = {};
	if (parsed.data.className !== undefined)
		update.className = parsed.data.className;
	if (parsed.data.bio !== undefined) update.bio = parsed.data.bio;
	if (parsed.data.abilities) {
		update.strMod = parsed.data.abilities.str;
		update.dexMod = parsed.data.abilities.dex;
		update.conMod = parsed.data.abilities.con;
		update.intMod = parsed.data.abilities.int;
		update.wisMod = parsed.data.abilities.wis;
		update.chaMod = parsed.data.abilities.cha;
	}
	if (parsed.data.skills) update.skills = parsed.data.skills;
	update.updatedAt = new Date();

	const updated = (
		await db
			.update(characters)
			.set(update)
			.where(eq(characters.id, existing.id))
			.returning()
	)[0];

	return NextResponse.json(updated);
}
