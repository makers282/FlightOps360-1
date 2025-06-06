
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plane, LogIn } from 'lucide-react'; // Changed icon

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-gradient-to-br from-sky-100 via-indigo-50 to-purple-100 p-8 text-center">
      <header className="mb-12">
        <div className="flex items-center justify-center gap-3 text-primary mb-4">
          <Plane className="h-12 w-12" />
          <span className="text-5xl font-bold">FlightOps360</span>
        </div>
        <p className="text-xl text-foreground/80">
          Comprehensive Flight Operations Management
        </p>
      </header>
      
      <div className="space-y-6 bg-background/80 backdrop-blur-sm p-8 rounded-lg shadow-xl max-w-lg">
        <p className="text-lg text-foreground/90">
          Welcome to FlightOps360!
        </p>
        <p className="text-md text-muted-foreground">
          Authentication is currently under development. Please proceed to the login page where you'll find an option to access the dashboard directly.
        </p>
        
        <Button asChild size="lg" className="text-lg px-8 py-6 w-full">
          <Link href="/login">
            <LogIn className="mr-2 h-5 w-5" />
            Proceed to Login Page
          </Link>
        </Button>
      </div>
      
      <footer className="absolute bottom-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} FlightOps360. All rights reserved.
      </footer>
    </div>
  );
}
