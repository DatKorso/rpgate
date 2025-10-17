"use client";
import { cn } from "@/lib/utils";
import { Brain, Check, Search } from "lucide-react";
import { useEffect, useState } from "react";

type MemoryStatus = "searching" | "found" | "stored" | "idle";

interface MemoryIndicatorProps {
	status: MemoryStatus;
	count?: number;
	className?: string;
	autoHide?: boolean;
}

export function MemoryIndicator({
	status,
	count,
	className,
	autoHide = false,
}: MemoryIndicatorProps) {
	const [visible, setVisible] = useState(true);

	useEffect(() => {
		if (autoHide && status === "stored") {
			const timer = setTimeout(() => {
				setVisible(false);
			}, 3000);
			return () => clearTimeout(timer);
		}
	}, [autoHide, status]);

	if (status === "idle" || !visible) return null;

	const config = {
		searching: {
			icon: Search,
			text: "Поиск в памяти...",
			bgColor: "bg-blue-50",
			textColor: "text-blue-700",
			iconColor: "text-blue-500",
			animate: "animate-pulse",
		},
		found: {
			icon: Brain,
			text: count
				? `Найдено ${count} ${count === 1 ? "воспоминание" : count < 5 ? "воспоминания" : "воспоминаний"}`
				: "Воспоминания найдены",
			bgColor: "bg-purple-50",
			textColor: "text-purple-700",
			iconColor: "text-purple-500",
			animate: "",
		},
		stored: {
			icon: Check,
			text: "Момент сохранён в памяти",
			bgColor: "bg-emerald-50",
			textColor: "text-emerald-700",
			iconColor: "text-emerald-500",
			animate: "",
		},
	}[status];

	const Icon = config.icon;

	return (
		<div
			className={cn(
				"flex items-center justify-center gap-2 py-2",
				"animate-in fade-in-0 slide-in-from-bottom-2",
				!visible && "animate-out fade-out-0 slide-out-to-bottom-2",
				className,
			)}
			role="status"
			aria-live="polite"
			aria-label={config.text}
		>
			<div
				className={cn(
					"flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium shadow-sm",
					config.bgColor,
					config.textColor,
				)}
			>
				<Icon className={cn("h-3.5 w-3.5", config.iconColor, config.animate)} />
				<span>{config.text}</span>
			</div>
		</div>
	);
}
