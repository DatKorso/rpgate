"use client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dices, TrendingDown, TrendingUp } from "lucide-react";

interface DiceResultProps {
	roll: number;
	modified: number;
	category: string;
	modifiers?: Record<string, number>;
}

export function DiceResult({
	roll,
	modified,
	category,
	modifiers,
}: DiceResultProps) {
	const isCrit = category.includes("CRIT");
	const isSuccess = category.includes("SUCCESS");
	const totalMod = modified - roll;

	return (
		<div className="flex items-center justify-center gap-2 py-2">
			<div
				className={cn(
					"flex items-center gap-3 rounded-xl border-2 px-4 py-2.5 shadow-sm",
					isCrit && isSuccess && "border-green-500 bg-green-50",
					isCrit && !isSuccess && "border-red-500 bg-red-50",
					!isCrit && "border-border bg-card",
				)}
			>
				<div className="flex items-center gap-2">
					<Dices className="h-4 w-4 text-muted-foreground" />
					<span className="text-2xl font-bold">{roll}</span>
				</div>

				{totalMod !== 0 && (
					<>
						<div className="flex items-center gap-1 text-muted-foreground">
							{totalMod > 0 ? (
								<TrendingUp className="h-3.5 w-3.5" />
							) : (
								<TrendingDown className="h-3.5 w-3.5" />
							)}
							<span className="text-sm font-medium">
								{totalMod > 0 ? "+" : ""}
								{totalMod}
							</span>
						</div>
						<div className="text-xl font-bold text-primary">= {modified}</div>
					</>
				)}

				<Badge
					variant={
						isCrit && isSuccess
							? "success"
							: isCrit && !isSuccess
								? "destructive"
								: isSuccess
									? "default"
									: "secondary"
					}
				>
					{isCrit && "⚡ "}
					{isSuccess ? "Успех" : "Провал"}
				</Badge>
			</div>
		</div>
	);
}
