"use client";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Dices } from "lucide-react";

const COMMON_SKILLS = [
	"Athletics",
	"Acrobatics",
	"Stealth",
	"Perception",
	"Investigation",
	"Insight",
	"Persuasion",
	"Deception",
	"Intimidation",
	"Arcana",
	"History",
	"Nature",
	"Religion",
	"Medicine",
	"Survival",
];

interface SkillSelectorProps {
	onSelect: (skill: string) => void;
	disabled?: boolean;
}

export function SkillSelector({ onSelect, disabled }: SkillSelectorProps) {
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="flex items-center gap-2 text-base">
					<Dices className="h-4 w-4" />
					Быстрый бросок
				</CardTitle>
				<CardDescription className="text-xs">
					Выберите навык для проверки
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 gap-2">
					{COMMON_SKILLS.slice(0, 6).map((skill) => (
						<Button
							key={skill}
							variant="outline"
							size="sm"
							onClick={() => onSelect(skill)}
							disabled={disabled}
							className="justify-start text-xs"
						>
							{skill}
						</Button>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
