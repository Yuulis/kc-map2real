import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import ThemeRegistry from "./components/ThemeRegistry";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "鎮守府水路図誌 - KanColle Map2Real",
  description: "KC Map2real",
  icons: {
    icon: "/img/nodes/start.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeRegistry>
          {/* Global header (client component) */}
          <div id="app-header-root">
            <Header />
          </div>

          {/* Content */}
          {children}
        </ThemeRegistry>
      </body>
    </html>
  );
}
