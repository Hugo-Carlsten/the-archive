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
        <header className="fixed top-0 left-0 right-0 z-50 bg-cream/90 backdrop-blur-sm border-b border-charcoal/10">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src="/logo.png" alt="" style={{ height: "60px", width: "auto", verticalAlign: "middle" }} />
              <span className="font-serif text-xl tracking-widest text-charcoal">THE ARCHIVE</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-8">
              {[
                { href: "/feed", label: "Feed" },
                { href: "/outfit-byggaren", label: "Outfit-byggaren" },
                { href: "/wishlist", label: "Wishlist" },
                { href: "/profile", label: "Profil" },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm tracking-wider text-charcoal/60 hover:text-taupe transition-colors uppercase"
                >
                  {label}
                </Link>
              ))}
            </nav>

            {/* Mobile nav */}
            <nav className="flex md:hidden items-center gap-5">
              {[
                { href: "/feed", label: "Feed" },
                { href: "/outfit-byggaren", label: "Outfits" },
                { href: "/wishlist", label: "Wishlist" },
                { href: "/profile", label: "Profil" },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-xs tracking-wider text-charcoal/60 hover:text-taupe transition-colors"
                >
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
