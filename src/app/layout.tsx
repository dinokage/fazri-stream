import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SessionWrapper from "@/components/SessionWrapper";
import TopLoader from "@/components/TopLoaderWrapper";
import { ThemeProvider } from "@/components/theme-provider";
import { HeroUIProvider } from "@heroui/react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fazri Stream",
  description: "Fazri Stream - Create and manage your streams effortlessly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionWrapper>
          <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
            <HeroUIProvider>
              <TopLoader>
                {children}
              </TopLoader>
            </HeroUIProvider>
          </ThemeProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}
