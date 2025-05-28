
import type { Metadata } from 'next';
// Removed GeistSans and GeistMono imports
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
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Removed Geist font variables from html className */}
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
