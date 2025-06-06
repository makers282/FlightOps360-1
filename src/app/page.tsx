
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plane, LayoutDashboard } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-gradient-to-br from-sky-100 via-indigo-50 to-purple-100 p-8 text-center">
      <header className="mb-12">
        <div className="flex items-center justify-center gap-3 text-primary mb-4">
          <Plane className="h-12 w-12" />
          <span className="text-5xl font-bold">SkyBase</span>
        </div>
        <p className="text-xl text-foreground/80">
          Flight Operations Management Platform
        </p>
      </header>
      
      <div className="space-y-6 bg-background/80 backdrop-blur-sm p-8 rounded-lg shadow-xl max-w-lg">
        <p className="text-lg text-foreground/90">
          Welcome! This is the main entry point for SkyBase.
        </p>
        <p className="text-md text-muted-foreground">
          Authentication is not yet implemented. For now, you can proceed directly to the dashboard to see the application's features.
        </p>
        
        <Button asChild size="lg" className="text-lg px-8 py-6 w-full">
          <Link href="/dashboard">
            <LayoutDashboard className="mr-2 h-5 w-5" />
            Go to Dashboard
          </Link>
        </Button>
        
        <p className="text-sm text-muted-foreground pt-4">
          (The <Link href="/login" className="underline hover:text-primary">Login Page</Link> also exists but is not functional for authentication yet.)
        </p>
      </div>
      
      <footer className="absolute bottom-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} SkyBase. All rights reserved.
      </footer>
    </div>
  );
}
