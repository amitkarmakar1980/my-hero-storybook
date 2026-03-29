import type { Metadata } from "next";
import { Roboto, Rowdies } from "next/font/google";
import "./globals.css";

// Roboto: default UI font for all body text, labels, and interface copy
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// Rowdies: display font reserved for the brand name, hero headline, and card titles
const rowdies = Rowdies({
  variable: "--font-rowdies",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

export const metadata: Metadata = {
  title: "Hero Storybook — Make Your Child the Hero",
  description: "Create personalized illustrated stories for your child in minutes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${roboto.variable} ${rowdies.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
