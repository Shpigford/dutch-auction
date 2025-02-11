import type { Metadata } from "next";
import { GeistSans, GeistMono } from "geist/font";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Optic was for sale",
  description: "Purchase Optic through a Dutch auction system",
  metadataBase: new URL('https://sale.withoptic.com'),
  openGraph: {
    title: "Optic was for sale",
    description: "Purchase Optic through a Dutch auction system",
    images: [
      {
        url: "/meta.png",
        width: 7148,
        height: 3486,
        alt: "Optic Sale",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Optic was for sale",
    description: "Purchase Optic through a Dutch auction system",
    images: ["/meta.png"],
    creator: "@withoptic",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={GeistSans.className}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
