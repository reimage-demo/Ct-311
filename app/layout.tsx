import type { Metadata } from "next";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/600.css";
import "@fontsource/open-sans/700.css";
import "./globals.css";
import { LanguageProvider } from "@/components/language";
import { Shell } from "@/components/shell";
export const metadata: Metadata = {
  title: {
    default: "Hartford 311 | Service portal demonstration",
    template: "%s | Hartford 311",
  },
  description:
    "Report a local issue, find Hartford city services, and follow a test report. City-proposal demonstration; not an official city service.",
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/icon.svg` },
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <LanguageProvider>
          <Shell>{children}</Shell>
        </LanguageProvider>
      </body>
    </html>
  );
}
