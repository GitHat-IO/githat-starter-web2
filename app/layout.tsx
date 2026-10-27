import type { Metadata } from "next";

export const metadata: Metadata = { title: "My GitHat app", description: "Sign-in, card payments and pay-per-call, ready." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
