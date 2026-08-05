import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import "./product.css";
import "./command-centre.css";
import "./ember-assistant.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");
  const metadataBase = new URL(host ? `${protocol}://${host}` : "https://queueproof.openai.site");
  const title = "QueueProof — Ask your work. Get the proof.";
  const description =
    "Ask across Slack, Gmail, Linear, GitHub, and files. Get one clear answer, the sources behind it, what disagrees, and what to do next.";
  const image = new URL("/og-v3.png", metadataBase).toString();
  return {
    metadataBase,
    title: { default: title, template: "%s · QueueProof" },
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      type: "website",
      title,
      description,
      images: [{ url: image, width: 1672, height: 941, alt: "QueueProof connects work sources to a clear, cited answer" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a className="skip-link" href="#main-content">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
