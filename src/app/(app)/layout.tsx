
import React from 'react';
import type { PropsWithChildren } from 'react';
import Link from 'next/link';
import {
  Bell,
  Calculator,
  Calendar,
  CalendarCheck2,
  CalendarClock,
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
  Building2, // Added for Company Settings
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
  return (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarHeader className="p-4">
          <Link href="/dashboard" className="flex items-center">
            <Icons.Logo className="h-7" />
            {/* Text is part of the logo image now */}
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton href="/dashboard" tooltip="Dashboard">
                <LayoutDashboard />
                Dashboard
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton isSubmenuTrigger tooltip="Trips">
                <CalendarDays />
                Trips
              </SidebarMenuButton>
              <SidebarMenuSub>
                <SidebarMenuSubButton href="/trips/new" tooltip="Create New Trip">
                  <CalendarPlus />
                  New Trip
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/trips/calendar" tooltip="Trip Calendar">
                  <Calendar />
                  Trip Calendar
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/trips/list" tooltip="Trip List View">
                  <ListChecks />
                  Trip List
                </SidebarMenuSubButton>
              </SidebarMenuSub>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton href="/customers" tooltip="Customers">
                <UsersRound />
                Customers
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton isSubmenuTrigger tooltip="Quotes & Routing">
                <FileSpreadsheet />
                Quotes & Routing
              </SidebarMenuButton>
              <SidebarMenuSub>
                <SidebarMenuSubButton href="/quotes/new" tooltip="New Quote">
                  <Calculator />
                  New Quote
                </SidebarMenuSubButton>
                 <SidebarMenuSubButton href="/quotes" tooltip="All Quotes">
                  <FileArchive />
                  All Quotes
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/optimal-route" tooltip="Optimal Route Planning">
                  <Route />
                  Optimal Route
                </SidebarMenuSubButton>
              </SidebarMenuSub>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton href="/documents" tooltip="Document Hub">
                <FileText />
                Document Hub
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton isSubmenuTrigger tooltip="Crew Management">
                <UsersRound />
                Crew Management
              </SidebarMenuButton>
              <SidebarMenuSub>
                 <SidebarMenuSubButton href="/crew/status" tooltip="Crew Status">
                  <Users />
                  Crew Status
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/crew/documents" tooltip="Crew Documents">
                  <FolderArchive />
                  Crew Documents
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/crew/training" tooltip="Crew Training Records">
                  <GraduationCap />
                  Crew Training
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/trips/crew-schedule" tooltip="Crew Schedule Calendar">
                  <CalendarCheck2 />
                  Crew Schedule
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/trips/duty-time" tooltip="Duty Time Calendar">
                  <CalendarClock />
                  Duty Times
                </SidebarMenuSubButton>
              </SidebarMenuSub>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton href="/frat" tooltip="FRAT Integration">
                <ShieldAlert />
                FRAT Integration
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton href="/notifications" tooltip="Notifications">
                <Bell />
                Notifications
                <SidebarMenuBadge>3</SidebarMenuBadge> {/* Example badge */}
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isSubmenuTrigger tooltip="Settings">
                <Settings />
                Settings
              </SidebarMenuButton>
              <SidebarMenuSub>
                <SidebarMenuSubButton href="/settings/company">
                  <Building2 /> Company Settings
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/settings/roles">
                  <Users /> User Roles
                </SidebarMenuSubButton>
                <SidebarMenuSubButton href="/settings/quote-config">
                  <SlidersHorizontal /> Quote Configuration
                </SidebarMenuSubButton>
                 <SidebarMenuSubButton href="/settings/aircraft-performance">
                  <PlaneTakeoff /> Aircraft Performance
                </SidebarMenuSubButton>
              </SidebarMenuSub>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2">
           {/* Could add a user profile link or quick actions here */}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-16 sm:px-6">
          <SidebarTrigger className="md:hidden" />
          <div className="flex-1">
            {/* Header content, e.g., breadcrumbs or search can go here if needed */}
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
