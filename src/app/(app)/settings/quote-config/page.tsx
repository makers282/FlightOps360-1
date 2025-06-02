
"use client";

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SlidersHorizontal, DollarSign, Edit, Percent, PlusCircle, Trash2, Save, XCircle, Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchAircraftRates, saveAircraftRate, deleteAircraftRate } from '@/ai/flows/manage-aircraft-rates-flow';
import type { AircraftRate } from '@/ai/schemas/aircraft-rate-schemas'; 
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { fetchCompanyProfile, saveCompanyProfile, type CompanyProfile, type ServiceFeeRate } from '@/ai/flows/manage-company-profile-flow';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
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

const formatCurrency = (amount: number) => {
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
};

export default function QuoteConfigPage() {
  const [aircraftRates, setAircraftRates] = useState<AircraftRate[]>([]);
  const [fleet, setFleet] = useState<FleetAircraft[]>([]);
  
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [currentServiceFeeRates, setCurrentServiceFeeRates] = useState<{ [key: string]: ServiceFeeRate }>({});

  const [isLoadingAircraftRates, setIsLoadingAircraftRates] = useState(true);
  const [isLoadingFleet, setIsLoadingFleet] = useState(true);
  const [isLoadingCompanyProfile, setIsLoadingCompanyProfile] = useState(true);

  const [isSavingAircraftRate, startSavingAircraftRateTransition] = useTransition();
  const [isDeletingAircraftRate, startDeletingAircraftRateTransition] = useTransition();
  const [isSavingServiceFee, startSavingServiceFeeTransition] = useTransition();

  const [currentDeletingRateId, setCurrentDeletingRateId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [rateToDelete, setRateToDelete] = useState<AircraftRate | null>(null);
  const { toast } = useToast();

  const [showAddAircraftRateForm, setShowAddAircraftRateForm] = useState(false);
  const [selectedFleetAircraftIdForRate, setSelectedFleetAircraftIdForRate] = useState<string>('');
  
  const [newAircraftBuyRate, setNewAircraftBuyRate] = useState('');
  const [newAircraftSellRate, setNewAircraftSellRate] = useState('');
  const [editingAircraftRateId, setEditingAircraftRateId] = useState<string | null>(null);

  const [showAddServiceForm, setShowAddServiceForm] = useState(false);
  const [newServiceDisplayDescription, setNewServiceDisplayDescription] = useState('');
  const [newServiceUnit, setNewServiceUnit] = useState('');
  const [newServiceBuyRateLocal, setNewServiceBuyRateLocal] = useState(''); 
  const [newServiceSellRateLocal, setNewServiceSellRateLocal] = useState(''); 
  const [editingServiceKey, setEditingServiceKey] = useState<string | null>(null);

  const loadInitialData = useCallback(async () => {
    setIsLoadingAircraftRates(true);
    setIsLoadingFleet(true);
    setIsLoadingCompanyProfile(true);
    try {
      const [fetchedRates, fetchedFleet, fetchedProfile] = await Promise.all([
        fetchAircraftRates(),
        fetchFleetAircraft(),
        fetchCompanyProfile()
      ]);
      setAircraftRates(fetchedRates);
      setFleet(fetchedFleet);
      setCompanyProfile(fetchedProfile);
      setCurrentServiceFeeRates(fetchedProfile?.serviceFeeRates || {});

    } catch (error) {
      console.error("Failed to load quote configuration data:", error);
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
    setShowDeleteConfirm(true);
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
        setShowDeleteConfirm(false);
        setRateToDelete(null);
      }
    });
  };

  const handleEditServiceFeeClick = (key: string) => {
    const serviceToEdit = currentServiceFeeRates[key];
    if (serviceToEdit) {
      setEditingServiceKey(key);
      setNewServiceDisplayDescription(serviceToEdit.displayDescription);
      setNewServiceUnit(serviceToEdit.unitDescription);
      setNewServiceBuyRateLocal(String(serviceToEdit.buy));
      setNewServiceSellRateLocal(String(serviceToEdit.sell));
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
        if (currentServiceFeeRates[keyToUse] && !editingServiceKey) { 
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
        ...currentServiceFeeRates,
        [keyToUse]: { 
            displayDescription: newServiceDisplayDescription.trim(),
            buy: buyRateNum, 
            sell: sellRateNum, 
            unitDescription: newServiceUnit.trim() 
        }
    };

    if (!companyProfile) {
        toast({ title: "Error", description: "Company profile not loaded.", variant: "destructive"});
        return;
    }

    const updatedProfile: CompanyProfile = {
        ...companyProfile,
        serviceFeeRates: updatedServiceFeeRates,
    };
    
    startSavingServiceFeeTransition(async () => {
        try {
            await saveCompanyProfile(updatedProfile);
            setCurrentServiceFeeRates(updatedServiceFeeRates); 
            setCompanyProfile(updatedProfile); 
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
    setShowAddServiceForm(false);
  };

  const handleDeleteServiceFee = (keyToDelete: string) => {
    if (!companyProfile) {
        toast({ title: "Error", description: "Company profile not loaded.", variant: "destructive"});
        return;
    }
    
    const updatedServiceFeeRates = { ...currentServiceFeeRates };
    delete updatedServiceFeeRates[keyToDelete];

    const updatedProfile: CompanyProfile = {
        ...companyProfile,
        serviceFeeRates: updatedServiceFeeRates,
    };

    startSavingServiceFeeTransition(async () => {
        try {
            await saveCompanyProfile(updatedProfile);
            setCurrentServiceFeeRates(updatedServiceFeeRates);
            setCompanyProfile(updatedProfile);
            toast({ title: "Success", description: "Service/Fee deleted from Firestore." });
            if (editingServiceKey === keyToDelete) {
              handleCancelEditServiceFee();
            }
        } catch (error) {
            console.error("Failed to delete service/fee rate:", error);
            toast({ title: "Error Deleting Service/Fee", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
        }
    });
  };

  const getAircraftDisplayLabel = (aircraftId: string): string => {
    const aircraft = fleet.find(ac => ac.id === aircraftId);
    return aircraft ? `${aircraft.tailNumber} - ${aircraft.model}` : aircraftId;
  };

  const availableFleetForNewRate = fleet.filter(ac => !aircraftRates.find(r => r.id === ac.id));

  return (
    <>
      <PageHeader 
        title="Quote Configuration" 
        description="Manage default rates and costs for flight quotes."
        icon={SlidersHorizontal}
      />

      <div className="space-y-6">
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

        <Card className="shadow-md">
          <CardHeader>
             <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5 text-primary"/> Standard Service &amp; Fee Rates</CardTitle>
                    <CardDescription>Default buy and sell rates for various services and fees. (Connected to Firestore)</CardDescription>
                </div>
                {!showAddServiceForm && (
                  <Button variant="outline" size="sm" onClick={() => { setEditingServiceKey(null); setShowAddServiceForm(true); setNewServiceDisplayDescription(''); setNewServiceUnit(''); setNewServiceBuyRateLocal(''); setNewServiceSellRateLocal(''); }}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Service/Fee
                  </Button>
                )}
            </div>
          </CardHeader>
          <CardContent>
            {showAddServiceForm && (
                 <Card className="p-4 mb-4 bg-muted/50 border-dashed">
                    <CardTitle className="text-lg mb-2">
                      {editingServiceKey ? `Edit Service/Fee: ${currentServiceFeeRates[editingServiceKey]?.displayDescription || editingServiceKey}` : 'Add New Service/Fee'}
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
                        <div className="flex gap-2">
                          <Button onClick={handleAddOrUpdateServiceFee} size="sm" disabled={isSavingServiceFee}>
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
                  <TableHead className="text-right">Default Buy Rate</TableHead>
                  <TableHead className="text-right">Default Sell Rate</TableHead>
                  <TableHead className="text-right">Default Margin</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(currentServiceFeeRates).length === 0 && (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-4">No service or fee rates configured yet.</TableCell>
                    </TableRow>
                )}
                {Object.entries(currentServiceFeeRates).map(([key, rates]) => {
                  const margin = rates.sell - rates.buy;
                  const marginPercent = rates.buy > 0 && rates.buy !== 0 ? (margin / rates.buy) * 100 : 0;
                  return (
                    <TableRow key={key}>
                      <TableCell className="font-medium">{rates.displayDescription}</TableCell>
                      <TableCell>{rates.unitDescription}</TableCell>
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
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteServiceFee(key)} className="text-destructive hover:text-destructive" disabled={isSavingServiceFee}>
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
        
        <Card className="shadow-md border-primary/30">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-blue-500"/> Current Implementation Notes</CardTitle>
            </CardHeader>
            <CardContent>
                 <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Aircraft hourly rates are managed with a standard buy and sell rate per aircraft.</li>
                    <li>Service/Fee rates are default values used in quote generation.</li>
                    <li>Both sections are connected to Firestore and allow adding, editing, and deleting.</li>
                </ul>
            </CardContent>
        </Card>

      </div>
      {showDeleteConfirm && rateToDelete && (
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the rate for aircraft "{getAircraftDisplayLabel(rateToDelete.id)}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)} disabled={isDeletingAircraftRate}>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={executeDeleteAircraftRate} disabled={isDeletingAircraftRate}>
                {isDeletingAircraftRate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
