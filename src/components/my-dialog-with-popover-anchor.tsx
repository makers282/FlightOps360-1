
"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogPortal,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";

export function MyDialogWithPopoverAnchor() {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      {/* 1) The Dialog with the “Pick date” button */}
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open Modal (PopoverAnchor Test)</Button>
        </DialogTrigger>
        <DialogPortal>
          <DialogContent className="overflow-visible sm:max-w-md">
            <div className="py-4">
              <h3 className="text-lg font-semibold mb-2">Modal Content</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This button uses a PopoverAnchor to display the calendar.
              </p>
              {/* This button lives in the modal and toggles the popover state */}
              <Button
                ref={buttonRef}
                variant="outline"
                onClick={() => setOpen((prev) => !prev)}
                className={cn(
                  "w-[280px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                Selected Date: {selectedDate ? format(selectedDate, "PPP") : "None"}
              </p>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* 2) Popover rendered at the root, anchored to buttonRef */}
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverAnchor asChild>
          {/* Invisible div acting as the anchor for positioning. 
              It needs to be present in the DOM for Radix to find the ref.
              Styling it to be non-interactive and zero-size if it affects layout.
           */}
          <div ref={buttonRef} style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />
        </PopoverAnchor>
        <PopoverContent side="bottom" align="start" className="z-[9999] p-0 w-auto">
          {/* Calendar inside PopoverContent. ShadCN's PopoverContent already portals. */}
          <div className="bg-background border rounded-md shadow-lg">
            <Calendar
              mode="single"
              selected={selectedDate || undefined}
              onSelect={(date) => {
                setSelectedDate(date || null);
                setOpen(false);
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
