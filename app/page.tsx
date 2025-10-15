"use client";
import { CharacterPanel } from "@/components/chat/character-panel";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { LoadingIndicator } from "@/components/chat/loading-indicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scroll } from "lucide-react";
import { useEffect, useState } from "react";

type Msg = { role: "player" | "gm" | "system"; content: string };
type LoadingStage = "rules" | "roll" | "narrative" | "done" | null;

export default function HomePage() {
	const [messages, setMessages] = useState<Msg[]>([]);
	const [className, setClassName] = useState("");
	const [bio, setBio] = useState("");
	const [busy, setBusy] = useState(false);
	const [loadingStage, setLoadingStage] = useState<LoadingStage>(null);
	const [characterKey, setCharacterKey] = useState(0);

	useEffect(() => {
		fetch("/api/history").then(async (r) => {
			const data = await r.json();
			const items = (data.items ?? []) as {
				role: "player" | "gm";
				content: string;
			}[];
			setMessages(items.map((m) => ({ role: m.role, content: m.content })));
		});
	}, []);

	async function saveProfile(newClassName: string, newBio: string) {
		setClassName(newClassName);
		setBio(newBio);
		const r = await fetch("/api/character", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ className: newClassName, bio: newBio }),
		});
		if (!r.ok) {
			const msg = await r.text();
			setMessages((prev) => [
				...prev,
				{ role: "system", content: `Профиль не сохранён: ${msg}` },
			]);
			return;
		}
		setMessages((prev) => [
			...prev,
			{ role: "system", content: "✓ Профиль сохранён" },
		]);
	}

	async function resetSession() {
		setBusy(true);
		try {
			const r = await fetch("/api/session/reset", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ regenerateCookie: false }),
			});
			if (!r.ok) throw new Error(await r.text());
			setMessages([{ role: "system", content: "✓ Сессия и история очищены" }]);
			// Force character panel to reload
			setCharacterKey((prev) => prev + 1);
		} catch (e) {
			setMessages((prev) => [
				...prev,
				{
					role: "system",
					content: `Сброс не выполнен: ${(e as Error).message}`,
				},
			]);
		} finally {
			setBusy(false);
		}
	}

	async function sendMessage(content: string) {
		const userMsg: Msg = { role: "player", content };
		setMessages((prev) => [...prev, userMsg]);
		setBusy(true);
		setLoadingStage("rules");
		try {
			const resp = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					content,
					profile: { className, bio },
				}),
			});
			if (!resp.ok || !resp.body) {
				const txt = await resp.text();
				throw new Error(txt || "No stream");
			}
			const reader = resp.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";

			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				let idx = buffer.indexOf("\n\n");
				while (idx >= 0) {
					const chunk = buffer.slice(0, idx);
					buffer = buffer.slice(idx + 2);
					idx = buffer.indexOf("\n\n");
					const line = chunk.split("\n").find((l) => l.startsWith("data: "));
					if (!line) continue;
					try {
						const evt = JSON.parse(line.slice(6));
						if (evt?.type === "rules") {
							setLoadingStage("roll");
							const requiresCheck = evt.payload.requiresCheck;
							if (requiresCheck) {
								setMessages((prev) => [
									...prev,
									{
										role: "system",
										content: `🎲 Проверка: ${evt.payload.skill || evt.payload.type}${evt.payload.dc ? ` (DC ${evt.payload.dc})` : ""}`,
									},
								]);
							} else {
								setLoadingStage("narrative");
							}
						} else if (evt?.type === "roll") {
							setLoadingStage("narrative");
							setMessages((prev) => [
								...prev,
								{
									role: "system",
									content: `🎲 Бросок: d20=${evt.payload.roll}, итог=${evt.payload.modified} (${evt.payload.category})`,
								},
							]);
						} else if (evt?.type === "outcome") {
							const icon = evt.payload.success ? "✓" : "✗";
							const crit = evt.payload.critical ? "критический " : "";
							const result = evt.payload.success ? "успех" : "провал";
							setMessages((prev) => [
								...prev,
								{
									role: "system",
									content: `${icon} ${crit}${result} (${evt.payload.margin >= 0 ? "+" : ""}${evt.payload.margin})`,
								},
							]);
						} else if (evt?.type === "narrative") {
							const delta = String(evt.payload?.textDelta ?? "");
							if (!delta) break;
							setMessages((prev) => {
								const copy = [...prev];
								const last = copy[copy.length - 1];
								if (last && last.role === "gm") {
									copy[copy.length - 1] = {
										...last,
										content: last.content + delta,
									};
								} else {
									copy.push({ role: "gm", content: delta });
								}
								return copy;
							});
						} else if (evt?.type === "final") {
							setLoadingStage("done");
						}
					} catch {
						// ignore parse errors
					}
				}
			}
		} catch (e) {
			setMessages((prev) => [
				...prev,
				{ role: "system", content: `Ошибка: ${(e as Error).message}` },
			]);
		} finally {
			setBusy(false);
			setLoadingStage(null);
		}
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
			<div className="mx-auto max-w-6xl">
				<header className="mb-6 flex items-center gap-3">
					<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
						<Scroll className="h-6 w-6" />
					</div>
					<div>
						<h1 className="text-2xl font-bold tracking-tight">RPGate</h1>
						<p className="text-sm text-muted-foreground">
							Текстовая RPG с AI Game Master
						</p>
					</div>
				</header>

				<div className="grid gap-4 lg:grid-cols-[1fr_320px]">
					<Card className="flex flex-col">
						<CardHeader className="border-b">
							<CardTitle>Приключение</CardTitle>
						</CardHeader>
						<CardContent className="flex-1 p-0">
							<ChatMessages messages={messages} />
							{loadingStage && loadingStage !== "done" && (
								<LoadingIndicator stage={loadingStage} />
							)}
						</CardContent>
						<div className="border-t p-4">
							<ChatInput onSend={sendMessage} disabled={busy} />
						</div>
					</Card>

					<div className="space-y-4">
						<CharacterPanel
							key={characterKey}
							onSave={saveProfile}
							onReset={resetSession}
							disabled={busy}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
