
"use client"; 

import React, { useState, useEffect } from 'react';
import type { PropsWithChildren } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; 
import {
  Bell,
  Calculator,
  Calendar,
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Plane,
  Route,
  Settings,
  ShieldAlert,
  Users, 
  UsersRound, 
  FileArchive as QuoteFileArchiveIcon, 
  SlidersHorizontal,
  PlaneTakeoff,
  Building2,
  Wrench, 
  BarChartBig, 
  DollarSign, 
  Package, 
  TrendingUp, 
  Users2, 
  BookOpenCheck,
  BookOpen, 
  FileWarning, 
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarInset,
  SidebarMenuBadge
} from '@/components/ui/sidebar';
import { Icons } from '@/components/icons';
import { auth } from '@/lib/firebase'; 
import { signOut, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';


export default function AppLayout({ children }: PropsWithChildren) {
  const pathname = usePathname(); 
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
      } else {
        setCurrentUser(user);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push('/login');
    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: "Logout Failed", description: "Could not log you out. Please try again.", variant: "destructive" });
      router.push('/login');
    }
  };
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon"> 
        <SidebarHeader className="p-2">
          <Link href="/dashboard" className="flex items-center">
            <Icons.Logo className="h-8 w-auto" /> 
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton href="/dashboard" tooltip="Dashboard" isActive={pathname === '/dashboard'}>
                <LayoutDashboard />
                Dashboard
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton isSubmenuTrigger tooltip="Trips" isActive={pathname.startsWith('/trips')}>
                <CalendarDays />
                Trips
              </SidebarMenuButton>
              <SidebarMenuSub>
                <SidebarMenuSubButton href="/trips/new" tooltip="Create New Trip" isActive={pathname === '/trips/new'}>
                  <CalendarPlus />
                  New Trip
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/trips/calendar" tooltip="Trip Calendar" isActive={pathname === '/trips/calendar'}>
                  <Calendar />
                  Trip Calendar
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/trips/list" tooltip="Trip List View" isActive={pathname === '/trips/list'}>
                  <ListChecks />
                  Trip List
                </SidebarMenuSubButton>
              </SidebarMenuSub>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton href="/customers" tooltip="Customers" isActive={pathname.startsWith('/customers')}>
                <UsersRound />
                Customers
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton isSubmenuTrigger tooltip="Quotes & Routing" isActive={pathname.startsWith('/quotes') || pathname.startsWith('/optimal-route')}>
                <FileSpreadsheet />
                Quotes & Routing
              </SidebarMenuButton>
              <SidebarMenuSub>
                <SidebarMenuSubButton href="/quotes/new" tooltip="New Quote" isActive={pathname === '/quotes/new'}>
                  <Calculator />
                  New Quote
                </SidebarMenuSubButton>
                 <SidebarMenuSubButton href="/quotes" tooltip="All Quotes" isActive={pathname === '/quotes' && pathname !== '/quotes/new'}>
                  <QuoteFileArchiveIcon />
                  All Quotes
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/optimal-route" tooltip="Optimal Route Planning" isActive={pathname === '/optimal-route'}>
                  <Route />
                  Optimal Route
                </SidebarMenuSubButton>
              </SidebarMenuSub>
            </SidebarMenuItem>
            
            <SidebarMenuItem>
              <SidebarMenuButton isSubmenuTrigger tooltip="Aircraft" isActive={pathname.startsWith('/aircraft') && !pathname.startsWith('/aircraft/currency')}>
                <Plane />
                Aircraft
              </SidebarMenuButton>
              <SidebarMenuSub>
                 <SidebarMenuSubButton href="/aircraft/discrepancies" tooltip="Discrepancy Log" isActive={pathname.startsWith('/aircraft/discrepancies')}>
                  <FileWarning /> 
                  Discrepancy Log
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/aircraft/mels" tooltip="MEL Log" isActive={pathname.startsWith('/aircraft/mels')}>
                  <BookOpen /> 
                  MEL Log
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/aircraft/documents" tooltip="Aircraft Documents" isActive={pathname.startsWith('/aircraft/documents')}>
                  <BookOpenCheck /> 
                  Aircraft Documents
                </SidebarMenuSubButton>
              </SidebarMenuSub>
            </SidebarMenuItem>
            
            <SidebarMenuItem>
                <SidebarMenuButton isSubmenuTrigger tooltip="Maintenance" isActive={pathname.startsWith('/aircraft/currency') || pathname.startsWith('/maintenance')}>
                    <Wrench />
                    Maintenance
                </SidebarMenuButton>
                <SidebarMenuSub>
                    <SidebarMenuSubButton href="/aircraft/currency" tooltip="Maintenance Currency" isActive={pathname.startsWith('/aircraft/currency')}>
                        <ListChecks /> 
                        Maintenance Currency
                    </SidebarMenuSubButton>
                    <SidebarMenuSubButton href="/maintenance/costs" tooltip="Maintenance Costs" isActive={pathname.startsWith('/maintenance/costs')}>
                        <DollarSign />
                        Maintenance Costs
                    </SidebarMenuSubButton>
                </SidebarMenuSub>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton 
                isSubmenuTrigger 
                tooltip="Crew Management" 
                isActive={
                  pathname.startsWith('/crew') || 
                  pathname === '/trips/crew-schedule' 
                }
              >
                <Users /> 
                Crew Management
              </SidebarMenuButton>
              <SidebarMenuSub>
                 <SidebarMenuSubButton href="/crew/status" tooltip="Crew Status" isActive={pathname === '/crew/status'}>
                  <UsersRound /> 
                  Crew Status
                </SidebarMenuSubButton>
                 <SidebarMenuSubButton href="/crew/roster" tooltip="Crew Roster" isActive={pathname === '/crew/roster'}>
                  <Users2 /> 
                  Crew Roster
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/crew/documents" tooltip="Crew Documents" isActive={pathname === '/crew/documents'}>
                  <FolderArchive />
                  Crew Documents
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/crew/training" tooltip="Crew Training Records" isActive={pathname === '/crew/training'}>
                  <GraduationCap />
                  Crew Training
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/trips/crew-schedule" tooltip="Crew Schedule & Duty Times" isActive={pathname === '/trips/crew-schedule'}>
                  <CalendarCheck2 />
                  Crew Schedule
                </SidebarMenuSubButton>
              </SidebarMenuSub>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton isSubmenuTrigger tooltip="Reports" isActive={pathname.startsWith('/reports')}>
                <BarChartBig />
                Reports
              </SidebarMenuButton>
              <SidebarMenuSub>
                <SidebarMenuSubButton href="/reports/maintenance" tooltip="Maintenance Reports" isActive={pathname === '/reports/maintenance'}>
                  <Wrench />
                  Maintenance
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/reports/financial" tooltip="Financial Reports" isActive={pathname === '/reports/financial'}>
                  <DollarSign />
                  Financial Reports
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/reports/crew" tooltip="Crew Activity" isActive={pathname === '/reports/crew'}>
                  <Users />
                  Crew Activity
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/reports/flight-logs" tooltip="Flight Logs" isActive={pathname === '/reports/flight-logs'}>
                  <PlaneTakeoff />
                  Flight Logs
                </SidebarMenuSubButton>
                 <SidebarMenuSubButton href="/reports/load-manifest" tooltip="Load Manifests" isActive={pathname === '/reports/load-manifest'}>
                  <Package />
                  Load Manifests
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/reports/analytics" tooltip="Operational Analytics" isActive={pathname === '/reports/analytics'}>
                  <TrendingUp />
                  Operational Analytics
                </SidebarMenuSubButton>
              </SidebarMenuSub>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton href="/documents" tooltip="Company Document Hub" isActive={pathname === '/documents'}>
                <FileText />
                Company Documents
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton href="/frat" tooltip="FRAT Integration" isActive={pathname === '/frat'}>
                <ShieldAlert />
                FRAT Integration
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton href="/notifications" tooltip="Notifications" isActive={pathname === '/notifications'}>
                <Bell />
                Notifications
                <SidebarMenuBadge>3</SidebarMenuBadge> 
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isSubmenuTrigger tooltip="Settings" isActive={pathname.startsWith('/settings')}>
                <Settings />
                Settings
              </SidebarMenuButton>
              <SidebarMenuSub>
                <SidebarMenuSubButton href="/settings/company" isActive={pathname === '/settings/company'}>
                  <Building2 /> Company Settings
                </SidebarMenuSubButton>
                 <SidebarMenuSubButton href="/settings/users" isActive={pathname === '/settings/users'}>
                   <Users /> Manage Users
                 </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/settings/roles" isActive={pathname === '/settings/roles'}>
                  <Users /> User Roles
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/settings/quote-config" tooltip="Quote Configuration" isActive={pathname === '/settings/quote-config'}>
                  <DollarSign /> Quote Configuration
                </SidebarMenuSubButton>
                 <SidebarMenuSubButton href="/settings/aircraft-performance" isActive={pathname === '/settings/aircraft-performance'}>
                  <PlaneTakeoff /> Aircraft Performance
                </SidebarMenuSubButton>
              </SidebarMenuSub>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2">
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-16 sm:px-6">
            <SidebarTrigger /> 
          <div className="flex-1">
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={currentUser?.photoURL || ''} alt="User Avatar" />
                  <AvatarFallback>{getInitials(currentUser?.displayName)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{currentUser?.displayName || 'My Account'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Billing</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
