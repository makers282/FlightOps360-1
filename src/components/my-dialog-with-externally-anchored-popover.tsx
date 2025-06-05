
"use client";

import React from "react";
import { Dialog, DialogTrigger, DialogContent, DialogPortal } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function MyDialogWithExternallyAnchoredPopover() {
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      {/* 1) The Dialog with the “Pick date” button */}
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open Modal (Externally Anchored Popover)</Button>
        </DialogTrigger>
        <DialogPortal>
          <DialogContent className="overflow-visible sm:max-w-md">
            <div className="py-4">
              <h3 className="text-lg font-semibold mb-2">Modal Content</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This button below will trigger a Popover whose content is rendered
                at the root level of the JSX tree, anchored to this button.
              </p>

              {/* This button is the anchor; it uses ref and manually controls the Popover state */}
              <Button
                ref={buttonRef}
                variant="outline"
                className={cn(
                  "w-[280px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
                onClick={() => setIsCalendarOpen(true)}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                Selected Date: {selectedDate ? format(selectedDate, "PPP") : "None"}
              </p>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* 2) Render the Popover at the root, anchored to buttonRef */}
      {/* 
        The Popover component itself is a context provider. 
        Its `open` and `onOpenChange` props control the visibility.
        The `anchorRef` prop tells Radix Popover where to position its content
        relative to, even if the PopoverTrigger is not a direct child or is minimal.
      */}
      <Popover
        open={isCalendarOpen}
        onOpenChange={setIsCalendarOpen}
        modal={false} // Keep it non-modal to avoid conflicts with the Dialog
        anchorRef={buttonRef}
      >
        <PopoverTrigger asChild>
          {/* 
            A PopoverTrigger is still needed for Radix's internal mechanics, 
            even if `anchorRef` is used for positioning. 
            It can be a minimal, non-interactive element if the actual click
            is handled by the button inside the Dialog.
            If `anchorRef` fully dictates positioning, this might not even need to be rendered,
            but it's safer to include it as per Radix patterns.
            An empty span ensures it doesn't interfere visually or with layout.
          */}
          <span />
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          className="p-0 w-auto" // w-auto allows Calendar to set its own width
          // No need for z-index or bg-transparent here, as the inner div handles visuals
          // and default portalling places it high.
        >
          {/* This div is the actual visual container for the calendar */}
          <div className="z-[9999] bg-background shadow-lg rounded-lg border">
            <Calendar
              mode="single"
              selected={selectedDate || undefined} // Pass undefined if null for react-day-picker
              onSelect={(date) => {
                setSelectedDate(date || null);
                setIsCalendarOpen(false);
              }}
              // No initialFocus
            />
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
