
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
import { fetchAircraftRates, saveAircraftRate, deleteAircraftRate, type AircraftRate, type RateCategory } from '@/ai/flows/manage-aircraft-rates-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { fetchCompanyProfile, saveCompanyProfile, type CompanyProfile, type ServiceFeeRate } from '@/ai/flows/manage-company-profile-flow';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const formatCurrency = (amount: number) => {
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
};

type RateCategoryKey = "standardCharter" | "owner" | "medical" | "cargo" | "positioning";

const AIRCRAFT_RATE_CATEGORIES: Array<{ key: RateCategoryKey; label: string }> = [
  { key: "standardCharter", label: "Standard Charter" },
  { key: "owner", label: "Owner Rate" },
  { key: "medical", label: "Medical Flight" },
  { key: "cargo", label: "Cargo Flight" },
  { key: "positioning", label: "Positioning/Ferry" },
];

interface EditableRateCategory {
  buy: string;
  sell: string;
}

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
  const { toast } = useToast();

  const [showAddAircraftRateForm, setShowAddAircraftRateForm] = useState(false);
  const [selectedFleetAircraftIdForRate, setSelectedFleetAircraftIdForRate] = useState<string>('');
  
  // State for categorized aircraft rates in the form
  const [editableAircraftRateCategories, setEditableAircraftRateCategories] = useState<Partial<Record<RateCategoryKey, EditableRateCategory>>>({});
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
    
    const initialEditableRates: Partial<Record<RateCategoryKey, EditableRateCategory>> = {};
    AIRCRAFT_RATE_CATEGORIES.forEach(category => {
      const existingCategoryRate = rate.rates?.[category.key];
      initialEditableRates[category.key] = {
        buy: existingCategoryRate?.buy !== undefined ? String(existingCategoryRate.buy) : '',
        sell: existingCategoryRate?.sell !== undefined ? String(existingCategoryRate.sell) : '',
      };
    });
    setEditableAircraftRateCategories(initialEditableRates);
    setShowAddAircraftRateForm(true);
  };

  const handleAircraftRateCategoryChange = (categoryKey: RateCategoryKey, field: 'buy' | 'sell', value: string) => {
    setEditableAircraftRateCategories(prev => ({
      ...prev,
      [categoryKey]: {
        ...(prev[categoryKey] || { buy: '', sell: '' }),
        [field]: value,
      }
    }));
  };
  
  const handleAddOrUpdateAircraftRate = () => {
    if (!selectedFleetAircraftIdForRate) {
      toast({ title: "Missing Aircraft", description: "Please select an aircraft.", variant: "destructive" });
      return;
    }

    const processedRates: Partial<Record<RateCategoryKey, RateCategory>> = {};
    let hasAtLeastOneRate = false;

    AIRCRAFT_RATE_CATEGORIES.forEach(category => {
      const inputCategory = editableAircraftRateCategories[category.key];
      if (inputCategory && (inputCategory.buy.trim() !== '' || inputCategory.sell.trim() !== '')) {
        const buyRateNum = parseFloat(inputCategory.buy);
        const sellRateNum = parseFloat(inputCategory.sell);

        if (isNaN(buyRateNum) && inputCategory.buy.trim() !== '') {
            toast({ title: "Invalid Buy Rate", description: `Buy rate for ${category.label} must be a valid number.`, variant: "destructive" });
            throw new Error("Invalid buy rate"); // Stop processing
        }
        if (isNaN(sellRateNum) && inputCategory.sell.trim() !== '') {
             toast({ title: "Invalid Sell Rate", description: `Sell rate for ${category.label} must be a valid number.`, variant: "destructive" });
            throw new Error("Invalid sell rate"); // Stop processing
        }
        
        // Only include if at least one is a valid non-negative number. Allow 0.
        if ((!isNaN(buyRateNum) && buyRateNum >= 0) || (!isNaN(sellRateNum) && sellRateNum >= 0)) {
            processedRates[category.key] = {
              buy: !isNaN(buyRateNum) && buyRateNum >= 0 ? buyRateNum : 0, // Default to 0 if one is empty but other is valid
              sell: !isNaN(sellRateNum) && sellRateNum >= 0 ? sellRateNum : 0,
            };
            hasAtLeastOneRate = true;
        }
      }
    });
    
    if (!hasAtLeastOneRate && !editingAircraftRateId) { // Stricter check for new rates
         toast({ title: "Missing Rates", description: "Please enter at least one buy or sell rate for any category.", variant: "destructive" });
        return;
    }


    const rateData: AircraftRate = {
      id: selectedFleetAircraftIdForRate, 
      rates: processedRates, 
    };

    startSavingAircraftRateTransition(async () => {
      try {
        await saveAircraftRate(rateData);
        await loadInitialData(); 
        toast({ title: "Success", description: `Aircraft rates ${editingAircraftRateId ? 'updated' : 'added/updated'}.` });
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
    setEditableAircraftRateCategories({});
    setShowAddAircraftRateForm(false);
  };

  const handleDeleteAircraftRate = (aircraftIdToDelete: string) => {
    setCurrentDeletingRateId(aircraftIdToDelete);
    startDeletingAircraftRateTransition(async () => {
      try {
        await deleteAircraftRate({ aircraftId: aircraftIdToDelete });
        await loadInitialData(); 
        toast({ title: "Success", description: "Aircraft rate deleted." });
        if (editingAircraftRateId === aircraftIdToDelete) { 
          handleCancelEditAircraftRate();
        }
      } catch (error) {
        console.error("Failed to delete aircraft rate:", error);
        toast({ title: "Error", description: `Could not delete aircraft rate. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
      } finally {
        setCurrentDeletingRateId(null);
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
                    <CardDescription>Set buy and sell rates for aircraft. (Connected to Firestore)</CardDescription>
                </div>
                {!showAddAircraftRateForm && (
                    <Button variant="outline" size="sm" onClick={() => { setEditingAircraftRateId(null); setShowAddAircraftRateForm(true); setSelectedFleetAircraftIdForRate(''); setEditableAircraftRateCategories({}); }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Aircraft Rate
                    </Button>
                )}
            </div>
          </CardHeader>
          <CardContent>
            {showAddAircraftRateForm && (
              <Card className="p-4 mb-4 bg-muted/50 border-dashed">
                <CardTitle className="text-lg mb-2">
                    {editingAircraftRateId ? `Edit Rates for: ${getAircraftDisplayLabel(editingAircraftRateId)}` : 'Add New Aircraft Rates'}
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
                  
                  {AIRCRAFT_RATE_CATEGORIES.map(category => (
                    <div key={category.key} className="p-3 border rounded-md bg-background/70">
                      <p className="font-medium text-sm mb-2 text-primary">{category.label} Rates</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor={`${category.key}-buyRate`}>Buy Rate (/hr)</Label>
                            <Input 
                              id={`${category.key}-buyRate`} 
                              type="number" 
                              value={editableAircraftRateCategories[category.key]?.buy || ''} 
                              onChange={(e) => handleAircraftRateCategoryChange(category.key, 'buy', e.target.value)} 
                              placeholder="e.g., 2500" 
                              min="0" 
                            />
                        </div>
                        <div>
                            <Label htmlFor={`${category.key}-sellRate`}>Sell Rate (/hr)</Label>
                            <Input 
                              id={`${category.key}-sellRate`} 
                              type="number" 
                              value={editableAircraftRateCategories[category.key]?.sell || ''} 
                              onChange={(e) => handleAircraftRateCategoryChange(category.key, 'sell', e.target.value)} 
                              placeholder="e.g., 3000" 
                              min="0" 
                            />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleAddOrUpdateAircraftRate} size="sm" disabled={isSavingAircraftRate || isLoadingFleet || (!editingAircraftRateId && availableFleetForNewRate.length === 0)}>
                        {isSavingAircraftRate ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        {editingAircraftRateId ? 'Update Rates' : 'Save New Rates'}
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
                    <TableHead className="text-right">Std. Charter Buy (/hr)</TableHead>
                    <TableHead className="text-right">Std. Charter Sell (/hr)</TableHead>
                    <TableHead className="text-right">Std. Charter Margin</TableHead>
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
                    const standardCharterRate = rate.rates?.standardCharter;
                    const buy = standardCharterRate?.buy ?? 0;
                    const sell = standardCharterRate?.sell ?? 0;
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
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteAircraftRate(rate.id)} className="text-destructive hover:text-destructive" disabled={isSavingAircraftRate || (isDeletingAircraftRate && currentDeletingRateId === rate.id)}>
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
                <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-blue-500"/> Implementation Status</CardTitle>
            </CardHeader>
            <CardContent>
                 <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Aircraft Fleet data (in Company Settings), Aircraft Hourly Rates, and Standard Service &amp; Fee Rates (this page) are now connected to Firestore.</li>
                    <li>Aircraft Hourly Rates now support multiple categories (Standard Charter, Owner, Medical, etc.).</li>
                    <li>The "Create New Quote" form will need to be updated next to use these categorized aircraft rates based on leg type.</li>
                </ul>
            </CardContent>
        </Card>

      </div>
    </>
  );
}
