
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
// Keep necessary imports for the isolated card section
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { List, ListItem } from '@/components/ui/list';
import { Megaphone, Loader2, AlertTriangle, CheckCircle2, InfoIcon as InfoIconLucide } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchBulletins, type Bulletin, type BulletinType } from '@/ai/flows/manage-bulletins-flow';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';

// Minimal state and logic needed for JUST the bulletin card
export default function DashboardPage() {
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [isLoadingBulletins, setIsLoadingBulletins] = useState(true);
  const [selectedBulletin, setSelectedBulletin] = useState<Bulletin | null>(null);
  const [isBulletinModalOpen, setIsBulletinModalOpen] = useState(false);
  const [isBulletinAccordionOpen, setIsBulletinAccordionOpen] = useState(true); // Keep open for testing
  const { toast } = useToast(); // Keep toast for potential errors in this isolated part

  const getBulletinTypeBadgeVariant = (type: BulletinType): "default" | "destructive" | "secondary" => {
    switch (type) {
      case 'Urgent': return 'destructive';
      case 'Important': return 'secondary';
      default: return 'default';
    }
  };

  const handleBulletinClick = (bulletin: Bulletin) => {
    setSelectedBulletin(bulletin);
    setIsBulletinModalOpen(true);
  };

  useEffect(() => {
    let isMounted = true;
    const loadBulletins = async () => {
      setIsLoadingBulletins(true);
      try {
        const fetchedBulletins = await fetchBulletins();
        if (isMounted) {
          const activeAndSortedBulletins = fetchedBulletins
            .filter(b => b.isActive)
            .sort((a, b) => parseISO(b.publishedAt).getTime() - parseISO(a.publishedAt).getTime())
            .slice(0, 5);
          setBulletins(activeAndSortedBulletins);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to load bulletins:", error);
          toast({ title: "Error Loading Bulletins", description: (error instanceof Error ? error.message : "Unknown error."), variant: "destructive" });
        }
      } finally {
        if (isMounted) setIsLoadingBulletins(false);
      }
    };
    loadBulletins();
    return () => { isMounted = false; };
  }, [toast]);

  // Return ONLY the first card structure
  return (
    <>
      {/* Line 408 equivalent would be here */}
      <Card className="mb-6 shadow-md border-primary/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              <CardTitle>Company Bulletin Board</CardTitle>
              {bulletins.length > 0 && (
                <Badge variant="secondary" className="ml-2">{bulletins.length}</Badge>
              )}
            </div>
          </div>
          <CardDescription className="mt-1">Latest news and announcements from Firestore.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Accordion
            type="single"
            collapsible
            defaultValue="bulletin-item" // Keep it open by default
            className="w-full"
          >
            <AccordionItem value="bulletin-item" className="border-none">
              {/* Example: Make the CardHeader area the trigger if desired, or add a separate one */}
              {/* For simplicity, let's assume the accordion is always open or has a separate trigger below if needed */}
              <AccordionContent className="pt-2">
                {isLoadingBulletins ? (
                  <div className="flex items-center justify-center py-5">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Loading bulletins...</p>
                  </div>
                ) : bulletins.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">No active company bulletins.</p>
                ) : (
                  <List>
                    {bulletins.map((item, index) => (
                      <React.Fragment key={item.id}>
                        <ListItem
                          className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3 cursor-pointer hover:bg-muted/50 rounded-md px-2 -mx-2"
                          onClick={() => handleBulletinClick(item)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBulletinClick(item);}}
                        >
                          <div className="flex-1 mb-2 sm:mb-0">
                            <p className="font-semibold">{item.title}
                              <span className="text-xs text-muted-foreground font-normal ml-2">
                                - {item.publishedAt && isValid(parseISO(item.publishedAt)) ? format(parseISO(item.publishedAt), 'MMM d, yyyy HH:mm') : 'N/A'}
                              </span>
                            </p>
                            <p className="text-sm text-muted-foreground truncate max-w-prose">{item.message}</p>
                          </div>
                          <Badge variant={getBulletinTypeBadgeVariant(item.type)} className="capitalize">{item.type}</Badge>
                        </ListItem>
                        {index < bulletins.length - 1 && <Separator />}
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Modal for displaying bulletin details */}
      {selectedBulletin && (
        <AlertDialog open={isBulletinModalOpen} onOpenChange={setIsBulletinModalOpen}>
          <AlertDialogContent className="sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Badge variant={getBulletinTypeBadgeVariant(selectedBulletin.type)} className="capitalize text-xs mr-2">{selectedBulletin.type}</Badge>
                {selectedBulletin.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground pt-1">
                Published: {selectedBulletin.publishedAt && isValid(parseISO(selectedBulletin.publishedAt)) ? format(parseISO(selectedBulletin.publishedAt), 'PPP HH:mm') : 'N/A'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ScrollArea className="max-h-[60vh] mt-2">
                <div className="whitespace-pre-wrap p-1 text-sm">
                    {selectedBulletin.message}
                </div>
            </ScrollArea>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel onClick={() => setIsBulletinModalOpen(false)}>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
