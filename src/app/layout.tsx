
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans'; // Still import to ensure variables are available
import { GeistMono } from 'geist/font/mono'; // Still import to ensure variables are available
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'FlightOps360 - Flight Operations Management',
  description: 'Comprehensive operations management for FAA Part 135 charter operators.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Note: GeistSans.variable and GeistMono.variable will typically apply to the <html> tag
  // or be available as CSS variables globally when imported like this in Next.js.
  // We are testing if the dynamic className string on <body> itself is the issue.
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

