
"use client";

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Copy } from 'lucide-react';
import type { FleetAircraft } from '@/ai/schemas/fleet-aircraft-schemas';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

interface CopyTasksModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onCopy: (targetAircraftIds: string[]) => Promise<void>;
  isCopying: boolean;
  sourceAircraft: FleetAircraft | null;
  fleet: FleetAircraft[];
}

export function CopyTasksModal({
  isOpen,
  setIsOpen,
  onCopy,
  isCopying,
  sourceAircraft,
  fleet,
}: CopyTasksModalProps) {
  const [selectedAircraftIds, setSelectedAircraftIds] = useState<string[]>([]);

  const targetAircraftOptions = useMemo(() => {
    return fleet.filter(ac => 
      ac.id !== sourceAircraft?.id && // Exclude source aircraft
      ac.model === sourceAircraft?.model // Recommend same model
    );
  }, [fleet, sourceAircraft]);

  const otherAircraftOptions = useMemo(() => {
    return fleet.filter(ac => 
      ac.id !== sourceAircraft?.id && 
      ac.model !== sourceAircraft?.model
    );
  }, [fleet, sourceAircraft]);

  const handleSelectAircraft = (aircraftId: string, checked: boolean) => {
    setSelectedAircraftIds(prev =>
      checked ? [...prev, aircraftId] : prev.filter(id => id !== aircraftId)
    );
  };

  const handleCopyClick = () => {
    onCopy(selectedAircraftIds);
  };
  
  // Reset selection when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedAircraftIds([]);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isCopying) setIsOpen(open); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy Maintenance Tasks</DialogTitle>
          <DialogDescription>
            Copy all tasks from <strong>{sourceAircraft?.tailNumber}</strong> to one or more other aircraft.
          </DialogDescription>
        </DialogHeader>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>
            This will create new copies of all tasks. The 'Last Completed' history (dates, hours, cycles) will be reset on the new tasks.
          </AlertDescription>
        </Alert>
        <ScrollArea className="max-h-80 pr-4">
            <div className="space-y-4">
                {targetAircraftOptions.length > 0 && (
                    <div>
                        <h4 className="font-semibold mb-2 text-sm">Recommended (Same Model: {sourceAircraft?.model})</h4>
                        <div className="space-y-2">
                        {targetAircraftOptions.map(aircraft => (
                            <div key={aircraft.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted">
                            <Checkbox
                                id={`copy-to-${aircraft.id}`}
                                onCheckedChange={(checked) => handleSelectAircraft(aircraft.id, !!checked)}
                                checked={selectedAircraftIds.includes(aircraft.id)}
                            />
                            <Label htmlFor={`copy-to-${aircraft.id}`} className="font-normal w-full cursor-pointer">
                                {aircraft.tailNumber} - {aircraft.model}
                            </Label>
                            </div>
                        ))}
                        </div>
                    </div>
                )}
                 {otherAircraftOptions.length > 0 && (
                    <div>
                        <h4 className="font-semibold mb-2 mt-4 text-sm">Other Aircraft</h4>
                        <div className="space-y-2">
                        {otherAircraftOptions.map(aircraft => (
                            <div key={aircraft.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted">
                            <Checkbox
                                id={`copy-to-${aircraft.id}`}
                                onCheckedChange={(checked) => handleSelectAircraft(aircraft.id, !!checked)}
                                checked={selectedAircraftIds.includes(aircraft.id)}
                            />
                            <Label htmlFor={`copy-to-${aircraft.id}`} className="font-normal w-full cursor-pointer">
                                {aircraft.tailNumber} - {aircraft.model}
                            </Label>
                            </div>
                        ))}
                        </div>
                    </div>
                )}
                 {targetAircraftOptions.length === 0 && otherAircraftOptions.length === 0 && (
                    <p className="text-muted-foreground text-center py-4">No other aircraft in the fleet to copy to.</p>
                 )}
            </div>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isCopying}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleCopyClick} disabled={isCopying || selectedAircraftIds.length === 0}>
            {isCopying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
            Copy Tasks to ({selectedAircraftIds.length}) Aircraft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
