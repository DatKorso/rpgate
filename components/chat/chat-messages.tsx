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
	const scrollAreaRef = useRef<HTMLDivElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const isUserScrollingRef = useRef(false);
	const lastScrollTopRef = useRef(0);

	// Detect if user is manually scrolling
	useEffect(() => {
		const scrollContainer = scrollAreaRef.current?.querySelector(
			"[data-radix-scroll-area-viewport]",
		);
		if (!scrollContainer) return;

		const handleScroll = () => {
			const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
			const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

			// User scrolled up
			if (scrollTop < lastScrollTopRef.current) {
				isUserScrollingRef.current = !isAtBottom;
			}
			// User scrolled down to bottom
			else if (isAtBottom) {
				isUserScrollingRef.current = false;
			}

			lastScrollTopRef.current = scrollTop;
		};

		scrollContainer.addEventListener("scroll", handleScroll);
		return () => scrollContainer.removeEventListener("scroll", handleScroll);
	}, []);

	// Auto-scroll to bottom when messages change (only if user was at bottom)
	useEffect(() => {
		if (!isUserScrollingRef.current && messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	});

	return (
		<ScrollArea ref={scrollAreaRef} className="h-[calc(100vh-20rem)] pr-4">
			<div className="space-y-4 p-4">
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
					<>
						{messages.map((msg, i) => (
							<MessageBubble
								key={`${msg.role}-${i}-${msg.content.slice(0, 20)}`}
								role={msg.role}
								content={msg.content}
							/>
						))}
						<div ref={messagesEndRef} />
					</>
				)}
			</div>
		</ScrollArea>
	);
}
