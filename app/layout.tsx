import type { Metadata } from "next";
import { VT323, Press_Start_2P } from "next/font/google";
import "./globals.css";

const vt323 = VT323({
  weight: "400",
  variable: "--font-vt323",
  subsets: ["latin"],
  display: "swap",
});

const pressStart = Press_Start_2P({
  weight: "400",
  variable: "--font-press-start",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "petpen",
  description: "San Mateo Pet Foster Program",
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${vt323.variable} ${pressStart.variable} h-full`}
    >
      <body className="min-h-full flex flex-col font-body bg-parchment text-wood-dark">
        {children}
        {modal}
      </body>
    </html>
  );
}
