import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Golden Home Care | Trusted support for aging parents at home",
  description:
    "Book trusted local companions for aging parents with recurring visits, provider-set rates, and family updates after every visit.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
