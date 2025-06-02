
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
import { Building2, Plane, PlusCircle, Trash2, Save, XCircle, Loader2, Edit, CheckSquare, Square, Info, Mail, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchFleetAircraft, saveFleetAircraft, deleteFleetAircraft, type FleetAircraft, type SaveFleetAircraftInput } from '@/ai/flows/manage-fleet-flow';
import { fetchCompanyProfile, saveCompanyProfile, type CompanyProfile } from '@/ai/flows/manage-company-profile-flow'; 
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton'; 

// Define local type including fields not directly editable via simple form inputs
// but that might be part of the FleetAircraft type from the flow
interface CompanyPageFleetAircraft extends FleetAircraft {
  // engineDetails might be complex and not directly editable in this basic form
}

export default function CompanySettingsPage() {
  const [fleet, setFleet] = useState<CompanyPageFleetAircraft[]>([]);
  const [isLoadingFleet, setIsLoadingFleet] = useState(true);
  const [isSavingAircraft, startSavingAircraftTransition] = useTransition();
  const [isDeletingAircraft, startDeletingAircraftTransition] = useTransition();
  const { toast } = useToast();

  const [showAddAircraftForm, setShowAddAircraftForm] = useState(false);
  const [editingAircraftId, setEditingAircraftId] = useState<string | null>(null);

  // Form state for adding/editing aircraft
  const [newTailNumber, setNewTailNumber] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newIsMaintenanceTracked, setNewIsMaintenanceTracked] = useState(true);
  const [newTrackedComponentNamesStr, setNewTrackedComponentNamesStr] = useState('');
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [newBaseLocation, setNewBaseLocation] = useState('');
  const [newPrimaryContactName, setNewPrimaryContactName] = useState('');
  const [newPrimaryContactPhone, setNewPrimaryContactPhone] = useState('');
  const [newPrimaryContactEmail, setNewPrimaryContactEmail] = useState(''); 

  // State for engine details
  const [engine1Model, setEngine1Model] = useState('');
  const [engine1SN, setEngine1SN] = useState('');
  const [engine2Model, setEngine2Model] = useState('');
  const [engine2SN, setEngine2SN] = useState('');


  // State for company information
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [isLoadingCompanyInfo, setIsLoadingCompanyInfo] = useState(true);
  const [isSavingCompanyInfo, startSavingCompanyInfoTransition] = useTransition();

  const loadFleetData = async () => {
    setIsLoadingFleet(true);
    try {
      const fetchedFleet = await fetchFleetAircraft();
      setFleet(fetchedFleet as CompanyPageFleetAircraft[]);
    } catch (error) {
      console.error("Failed to fetch fleet aircraft:", error);
      toast({ title: "Error", description: "Could not load aircraft fleet.", variant: "destructive" });
    } finally {
      setIsLoadingFleet(false);
    }
  };

  const loadCompanyProfileData = async () => {
    setIsLoadingCompanyInfo(true);
    try {
      const profile = await fetchCompanyProfile();
      if (profile) {
        setCompanyName(profile.companyName || '');
        setCompanyAddress(profile.companyAddress || '');
        setCompanyEmail(profile.companyEmail || '');
        setCompanyPhone(profile.companyPhone || '');
      } else {
        // Set default or example values if no profile exists
        setCompanyName("FlightOps360 LLC (Example)");
        setCompanyAddress("123 Aviation Way, Hangar B, Anytown, USA 12345");
        setCompanyEmail("ops@flightops360.example.com");
        setCompanyPhone("(555) 012-3456");
      }
    } catch (error) {
      console.error("Failed to fetch company profile:", error);
      toast({ title: "Error Loading Company Info", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    } finally {
      setIsLoadingCompanyInfo(false);
    }
  };


  useEffect(() => {
    loadFleetData();
    loadCompanyProfileData();
  }, []); 

  const resetAircraftFormFields = () => {
    setNewTailNumber('');
    setNewModel('');
    setNewIsMaintenanceTracked(true);
    setNewTrackedComponentNamesStr('');
    setNewSerialNumber('');
    setNewBaseLocation('');
    setNewPrimaryContactName('');
    setNewPrimaryContactPhone('');
    setNewPrimaryContactEmail(''); 
    setEngine1Model('');
    setEngine1SN('');
    setEngine2Model('');
    setEngine2SN('');
  };

  const handleEditAircraftClick = (aircraft: CompanyPageFleetAircraft) => {
    setEditingAircraftId(aircraft.id);
    setNewTailNumber(aircraft.tailNumber);
    setNewModel(aircraft.model);
    setNewIsMaintenanceTracked(aircraft.isMaintenanceTracked ?? true);
    setNewTrackedComponentNamesStr((aircraft.trackedComponentNames || ['Airframe', 'Engine 1']).join(', '));
    setNewSerialNumber(aircraft.serialNumber || '');
    setNewBaseLocation(aircraft.baseLocation || '');
    setNewPrimaryContactName(aircraft.primaryContactName || '');
    setNewPrimaryContactPhone(aircraft.primaryContactPhone || '');
    setNewPrimaryContactEmail(aircraft.primaryContactEmail || ''); 
    setEngine1Model(aircraft.engineDetails?.[0]?.model || '');
    setEngine1SN(aircraft.engineDetails?.[0]?.serialNumber || '');
    setEngine2Model(aircraft.engineDetails?.[1]?.model || '');
    setEngine2SN(aircraft.engineDetails?.[1]?.serialNumber || '');
    setShowAddAircraftForm(true);
  };
  
  const handleAddOrUpdateAircraft = () => {
    if (!newTailNumber || !newModel) {
      toast({ title: "Missing Fields", description: "Please fill in Tail Number and Model for the aircraft.", variant: "destructive" });
      return;
    }
    if (newPrimaryContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newPrimaryContactEmail)) {
        toast({ title: "Invalid Email", description: "Please enter a valid email address for the aircraft contact.", variant: "destructive" });
        return;
    }

    const parsedTrackedComponentNames = newTrackedComponentNamesStr
      .split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0);
    
    const engineDetails = [];
    if (engine1Model.trim() || engine1SN.trim()) {
      engineDetails.push({ model: engine1Model.trim() || undefined, serialNumber: engine1SN.trim() || undefined });
    }
    if (engine2Model.trim() || engine2SN.trim()) {
      engineDetails.push({ model: engine2Model.trim() || undefined, serialNumber: engine2SN.trim() || undefined });
    }
    // If only engine 2 has data but engine 1 doesn't, we should still push an empty object for engine 1
    // to maintain the order, or ensure engine 1 is filled if engine 2 is.
    // For simplicity now, if E1 is blank but E2 has data, E2 effectively becomes E1 in the array.
    // A more robust UI would prevent this or handle indexing explicitly.

    const aircraftData: SaveFleetAircraftInput = {
      id: editingAircraftId || newTailNumber.toUpperCase().replace(/\s+/g, ''), 
      tailNumber: newTailNumber.toUpperCase().trim(),
      model: newModel.trim(),
      isMaintenanceTracked: newIsMaintenanceTracked,
      trackedComponentNames: parsedTrackedComponentNames.length > 0 ? parsedTrackedComponentNames : ['Airframe', 'Engine 1'],
      serialNumber: newSerialNumber.trim() || undefined,
      aircraftYear: editingAircraftId ? fleet.find(ac => ac.id === editingAircraftId)?.aircraftYear : undefined, // Preserve year if editing
      baseLocation: newBaseLocation.trim() || undefined,
      primaryContactName: newPrimaryContactName.trim() || undefined,
      primaryContactPhone: newPrimaryContactPhone.trim() || undefined,
      primaryContactEmail: newPrimaryContactEmail.trim() || undefined, 
      engineDetails: engineDetails.length > 0 ? engineDetails : undefined, // Send undefined if no engine details
      internalNotes: editingAircraftId ? fleet.find(ac => ac.id === editingAircraftId)?.internalNotes : undefined, // Preserve notes if editing
    };

    startSavingAircraftTransition(async () => {
      try {
        await saveFleetAircraft(aircraftData);
        await loadFleetData(); 
        toast({ title: "Success", description: `Aircraft ${editingAircraftId ? 'updated' : 'added'}.` });
        handleCancelEditAircraft();
      } catch (error) {
        console.error("Failed to save aircraft:", error);
        toast({ title: "Error", description: `Could not ${editingAircraftId ? 'update' : 'add'} aircraft. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
      }
    });
  };

  const handleCancelEditAircraft = () => {
    setEditingAircraftId(null);
    resetAircraftFormFields();
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
        toast({ title: "Error", description: `Could not delete aircraft. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
      }
    });
  };

  const handleSaveCompanyInfo = () => {
    startSavingCompanyInfoTransition(async () => {
      const profileData: CompanyProfile = {
        id: 'main', 
        companyName: companyName.trim(),
        companyAddress: companyAddress.trim(),
        companyEmail: companyEmail.trim(),
        companyPhone: companyPhone.trim(),
        // Ensure serviceFeeRates is preserved if it exists on the current companyProfile state
        serviceFeeRates: companyProfile?.serviceFeeRates || {},
      };
      try {
        await saveCompanyProfile(profileData);
        // Update local state after successful save
        setCompanyProfile(prevProfile => ({...prevProfile, ...profileData} as CompanyProfile));
        toast({ title: "Success", description: "Company information updated in Firestore." });
      } catch (error) {
        console.error("Failed to save company profile:", error);
        toast({ title: "Error Saving Company Info", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
            <CardDescription>Update your company's profile details. (Connected to Firestore)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingCompanyInfo ? (
                <div className="space-y-4">
                    <Skeleton className="h-6 w-1/4" /> <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-6 w-1/4" /> <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-6 w-1/4" /> <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-6 w-1/4" /> <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-1/3 mt-2" />
                </div>
            ) : (
            <>
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
                <p className="text-xs text-muted-foreground">Logo upload functionality to be implemented separately.</p>
            </div>
            <Button onClick={handleSaveCompanyInfo} disabled={isSavingCompanyInfo || isLoadingCompanyInfo}>
              {isSavingCompanyInfo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Company Information
            </Button>
            </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-primary"/> Manage Aircraft Fleet</CardTitle>
                <CardDescription>Add, edit, or remove aircraft. (Connected to Firestore)</CardDescription>
              </div>
              {!showAddAircraftForm && (
                <Button variant="outline" size="sm" onClick={() => { setEditingAircraftId(null); resetAircraftFormFields(); setShowAddAircraftForm(true); setNewTrackedComponentNamesStr('Airframe, Engine 1, Engine 2');}}>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="newTailNumber">Tail Number (ID)</Label>
                      <Input id="newTailNumber" value={newTailNumber} onChange={(e) => setNewTailNumber(e.target.value)} placeholder="e.g., N123AB" disabled={!!editingAircraftId} />
                      {editingAircraftId && <p className="text-xs text-muted-foreground">Tail number (ID) cannot be changed during edit.</p>}
                       {!editingAircraftId && <p className="text-xs text-muted-foreground">This will be used as the document ID in Firestore.</p>}
                    </div>
                    <div>
                      <Label htmlFor="newModel">Model</Label>
                      <Input id="newModel" value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="e.g., Cessna Citation CJ3" />
                    </div>
                  </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="newSerialNumber">Serial Number</Label>
                      <Input id="newSerialNumber" value={newSerialNumber} onChange={(e) => setNewSerialNumber(e.target.value)} placeholder="e.g., CJ3-0123" />
                    </div>
                     <div>
                      <Label htmlFor="newBaseLocation">Base Location</Label>
                      <Input id="newBaseLocation" value={newBaseLocation} onChange={(e) => setNewBaseLocation(e.target.value)} placeholder="e.g., KTEB" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="newPrimaryContactName">Primary Contact Name</Label>
                    <Input id="newPrimaryContactName" value={newPrimaryContactName} onChange={(e) => setNewPrimaryContactName(e.target.value)} placeholder="e.g., John Doe" />
                  </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="newPrimaryContactPhone">Primary Contact Phone</Label>
                      <Input id="newPrimaryContactPhone" type="tel" value={newPrimaryContactPhone} onChange={(e) => setNewPrimaryContactPhone(e.target.value)} placeholder="e.g., (555) 123-4567" />
                    </div>
                    <div>
                      <Label htmlFor="newPrimaryContactEmail">Primary Contact Email</Label>
                      <Input id="newPrimaryContactEmail" type="email" value={newPrimaryContactEmail} onChange={(e) => setNewPrimaryContactEmail(e.target.value)} placeholder="e.g., contact@aircraft.com" />
                    </div>
                  </div>

                  {/* Engine Details Inputs */}
                  <div className="pt-2 space-y-3">
                    <Label className="font-medium text-sm">Engine Details</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-2 p-3 border rounded-md bg-background/70">
                        <div>
                            <Label htmlFor="engine1Model" className="text-xs">Engine 1 Model</Label>
                            <Input id="engine1Model" value={engine1Model} onChange={(e) => setEngine1Model(e.target.value)} placeholder="e.g., PT6A-67D" />
                        </div>
                        <div>
                            <Label htmlFor="engine1SN" className="text-xs">Engine 1 S/N</Label>
                            <Input id="engine1SN" value={engine1SN} onChange={(e) => setEngine1SN(e.target.value)} placeholder="e.g., PCE12345" />
                        </div>
                        <div>
                            <Label htmlFor="engine2Model" className="text-xs">Engine 2 Model (Optional)</Label>
                            <Input id="engine2Model" value={engine2Model} onChange={(e) => setEngine2Model(e.target.value)} placeholder="e.g., PT6A-67D" />
                        </div>
                        <div>
                            <Label htmlFor="engine2SN" className="text-xs">Engine 2 S/N (Optional)</Label>
                            <Input id="engine2SN" value={engine2SN} onChange={(e) => setEngine2SN(e.target.value)} placeholder="e.g., PCE67890" />
                        </div>
                    </div>
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
                    <p className="text-xs text-muted-foreground">Enter component names, separated by commas. (e.g., Airframe, Engine 1, Engine 2)</p>
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
                <p className="ml-2 text-muted-foreground">Loading fleet from Firestore...</p>
              </div>
            ) : (
              <>
              <Alert className="mb-4">
                <Settings2 className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Aircraft year, detailed multi-engine configuration, and internal notes can be managed on the 
                  <Button variant="link" size="sm" className="p-0 h-auto ml-1 text-xs" asChild><Link href="/aircraft/currency">Aircraft Maintenance Currency page</Link></Button>.
                </AlertDescription>
              </Alert>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tail Number</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Maintenance Tracked</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fleet.length === 0 && !isLoadingFleet && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-4">No aircraft in fleet. Add one to get started.</TableCell>
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
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditAircraftClick(aircraft)} className="mr-1 hover:text-primary" disabled={isSavingAircraft || isDeletingAircraft}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit {aircraft.tailNumber}</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteAircraft(aircraft.id)} className="text-destructive hover:text-destructive" disabled={isSavingAircraft || (isDeletingAircraft && editingAircraftId === aircraft.id) }>
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
