
import { LoginForm } from './components/login-form';
import { Plane } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-100 via-indigo-50 to-purple-100 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary shadow-lg">
            <Plane className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Welcome to FlightOps360
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to access your flight operations dashboard.
          </p>
        </div>
        <LoginForm />
        <div className="relative mt-8 hidden sm:block">
           <Image
            src="https://placehold.co/600x400.png"
            alt="Abstract aviation background"
            width={600}
            height={400}
            className="rounded-lg object-cover opacity-30 shadow-xl"
            data-ai-hint="abstract aviation"
            priority
          />
        </div>
      </div>
    </div>
  );
}
