
"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useFloating, shift, offset, autoUpdate, flip } from "@floating-ui/react-dom";
import { Dialog, DialogTrigger, DialogContent, DialogPortal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function MyDialogWithFloatingUIDatePicker() {
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(undefined);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1) Create a ref for the button that opens the popover
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  // 2) Use Floating UI’s hook to calculate x,y for the popover
  const { x, y, strategy, refs: { setReference, setFloating }, update } = useFloating({
    placement: "bottom-start",
    middleware: [offset(4), shift(), flip()], // Added flip
    whileElementsMounted: autoUpdate, // Simplified autoUpdate usage
  });

  // 3) Wire up the ref returned by Floating UI
  React.useEffect(() => {
    if (buttonRef.current) {
      setReference(buttonRef.current);
    }
  }, [setReference, buttonRef, isCalendarOpen]); // Re-run if calendar opens/closes or button ref changes


  return (
    <>
      {/* 1) Dialog with “Pick date” button inside */}
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open Modal (Floating UI)</Button>
        </DialogTrigger>
        <DialogPortal>
          <DialogContent className="overflow-visible sm:max-w-md">
            {/* ...other form fields... */}
             <h3 className="text-lg font-semibold">Floating UI Date Picker Example</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This date picker uses Floating UI and ReactDOM.createPortal.
            </p>
            {/* The button that toggles the calendar popover */}
            <Button
              ref={buttonRef}
              variant="outline"
              className={cn("w-[280px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
              onClick={() => setIsCalendarOpen((prev) => !prev)}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
            </Button>

            <div className="mt-4">
                Selected date: {selectedDate ? format(selectedDate, "PPP") : "None"}
            </div>
            {/* ...rest of DialogContent... */}
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* 2) When isCalendarOpen is true, render the Calendar in a portal */}
      {isMounted && isCalendarOpen &&
        createPortal(
          <div
            ref={setFloating}
            style={{
              position: strategy,
              top: y ?? "", // Use empty string if y is null to avoid '0px' initial flicker
              left: x ?? "", // Use empty string if x is null
              zIndex: 9999,
            }}
          >
            <div className="bg-background border shadow-lg rounded-md"> {/* Use theme variable for background */}
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  setSelectedDate(date || undefined);
                  setIsCalendarOpen(false);
                }}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
