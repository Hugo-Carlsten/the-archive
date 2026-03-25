import type { Metadata } from "next";
import Link from "next/link";
import SeedProducts from "@/components/SeedProducts";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Archive",
  description: "Din personliga AI-stylist",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <head>
        {/* Awin Publisher MasterTag */}
        <script src="https://www.dwin2.com/pub.2824554.min.js" defer></script>
      </head>
      <body className="bg-cream text-charcoal font-sans antialiased">
        <header className="fixed top-0 left-0 right-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-border">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-75 transition-opacity duration-300">
              <img src="/logo.png" alt="" style={{ height: "60px", width: "auto", verticalAlign: "middle" }} />
              <span className="font-serif text-lg tracking-[0.25em] text-charcoal">THE ARCHIVE</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-10">
              {[
                { href: "/feed", label: "Feed" },
                { href: "/outfit-byggaren", label: "Outfit-byggaren" },
                { href: "/wishlist", label: "Wishlist" },
                { href: "/profil", label: "Profil" },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="nav-link">
                  {label}
                </Link>
              ))}
            </nav>

            {/* Mobile nav */}
            <nav className="flex md:hidden items-center gap-6">
              {[
                { href: "/feed", label: "Feed" },
                { href: "/outfit-byggaren", label: "Outfits" },
                { href: "/wishlist", label: "Wishlist" },
                { href: "/profil", label: "Profil" },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="nav-link">
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <SeedProducts />
        <main className="pt-16">{children}</main>
      </body>
    </html>
  );
}
