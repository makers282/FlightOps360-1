
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Plane } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="py-4 px-6 container mx-auto">
        <div className="flex items-center gap-2 text-primary">
          <Plane className="h-8 w-8" />
          <span className="text-2xl font-semibold">SkyBase</span>
        </div>
      </header>
      <main className="flex-grow container mx-auto px-4 py-12 sm:py-16 md:py-24 flex items-center">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 w-full">
          <div className="lg:w-1/2 text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-primary tracking-tight">
              Welcome to SkyBase
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-foreground/80 max-w-2xl mx-auto lg:mx-0">
              Your advanced flight operations management platform, designed for efficiency, safety, and real-time insights.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button asChild size="lg" className="text-lg px-8 py-6">
                <Link href="/login">Login to Your Account</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6 border-primary text-primary hover:bg-primary/10 hover:text-primary">
                <Link href="/dashboard">Explore Features</Link>
              </Button>
            </div>
          </div>
          <div className="lg:w-1/2 mt-10 lg:mt-0 flex justify-center">
            <Image
              src="https://placehold.co/600x450.png"
              alt="SkyBase Platform Showcase"
              width={600}
              height={450}
              className="rounded-xl shadow-2xl object-cover"
              data-ai-hint="aviation technology cockpit"
              priority
            />
          </div>
        </div>
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border">
        © {new Date().getFullYear()} SkyBase. All rights reserved.
      </footer>
    </div>
  );
}
