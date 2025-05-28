
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

// The imported GeistSans and GeistMono objects directly provide the .variable property.
// No need to call them as functions.

export const metadata: Metadata = {
  title: 'FlightOps360 - Flight Operations Management',
  description: 'Comprehensive operations management for FAA Part 135 charter operators.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`} suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
