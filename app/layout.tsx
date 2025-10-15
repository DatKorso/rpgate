import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata = {
	title: "RPGate — Текстовая RPG с AI Game Master",
	description: "Погрузитесь в мир средневекового фэнтези с AI ведущим",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="ru" suppressHydrationWarning>
			<body className={inter.className}>{children}</body>
		</html>
	);
}
