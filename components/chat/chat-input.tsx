"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send } from "lucide-react";
import { type KeyboardEvent, useState } from "react";

interface ChatInputProps {
	onSend: (message: string) => void;
	disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
	const [input, setInput] = useState("");

	const handleSend = () => {
		if (!input.trim() || disabled) return;
		onSend(input.trim());
		setInput("");
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<div className="flex gap-2">
			<Input
				placeholder="Введите действие..."
				value={input}
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={handleKeyDown}
				disabled={disabled}
				className="flex-1"
			/>
			<Button onClick={handleSend} disabled={disabled || !input.trim()}>
				{disabled ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<Send className="h-4 w-4" />
				)}
			</Button>
		</div>
	);
}
