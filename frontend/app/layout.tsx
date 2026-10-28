import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import RogGoldBackdrop from "@/components/RogGoldBackdrop";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "VelocitiFleet — Executive Fleet Operations & Telemetry",
  description: "Luxury fleet management platform with real-time GPS telemetry, premium vehicle rentals, and fleet operations.",
  keywords: "executive fleet, luxury rental, GPS telemetry, fleet management",
  icons: {
    icon: "/logo-gold.png",
    shortcut: "/logo-gold.png",
    apple: "/logo-gold.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="icon" href="/logo-gold.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo-gold.png" />
      </head>
      <body suppressHydrationWarning>
        <RogGoldBackdrop />
        <AuthProvider>
          <Navbar />
          <main style={{ position: 'relative', zIndex: 1 }}>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
