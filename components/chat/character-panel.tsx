"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dices, Save, Trash2, User } from "lucide-react";
import { useEffect, useState } from "react";

interface CharacterPanelProps {
	onSave: (className: string, bio: string) => Promise<void>;
	onReset: () => Promise<void>;
	disabled?: boolean;
}

type Character = {
	id: number;
	className: string;
	bio: string;
	strMod: number;
	dexMod: number;
	conMod: number;
	intMod: number;
	wisMod: number;
	chaMod: number;
	skills: Record<string, number>;
};

export function CharacterPanel({
	onSave,
	onReset,
	disabled,
}: CharacterPanelProps) {
	const [className, setClassName] = useState("");
	const [bio, setBio] = useState("");
	const [saving, setSaving] = useState(false);
	const [regenerating, setRegenerating] = useState(false);
	const [character, setCharacter] = useState<Character | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetch("/api/character")
			.then((r) => r.json())
			.then((data) => {
				if (data.character) {
					setCharacter(data.character);
					setClassName(data.character.className || "");
					setBio(data.character.bio || "");
				}
			})
			.finally(() => setLoading(false));
	}, []);

	const handleSave = async () => {
		setSaving(true);
		try {
			await onSave(className, bio);
			// Reload character data after save
			const r = await fetch("/api/character");
			const data = await r.json();
			if (data.character) {
				setCharacter(data.character);
			}
		} finally {
			setSaving(false);
		}
	};

	const handleRegenerate = async () => {
		setRegenerating(true);
		try {
			const r = await fetch("/api/character/regenerate", {
				method: "POST",
			});
			if (r.ok) {
				const data = await r.json();
				if (data.character) {
					setCharacter(data.character);
				}
			}
		} finally {
			setRegenerating(false);
		}
	};

	if (loading) {
		return (
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base">
						<User className="h-4 w-4" />
						Персонаж
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">Загрузка...</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="flex items-center gap-2 text-base">
					<User className="h-4 w-4" />
					Персонаж
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{character ? (
					<>
						<div className="rounded-lg border bg-muted/50 p-3 space-y-2">
							<div>
								<p className="text-xs font-medium text-muted-foreground">
									Класс
								</p>
								<p className="text-sm font-medium">
									{character.className || "Не указан"}
								</p>
							</div>
							{character.bio && (
								<div>
									<p className="text-xs font-medium text-muted-foreground">
										Биография
									</p>
									<p className="text-sm">{character.bio}</p>
								</div>
							)}
							<div className="grid grid-cols-3 gap-2 pt-2 border-t">
								<div className="text-center">
									<p className="text-xs text-muted-foreground">СИЛ</p>
									<p className="text-sm font-medium">
										{character.strMod >= 0 ? "+" : ""}
										{character.strMod}
									</p>
								</div>
								<div className="text-center">
									<p className="text-xs text-muted-foreground">ЛОВ</p>
									<p className="text-sm font-medium">
										{character.dexMod >= 0 ? "+" : ""}
										{character.dexMod}
									</p>
								</div>
								<div className="text-center">
									<p className="text-xs text-muted-foreground">ТЕЛ</p>
									<p className="text-sm font-medium">
										{character.conMod >= 0 ? "+" : ""}
										{character.conMod}
									</p>
								</div>
								<div className="text-center">
									<p className="text-xs text-muted-foreground">ИНТ</p>
									<p className="text-sm font-medium">
										{character.intMod >= 0 ? "+" : ""}
										{character.intMod}
									</p>
								</div>
								<div className="text-center">
									<p className="text-xs text-muted-foreground">МДР</p>
									<p className="text-sm font-medium">
										{character.wisMod >= 0 ? "+" : ""}
										{character.wisMod}
									</p>
								</div>
								<div className="text-center">
									<p className="text-xs text-muted-foreground">ХАР</p>
									<p className="text-sm font-medium">
										{character.chaMod >= 0 ? "+" : ""}
										{character.chaMod}
									</p>
								</div>
							</div>
						</div>
						<details className="text-sm">
							<summary className="cursor-pointer text-muted-foreground hover:text-foreground">
								Редактировать
							</summary>
							<div className="space-y-2 mt-2">
								<Input
									placeholder="Класс (например, Воин)"
									value={className}
									onChange={(e) => setClassName(e.target.value)}
									disabled={disabled}
								/>
								<Input
									placeholder="Краткая биография"
									value={bio}
									onChange={(e) => setBio(e.target.value)}
									disabled={disabled}
								/>
								<Button
									onClick={handleSave}
									disabled={disabled || saving}
									className="w-full"
									size="sm"
								>
									<Save className="h-3.5 w-3.5" />
									Обновить
								</Button>
								<Button
									onClick={handleRegenerate}
									disabled={disabled || regenerating}
									variant="outline"
									className="w-full"
									size="sm"
								>
									<Dices className="h-3.5 w-3.5" />
									{regenerating ? "Бросаем кубики..." : "Перебросить характеристики"}
								</Button>
							</div>
						</details>
					</>
				) : (
					<>
						<p className="text-sm text-muted-foreground mb-3">
							Персонаж не создан. Заполните данные ниже:
						</p>
						<Input
							placeholder="Класс (например, Воин)"
							value={className}
							onChange={(e) => setClassName(e.target.value)}
							disabled={disabled}
						/>
						<Input
							placeholder="Краткая биография"
							value={bio}
							onChange={(e) => setBio(e.target.value)}
							disabled={disabled}
						/>
						<Button
							onClick={handleSave}
							disabled={disabled || saving}
							className="w-full"
							size="sm"
						>
							<Save className="h-3.5 w-3.5" />
							Создать персонажа
						</Button>
					</>
				)}
				<Button
					onClick={onReset}
					disabled={disabled}
					variant="outline"
					size="sm"
					className="w-full"
				>
					<Trash2 className="h-3.5 w-3.5" />
					Сбросить сессию
				</Button>
			</CardContent>
		</Card>
	);
}
