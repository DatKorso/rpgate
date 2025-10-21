"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { AppearanceData, BackgroundData } from "@/lib/agents/protocol";
import {
	Briefcase,
	Dices,
	Eye,
	MapPin,
	Save,
	Trash2,
	User,
} from "lucide-react";
import { useEffect, useState } from "react";

interface EnhancedCharacterPanelProps {
	onSave: (profile: {
		className: string;
		bio: string;
		appearance?: AppearanceData;
		background?: BackgroundData;
		abilityPriority?: "physical" | "mental" | "social";
	}) => Promise<void>;
	onReset: () => Promise<void>;
	disabled?: boolean;
}

type EnhancedCharacter = {
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
	appearance: AppearanceData;
	background: BackgroundData;
	abilityPriority?: "physical" | "mental" | "social";
};

const APPEARANCE_OPTIONS = {
	height: [
		{ value: "низкий", label: "Низкий" },
		{ value: "средний", label: "Средний" },
		{ value: "высокий", label: "Высокий" },
	],
	build: [
		{ value: "худощавый", label: "Худощавый" },
		{ value: "крепкий", label: "Крепкий" },
		{ value: "полный", label: "Полный" },
	],
	hair: [
		{ value: "темные", label: "Темные" },
		{ value: "светлые", label: "Светлые" },
		{ value: "рыжие", label: "Рыжие" },
		{ value: "седые", label: "Седые" },
	],
	eyes: [
		{ value: "карие", label: "Карие" },
		{ value: "голубые", label: "Голубые" },
		{ value: "зеленые", label: "Зеленые" },
		{ value: "серые", label: "Серые" },
	],
};

const BACKGROUND_OPTIONS = {
	origin: [
		{ value: "деревня", label: "Деревня" },
		{ value: "город", label: "Город" },
		{ value: "дворянство", label: "Дворянство" },
		{ value: "кочевники", label: "Кочевники" },
	],
	profession: [
		{ value: "ремесленник", label: "Ремесленник" },
		{ value: "торговец", label: "Торговец" },
		{ value: "солдат", label: "Солдат" },
		{ value: "ученый", label: "Ученый" },
	],
};

const ABILITY_PRIORITIES = [
	{
		value: "physical",
		label: "Физические",
		description: "СИЛ +2, ЛОВ +2, ТЕЛ +1",
	},
	{
		value: "mental",
		label: "Ментальные",
		description: "ИНТ +2, МДР +2, ТЕЛ +1",
	},
	{
		value: "social",
		label: "Социальные",
		description: "ХАР +2, МДР +2, ТЕЛ +1",
	},
];

export function EnhancedCharacterPanel({
	onSave,
	onReset,
	disabled,
}: EnhancedCharacterPanelProps) {
	const [className, setClassName] = useState("");
	const [bio, setBio] = useState("");
	const [saving, setSaving] = useState(false);
	const [regenerating, setRegenerating] = useState(false);
	const [character, setCharacter] = useState<EnhancedCharacter | null>(null);
	const [loading, setLoading] = useState(true);
	const [isEditing, setIsEditing] = useState(false);

	// Enhanced character data state
	const [appearance, setAppearance] = useState<AppearanceData>({});
	const [background, setBackground] = useState<BackgroundData>({});
	const [abilityPriority, setAbilityPriority] = useState<
		"physical" | "mental" | "social" | undefined
	>();

	useEffect(() => {
		fetch("/api/character")
			.then((r) => r.json())
			.then((data) => {
				if (data.character) {
					setCharacter(data.character);
					setClassName(data.character.className || "");
					setBio(data.character.bio || "");
					setAppearance(data.character.appearance || {});
					setBackground(data.character.background || {});
					setAbilityPriority(data.character.abilityPriority);
				}
			})
			.finally(() => setLoading(false));
	}, []);

	const handleSave = async () => {
		setSaving(true);
		try {
			await onSave({
				className,
				bio,
				appearance: Object.keys(appearance).length > 0 ? appearance : undefined,
				background: Object.keys(background).length > 0 ? background : undefined,
				abilityPriority,
			});
			// Reload character data after save
			const r = await fetch("/api/character");
			const data = await r.json();
			if (data.character) {
				setCharacter(data.character);
				setAppearance(data.character.appearance || {});
				setBackground(data.character.background || {});
				setAbilityPriority(data.character.abilityPriority);
			}
			setIsEditing(false);
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

	const formatAppearanceDisplay = (appearance: AppearanceData) => {
		const parts = [];
		if (appearance.age) parts.push(`${appearance.age} лет`);
		if (appearance.height) parts.push(appearance.height);
		if (appearance.build) parts.push(appearance.build);
		if (appearance.hair) parts.push(`${appearance.hair} волосы`);
		if (appearance.eyes) parts.push(`${appearance.eyes} глаза`);
		return parts.join(", ");
	};

	const formatBackgroundDisplay = (background: BackgroundData) => {
		const parts = [];
		if (background.origin)
			parts.push(
				`из ${background.origin === "дворянство" ? "дворянства" : background.origin === "деревня" ? "деревни" : background.origin === "город" ? "города" : "кочевников"}`,
			);
		if (background.profession) parts.push(background.profession);
		return parts.join(", ");
	};

	const getPriorityBadgeColor = (priority?: string) => {
		switch (priority) {
			case "physical":
				return "bg-red-100 text-red-800 border-red-200";
			case "mental":
				return "bg-blue-100 text-blue-800 border-blue-200";
			case "social":
				return "bg-green-100 text-green-800 border-green-200";
			default:
				return "bg-gray-100 text-gray-800 border-gray-200";
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
						<div className="rounded-lg border bg-muted/50 p-3 space-y-3">
							{/* Basic Info */}
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

							{/* Ability Priority */}
							{character.abilityPriority && (
								<div>
									<p className="text-xs font-medium text-muted-foreground mb-1">
										Приоритет характеристик
									</p>
									<Badge
										className={getPriorityBadgeColor(character.abilityPriority)}
									>
										{
											ABILITY_PRIORITIES.find(
												(p) => p.value === character.abilityPriority,
											)?.label
										}
									</Badge>
								</div>
							)}

							{/* Appearance */}
							{Object.keys(character.appearance || {}).length > 0 && (
								<div>
									<p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
										<Eye className="h-3 w-3" />
										Внешность
									</p>
									<p className="text-sm">
										{formatAppearanceDisplay(character.appearance)}
									</p>
									{character.appearance.distinguishingMarks && (
										<p className="text-xs text-muted-foreground mt-1">
											Особые приметы: {character.appearance.distinguishingMarks}
										</p>
									)}
								</div>
							)}

							{/* Background */}
							{Object.keys(character.background || {}).length > 0 && (
								<div>
									<p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
										<MapPin className="h-3 w-3" />
										Предыстория
									</p>
									<p className="text-sm">
										{formatBackgroundDisplay(character.background)}
									</p>
									{character.background.motivation && (
										<p className="text-xs text-muted-foreground mt-1">
											Мотивация: {character.background.motivation}
										</p>
									)}
								</div>
							)}

							{/* Ability Scores */}
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

						{/* Edit Section */}
						<details
							open={isEditing}
							onToggle={(e) => setIsEditing(e.currentTarget.open)}
							className="text-sm"
						>
							<summary className="cursor-pointer text-muted-foreground hover:text-foreground">
								Редактировать
							</summary>
							<div className="space-y-3 mt-3">
								{/* Basic Info */}
								<div className="space-y-2">
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
								</div>

								{/* Ability Priority */}
								<div>
									<label className="text-xs font-medium text-muted-foreground block mb-1">
										Приоритет характеристик
									</label>
									<Select
										value={abilityPriority || "none"}
										onValueChange={(value) =>
											setAbilityPriority(
												value === "none" ? undefined : (value as "physical" | "mental" | "social"),
											)
										}
										disabled={disabled}
									>
										<SelectTrigger>
											<SelectValue placeholder="Выберите приоритет" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">Без приоритета</SelectItem>
											{ABILITY_PRIORITIES.map((priority) => (
												<SelectItem key={priority.value} value={priority.value}>
													<div>
														<div className="font-medium">{priority.label}</div>
														<div className="text-xs text-muted-foreground">
															{priority.description}
														</div>
													</div>
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								{/* Appearance Section */}
								<div className="border rounded-lg p-3 space-y-2">
									<h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
										<Eye className="h-3 w-3" />
										Внешность
									</h4>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<label className="text-xs text-muted-foreground block mb-1">
												Возраст
											</label>
											<Input
												type="number"
												min="16"
												max="80"
												placeholder="25"
												value={appearance.age || ""}
												onChange={(e) =>
													setAppearance((prev) => ({
														...prev,
														age: e.target.value
															? Number(e.target.value)
															: undefined,
													}))
												}
												disabled={disabled}
											/>
										</div>
										<div>
											<label className="text-xs text-muted-foreground block mb-1">
												Рост
											</label>
											<Select
												value={appearance.height || "none"}
												onValueChange={(value) =>
													setAppearance((prev) => ({
														...prev,
														height: value === "none" ? undefined : (value as AppearanceData["height"]),
													}))
												}
												disabled={disabled}
											>
												<SelectTrigger>
													<SelectValue placeholder="Выберите" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="none">Не указан</SelectItem>
													{APPEARANCE_OPTIONS.height.map((option) => (
														<SelectItem key={option.value} value={option.value}>
															{option.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div>
											<label className="text-xs text-muted-foreground block mb-1">
												Телосложение
											</label>
											<Select
												value={appearance.build || "none"}
												onValueChange={(value) =>
													setAppearance((prev) => ({
														...prev,
														build: value === "none" ? undefined : (value as AppearanceData["build"]),
													}))
												}
												disabled={disabled}
											>
												<SelectTrigger>
													<SelectValue placeholder="Выберите" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="none">Не указано</SelectItem>
													{APPEARANCE_OPTIONS.build.map((option) => (
														<SelectItem key={option.value} value={option.value}>
															{option.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div>
											<label className="text-xs text-muted-foreground block mb-1">
												Волосы
											</label>
											<Select
												value={appearance.hair || "none"}
												onValueChange={(value) =>
													setAppearance((prev) => ({
														...prev,
														hair: value === "none" ? undefined : (value as AppearanceData["hair"]),
													}))
												}
												disabled={disabled}
											>
												<SelectTrigger>
													<SelectValue placeholder="Выберите" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="none">Не указаны</SelectItem>
													{APPEARANCE_OPTIONS.hair.map((option) => (
														<SelectItem key={option.value} value={option.value}>
															{option.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div>
											<label className="text-xs text-muted-foreground block mb-1">
												Глаза
											</label>
											<Select
												value={appearance.eyes || "none"}
												onValueChange={(value) =>
													setAppearance((prev) => ({
														...prev,
														eyes: value === "none" ? undefined : (value as AppearanceData["eyes"]),
													}))
												}
												disabled={disabled}
											>
												<SelectTrigger>
													<SelectValue placeholder="Выберите" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="none">Не указаны</SelectItem>
													{APPEARANCE_OPTIONS.eyes.map((option) => (
														<SelectItem key={option.value} value={option.value}>
															{option.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>
									<div>
										<label className="text-xs text-muted-foreground block mb-1">
											Особые приметы
										</label>
										<Input
											placeholder="Шрам на лице, татуировка..."
											value={appearance.distinguishingMarks || ""}
											onChange={(e) =>
												setAppearance((prev) => ({
													...prev,
													distinguishingMarks: e.target.value || undefined,
												}))
											}
											disabled={disabled}
										/>
									</div>
								</div>

								{/* Background Section */}
								<div className="border rounded-lg p-3 space-y-2">
									<h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
										<MapPin className="h-3 w-3" />
										Предыстория
									</h4>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<label className="text-xs text-muted-foreground block mb-1">
												Происхождение
											</label>
											<Select
												value={background.origin || "none"}
												onValueChange={(value) =>
													setBackground((prev) => ({
														...prev,
														origin: value === "none" ? undefined : (value as BackgroundData["origin"]),
													}))
												}
												disabled={disabled}
											>
												<SelectTrigger>
													<SelectValue placeholder="Выберите" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="none">Не указано</SelectItem>
													{BACKGROUND_OPTIONS.origin.map((option) => (
														<SelectItem key={option.value} value={option.value}>
															{option.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div>
											<label className="text-xs text-muted-foreground block mb-1">
												Профессия
											</label>
											<Select
												value={background.profession || "none"}
												onValueChange={(value) =>
													setBackground((prev) => ({
														...prev,
														profession: value === "none" ? undefined : (value as BackgroundData["profession"]),
													}))
												}
												disabled={disabled}
											>
												<SelectTrigger>
													<SelectValue placeholder="Выберите" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="none">Не указана</SelectItem>
													{BACKGROUND_OPTIONS.profession.map((option) => (
														<SelectItem key={option.value} value={option.value}>
															{option.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>
									<div>
										<label className="text-xs text-muted-foreground block mb-1">
											Мотивация
										</label>
										<Input
											placeholder="Что движет вашим персонажем?"
											value={background.motivation || ""}
											onChange={(e) =>
												setBackground((prev) => ({
													...prev,
													motivation: e.target.value || undefined,
												}))
											}
											disabled={disabled}
										/>
									</div>
								</div>

								{/* Action Buttons */}
								<div className="space-y-2">
									<Button
										onClick={handleSave}
										disabled={disabled || saving}
										className="w-full"
										size="sm"
									>
										<Save className="h-3.5 w-3.5" />
										{saving ? "Сохранение..." : "Обновить"}
									</Button>
									<Button
										onClick={handleRegenerate}
										disabled={disabled || regenerating}
										variant="outline"
										className="w-full"
										size="sm"
									>
										<Dices className="h-3.5 w-3.5" />
										{regenerating
											? "Бросаем кубики..."
											: "Перебросить характеристики"}
									</Button>
								</div>
							</div>
						</details>
					</>
				) : (
					<>
						<p className="text-sm text-muted-foreground mb-3">
							Персонаж не создан. Заполните данные ниже:
						</p>

						{/* Basic Info */}
						<div className="space-y-2">
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
						</div>

						{/* Ability Priority */}
						<div>
							<label className="text-xs font-medium text-muted-foreground block mb-1">
								Приоритет характеристик
							</label>
							<Select
								value={abilityPriority || "none"}
								onValueChange={(value) =>
									setAbilityPriority(
										value === "none" ? undefined : (value as "physical" | "mental" | "social"),
									)
								}
								disabled={disabled}
							>
								<SelectTrigger>
									<SelectValue placeholder="Выберите приоритет" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">Без приоритета</SelectItem>
									{ABILITY_PRIORITIES.map((priority) => (
										<SelectItem key={priority.value} value={priority.value}>
											<div>
												<div className="font-medium">{priority.label}</div>
												<div className="text-xs text-muted-foreground">
													{priority.description}
												</div>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Appearance Section */}
						<details className="border rounded-lg">
							<summary className="p-3 cursor-pointer text-sm font-medium flex items-center gap-1">
								<Eye className="h-4 w-4" />
								Внешность (необязательно)
							</summary>
							<div className="p-3 pt-0 space-y-2">
								<div className="grid grid-cols-2 gap-2">
									<div>
										<label className="text-xs text-muted-foreground block mb-1">
											Возраст
										</label>
										<Input
											type="number"
											min="16"
											max="80"
											placeholder="25"
											value={appearance.age || ""}
											onChange={(e) =>
												setAppearance((prev) => ({
													...prev,
													age: e.target.value
														? Number(e.target.value)
														: undefined,
												}))
											}
											disabled={disabled}
										/>
									</div>
									<div>
										<label className="text-xs text-muted-foreground block mb-1">
											Рост
										</label>
										<Select
											value={appearance.height || "none"}
											onValueChange={(value) =>
												setAppearance((prev) => ({
													...prev,
													height: value === "none" ? undefined : (value as AppearanceData["height"]),
												}))
											}
											disabled={disabled}
										>
											<SelectTrigger>
												<SelectValue placeholder="Выберите" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">Не указан</SelectItem>
												{APPEARANCE_OPTIONS.height.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div>
										<label className="text-xs text-muted-foreground block mb-1">
											Телосложение
										</label>
										<Select
											value={appearance.build || "none"}
											onValueChange={(value) =>
												setAppearance((prev) => ({
													...prev,
													build: value === "none" ? undefined : (value as AppearanceData["build"]),
												}))
											}
											disabled={disabled}
										>
											<SelectTrigger>
												<SelectValue placeholder="Выберите" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">Не указано</SelectItem>
												{APPEARANCE_OPTIONS.build.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div>
										<label className="text-xs text-muted-foreground block mb-1">
											Волосы
										</label>
										<Select
											value={appearance.hair || "none"}
											onValueChange={(value) =>
												setAppearance((prev) => ({
													...prev,
													hair: value === "none" ? undefined : (value as AppearanceData["hair"]),
												}))
											}
											disabled={disabled}
										>
											<SelectTrigger>
												<SelectValue placeholder="Выберите" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">Не указаны</SelectItem>
												{APPEARANCE_OPTIONS.hair.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div>
										<label className="text-xs text-muted-foreground block mb-1">
											Глаза
										</label>
										<Select
											value={appearance.eyes || "none"}
											onValueChange={(value) =>
												setAppearance((prev) => ({
													...prev,
													eyes: value === "none" ? undefined : (value as AppearanceData["eyes"]),
												}))
											}
											disabled={disabled}
										>
											<SelectTrigger>
												<SelectValue placeholder="Выберите" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">Не указаны</SelectItem>
												{APPEARANCE_OPTIONS.eyes.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>
								<div>
									<label className="text-xs text-muted-foreground block mb-1">
										Особые приметы
									</label>
									<Input
										placeholder="Шрам на лице, татуировка..."
										value={appearance.distinguishingMarks || ""}
										onChange={(e) =>
											setAppearance((prev) => ({
												...prev,
												distinguishingMarks: e.target.value || undefined,
											}))
										}
										disabled={disabled}
									/>
								</div>
							</div>
						</details>

						{/* Background Section */}
						<details className="border rounded-lg">
							<summary className="p-3 cursor-pointer text-sm font-medium flex items-center gap-1">
								<MapPin className="h-4 w-4" />
								Предыстория (необязательно)
							</summary>
							<div className="p-3 pt-0 space-y-2">
								<div className="grid grid-cols-2 gap-2">
									<div>
										<label className="text-xs text-muted-foreground block mb-1">
											Происхождение
										</label>
										<Select
											value={background.origin || "none"}
											onValueChange={(value) =>
												setBackground((prev) => ({
													...prev,
													origin: value === "none" ? undefined : (value as BackgroundData["origin"]),
												}))
											}
											disabled={disabled}
										>
											<SelectTrigger>
												<SelectValue placeholder="Выберите" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">Не указано</SelectItem>
												{BACKGROUND_OPTIONS.origin.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div>
										<label className="text-xs text-muted-foreground block mb-1">
											Профессия
										</label>
										<Select
											value={background.profession || "none"}
											onValueChange={(value) =>
												setBackground((prev) => ({
													...prev,
													profession: value === "none" ? undefined : (value as BackgroundData["profession"]),
												}))
											}
											disabled={disabled}
										>
											<SelectTrigger>
												<SelectValue placeholder="Выберите" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">Не указана</SelectItem>
												{BACKGROUND_OPTIONS.profession.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>
								<div>
									<label className="text-xs text-muted-foreground block mb-1">
										Мотивация
									</label>
									<Input
										placeholder="Что движет вашим персонажем?"
										value={background.motivation || ""}
										onChange={(e) =>
											setBackground((prev) => ({
												...prev,
												motivation: e.target.value || undefined,
											}))
										}
										disabled={disabled}
									/>
								</div>
							</div>
						</details>

						<Button
							onClick={handleSave}
							disabled={disabled || saving}
							className="w-full"
							size="sm"
						>
							<Save className="h-3.5 w-3.5" />
							{saving ? "Создание..." : "Создать персонажа"}
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
