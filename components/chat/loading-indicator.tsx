"use client";
import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";

interface LoadingIndicatorProps {
	stage: "rules" | "roll" | "narrative" | "done";
}

const stages = [
	{ id: "rules", label: "Анализ правил" },
	{ id: "roll", label: "Бросок кубов" },
	{ id: "narrative", label: "Генерация нарратива" },
];

export function LoadingIndicator({ stage }: LoadingIndicatorProps) {
	const currentIndex = stages.findIndex((s) => s.id === stage);

	return (
		<div className="flex items-center justify-center gap-2 py-3">
			<div className="flex items-center gap-3 rounded-lg bg-muted px-4 py-2">
				{stages.map((s, idx) => {
					const isActive = idx === currentIndex;
					const isDone = idx < currentIndex || stage === "done";

					return (
						<div key={s.id} className="flex items-center gap-2">
							{idx > 0 && (
								<div
									className={cn(
										"h-px w-8",
										isDone ? "bg-primary" : "bg-border",
									)}
								/>
							)}
							<div className="flex items-center gap-1.5">
								{isDone ? (
									<Check className="h-3.5 w-3.5 text-primary" />
								) : isActive ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
								) : (
									<div className="h-3.5 w-3.5 rounded-full border-2 border-border" />
								)}
								<span
									className={cn(
										"text-xs font-medium",
										isActive || isDone
											? "text-foreground"
											: "text-muted-foreground",
									)}
								>
									{s.label}
								</span>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
