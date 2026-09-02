import type { Metadata } from "next";
import { SessionProvider } from "@/lib/session";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arcade Vault · Portal Retro",
  description:
    "Arcade Vault — biblioteca de juegos retro, marcadores y salón de la fama.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full">
        <div className="av-bg" />
        <div className="av-noise" />
        <SessionProvider>
          <div id="root">
            <Nav />
            <main className="av-main">{children}</main>
            <footer
              style={{
                borderTop: "1px solid var(--line)",
                padding: "20px 32px",
                textAlign: "center",
                color: "var(--ink-faint)",
                fontFamily: "var(--mono)",
                fontSize: 11,
                letterSpacing: "0.16em",
              }}
            >
              © 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0
            </footer>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
