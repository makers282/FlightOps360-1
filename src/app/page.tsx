
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plane, CalendarDays, ShieldCheck, DollarSign, Users, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-purple-50 text-gray-800">
      {/* Header/Nav */}
      <header className="py-4 px-6 sm:px-10 md:px-16 fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary">
            <Plane className="h-7 w-7" />
            <span>FlightOps360</span>
          </Link>
          <nav>
            <Button asChild variant="outline">
              <Link href="/login">Login</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container mx-auto px-6 py-24 pt-40 sm:py-32 md:pt-48 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground">
            Elevate Your Flight Operations
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg sm:text-xl text-muted-foreground">
            FlightOps360 is the all-in-one platform for FAA Part 135 charter operators,
            simplifying scheduling, compliance, quoting, and fleet management.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/login">Get Started</Link>
            </Button>
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 sm:py-24 bg-background">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Powerful Features, Seamlessly Integrated</h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
                Everything you need to manage your charter operations efficiently and stay compliant.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard
                icon={<CalendarDays className="h-10 w-10 text-primary" />}
                title="Smart Scheduling & Dispatch"
                description="Intuitive trip planning, crew assignments, and real-time aircraft tracking on a dynamic calendar view."
              />
              <FeatureCard
                icon={<ShieldCheck className="h-10 w-10 text-primary" />}
                title="Comprehensive Compliance"
                description="Manage aircraft maintenance, MELs, crew documents, and training records with automated alerts."
              />
              <FeatureCard
                icon={<DollarSign className="h-10 w-10 text-primary" />}
                title="Efficient Quoting & CRM"
                description="Generate accurate quotes quickly, manage customer relationships, and track sales performance."
              />
               <FeatureCard
                icon={<Plane className="h-10 w-10 text-primary" />}
                title="Integrated Fleet Management"
                description="Oversee your entire fleet, from aircraft details and performance data to block-outs and currency."
              />
               <FeatureCard
                icon={<Users className="h-10 w-10 text-primary" />}
                title="Centralized Crew Management"
                description="Maintain detailed crew rosters, track qualifications, manage documents, and oversee duty times."
              />
               <FeatureCard
                icon={<FileText className="h-10 w-10 text-primary" />}
                title="Robust Reporting & Analytics"
                description="Gain insights into your operations with comprehensive reports on flights, financials, and crew activity."
              />
            </div>
          </div>
        </section>
        
        <section className="py-16 sm:py-24 bg-gradient-to-b from-sky-50 to-indigo-50">
            <div className="container mx-auto px-6 text-center">
                <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Ready to Transform Your Operations?</h2>
                <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
                    Join FlightOps360 today and experience a new level of efficiency and control.
                </p>
                <Button size="lg" asChild className="mt-8 bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Link href="/login">Request a Demo</Link>
                </Button>
            </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="py-8 bg-background border-t">
        <div className="container mx-auto px-6 text-center text-muted-foreground text-sm">
          &copy; {new Date().getFullYear()} FlightOps360. All rights reserved.
          <p className="mt-1">Streamlining charter operations, one flight at a time.</p>
        </div>
      </footer>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="items-center text-center">
        <div className="p-4 bg-primary/10 rounded-full mb-4 inline-block">
          {icon}
        </div>
        <CardTitle className="text-xl text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
