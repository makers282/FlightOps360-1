
"use client";

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Edit, PlusCircle, Trash2, Save, XCircle, Loader2, Percent, CheckSquare, Square } from 'lucide-react'; // Added CheckSquare, Square
import { useToast } from '@/hooks/use-toast';
import { fetchAircraftRates, saveAircraftRate, deleteAircraftRate } from '@/ai/flows/manage-aircraft-rates-flow';
import type { AircraftRate } from '@/ai/schemas/aircraft-rate-schemas'; 
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fetchCompanyProfile, saveCompanyProfile, type CompanyProfile, type ServiceFeeRate } from '@/ai/flows/manage-company-profile-flow';
import { Checkbox } from '@/components/ui/checkbox'; // Added Checkbox

const formatCurrency = (amount: number) => {
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
};

export default function QuoteConfigPage() { 
  const [aircraftRates, setAircraftRates] = useState<AircraftRate[]>([]);
  const [fleet, setFleet] = useState<FleetAircraft[]>([]);
  
  const [isLoadingAircraftRates, setIsLoadingAircraftRates] = useState(true);
  const [isLoadingFleet, setIsLoadingFleet] = useState(true);

  const [isSavingAircraftRate, startSavingAircraftRateTransition] = useTransition();
  const [isDeletingAircraftRate, startDeletingAircraftRateTransition] = useTransition();

  const [currentDeletingRateId, setCurrentDeletingRateId] = useState<string | null>(null);
  const [showDeleteConfirmAircraftRate, setShowDeleteConfirmAircraftRate] = useState(false);
  const [rateToDelete, setRateToDelete] = useState<AircraftRate | null>(null);
  const { toast } = useToast();

  const [showAddAircraftRateForm, setShowAddAircraftRateForm] = useState(false);
  const [selectedFleetAircraftIdForRate, setSelectedFleetAircraftIdForRate] = useState<string>('');
  
  const [newAircraftBuyRate, setNewAircraftBuyRate] = useState('');
  const [newAircraftSellRate, setNewAircraftSellRate] = useState('');
  const [editingAircraftRateId, setEditingAircraftRateId] = useState<string | null>(null);

  // State for Service Fees
  const [currentCompanyProfile, setCurrentCompanyProfile] = useState<CompanyProfile | null>(null);
  const [serviceFeeRates, setServiceFeeRates] = useState<{ [key: string]: ServiceFeeRate }>({});
  const [isLoadingCompanyProfile, setIsLoadingCompanyProfile] = useState(true);
  const [isSavingServiceFee, startSavingServiceFeeTransition] = useTransition();
  const [showAddServiceForm, setShowAddServiceForm] = useState(false);
  const [newServiceDisplayDescription, setNewServiceDisplayDescription] = useState('');
  const [newServiceUnit, setNewServiceUnit] = useState('');
  const [newServiceBuyRateLocal, setNewServiceBuyRateLocal] = useState('');
  const [newServiceSellRateLocal, setNewServiceSellRateLocal] = useState('');
  const [newServiceIsActive, setNewServiceIsActive] = useState(true); // New state for isActive
  const [editingServiceKey, setEditingServiceKey] = useState<string | null>(null);
  const [serviceFeeToDeleteKey, setServiceFeeToDeleteKey] = useState<string | null>(null);
  const [showDeleteServiceFeeConfirm, setShowDeleteServiceFeeConfirm] = useState(false);


  const loadInitialData = useCallback(async () => {
    setIsLoadingAircraftRates(true);
    setIsLoadingFleet(true);
    setIsLoadingCompanyProfile(true);
    try {
      const [fetchedRates, fetchedFleet, fetchedProfile] = await Promise.all([
        fetchAircraftRates(),
        fetchFleetAircraft(),
        fetchCompanyProfile(),
      ]);
      setAircraftRates(fetchedRates);
      setFleet(fetchedFleet);
      if (fetchedProfile) {
        setCurrentCompanyProfile(fetchedProfile);
        // Ensure isActive defaults to true for existing items if not present
        const processedRates = Object.fromEntries(
          Object.entries(fetchedProfile.serviceFeeRates || {}).map(([key, rate]) => [
            key,
            { ...rate, isActive: rate.isActive ?? true },
          ])
        );
        setServiceFeeRates(processedRates);
      } else {
        const defaultProfile = { 
          id: 'main', 
          companyName: "Default Company", 
          serviceFeeRates: {} 
        };
        setCurrentCompanyProfile(defaultProfile);
        setServiceFeeRates({});
      }
    } catch (error) {
      console.error("Failed to load configuration data:", error);
      toast({ title: "Error", description: `Could not load configuration data. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
    } finally {
      setIsLoadingAircraftRates(false);
      setIsLoadingFleet(false);
      setIsLoadingCompanyProfile(false);
    }
  }, [toast]); 

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleEditAircraftRateClick = (rate: AircraftRate) => {
    setEditingAircraftRateId(rate.id);
    setSelectedFleetAircraftIdForRate(rate.id); 
    setNewAircraftBuyRate(String(rate.buy));
    setNewAircraftSellRate(String(rate.sell));
    setShowAddAircraftRateForm(true);
  };
  
  const handleAddOrUpdateAircraftRate = () => {
    if (!selectedFleetAircraftIdForRate) {
      toast({ title: "Missing Aircraft", description: "Please select an aircraft.", variant: "destructive" });
      return;
    }

    const buyRateNum = parseFloat(newAircraftBuyRate);
    const sellRateNum = parseFloat(newAircraftSellRate);

    if (isNaN(buyRateNum) || buyRateNum < 0 || isNaN(sellRateNum) || sellRateNum < 0) {
      toast({ title: "Invalid Rates", description: "Buy and Sell rates must be valid non-negative numbers.", variant: "destructive" });
      return;
    }

    const rateData: AircraftRate = {
      id: selectedFleetAircraftIdForRate, 
      buy: buyRateNum,
      sell: sellRateNum,
    };

    startSavingAircraftRateTransition(async () => {
      try {
        await saveAircraftRate(rateData);
        await loadInitialData(); 
        toast({ title: "Success", description: `Aircraft rate ${editingAircraftRateId ? 'updated' : 'added'}.` });
        handleCancelEditAircraftRate();
      } catch (error) {
        console.error("Failed to save aircraft rate:", error);
        toast({ title: "Error", description: `Could not ${editingAircraftRateId ? 'update' : 'add'} aircraft rate. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
      }
    });
  };
  
  const handleCancelEditAircraftRate = () => {
    setEditingAircraftRateId(null);
    setSelectedFleetAircraftIdForRate('');
    setNewAircraftBuyRate('');
    setNewAircraftSellRate('');
    setShowAddAircraftRateForm(false);
  };

  const confirmDeleteAircraftRate = (rate: AircraftRate) => {
    setRateToDelete(rate);
    setShowDeleteConfirmAircraftRate(true);
  };

  const executeDeleteAircraftRate = () => {
    if (!rateToDelete) return;
    setCurrentDeletingRateId(rateToDelete.id);
    startDeletingAircraftRateTransition(async () => {
      try {
        await deleteAircraftRate({ aircraftId: rateToDelete.id });
        await loadInitialData(); 
        toast({ title: "Success", description: "Aircraft rate deleted." });
        if (editingAircraftRateId === rateToDelete.id) { 
          handleCancelEditAircraftRate();
        }
      } catch (error) {
        console.error("Failed to delete aircraft rate:", error);
        toast({ title: "Error", description: `Could not delete aircraft rate. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
      } finally {
        setCurrentDeletingRateId(null);
        setShowDeleteConfirmAircraftRate(false);
        setRateToDelete(null);
      }
    });
  };

  const getAircraftDisplayLabel = (aircraftId: string): string => {
    const aircraft = fleet.find(ac => ac.id === aircraftId);
    return aircraft ? `${aircraft.tailNumber} - ${aircraft.model}` : aircraftId;
  };

  const availableFleetForNewRate = fleet.filter(ac => !aircraftRates.find(r => r.id === ac.id));

  // Service Fee Management Functions
  const handleEditServiceFeeClick = (key: string) => {
    const serviceToEdit = serviceFeeRates[key];
    if (serviceToEdit) {
      setEditingServiceKey(key);
      setNewServiceDisplayDescription(serviceToEdit.displayDescription);
      setNewServiceUnit(serviceToEdit.unitDescription);
      setNewServiceBuyRateLocal(String(serviceToEdit.buy));
      setNewServiceSellRateLocal(String(serviceToEdit.sell));
      setNewServiceIsActive(serviceToEdit.isActive ?? true); // Set isActive state
      setShowAddServiceForm(true);
    }
  };
  
  const handleAddOrUpdateServiceFee = () => {
    let keyToUse: string;

    if (editingServiceKey) {
        keyToUse = editingServiceKey;
    } else {
        if (!newServiceDisplayDescription) {
            toast({ title: "Missing Fields", description: "Please provide a display description for the service/fee.", variant: "destructive" });
            return;
        }
        keyToUse = newServiceDisplayDescription
            .trim()
            .toUpperCase()
            .replace(/\s+/g, '_') 
            .replace(/[^A-Z0-9_]/g, ''); 

        if (!keyToUse) {
             toast({ title: "Invalid Description", description: "Could not generate a valid key from the description. Please use alphanumeric characters.", variant: "destructive" });
            return;
        }
        if (serviceFeeRates[keyToUse] && !editingServiceKey) { 
            toast({ title: "Key Exists", description: `A service/fee with a similar description (key: ${keyToUse}) already exists. Please use a more unique description or edit the existing one.`, variant: "destructive" });
            return;
        }
    }

    if (!newServiceDisplayDescription || !newServiceUnit || !newServiceBuyRateLocal || !newServiceSellRateLocal) {
        toast({ title: "Missing Fields", description: "Please fill in all fields for the service/fee.", variant: "destructive" });
        return;
    }
    const buyRateNum = parseFloat(newServiceBuyRateLocal);
    const sellRateNum = parseFloat(newServiceSellRateLocal);

    if (isNaN(buyRateNum) || isNaN(sellRateNum) || buyRateNum < 0 || sellRateNum < 0) {
        toast({ title: "Invalid Rates", description: "Buy and Sell rates must be valid non-negative numbers.", variant: "destructive" });
        return;
    }

    const updatedServiceFeeRates = {
        ...serviceFeeRates,
        [keyToUse]: { 
            displayDescription: newServiceDisplayDescription.trim(),
            buy: buyRateNum, 
            sell: sellRateNum, 
            unitDescription: newServiceUnit.trim(),
            isActive: newServiceIsActive, // Include isActive
        }
    };

    if (!currentCompanyProfile) { 
        toast({ title: "Error", description: "Company profile not loaded.", variant: "destructive"});
        return;
    }

    const updatedProfile: CompanyProfile = {
        ...currentCompanyProfile,
        serviceFeeRates: updatedServiceFeeRates,
    };
    
    startSavingServiceFeeTransition(async () => {
        try {
            await saveCompanyProfile(updatedProfile);
            setServiceFeeRates(updatedServiceFeeRates); 
            setCurrentCompanyProfile(updatedProfile);
            toast({ title: "Success", description: `Service/Fee ${editingServiceKey ? 'updated' : 'added'} in Firestore.` });
            handleCancelEditServiceFee();
        } catch (error) {
            console.error("Failed to save service/fee rate:", error);
            toast({ title: "Error Saving Service/Fee", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
        }
    });
  };

  const handleCancelEditServiceFee = () => {
    setEditingServiceKey(null);
    setNewServiceDisplayDescription('');
    setNewServiceUnit('');
    setNewServiceBuyRateLocal('');
    setNewServiceSellRateLocal('');
    setNewServiceIsActive(true); // Reset isActive
    setShowAddServiceForm(false);
  };

  const confirmDeleteServiceFee = (keyToDelete: string) => {
    setServiceFeeToDeleteKey(keyToDelete);
    setShowDeleteServiceFeeConfirm(true);
  };

  const executeDeleteServiceFee = () => {
    if (!serviceFeeToDeleteKey || !currentCompanyProfile) {
        toast({ title: "Error", description: "Required data for deletion is missing.", variant: "destructive"});
        return;
    }
    
    const updatedServiceFeeRates = { ...serviceFeeRates };
    delete updatedServiceFeeRates[serviceFeeToDeleteKey];

    const updatedProfile: CompanyProfile = {
        ...currentCompanyProfile,
        serviceFeeRates: updatedServiceFeeRates,
    };

    startSavingServiceFeeTransition(async () => {
        try {
            await saveCompanyProfile(updatedProfile);
            setServiceFeeRates(updatedServiceFeeRates);
            setCurrentCompanyProfile(updatedProfile);
            toast({ title: "Success", description: "Service/Fee deleted from Firestore." });
            if (editingServiceKey === serviceFeeToDeleteKey) {
              handleCancelEditServiceFee();
            }
        } catch (error) {
            console.error("Failed to delete service/fee rate:", error);
            toast({ title: "Error Deleting Service/Fee", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
        } finally {
            setShowDeleteServiceFeeConfirm(false);
            setServiceFeeToDeleteKey(null);
        }
    });
  };

  return (
    <>
      <PageHeader 
        title="Quote Configuration" 
        description="Manage default hourly rates for aircraft and standard rates for services & fees used in quotes."
        icon={DollarSign}
      />

      <div className="space-y-6">
        {/* Aircraft Hourly Rates Card */}
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary"/> Aircraft Hourly Rates</CardTitle>
                    <CardDescription>Set standard buy and sell rates for aircraft. (Connected to Firestore)</CardDescription>
                </div>
                {!showAddAircraftRateForm && (
                    <Button variant="outline" size="sm" onClick={() => { setEditingAircraftRateId(null); setShowAddAircraftRateForm(true); setSelectedFleetAircraftIdForRate(''); setNewAircraftBuyRate(''); setNewAircraftSellRate(''); }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Aircraft Rate
                    </Button>
                )}
            </div>
          </CardHeader>
          <CardContent>
            {showAddAircraftRateForm && (
              <Card className="p-4 mb-4 bg-muted/50 border-dashed">
                <CardTitle className="text-lg mb-2">
                    {editingAircraftRateId ? `Edit Rates for: ${getAircraftDisplayLabel(editingAircraftRateId)}` : 'Add New Aircraft Rate'}
                </CardTitle>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="selectedFleetAircraftIdForRate">Select Aircraft from Fleet</Label>
                    <Select 
                        onValueChange={setSelectedFleetAircraftIdForRate} 
                        value={selectedFleetAircraftIdForRate}
                        disabled={!!editingAircraftRateId || isLoadingFleet}
                    >
                        <SelectTrigger id="selectedFleetAircraftIdForRate">
                            <SelectValue placeholder={isLoadingFleet ? "Loading fleet..." : "Select an aircraft"} />
                        </SelectTrigger>
                        <SelectContent>
                            {editingAircraftRateId && fleet.find(ac => ac.id === editingAircraftRateId) && (
                                <SelectItem value={editingAircraftRateId}>
                                    {getAircraftDisplayLabel(editingAircraftRateId)}
                                </SelectItem>
                            )}
                            {!editingAircraftRateId && availableFleetForNewRate.map(ac => (
                                <SelectItem key={ac.id} value={ac.id}>
                                    {ac.tailNumber} - {ac.model}
                                </SelectItem>
                            ))}
                            {!editingAircraftRateId && availableFleetForNewRate.length === 0 && !isLoadingFleet && <SelectItem value="no-fleet" disabled>All fleet aircraft have rates or no fleet.</SelectItem>}
                        </SelectContent>
                    </Select>
                    {editingAircraftRateId && <p className="text-xs text-muted-foreground">Aircraft selection is disabled during edit.</p>}
                  </div>
                  
                  <div className="p-3 border rounded-md bg-background/70">
                      <p className="font-medium text-sm mb-2 text-primary">Standard Hourly Rates</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor={`standard-buyRate`}>Buy Rate (/hr)</Label>
                            <Input 
                              id={`standard-buyRate`} 
                              type="number" 
                              value={newAircraftBuyRate} 
                              onChange={(e) => setNewAircraftBuyRate(e.target.value)} 
                              placeholder="e.g., 2500" 
                              min="0" 
                            />
                        </div>
                        <div>
                            <Label htmlFor={`standard-sellRate`}>Sell Rate (/hr)</Label>
                            <Input 
                              id={`standard-sellRate`} 
                              type="number" 
                              value={newAircraftSellRate} 
                              onChange={(e) => setNewAircraftSellRate(e.target.value)} 
                              placeholder="e.g., 3000" 
                              min="0" 
                            />
                        </div>
                      </div>
                    </div>

                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleAddOrUpdateAircraftRate} size="sm" disabled={isSavingAircraftRate || isLoadingFleet || (!editingAircraftRateId && availableFleetForNewRate.length === 0)}>
                        {isSavingAircraftRate ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        {editingAircraftRateId ? 'Update Rate' : 'Save New Rate'}
                    </Button>
                    <Button variant="outline" onClick={handleCancelEditAircraftRate} size="sm" disabled={isSavingAircraftRate}>
                        <XCircle className="mr-2 h-4 w-4"/>Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            )}
            {isLoadingAircraftRates || isLoadingFleet ? (
                <div className="space-y-2 py-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                </div>
            ) : (
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Aircraft (Tail - Model)</TableHead>
                    <TableHead className="text-right">Std. Buy Rate (/hr)</TableHead>
                    <TableHead className="text-right">Std. Sell Rate (/hr)</TableHead>
                    <TableHead className="text-right">Std. Margin</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {aircraftRates.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-4">No aircraft rates configured yet.</TableCell>
                        </TableRow>
                    )}
                    {aircraftRates.map((rate) => {
                    const buy = rate.buy;
                    const sell = rate.sell;
                    const margin = sell - buy;
                    const marginPercent = buy > 0 ? (margin / buy) * 100 : 0;
                    return (
                        <TableRow key={rate.id}>
                        <TableCell className="font-medium">{getAircraftDisplayLabel(rate.id)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(buy)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(sell)}</TableCell>
                        <TableCell className="text-right">
                            {formatCurrency(margin)} <span className={margin >= 0 ? 'text-green-600' : 'text-red-600'}>({marginPercent.toFixed(1)}%)</span>
                        </TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleEditAircraftRateClick(rate)} className="mr-1 hover:text-primary" disabled={isSavingAircraftRate || isDeletingAircraftRate}>
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit rate for {rate.id}</span>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => confirmDeleteAircraftRate(rate)} className="text-destructive hover:text-destructive" disabled={isSavingAircraftRate || (isDeletingAircraftRate && currentDeletingRateId === rate.id)}>
                            {isDeletingAircraftRate && currentDeletingRateId === rate.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                            <span className="sr-only">Delete rate for {rate.id}</span>
                            </Button>
                        </TableCell>
                        </TableRow>
                    );
                    })}
                </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>

        {/* Standard Service & Fee Rates Card */}
        <Card className="shadow-md">
          <CardHeader>
             <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5 text-primary"/> Standard Service &amp; Fee Rates</CardTitle>
                    <CardDescription>Default buy and sell rates for various services and fees used in quotes. (Saved to Company Profile)</CardDescription>
                </div>
                {!showAddServiceForm && (
                  <Button variant="outline" size="sm" onClick={() => { setEditingServiceKey(null); setShowAddServiceForm(true); setNewServiceDisplayDescription(''); setNewServiceUnit(''); setNewServiceBuyRateLocal(''); setNewServiceSellRateLocal(''); setNewServiceIsActive(true); }}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Service/Fee
                  </Button>
                )}
            </div>
          </CardHeader>
          <CardContent>
            {showAddServiceForm && (
                 <Card className="p-4 mb-4 bg-muted/50 border-dashed">
                    <CardTitle className="text-lg mb-2">
                      {editingServiceKey ? `Edit Service/Fee: ${serviceFeeRates[editingServiceKey]?.displayDescription || editingServiceKey}` : 'Add New Service/Fee'}
                    </CardTitle>
                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="newServiceDisplayDescription">Display Description</Label>
                            <Input id="newServiceDisplayDescription" value={newServiceDisplayDescription} onChange={(e) => setNewServiceDisplayDescription(e.target.value)} placeholder="e.g., International Handling Fee" />
                            {!editingServiceKey && <p className="text-xs text-muted-foreground">A unique key will be auto-generated from this description.</p>}
                        </div>
                        <div>
                            <Label htmlFor="newServiceUnit">Unit Description</Label>
                            <Input id="newServiceUnit" value={newServiceUnit} onChange={(e) => setNewServiceUnit(e.target.value)} placeholder="e.g., Per Trip, Per Leg, Per Day" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="newServiceBuyRateLocal">Buy Rate</Label>
                                <Input id="newServiceBuyRateLocal" type="number" value={newServiceBuyRateLocal} onChange={(e) => setNewServiceBuyRateLocal(e.target.value)} placeholder="e.g., 200" min="0"/>
                            </div>
                            <div>
                                <Label htmlFor="newServiceSellRateLocal">Sell Rate</Label>
                                <Input id="newServiceSellRateLocal" type="number" value={newServiceSellRateLocal} onChange={(e) => setNewServiceSellRateLocal(e.target.value)} placeholder="e.g., 250" min="0"/>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 pt-1">
                            <Checkbox id="newServiceIsActive" checked={newServiceIsActive} onCheckedChange={(checked) => setNewServiceIsActive(Boolean(checked))} />
                            <Label htmlFor="newServiceIsActive" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Active (Use for default pricing on new quotes)
                            </Label>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button onClick={handleAddOrUpdateServiceFee} size="sm" disabled={isSavingServiceFee || isLoadingCompanyProfile}>
                            {isSavingServiceFee ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                            {editingServiceKey ? 'Update Service/Fee' : 'Save New Service/Fee'}
                          </Button>
                          <Button variant="outline" onClick={handleCancelEditServiceFee} size="sm" disabled={isSavingServiceFee}>
                              <XCircle className="mr-2 h-4 w-4"/>Cancel
                          </Button>
                        </div>
                    </div>
                 </Card>
            )}
            {isLoadingCompanyProfile ? (
                 <div className="space-y-2 py-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                </div>
            ) : (
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service / Fee Description</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-right">Default Buy Rate</TableHead>
                  <TableHead className="text-right">Default Sell Rate</TableHead>
                  <TableHead className="text-right">Default Margin</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(serviceFeeRates).length === 0 && (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-4">No service or fee rates configured yet.</TableCell>
                    </TableRow>
                )}
                {Object.entries(serviceFeeRates).map(([key, rates]) => {
                  const margin = rates.sell - rates.buy;
                  const marginPercent = rates.buy > 0 && rates.buy !== 0 ? (margin / rates.buy) * 100 : 0;
                  return (
                    <TableRow key={key}>
                      <TableCell className="font-medium">{rates.displayDescription}</TableCell>
                      <TableCell>{rates.unitDescription}</TableCell>
                      <TableCell className="text-center">
                        {rates.isActive ? <CheckSquare className="h-5 w-5 text-green-500 inline-block" /> : <Square className="h-5 w-5 text-muted-foreground inline-block" />}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(rates.buy)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(rates.sell)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(margin)} <span className={margin >= 0 ? 'text-green-600' : 'text-red-600'}>({marginPercent.toFixed(1)}%)</span>
                      </TableCell>
                       <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditServiceFeeClick(key)} className="mr-1 hover:text-primary" disabled={isSavingServiceFee}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit {rates.displayDescription}</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => confirmDeleteServiceFee(key)} className="text-destructive hover:text-destructive" disabled={isSavingServiceFee}>
                          <Trash2 className="h-4 w-4" />
                           <span className="sr-only">Delete {rates.displayDescription}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Aircraft Rate Delete Confirmation Dialog */}
      {showDeleteConfirmAircraftRate && rateToDelete && (
        <AlertDialog open={showDeleteConfirmAircraftRate} onOpenChange={setShowDeleteConfirmAircraftRate}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the rate for aircraft "{getAircraftDisplayLabel(rateToDelete.id)}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteConfirmAircraftRate(false)} disabled={isDeletingAircraftRate}>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={executeDeleteAircraftRate} disabled={isDeletingAircraftRate}>
                {isDeletingAircraftRate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Rate
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Service/Fee Delete Confirmation Dialog */}
      {showDeleteServiceFeeConfirm && serviceFeeToDeleteKey && (
        <AlertDialog open={showDeleteServiceFeeConfirm} onOpenChange={setShowDeleteServiceFeeConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the service/fee "{serviceFeeRates[serviceFeeToDeleteKey]?.displayDescription || serviceFeeToDeleteKey}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteServiceFeeConfirm(false)} disabled={isSavingServiceFee}>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={executeDeleteServiceFee} disabled={isSavingServiceFee}>
                {isSavingServiceFee && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Service/Fee
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
