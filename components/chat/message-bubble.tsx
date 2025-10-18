"use client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Bot, Dices, User } from "lucide-react";
import { MemoryIndicator } from "./memory-indicator";

type MessageRole = "player" | "gm" | "system";

interface MessageBubbleProps {
	role: MessageRole;
	content: string;
	memoryStatus?: "searching" | "found" | "stored";
	memoryCount?: number;
}

export function MessageBubble({
	role,
	content,
	memoryStatus,
	memoryCount,
}: MessageBubbleProps) {
	const isPlayer = role === "player";
	const isSystem = role === "system";

	if (isSystem) {
		// Memory status indicator
		if (memoryStatus) {
			return <MemoryIndicator status={memoryStatus} count={memoryCount} />;
		}

		// Regular system message
		return (
			<div className="flex items-center justify-center gap-2 py-2">
				<div className="flex items-center gap-2 rounded-full bg-muted px-4 py-1.5 text-xs text-muted-foreground">
					<Dices className="h-3 w-3" />
					<span>{content}</span>
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2",
				isPlayer ? "flex-row-reverse" : "flex-row",
			)}
		>
			<Avatar className="h-8 w-8 shrink-0">
				<AvatarFallback
					className={cn(
						isPlayer
							? "bg-primary text-primary-foreground"
							: "bg-secondary text-secondary-foreground",
					)}
				>
					{isPlayer ? (
						<User className="h-4 w-4" />
					) : (
						<Bot className="h-4 w-4" />
					)}
				</AvatarFallback>
			</Avatar>

			<div
				className={cn(
					"group relative max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
					isPlayer
						? "bg-primary text-primary-foreground"
						: "bg-muted text-foreground",
				)}
			>
				<div className="whitespace-pre-wrap break-words">{content}</div>
			</div>
		</div>
	);
}
