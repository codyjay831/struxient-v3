import type { Metadata } from "next";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Struxient v3",
  description: "Trade-first quote and execution platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
