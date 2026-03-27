import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
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
        <NavBar />
        <SeedProducts />
        <main className="pt-16">{children}</main>
      </body>
    </html>
  );
}
