
"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// import { auth } from '@/lib/firebase'; // We'll use this later
// import { signInWithEmailAndPassword } from 'firebase/auth'; // We'll use this later
// import { useRouter } from 'next/navigation'; // We'll use this later

const formSchema = z.object({
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
  password: z.string().min(6, "Password must be at least 6 characters.").min(1, "Password is required."),
});

type FormData = z.infer<typeof formSchema>;

export function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  // const router = useRouter(); // We'll use this later

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit: SubmitHandler<FormData> = (data) => {
    startTransition(async () => {
      console.log("Login attempt with:", data);
      // Placeholder for actual Firebase login logic
      // try {
      //   const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      //   console.log("User signed in:", userCredential.user);
      //   toast({ title: "Login Successful", description: "Redirecting to dashboard..." });
      //   router.push('/dashboard');
      // } catch (error: any) {
      //   console.error("Login error:", error);
      //   toast({
      //     title: "Login Failed",
      //     description: error.message || "An unknown error occurred.",
      //     variant: "destructive",
      //   });
      // }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: "Login Submitted (Placeholder)",
        description: "Actual login logic to be implemented.",
      });
    });
  };

  return (
    <Card className="w-full shadow-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Sign In</CardTitle>
        <CardDescription>Enter your credentials to access your account.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div className="flex items-center justify-between text-sm">
                {/* Placeholder for "Forgot password?" */}
                <a href="#" className="font-medium text-primary hover:text-primary/90">
                  Forgot password?
                </a>
              </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              Sign In
            </Button>
             <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <a href="#" className="font-semibold text-primary hover:text-primary/90">
                  Contact Support
                </a>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
