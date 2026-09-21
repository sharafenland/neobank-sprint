import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neobank Sprint",
  description: "An agile sprint simulation for the Financial Software Engineering lecture.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The inline script below stamps data-theme before React hydrates, which
    // is the point — it is also, by definition, an attribute the server did
    // not render, so the mismatch on <html> is expected and suppressed.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=IBM+Plex+Mono:wght@400;500;600&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&display=swap"
        />
        <script
          // Runs before paint, so a chosen theme never flashes the other one.
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('nbs.theme');" +
              "if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
