
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '20px', textAlign: 'center' }}>
      <h1>Hello World!</h1>
      <p>This is the root page of your FlightOps360 application.</p>
      <p className="mt-4">If you see this, the basic routing to src/app/page.tsx is working.</p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/login">Go to Login Page</Link>
        </Button>
      </div>
      <div className="mt-2">
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to Dashboard (if logged in)</Link>
        </Button>
      </div>
    </div>
  );
}
