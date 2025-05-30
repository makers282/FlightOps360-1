
"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Plane, PlusCircle, Trash2, Save, XCircle, Loader2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchFleetAircraft, saveFleetAircraft, deleteFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';

const formatCurrency = (amount: number) => {
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
};

export default function CompanySettingsPage() {
  const [fleet, setFleet] = useState<FleetAircraft[]>([]);
  const [isLoadingFleet, setIsLoadingFleet] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const [isDeleting, startDeletingTransition] = useTransition();
  const { toast } = useToast();

  const [showAddAircraftForm, setShowAddAircraftForm] = useState(false);
  const [newTailNumber, setNewTailNumber] = useState('');
  const [newModel, setNewModel] = useState('');
  const [editingAircraftId, setEditingAircraftId] = useState<string | null>(null); // For editing existing aircraft

  useEffect(() => {
    const loadFleet = async () => {
      setIsLoadingFleet(true);
      try {
        const fetchedFleet = await fetchFleetAircraft();
        setFleet(fetchedFleet);
      } catch (error) {
        console.error("Failed to fetch fleet aircraft:", error);
        toast({ title: "Error", description: "Could not load aircraft fleet.", variant: "destructive" });
      } finally {
        setIsLoadingFleet(false);
      }
    };
    loadFleet();
  }, [toast]);

  const handleEditAircraftClick = (aircraft: FleetAircraft) => {
    setEditingAircraftId(aircraft.id);
    setNewTailNumber(aircraft.tailNumber);
    setNewModel(aircraft.model);
    setShowAddAircraftForm(true);
  };
  
  const handleAddOrUpdateAircraft = () => {
    if (!newTailNumber || !newModel) {
      toast({ title: "Missing Fields", description: "Please fill in Tail Number and Model.", variant: "destructive" });
      return;
    }

    const aircraftData: FleetAircraft = {
      id: editingAircraftId || newTailNumber.toUpperCase().replace(/\s+/g, ''), // Use tail as ID if new, else existing ID
      tailNumber: newTailNumber.toUpperCase().trim(),
      model: newModel.trim(),
    };

    startSavingTransition(async () => {
      try {
        const savedAircraft = await saveFleetAircraft(aircraftData);
        if (editingAircraftId) {
          setFleet(prev => prev.map(ac => ac.id === editingAircraftId ? savedAircraft : ac));
        } else {
          setFleet(prev => [...prev, savedAircraft]);
        }
        toast({ title: "Success", description: `Aircraft ${editingAircraftId ? 'updated' : 'added'}.` });
        handleCancelEditAircraft();
      } catch (error) {
        console.error("Failed to save aircraft:", error);
        toast({ title: "Error", description: `Could not ${editingAircraftId ? 'update' : 'add'} aircraft.`, variant: "destructive" });
      }
    });
  };

  const handleCancelEditAircraft = () => {
    setEditingAircraftId(null);
    setNewTailNumber('');
    setNewModel('');
    setShowAddAircraftForm(false);
  };

  const handleDeleteAircraft = (aircraftIdToDelete: string) => {
    startDeletingTransition(async () => {
      try {
        await deleteFleetAircraft({ aircraftId: aircraftIdToDelete });
        setFleet(prev => prev.filter(ac => ac.id !== aircraftIdToDelete));
        toast({ title: "Success", description: "Aircraft deleted from fleet." });
        if (editingAircraftId === aircraftIdToDelete) {
          handleCancelEditAircraft();
        }
      } catch (error) {
        console.error("Failed to delete aircraft:", error);
        toast({ title: "Error", description: "Could not delete aircraft.", variant: "destructive" });
      }
    });
  };

  return (
    <>
      <PageHeader 
        title="Company Settings" 
        description="Manage company information and aircraft fleet."
        icon={Building2}
      />

      <div className="space-y-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
            <CardDescription>Basic details about your company (placeholder).</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Company details form will go here.</p>
            {/* Placeholder for company info form: Name, Address, Contact, Logo upload etc. */}
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-primary"/> Manage Aircraft Fleet</CardTitle>
                <CardDescription>Add, edit, or remove aircraft from your company's fleet.</CardDescription>
              </div>
              {!showAddAircraftForm && (
                <Button variant="outline" size="sm" onClick={() => { setEditingAircraftId(null); setShowAddAircraftForm(true); setNewTailNumber(''); setNewModel('');}}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Aircraft
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {showAddAircraftForm && (
              <Card className="p-4 mb-4 bg-muted/50 border-dashed">
                <CardTitle className="text-lg mb-2">
                  {editingAircraftId ? `Edit Aircraft: ${editingAircraftId}` : 'Add New Aircraft'}
                </CardTitle>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="newTailNumber">Tail Number</Label>
                    <Input id="newTailNumber" value={newTailNumber} onChange={(e) => setNewTailNumber(e.target.value)} placeholder="e.g., N123AB" />
                  </div>
                  <div>
                    <Label htmlFor="newModel">Model</Label>
                    <Input id="newModel" value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="e.g., Cessna Citation CJ3" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddOrUpdateAircraft} size="sm" disabled={isSaving}>
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                      {editingAircraftId ? 'Update Aircraft' : 'Save Aircraft'}
                    </Button>
                    <Button variant="outline" onClick={handleCancelEditAircraft} size="sm" disabled={isSaving}>
                      <XCircle className="mr-2 h-4 w-4"/>Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            )}
            {isLoadingFleet ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading fleet...</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tail Number</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fleet.length === 0 && !isLoadingFleet && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-4">No aircraft in fleet. Add one to get started.</TableCell>
                    </TableRow>
                  )}
                  {fleet.map((aircraft) => (
                    <TableRow key={aircraft.id}>
                      <TableCell className="font-medium">{aircraft.tailNumber}</TableCell>
                      <TableCell>{aircraft.model}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditAircraftClick(aircraft)} className="mr-1 hover:text-primary" disabled={isSaving || isDeleting}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit {aircraft.tailNumber}</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteAircraft(aircraft.id)} className="text-destructive hover:text-destructive" disabled={isSaving || isDeleting}>
                          {isDeleting && editingAircraftId === aircraft.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                          <span className="sr-only">Delete {aircraft.tailNumber}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
