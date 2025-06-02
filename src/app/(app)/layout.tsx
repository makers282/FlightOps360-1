
"use client"; // Mark as client component for usePathname

import React from 'react';
import type { PropsWithChildren } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation'; // Import usePathname
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
  FileArchive,
  SlidersHorizontal,
  PlaneTakeoff,
  Building2,
  Wrench, 
  ClipboardCheck,
  BarChartBig, // New icon for Reports
  DollarSign, // New icon for Financial Reports
  Package, // New icon for Load Manifests
  TrendingUp, // New icon for Operational Analytics
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


export default function AppLayout({ children }: PropsWithChildren) {
  const pathname = usePathname(); // Get current pathname

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon"> {/* Changed collapsible to "icon" */}
        <SidebarHeader className="p-4">
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
                  <FileArchive />
                  All Quotes
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/optimal-route" tooltip="Optimal Route Planning" isActive={pathname === '/optimal-route'}>
                  <Route />
                  Optimal Route
                </SidebarMenuSubButton>
              </SidebarMenuSub>
            </SidebarMenuItem>
            
            <SidebarMenuItem>
              <SidebarMenuButton isSubmenuTrigger tooltip="Aircraft" isActive={pathname.startsWith('/aircraft')}>
                <Plane />
                Aircraft
              </SidebarMenuButton>
              <SidebarMenuSub>
                <SidebarMenuSubButton href="/aircraft/currency" tooltip="Maintenance Currency" isActive={pathname.startsWith('/aircraft/currency')}>
                  <Wrench /> 
                  Maintenance Currency
                </SidebarMenuSubButton>
              </SidebarMenuSub>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton 
                isSubmenuTrigger 
                tooltip="Crew Management" 
                isActive={
                  pathname.startsWith('/crew') || 
                  pathname === '/trips/crew-schedule' // Crew Schedule is under Trips for now
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
              <SidebarMenuButton href="/documents" tooltip="Document Hub" isActive={pathname === '/documents'}>
                <FileText />
                Document Hub
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
                <SidebarMenuSubButton href="/settings/quote-config" isActive={pathname === '/settings/quote-config'}>
                  <SlidersHorizontal /> Quote Configuration
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
          <SidebarTrigger /> {/* Removed md:hidden */}
          <div className="flex-1">
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://placehold.co/100x100.png" alt="User Avatar" data-ai-hint="user avatar" />
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Billing</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
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
