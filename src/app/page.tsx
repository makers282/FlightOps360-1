
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plane, LogIn, Menu } from 'lucide-react';
import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
    {children}
  </Link>
);

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center space-x-2">
            <Plane className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold text-foreground">FlightOps360</span>
          </Link>
          <div className="hidden md:flex items-center space-x-6">
            <NavLink href="#">Features</NavLink>
            <NavLink href="#">Pricing</NavLink>
            <NavLink href="#">Benefits</NavLink>
            <NavLink href="/login">Sign In</NavLink>
            <Button asChild size="sm">
              <Link href="/#">Sign Up</Link>
            </Button>
          </div>
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild><Link href="#">Features</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="#">Pricing</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="#">Benefits</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/login">Sign In</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="#">Sign Up</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-40 bg-gradient-to-br from-primary/10 via-background to-background text-foreground">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 xl:gap-16 items-center">
              <div className="flex flex-col justify-center space-y-6">
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl xl:text-[5.5rem] 2xl:text-[6rem] leading-tight">
                  THE EASY-TO-USE
                  <br />
                  ALL-IN-ONE FLIGHT
                  <br />
                  OPERATIONS MANAGEMENT SYSTEM
                </h1>
                <p className="max-w-[600px] text-muted-foreground md:text-xl">
                  Streamline your FAA Part 135 charter operations with FlightOps360. From real-time dashboards to document management and AI-powered route optimization.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="text-lg px-8 py-6 shadow-lg hover:shadow-primary/30 transition-shadow">
                    <Link href="/login">
                      <LogIn className="mr-2 h-5 w-5" />
                      Proceed to Login Page
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" className="text-lg px-8 py-6">
                    Learn More
                  </Button>
                </div>
                 <p className="text-sm text-muted-foreground mt-2">
                    Authentication is currently under development. The login page provides a direct link to the dashboard.
                  </p>
              </div>
              <div className="relative mx-auto aspect-[4/3] overflow-hidden rounded-xl sm:w-full lg:order-last lg:aspect-square shadow-2xl">
                <Image
                  src="https://placehold.co/800x600.png" 
                  alt="FlightOps360 App Mockup"
                  layout="fill"
                  objectFit="cover"
                  className="rounded-xl"
                  data-ai-hint="app interface flight operations"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Placeholder Features Section */}
        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-muted/30">
          <div className="container mx-auto px-4 md:px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-4">FEATURES</h2>
            <div className="mx-auto mb-8 h-1 w-24 bg-primary rounded-full"></div>
            <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Detailed feature explanations will be added here soon. Stay tuned for updates on our real-time dashboard, document hub, AI-powered routing, FRAT integration, and automated notifications.
            </p>
            {/* Placeholder for feature cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
              <div className="p-6 bg-card rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-2">Real-Time Dashboard</h3>
                <p className="text-sm text-muted-foreground">Monitor critical flight data at a glance.</p>
              </div>
              <div className="p-6 bg-card rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-2">Document Hub</h3>
                <p className="text-sm text-muted-foreground">Centralized document management and compliance.</p>
              </div>
              <div className="p-6 bg-card rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-2">AI Route Optimization</h3>
                <p className="text-sm text-muted-foreground">Intelligent route suggestions for efficiency.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40">
        <div className="container mx-auto flex flex-col items-center justify-between gap-2 py-6 px-4 md:flex-row md:px-8">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} FlightOps360. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="#" className="text-sm text-muted-foreground hover:text-primary">Privacy Policy</Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-primary">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
