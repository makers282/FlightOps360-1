// src/app/page.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plane, LogIn, ChevronRight, Zap, Users, ShieldCheck } from 'lucide-react';
import Image from 'next/image';

export default function LandingPage() {
  console.log('LANDING PAGE - TEST CHANGE APPLIED BY AI'); // AI: Added this line for verification
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-sky-100 via-indigo-50 to-purple-100">
      <header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary">
            <Plane className="h-7 w-7" />
            <span>FlightOps360</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <Link href="#features" className="text-muted-foreground transition-colors hover:text-foreground">Features</Link>
            <Link href="#pricing" className="text-muted-foreground transition-colors hover:text-foreground">Pricing</Link>
            <Link href="#contact" className="text-muted-foreground transition-colors hover:text-foreground">Contact</Link>
          </nav>
          <Button asChild>
            <Link href="/login">
              Log In <LogIn className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto flex flex-col items-center justify-center gap-8 px-4 py-16 text-center md:px-6 md:py-24 lg:py-32">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
              Elevate Your Flight Operations
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              FlightOps360 provides a comprehensive suite of tools to manage your Part 135 charter operations efficiently,
              from quoting and scheduling to crew and aircraft management.
            </p>
          </div>
          <div className="relative mx-auto mt-8 w-full max-w-4xl">
            <Image
              src="https://placehold.co/1200x600.png"
              alt="FlightOps360 Dashboard Mockup"
              width={1200}
              height={600}
              className="rounded-xl object-cover shadow-2xl"
              priority
              data-ai-hint="dashboard aviation software"
            />
            <div className="absolute inset-0 rounded-xl bg-black/10 ring-1 ring-inset ring-black/20"></div>
          </div>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button size="lg" asChild>
              <Link href="/login">
                Get Started <ChevronRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="#features">
                Learn More
              </Link>
            </Button>
          </div>
        </section>

        {/* Features Section Placeholder */}
        <section id="features" className="container mx-auto px-4 py-16 md:px-6 md:py-24">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Streamlined Operations, Enhanced Safety</h2>
            <p className="mt-4 text-lg text-gray-600">
              Discover how FlightOps360 can revolutionize your aviation business.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-3">
            {[
              { name: "Intelligent Quoting", description: "Generate accurate quotes quickly with integrated aircraft performance and operational costs.", icon: Zap, dataAiHint: "calculator money" },
              { name: "Crew Management", description: "Track crew qualifications, duty times, and scheduling with ease.", icon: Users, dataAiHint: "team people" },
              { name: "Aircraft & Maintenance", description: "Monitor aircraft status, maintenance schedules, and compliance requirements.", icon: ShieldCheck, dataAiHint: "airplane safety" },
            ].map((feature) => (
              <div key={feature.name} className="flex flex-col items-center rounded-lg bg-card p-8 text-center shadow-lg transition-shadow hover:shadow-xl">
                <feature.icon className="mb-4 h-10 w-10 text-primary" aria-hidden="true" />
                <Image src={`https://placehold.co/300x200.png`} alt={feature.name} width={300} height={200} className="mb-4 rounded-md object-cover" data-ai-hint={feature.dataAiHint} />
                <h3 className="text-xl font-semibold text-gray-900">{feature.name}</h3>
                <p className="mt-2 text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t bg-background">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row md:px-6">
          <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} FlightOps360. All rights reserved.</p>
          <nav className="flex gap-4 text-sm">
            <Link href="#" className="text-muted-foreground hover:text-foreground">Terms of Service</Link>
            <Link href="#" className="text-muted-foreground hover:text-foreground">Privacy Policy</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
