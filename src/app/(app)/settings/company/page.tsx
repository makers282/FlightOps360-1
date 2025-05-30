
"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, Plane, PlusCircle, Trash2, Save, XCircle, Loader2, Edit, CheckSquare, Square, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchFleetAircraft, saveFleetAircraft, deleteFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function CompanySettingsPage() {
  const [fleet, setFleet] = useState<FleetAircraft[]>([]);
  const [isLoadingFleet, setIsLoadingFleet] = useState(true);
  const [isSavingAircraft, startSavingAircraftTransition] = useTransition();
  const [isDeletingAircraft, startDeletingAircraftTransition] = useTransition();
  const { toast } = useToast();

  const [showAddAircraftForm, setShowAddAircraftForm] = useState(false);
  const [newTailNumber, setNewTailNumber] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newIsMaintenanceTracked, setNewIsMaintenanceTracked] = useState(true);
  const [newTrackedComponentNamesStr, setNewTrackedComponentNamesStr] = useState('');
  const [editingAircraftId, setEditingAircraftId] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [isSavingCompanyInfo, startSavingCompanyInfoTransition] = useTransition();

  const loadFleetData = async () => {
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

  useEffect(() => {
    loadFleetData();
    setCompanyName("FlightOps360 LLC");
    setCompanyAddress("123 Aviation Way, Hangar B, Anytown, USA 12345");
    setCompanyEmail("ops@flightops360.example.com");
    setCompanyPhone("(555) 012-3456");
  }, [toast]);

  const handleEditAircraftClick = (aircraft: FleetAircraft) => {
    setEditingAircraftId(aircraft.id);
    setNewTailNumber(aircraft.tailNumber);
    setNewModel(aircraft.model);
    setNewIsMaintenanceTracked(aircraft.isMaintenanceTracked ?? true);
    setNewTrackedComponentNamesStr((aircraft.trackedComponentNames || ['Airframe', 'Engine 1']).join(', '));
    setShowAddAircraftForm(true);
  };
  
  const handleAddOrUpdateAircraft = () => {
    if (!newTailNumber || !newModel) {
      toast({ title: "Missing Fields", description: "Please fill in Tail Number and Model for the aircraft.", variant: "destructive" });
      return;
    }

    const parsedTrackedComponentNames = newTrackedComponentNamesStr
      .split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    const aircraftData: FleetAircraft = {
      id: editingAircraftId || newTailNumber.toUpperCase().replace(/\s+/g, ''), 
      tailNumber: newTailNumber.toUpperCase().trim(),
      model: newModel.trim(),
      isMaintenanceTracked: newIsMaintenanceTracked,
      trackedComponentNames: parsedTrackedComponentNames.length > 0 ? parsedTrackedComponentNames : ['Airframe', 'Engine 1'], // Default if empty
    };

    startSavingAircraftTransition(async () => {
      try {
        await saveFleetAircraft(aircraftData);
        await loadFleetData(); 
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
    setNewIsMaintenanceTracked(true);
    setNewTrackedComponentNamesStr('');
    setShowAddAircraftForm(false);
  };

  const handleDeleteAircraft = (aircraftIdToDelete: string) => {
    startDeletingAircraftTransition(async () => {
      try {
        await deleteFleetAircraft({ aircraftId: aircraftIdToDelete });
        await loadFleetData();
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

  const handleSaveCompanyInfo = () => {
    startSavingCompanyInfoTransition(() => {
      console.log("Saving company information:", {
        companyName,
        companyAddress,
        companyEmail,
        companyPhone
      });
      toast({
        title: "Company Information Saved (Simulated)",
        description: "In a real app, this would save to a backend.",
      });
    });
  };


  return (
    <>
      <PageHeader 
        title="Company Settings" 
        description="Manage company information and aircraft fleet."
        icon={Building2}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
            <CardDescription>Update your company's profile details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your Company LLC" />
            </div>
            <div>
              <Label htmlFor="companyAddress">Address</Label>
              <Textarea id="companyAddress" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder="123 Main St, City, State, Zip" rows={3}/>
            </div>
            <div>
              <Label htmlFor="companyEmail">Contact Email</Label>
              <Input id="companyEmail" type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="contact@company.com" />
            </div>
            <div>
              <Label htmlFor="companyPhone">Contact Phone</Label>
              <Input id="companyPhone" type="tel" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="(555) 123-4567" />
            </div>
            <div className="space-y-1">
                <Label htmlFor="logoUpload">Company Logo</Label>
                <Input id="logoUpload" type="file" disabled className="text-sm file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-muted-foreground hover:file:bg-muted/80"/>
                <p className="text-xs text-muted-foreground">Logo upload functionality to be implemented.</p>
            </div>
            <Button onClick={handleSaveCompanyInfo} disabled={isSavingCompanyInfo}>
              {isSavingCompanyInfo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Company Information
            </Button>
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
                <Button variant="outline" size="sm" onClick={() => { setEditingAircraftId(null); setShowAddAircraftForm(true); setNewTailNumber(''); setNewModel(''); setNewIsMaintenanceTracked(true); setNewTrackedComponentNamesStr('Airframe, Engine 1');}}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Aircraft
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {showAddAircraftForm && (
              <Card className="p-4 mb-4 bg-muted/50 border-dashed">
                <CardTitle className="text-lg mb-2">
                  {editingAircraftId ? `Edit Aircraft: ${fleet.find(ac => ac.id === editingAircraftId)?.tailNumber || editingAircraftId}` : 'Add New Aircraft'}
                </CardTitle>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="newTailNumber">Tail Number</Label>
                    <Input id="newTailNumber" value={newTailNumber} onChange={(e) => setNewTailNumber(e.target.value)} placeholder="e.g., N123AB" disabled={!!editingAircraftId} />
                     {editingAircraftId && <p className="text-xs text-muted-foreground">Tail number (ID) cannot be changed during edit.</p>}
                  </div>
                  <div>
                    <Label htmlFor="newModel">Model</Label>
                    <Input id="newModel" value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="e.g., Cessna Citation CJ3" />
                  </div>
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox 
                        id="newIsMaintenanceTracked" 
                        checked={newIsMaintenanceTracked} 
                        onCheckedChange={(checked) => setNewIsMaintenanceTracked(checked as boolean)}
                    />
                    <Label htmlFor="newIsMaintenanceTracked" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Track Maintenance for this Aircraft
                    </Label>
                  </div>
                  <div>
                    <Label htmlFor="newTrackedComponentNamesStr">Tracked Component Names</Label>
                    <Textarea 
                      id="newTrackedComponentNamesStr"
                      value={newTrackedComponentNamesStr}
                      onChange={(e) => setNewTrackedComponentNamesStr(e.target.value)}
                      placeholder="e.g., Airframe, Engine 1, Propeller 1, APU"
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">Enter component names, separated by commas.</p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleAddOrUpdateAircraft} size="sm" disabled={isSavingAircraft}>
                      {isSavingAircraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                      {editingAircraftId ? 'Update Aircraft' : 'Save Aircraft'}
                    </Button>
                    <Button variant="outline" onClick={handleCancelEditAircraft} size="sm" disabled={isSavingAircraft}>
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
              <>
              <Alert className="mb-4">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Sample tracked components for existing aircraft:
                  <ul className="list-disc list-inside pl-4">
                    <li>N123AB: Airframe, Engine 1, Engine 2, APU</li>
                    <li>N456CD: Airframe, Engine 1, Engine 2, APU</li>
                    <li>N789EF: Airframe, Engine 1, Engine 2, APU, Air Conditioning</li>
                    <li>N630MW: Airframe, Engine 1, Propeller 1</li>
                  </ul>
                  Newly added aircraft default to 'Airframe, Engine 1' if not specified.
                </AlertDescription>
              </Alert>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tail Number</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Maintenance Tracked</TableHead>
                    <TableHead>Tracked Components</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fleet.length === 0 && !isLoadingFleet && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-4">No aircraft in fleet. Add one to get started.</TableCell>
                    </TableRow>
                  )}
                  {fleet.map((aircraft) => (
                    <TableRow key={aircraft.id}>
                      <TableCell className="font-medium">{aircraft.tailNumber}</TableCell>
                      <TableCell>{aircraft.model}</TableCell>
                       <TableCell>
                        {aircraft.isMaintenanceTracked ? 
                          <CheckSquare className="h-5 w-5 text-green-500" /> : 
                          <Square className="h-5 w-5 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(aircraft.trackedComponentNames || []).join(', ') || 'Default (Airframe, Engine 1)'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditAircraftClick(aircraft)} className="mr-1 hover:text-primary" disabled={isSavingAircraft || isDeletingAircraft}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit {aircraft.tailNumber}</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteAircraft(aircraft.id)} className="text-destructive hover:text-destructive" disabled={isSavingAircraft || isDeletingAircraft}>
                          {isDeletingAircraft && editingAircraftId === aircraft.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                          <span className="sr-only">Delete {aircraft.tailNumber}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
