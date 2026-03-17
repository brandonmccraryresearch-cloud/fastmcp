import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FastMCP - TypeScript MCP Framework",
  description:
    "A comprehensive TypeScript framework for building Model Context Protocol servers and clients",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
