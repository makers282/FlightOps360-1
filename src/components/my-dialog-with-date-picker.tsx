
"use client";

import React from "react";
import ReactDOM from "react-dom";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Popover, PopoverTrigger } from "@/components/ui/popover"; // Note: PopoverContent is not used for rendering the calendar
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Helper component to manually portal content to document.body
function ManualPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) {
    return null;
  }

  return ReactDOM.createPortal(
    children,
    document.body
  );
}

export function MyDialogWithDatePicker() {
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(undefined);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [calendarPosition, setCalendarPosition] = React.useState({ top: 0, left: 0 });

  React.useEffect(() => {
    if (isCalendarOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCalendarPosition({
        top: rect.bottom + window.scrollY + 5, // Position below the trigger + 5px offset
        left: rect.left + window.scrollX,      // Align with left of the trigger
      });
    }
  }, [isCalendarOpen]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Modal with Date Picker</Button>
      </DialogTrigger>
      <DialogContent className="overflow-visible sm:max-w-md">
        <h3 className="text-lg font-semibold">Date Picker Example</h3>
        <p className="text-sm text-muted-foreground mb-4">
          This date picker uses ReactDOM.createPortal.
        </p>
        
        {/* The Popover component is used here mainly to manage the open/close state (isCalendarOpen) 
            and to provide a PopoverTrigger. We are NOT using PopoverContent for the calendar. */}
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen} modal={false}>
          <PopoverTrigger asChild ref={triggerRef}>
            <Button
              variant={"outline"}
              className={cn(
                "w-[280px] justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          
          {/* Conditional rendering of the manually portalled calendar */}
          {isCalendarOpen && (
            <ManualPortal>
              {/* This outer div establishes the fixed positioning context */}
              <div
                style={{
                  position: 'fixed', // Ensures it's relative to viewport
                  top: `${calendarPosition.top}px`,
                  left: `${calendarPosition.left}px`,
                  zIndex: 99999, // Very high z-index
                  // pointerEvents: 'none', // Allows clicks to pass through the full-screen portal layer itself
                                        // but the calendar's wrapper below will have pointer-events: auto
                }}
              >
                {/* This inner div is the actual visible calendar box */}
                <div 
                  className="bg-popover text-popover-foreground border shadow-md rounded-md"
                  // style={{ pointerEvents: 'auto' }} // Ensure clicks are caught by the calendar
                >
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setIsCalendarOpen(false); // Close popover on date select
                    }}
                    // No initialFocus or other focus-grabbing props
                  />
                </div>
              </div>
            </ManualPortal>
          )}
        </Popover>

        <div className="mt-4">
          Selected date: {selectedDate ? format(selectedDate, "PPP") : "None"}
        </div>

        {/* Dummy button to test focus within dialog */}
        <Button className="mt-4">Another Button in Dialog</Button>

      </DialogContent>
    </Dialog>
  );
}
