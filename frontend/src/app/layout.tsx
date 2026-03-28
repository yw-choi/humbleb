import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HumbleB 테니스",
  description: "HumbleB 테니스 클럽 정모 관리",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const THEME_SCRIPT = `(function(){var t=localStorage.getItem('humbleb_theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-[100dvh] flex-col bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
