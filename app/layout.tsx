import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/brand";
import "./globals.css";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: "AI-assisted order management for freelancers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
