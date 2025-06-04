
"use client";

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, Plane, PlusCircle, Trash2, Save, XCircle, Loader2, Edit, CheckSquare, Square, Info, Settings2, Cog, Wind, Megaphone, CalendarDays, UserX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchFleetAircraft, saveFleetAircraft, deleteFleetAircraft } from '@/ai/flows/manage-fleet-flow';
import type { FleetAircraft, SaveFleetAircraftInput, EngineDetail, PropellerDetail } from '@/ai/schemas/fleet-aircraft-schemas';
import { fetchCompanyProfile, saveCompanyProfile, type CompanyProfile } from '@/ai/flows/manage-company-profile-flow';
import { fetchBulletins, saveBulletin, deleteBulletin } from '@/ai/flows/manage-bulletins-flow';
import type { Bulletin, SaveBulletinInput, BulletinType } from '@/ai/schemas/bulletin-schemas';
import { AddEditBulletinModal } from './components/add-edit-bulletin-modal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ManageEngineDetailsModal } from '@/app/(app)/aircraft/currency/[tailNumber]/components/manage-engine-details-modal';
import { ManagePropellerDetailsModal } from '@/app/(app)/aircraft/currency/[tailNumber]/components/manage-propeller-details-modal';
import { format, parseISO, isValid } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CompanyPageFleetAircraft extends FleetAircraft {
  // No custom fields needed here anymore as engineDetails and propellerDetails are directly from FleetAircraft
}

export default function CompanySettingsPage() {
  const [fleet, setFleet] = useState<CompanyPageFleetAircraft[]>([]);
  const [isLoadingFleet, setIsLoadingFleet] = useState(true);
  const [isSavingAircraft, startSavingAircraftTransition] = useTransition();
  const [isDeletingAircraft, startDeletingAircraftTransition] = useTransition();
  const { toast } = useToast();

  const [showAddAircraftForm, setShowAddAircraftForm] = useState(false);
  const [editingAircraftId, setEditingAircraftId] = useState<string | null>(null);

  const [newTailNumber, setNewTailNumber] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newIsMaintenanceTracked, setNewIsMaintenanceTracked] = useState(true);
  const [newTrackedComponentNamesStr, setNewTrackedComponentNamesStr] = useState('');
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [newBaseLocation, setNewBaseLocation] = useState('');
  const [newPrimaryContactName, setNewPrimaryContactName] = useState('');
  const [newPrimaryContactPhone, setNewPrimaryContactPhone] = useState('');
  const [newPrimaryContactEmail, setNewPrimaryContactEmail] = useState('');

  const [currentEngineDetailsForForm, setCurrentEngineDetailsForForm] = useState<EngineDetail[]>([]);
  const [isEngineModalOpen, setIsEngineModalOpen] = useState(false);

  const [currentPropellerDetailsForForm, setCurrentPropellerDetailsForForm] = useState<PropellerDetail[]>([]);
  const [isPropellerModalOpen, setIsPropellerModalOpen] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [currentCompanyProfile, setCurrentCompanyProfile] = useState<CompanyProfile | null>(null);
  const [isLoadingCompanyInfo, setIsLoadingCompanyInfo] = useState(true);
  const [isSavingCompanyInfo, startSavingCompanyInfoTransition] = useTransition();

  // State for Bulletins
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [isLoadingBulletins, setIsLoadingBulletins] = useState(true);
  const [isBulletinModalOpen, setIsBulletinModalOpen] = useState(false);
  const [isEditingBulletin, setIsEditingBulletin] = useState(false);
  const [currentBulletinForModal, setCurrentBulletinForModal] = useState<Bulletin | null>(null);
  const [isSavingBulletin, startSavingBulletinTransition] = useTransition();
  const [bulletinToDelete, setBulletinToDelete] = useState<Bulletin | null>(null);
  const [showDeleteBulletinConfirm, setShowDeleteBulletinConfirm] = useState(false);
  const [isDeletingBulletin, startDeletingBulletinTransition] = useTransition();


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
        setCurrentCompanyProfile(profile);
      } else {
        // Set default values if profile is null
        setCompanyName("FlightOps360 LLC (Example)");
        setCompanyAddress("123 Aviation Way, Hangar B, Anytown, USA 12345");
        setCompanyEmail("ops@flightops360.example.com");
        setCompanyPhone("(555) 012-3456");
        setCurrentCompanyProfile({
            id: 'main',
            companyName: "FlightOps360 LLC (Example)",
            companyAddress: "123 Aviation Way, Hangar B, Anytown, USA 12345",
            companyEmail: "ops@flightops360.example.com",
            companyPhone: "(555) 012-3456",
            serviceFeeRates: {}, // Initialize with empty rates
        });
      }
    } catch (error) {
      console.error("Failed to fetch company profile:", error);
      toast({ title: "Error Loading Company Info", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    } finally {
      setIsLoadingCompanyInfo(false);
    }
  };

  const loadBulletinsData = async () => {
    setIsLoadingBulletins(true);
    try {
      const fetchedBulletins = await fetchBulletins();
      setBulletins(fetchedBulletins);
    } catch (error) {
      console.error("Failed to fetch bulletins:", error);
      toast({ title: "Error Loading Bulletins", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    } finally {
      setIsLoadingBulletins(false);
    }
  };


  useEffect(() => {
    loadFleetData();
    loadCompanyProfileData();
    loadBulletinsData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetAircraftFormFields = () => {
    setNewTailNumber(''); setNewModel(''); setNewIsMaintenanceTracked(true);
    setNewTrackedComponentNamesStr(''); setNewSerialNumber(''); setNewBaseLocation('');
    setNewPrimaryContactName(''); setNewPrimaryContactPhone(''); setNewPrimaryContactEmail('');
    setCurrentEngineDetailsForForm([]); setCurrentPropellerDetailsForForm([]);
  };

  const handleEditAircraftClick = (aircraft: CompanyPageFleetAircraft) => {
    setEditingAircraftId(aircraft.id); setNewTailNumber(aircraft.tailNumber); setNewModel(aircraft.model);
    setNewIsMaintenanceTracked(aircraft.isMaintenanceTracked ?? true);
    setNewTrackedComponentNamesStr((aircraft.trackedComponentNames || ['Airframe', 'Engine 1']).join(', '));
    setNewSerialNumber(aircraft.serialNumber || ''); setNewBaseLocation(aircraft.baseLocation || '');
    setNewPrimaryContactName(aircraft.primaryContactName || ''); setNewPrimaryContactPhone(aircraft.primaryContactPhone || '');
    setNewPrimaryContactEmail(aircraft.primaryContactEmail || '');
    setCurrentEngineDetailsForForm(aircraft.engineDetails || []);
    setCurrentPropellerDetailsForForm(aircraft.propellerDetails || []);
    setShowAddAircraftForm(true);
  };

  const handleAddOrUpdateAircraft = () => {
    if (!newTailNumber || !newModel) { toast({title: "Missing Fields", description: "Tail number and model are required.", variant: "destructive"}); return; }
    const parsedTrackedComponentNames = newTrackedComponentNamesStr.split(',').map(name => name.trim()).filter(name => name.length > 0);
    const aircraftData: SaveFleetAircraftInput = {
      id: editingAircraftId || newTailNumber.toUpperCase().replace(/\s+/g, ''), tailNumber: newTailNumber.toUpperCase().trim(),
      model: newModel.trim(), isMaintenanceTracked: newIsMaintenanceTracked,
      trackedComponentNames: parsedTrackedComponentNames.length > 0 ? parsedTrackedComponentNames : ['Airframe', 'Engine 1'],
      serialNumber: newSerialNumber.trim() || undefined, aircraftYear: editingAircraftId ? fleet.find(ac => ac.id === editingAircraftId)?.aircraftYear : undefined,
      baseLocation: newBaseLocation.trim() || undefined, primaryContactName: newPrimaryContactName.trim() || undefined,
      primaryContactPhone: newPrimaryContactPhone.trim() || undefined, primaryContactEmail: newPrimaryContactEmail.trim() || undefined,
      engineDetails: currentEngineDetailsForForm, propellerDetails: currentPropellerDetailsForForm,
      internalNotes: editingAircraftId ? fleet.find(ac => ac.id === editingAircraftId)?.internalNotes : undefined,
    };
    startSavingAircraftTransition(async () => {
      try { await saveFleetAircraft(aircraftData); await loadFleetData();
        toast({ title: "Success", description: `Aircraft ${editingAircraftId ? 'updated' : 'added'}.` });
        handleCancelEditAircraft();
      } catch (error) {
        console.error("Failed to save aircraft:", error);
        toast({ title: "Error", description: `Could not save aircraft. ${error instanceof Error ? error.message : ''}`, variant: "destructive"});
      }
    });
  }

  const handleCancelEditAircraft = () => { setEditingAircraftId(null); resetAircraftFormFields(); setShowAddAircraftForm(false); };
  const handleDeleteAircraft = (aircraftIdToDelete: string) => {
    startDeletingAircraftTransition(async () => {
      try { await deleteFleetAircraft({ aircraftId: aircraftIdToDelete }); await loadFleetData();
        toast({ title: "Success", description: "Aircraft deleted." });
        if (editingAircraftId === aircraftIdToDelete) handleCancelEditAircraft();
      } catch (error) {
          console.error("Failed to delete aircraft:", error);
          toast({ title: "Error", description: `Could not delete aircraft. ${error instanceof Error ? error.message : ''}`, variant: "destructive"});
      }
    });
  }

  const handleSaveCompanyInfo = () => {
    startSavingCompanyInfoTransition(async () => {
      const profileData: CompanyProfile = {
        id: 'main', companyName: companyName.trim(), companyAddress: companyAddress.trim(),
        companyEmail: companyEmail.trim(), companyPhone: companyPhone.trim(),
        serviceFeeRates: currentCompanyProfile?.serviceFeeRates || {},
      };
      try { await saveCompanyProfile(profileData);
        setCurrentCompanyProfile(prev => ({...prev, ...profileData} as CompanyProfile));
        toast({ title: "Success", description: "Company info updated." });
      } catch (error) {
        console.error("Failed to save company info:", error);
        toast({ title: "Error", description: `Could not save company info. ${error instanceof Error ? error.message : ''}`, variant: "destructive"});
      }
    });
  }
  const handleEngineDetailsSave = (updatedEngines: EngineDetail[]) => { setCurrentEngineDetailsForForm(updatedEngines); };
  const handlePropellerDetailsSave = (updatedProps: PropellerDetail[]) => { setCurrentPropellerDetailsForForm(updatedProps); };

  // Bulletin Management Functions
  const handleOpenAddBulletinModal = () => {
    setIsEditingBulletin(false);
    setCurrentBulletinForModal(null);
    setIsBulletinModalOpen(true);
  };

  const handleOpenEditBulletinModal = (bulletin: Bulletin) => {
    setIsEditingBulletin(true);
    setCurrentBulletinForModal(bulletin);
    setIsBulletinModalOpen(true);
  };

  const handleSaveBulletin = async (data: SaveBulletinInput, originalBulletinId?: string) => {
    startSavingBulletinTransition(async () => {
      try {
        const dataToSave = { ...data, id: originalBulletinId };
        const savedData = await saveBulletin(dataToSave);
        toast({
          title: isEditingBulletin ? "Bulletin Updated" : "Bulletin Published",
          description: `Bulletin "${savedData.title}" has been successfully ${isEditingBulletin ? 'updated' : 'published'}.`,
        });
        setIsBulletinModalOpen(false);
        await loadBulletinsData();
      } catch (error) {
        console.error("Failed to save bulletin:", error);
        toast({ title: "Error Saving Bulletin", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
      }
    });
  };

  const handleDeleteBulletinClick = (bulletin: Bulletin) => {
    setBulletinToDelete(bulletin);
    setShowDeleteBulletinConfirm(true);
  };

  const executeDeleteBulletin = async () => {
    if (!bulletinToDelete) return;
    startDeletingBulletinTransition(async () => {
      try {
        await deleteBulletin({ bulletinId: bulletinToDelete.id });
        toast({ title: "Bulletin Deleted", description: `Bulletin "${bulletinToDelete.title}" has been removed.` });
        setShowDeleteBulletinConfirm(false);
        setBulletinToDelete(null);
        await loadBulletinsData();
      } catch (error) {
        console.error("Failed to delete bulletin:", error);
        toast({ title: "Error Deleting Bulletin", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
        setShowDeleteBulletinConfirm(false);
        setBulletinToDelete(null);
      }
    });
  };

  const getBulletinTypeBadgeVariant = (type: BulletinType): "default" | "destructive" | "secondary" => {
    switch (type) {
      case 'Urgent': return 'destructive';
      case 'Important': return 'secondary';
      default: return 'default'; // General
    }
  };

  return (
    <>
      <PageHeader
        title="Company Settings"
        description="Manage company information, aircraft fleet, and company bulletins."
        icon={Building2}
      />
      <div className="grid gap-6 md:grid-cols-2">
        {/* Company Information Card */}
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

        {/* Manage Aircraft Fleet Card */}
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-primary"/> Manage Aircraft Fleet</CardTitle>
                <CardDescription>Add, edit, or remove aircraft. (Connected to Firestore)</CardDescription>
              </div>
              {!showAddAircraftForm && (
                <Button variant="outline" size="sm" onClick={() => { setEditingAircraftId(null); resetAircraftFormFields(); setShowAddAircraftForm(true); setNewTrackedComponentNamesStr('Airframe, Engine 1');}}>
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
                  <div className="pt-2 space-y-3">
                    <div className="space-y-1">
                        <Label className="font-medium text-sm">Engine Configuration</Label>
                        <Button type="button" variant="outline" onClick={() => setIsEngineModalOpen(true)} className="w-full sm:w-auto text-xs" size="sm" > <Cog className="mr-2 h-3.5 w-3.5" /> Manage Engine Details ({currentEngineDetailsForForm.length} configured) </Button>
                    </div>
                     <ManageEngineDetailsModal isOpen={isEngineModalOpen} setIsOpen={setIsEngineModalOpen} initialEngineDetails={currentEngineDetailsForForm} onSave={handleEngineDetailsSave}/>
                    <div className="space-y-1">
                        <Label className="font-medium text-sm">Propeller Configuration (if applicable)</Label>
                        <Button type="button" variant="outline" onClick={() => setIsPropellerModalOpen(true)} className="w-full sm:w-auto text-xs" size="sm" > <Wind className="mr-2 h-3.5 w-3.5" /> Manage Propeller Details ({currentPropellerDetailsForForm.length} configured) </Button>
                    </div>
                     <ManagePropellerDetailsModal isOpen={isPropellerModalOpen} setIsOpen={setIsPropellerModalOpen} initialPropellerDetails={currentPropellerDetailsForForm} onSave={handlePropellerDetailsSave} />
                  </div>
                  <div className="flex items-center space-x-2 pt-2"> <Checkbox id="newIsMaintenanceTracked" checked={newIsMaintenanceTracked} onCheckedChange={(checked) => setNewIsMaintenanceTracked(checked as boolean)}/> <Label htmlFor="newIsMaintenanceTracked" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"> Track Maintenance for this Aircraft </Label> </div>
                  <div> <Label htmlFor="newTrackedComponentNamesStr">Tracked Component Names</Label> <Textarea id="newTrackedComponentNamesStr" value={newTrackedComponentNamesStr} onChange={(e) => setNewTrackedComponentNamesStr(e.target.value)} placeholder="e.g., Airframe, Engine 1, Propeller 1, APU" rows={2}/> <p className="text-xs text-muted-foreground">Enter component names, separated by commas. (e.g., Airframe, Engine 1, Engine 2)</p> </div>
                  <div className="flex gap-2 pt-2"> <Button onClick={handleAddOrUpdateAircraft} size="sm" disabled={isSavingAircraft}> {isSavingAircraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} {editingAircraftId ? 'Update Aircraft' : 'Save Aircraft'} </Button> <Button variant="outline" onClick={handleCancelEditAircraft} size="sm" disabled={isSavingAircraft}> <XCircle className="mr-2 h-4 w-4"/>Cancel </Button> </div>
                </div>
              </Card>
            )}
            {isLoadingFleet ? (<div className="flex items-center justify-center py-6"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2 text-muted-foreground">Loading fleet...</p> </div> ) : (
              <>
              <Alert className="mb-4"> <Settings2 className="h-4 w-4" /> <AlertDescription className="text-xs"> Aircraft year and internal notes can be managed on the <Button variant="link" size="sm" className="p-0 h-auto ml-1 text-xs" asChild><Link href="/aircraft/currency">Aircraft Maintenance Currency page</Link></Button>. </AlertDescription> </Alert>
              <Table>
                <TableHeader><TableRow><TableHead>Tail Number</TableHead><TableHead>Model</TableHead><TableHead>Maintenance Tracked</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {fleet.length === 0 && !isLoadingFleet && (<TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No aircraft in fleet.</TableCell></TableRow> )}
                  {fleet.map((aircraft) => (<TableRow key={aircraft.id}><TableCell className="font-medium">{aircraft.tailNumber}</TableCell><TableCell>{aircraft.model}</TableCell><TableCell>{aircraft.isMaintenanceTracked ? <CheckSquare className="h-5 w-5 text-green-500" /> : <Square className="h-5 w-5 text-muted-foreground" />}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleEditAircraftClick(aircraft)} className="mr-1 hover:text-primary" disabled={isSavingAircraft || isDeletingAircraft}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteAircraft(aircraft.id)} className="text-destructive hover:text-destructive" disabled={isSavingAircraft || (isDeletingAircraft && editingAircraftId === aircraft.id) }>{isDeletingAircraft && editingAircraftId === aircraft.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}</Button></TableCell></TableRow> ))}
                </TableBody>
              </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Company Bulletins Management Card */}
      <Card className="mt-6 shadow-md">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary"/> Company Bulletins</CardTitle>
              <CardDescription>Manage company-wide announcements and bulletins. Displayed on Dashboard.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleOpenAddBulletinModal}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Bulletin
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingBulletins ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading bulletins...</p>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Published</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {bulletins.length === 0 && !isLoadingBulletins && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No bulletins published yet.</TableCell></TableRow>
                )}
                {bulletins.map((bulletin) => (
                  <TableRow key={bulletin.id}>
                    <TableCell className="font-medium max-w-xs truncate" title={bulletin.title}>{bulletin.title}</TableCell>
                    <TableCell><Badge variant={getBulletinTypeBadgeVariant(bulletin.type)} className="capitalize">{bulletin.type}</Badge></TableCell>
                    <TableCell className="text-xs">{bulletin.publishedAt && isValid(parseISO(bulletin.publishedAt)) ? format(parseISO(bulletin.publishedAt), 'MMM d, yyyy HH:mm') : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={bulletin.isActive ? 'default' : 'outline'} className="text-xs">
                        {bulletin.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEditBulletinModal(bulletin)} className="mr-1 hover:text-primary" disabled={isSavingBulletin || isDeletingBulletin}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteBulletinClick(bulletin)} className="text-destructive hover:text-destructive" disabled={isSavingBulletin || (isDeletingBulletin && bulletinToDelete?.id === bulletin.id)}>
                        {isDeletingBulletin && bulletinToDelete?.id === bulletin.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddEditBulletinModal
        isOpen={isBulletinModalOpen}
        setIsOpen={setIsBulletinModalOpen}
        onSave={handleSaveBulletin}
        initialData={currentBulletinForModal}
        isEditing={isEditingBulletin}
        isSaving={isSavingBulletin}
      />

      {showDeleteBulletinConfirm && bulletinToDelete && (
        <AlertDialog open={showDeleteBulletinConfirm} onOpenChange={setShowDeleteBulletinConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Delete Bulletin</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the bulletin "{bulletinToDelete.title}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteBulletinConfirm(false)} disabled={isDeletingBulletin}>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={executeDeleteBulletin} disabled={isDeletingBulletin}>
                {isDeletingBulletin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
