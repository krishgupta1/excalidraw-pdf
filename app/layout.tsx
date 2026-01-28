import type { Metadata } from "next";
// Add Google Font import for a handwritten look if desired
import { Inter, Patrick_Hand } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const patrickHand = Patrick_Hand({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-hand",
});

export const metadata: Metadata = {
  title: "Excalidraw to PDF",
  description: "Convert .excalidraw files to PDF instantly",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${patrickHand.variable}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
