"use client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";

type Message = {
	role: "player" | "gm" | "system";
	content: string;
};

interface ChatMessagesProps {
	messages: Message[];
}

export function ChatMessages({ messages }: ChatMessagesProps) {
	const scrollRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Need to scroll on messages change
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages.length]);

	return (
		<ScrollArea className="h-[calc(100vh-20rem)] pr-4">
			<div ref={scrollRef} className="space-y-4 p-4">
				{messages.length === 0 ? (
					<div className="flex h-full items-center justify-center text-center text-muted-foreground">
						<div className="space-y-2">
							<p className="text-lg font-medium">Добро пожаловать в RPGate</p>
							<p className="text-sm">
								Создайте персонажа и начните своё приключение
							</p>
						</div>
					</div>
				) : (
					messages.map((msg, i) => (
						<MessageBubble
							key={`${msg.role}-${i}-${msg.content.slice(0, 20)}`}
							role={msg.role}
							content={msg.content}
						/>
					))
				)}
			</div>
		</ScrollArea>
	);
}
