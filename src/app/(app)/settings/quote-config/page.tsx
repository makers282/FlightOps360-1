
"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SlidersHorizontal, DollarSign, Edit, Percent, PlusCircle, Trash2, Save, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchAircraftRates, saveAircraftRate, deleteAircraftRate, type AircraftRate } from '@/ai/flows/manage-aircraft-rates-flow';

// ServiceFeeRate structure (still client-side for now)
interface ServiceFeeRate {
  displayDescription: string;
  buy: number;
  sell: number;
  unitDescription: string;
}

const INITIAL_OTHER_COST_RATES_DATA: { [key: string]: ServiceFeeRate } = {
  FUEL_SURCHARGE_PER_BLOCK_HOUR: { displayDescription: "Fuel Surcharge", buy: 300, sell: 400, unitDescription: "Per Block Hour" },
  LANDING_FEE_PER_LEG: { displayDescription: "Landing Fee", buy: 400, sell: 500, unitDescription: "Per Leg" },
  OVERNIGHT_FEE_PER_NIGHT: { displayDescription: "Overnight Fee", buy: 1000, sell: 1300, unitDescription: "Per Night"},
  MEDICS_FEE_FLAT: { displayDescription: "Medics Fee", buy: 1800, sell: 2500, unitDescription: "Per Service" }, 
  CATERING_FEE_FLAT: { displayDescription: "Catering Fee", buy: 350, sell: 500, unitDescription: "Per Service" },
};

const formatCurrency = (amount: number) => {
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
};

export default function QuoteConfigPage() {
  const [aircraftRates, setAircraftRates] = useState<AircraftRate[]>([]);
  const [otherCostRates, setOtherCostRates] = useState<{ [key: string]: ServiceFeeRate }>(INITIAL_OTHER_COST_RATES_DATA);

  const [isLoadingAircraftRates, setIsLoadingAircraftRates] = useState(true);
  const [isSavingAircraftRate, startSavingTransition] = useTransition();
  const [isDeletingAircraftRate, startDeletingTransition] = useTransition();
  const { toast } = useToast();

  const [showAddAircraftForm, setShowAddAircraftForm] = useState(false);
  const [newAircraftId, setNewAircraftId] = useState(''); // Renamed from newAircraftName to newAircraftId for clarity
  const [newAircraftBuyRate, setNewAircraftBuyRate] = useState('');
  const [newAircraftSellRate, setNewAircraftSellRate] = useState('');
  const [editingAircraftId, setEditingAircraftId] = useState<string | null>(null);


  const [showAddServiceForm, setShowAddServiceForm] = useState(false);
  const [newServiceKey, setNewServiceKey] = useState('');
  const [newServiceDisplayDescription, setNewServiceDisplayDescription] = useState('');
  const [newServiceUnit, setNewServiceUnit] = useState('');
  const [newServiceBuyRate, setNewServiceBuyRate] = useState('');
  const [newServiceSellRate, setNewServiceSellRate] = useState('');
  const [editingServiceKey, setEditingServiceKey] = useState<string | null>(null);

  useEffect(() => {
    const loadRates = async () => {
      setIsLoadingAircraftRates(true);
      try {
        const rates = await fetchAircraftRates();
        setAircraftRates(rates);
      } catch (error) {
        console.error("Failed to fetch aircraft rates:", error);
        toast({ title: "Error", description: "Could not load aircraft rates.", variant: "destructive" });
      } finally {
        setIsLoadingAircraftRates(false);
      }
    };
    loadRates();
  }, [toast]);

  const handleEditAircraftClick = (rate: AircraftRate) => {
    setEditingAircraftId(rate.id);
    setNewAircraftId(rate.id); 
    setNewAircraftBuyRate(String(rate.buy));
    setNewAircraftSellRate(String(rate.sell));
    setShowAddAircraftForm(true);
  };

  const handleAddOrUpdateAircraftRate = () => {
    if (!newAircraftId || !newAircraftBuyRate || !newAircraftSellRate) {
      toast({ title: "Missing Fields", description: "Please fill in all fields for the aircraft rate.", variant: "destructive" });
      return;
    }
    const buyRateNum = parseFloat(newAircraftBuyRate);
    const sellRateNum = parseFloat(newAircraftSellRate);
    if (isNaN(buyRateNum) || isNaN(sellRateNum)) {
        toast({ title: "Invalid Rates", description: "Buy and Sell rates must be valid numbers.", variant: "destructive" });
        return;
    }

    const rateData: AircraftRate = {
      id: newAircraftId.trim(), // Use newAircraftId as the ID
      buy: buyRateNum,
      sell: sellRateNum,
    };

    startSavingTransition(async () => {
      try {
        const savedRate = await saveAircraftRate(rateData);
        if (editingAircraftId) { // Editing existing
          setAircraftRates(prev => prev.map(r => r.id === editingAircraftId ? savedRate : r));
        } else { // Adding new
          setAircraftRates(prev => [...prev, savedRate]);
        }
        toast({ title: "Success", description: `Aircraft rate ${editingAircraftId ? 'updated' : 'added'}.` });
        handleCancelEditAircraft();
      } catch (error) {
        console.error("Failed to save aircraft rate:", error);
        toast({ title: "Error", description: `Could not ${editingAircraftId ? 'update' : 'add'} aircraft rate.`, variant: "destructive" });
      }
    });
  };
  
  const handleCancelEditAircraft = () => {
    setEditingAircraftId(null);
    setNewAircraftId('');
    setNewAircraftBuyRate('');
    setNewAircraftSellRate('');
    setShowAddAircraftForm(false);
  };

  const handleDeleteAircraftRate = (aircraftIdToDelete: string) => {
    startDeletingTransition(async () => {
      try {
        await deleteAircraftRate({ aircraftId: aircraftIdToDelete });
        setAircraftRates(prev => prev.filter(rate => rate.id !== aircraftIdToDelete));
        toast({ title: "Success", description: "Aircraft rate deleted." });
        if (editingAircraftId === aircraftIdToDelete) { 
          handleCancelEditAircraft();
        }
      } catch (error) {
        console.error("Failed to delete aircraft rate:", error);
        toast({ title: "Error", description: "Could not delete aircraft rate.", variant: "destructive" });
      }
    });
  };

  const handleEditServiceFeeClick = (key: string) => {
    const serviceToEdit = otherCostRates[key];
    if (serviceToEdit) {
      setEditingServiceKey(key);
      setNewServiceKey(key); 
      setNewServiceDisplayDescription(serviceToEdit.displayDescription);
      setNewServiceUnit(serviceToEdit.unitDescription);
      setNewServiceBuyRate(String(serviceToEdit.buy));
      setNewServiceSellRate(String(serviceToEdit.sell));
      setShowAddServiceForm(true);
    }
  };
  
  const handleAddOrUpdateServiceFee = () => {
    const keyToUse = editingServiceKey || newServiceKey.toUpperCase().replace(/\s+/g, '_');
    if (!keyToUse || !newServiceDisplayDescription || !newServiceUnit || !newServiceBuyRate || !newServiceSellRate) {
        toast({ title: "Missing Fields", description: "Please fill in all fields for the service/fee.", variant: "destructive" });
        return;
    }
    const buyRateNum = parseFloat(newServiceBuyRate);
    const sellRateNum = parseFloat(newServiceSellRate);
     if (isNaN(buyRateNum) || isNaN(sellRateNum)) {
        toast({ title: "Invalid Rates", description: "Buy and Sell rates must be valid numbers.", variant: "destructive" });
        return;
    }

    // For now, this still manipulates client-side state.
    // TODO: Implement backend calls for service fees similar to aircraft rates.
    setOtherCostRates(prev => ({
        ...prev,
        [keyToUse]: { 
            displayDescription: newServiceDisplayDescription,
            buy: buyRateNum, 
            sell: sellRateNum, 
            unitDescription: newServiceUnit 
        }
    }));

    setNewServiceKey('');
    setNewServiceDisplayDescription('');
    setNewServiceUnit('');
    setNewServiceBuyRate('');
    setNewServiceSellRate('');
    setShowAddServiceForm(false);
    setEditingServiceKey(null);
    toast({ title: "Success", description: `Service/Fee ${editingServiceKey ? 'updated' : 'added'} (client-side).` });
  };

  const handleCancelEditServiceFee = () => {
    setEditingServiceKey(null);
    setNewServiceKey('');
    setNewServiceDisplayDescription('');
    setNewServiceUnit('');
    setNewServiceBuyRate('');
    setNewServiceSellRate('');
    setShowAddServiceForm(false);
  };

  const handleDeleteServiceFee = (key: string) => {
    // TODO: Implement backend call for deleting service fees.
    setOtherCostRates(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
     if (editingServiceKey === key) {
      handleCancelEditServiceFee();
    }
    toast({ title: "Success", description: "Service/Fee deleted (client-side)." });
  };

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
                    <CardDescription>Default buy and sell rates per flight hour. Backend connected (Firestore placeholders).</CardDescription>
                </div>
                {!showAddAircraftForm && (
                    <Button variant="outline" size="sm" onClick={() => { setEditingAircraftId(null); setShowAddAircraftForm(true); setNewAircraftId(''); setNewAircraftBuyRate(''); setNewAircraftSellRate(''); }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Aircraft Rate
                    </Button>
                )}
            </div>
          </CardHeader>
          <CardContent>
            {showAddAircraftForm && (
              <Card className="p-4 mb-4 bg-muted/50 border-dashed">
                <CardTitle className="text-lg mb-2">
                    {editingAircraftId ? `Edit Aircraft Rate: ${editingAircraftId}` : 'Add New Aircraft Rate'}
                </CardTitle>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="newAircraftId">Aircraft ID / Name (Unique Key)</Label>
                    <Input id="newAircraftId" value={newAircraftId} onChange={(e) => setNewAircraftId(e.target.value)} placeholder="e.g., Category: Super Mid Jet" disabled={!!editingAircraftId && newAircraftId !== editingAircraftId} />
                     {editingAircraftId && newAircraftId !== editingAircraftId && <p className="text-xs text-muted-foreground">Renaming ID is disabled during edit. Delete and re-add if ID change is needed.</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="newAircraftBuyRate">Buy Rate (/hr)</Label>
                        <Input id="newAircraftBuyRate" type="number" value={newAircraftBuyRate} onChange={(e) => setNewAircraftBuyRate(e.target.value)} placeholder="e.g., 5000" />
                    </div>
                    <div>
                        <Label htmlFor="newAircraftSellRate">Sell Rate (/hr)</Label>
                        <Input id="newAircraftSellRate" type="number" value={newAircraftSellRate} onChange={(e) => setNewAircraftSellRate(e.target.value)} placeholder="e.g., 5500" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddOrUpdateAircraftRate} size="sm" disabled={isSavingAircraftRate}>
                        {isSavingAircraftRate ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        {editingAircraftId ? 'Update Rate' : 'Save New Rate'}
                    </Button>
                    <Button variant="outline" onClick={handleCancelEditAircraft} size="sm" disabled={isSavingAircraftRate}>
                        <XCircle className="mr-2 h-4 w-4"/>Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            )}
            {isLoadingAircraftRates ? (
                 <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Loading aircraft rates...</p>
                </div>
            ) : (
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Aircraft ID / Name</TableHead>
                    <TableHead className="text-right">Buy Rate (/hr)</TableHead>
                    <TableHead className="text-right">Sell Rate (/hr)</TableHead>
                    <TableHead className="text-right">Default Margin</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {aircraftRates.length === 0 && !isLoadingAircraftRates && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-4">No aircraft rates configured yet.</TableCell>
                        </TableRow>
                    )}
                    {aircraftRates.map((rate) => {
                    const margin = rate.sell - rate.buy;
                    const marginPercent = rate.buy > 0 ? (margin / rate.buy) * 100 : 0;
                    return (
                        <TableRow key={rate.id}>
                        <TableCell className="font-medium">{rate.id.replace('DEFAULT_AIRCRAFT_RATES', 'Default Fallback Rates')}</TableCell>
                        <TableCell className="text-right">{formatCurrency(rate.buy)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(rate.sell)}</TableCell>
                        <TableCell className="text-right">
                            {formatCurrency(margin)} ({marginPercent.toFixed(1)}%)
                        </TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleEditAircraftClick(rate)} className="mr-1 hover:text-primary" disabled={isSavingAircraftRate || isDeletingAircraftRate}>
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit {rate.id}</span>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteAircraftRate(rate.id)} className="text-destructive hover:text-destructive" disabled={isSavingAircraftRate || isDeletingAircraftRate}>
                            {isDeletingAircraftRate && editingAircraftId === rate.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                            <span className="sr-only">Delete {rate.id}</span>
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
                    <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5 text-primary"/> Standard Service & Fee Rates</CardTitle>
                    <CardDescription>Default buy and sell rates for various services and fees. (Client-side only for this demo)</CardDescription>
                </div>
                {!showAddServiceForm && (
                  <Button variant="outline" size="sm" onClick={() => { setEditingServiceKey(null); setShowAddServiceForm(true); setNewServiceKey(''); setNewServiceDisplayDescription(''); setNewServiceUnit(''); setNewServiceBuyRate(''); setNewServiceSellRate(''); }}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Service/Fee
                  </Button>
                )}
            </div>
          </CardHeader>
          <CardContent>
            {showAddServiceForm && (
                 <Card className="p-4 mb-4 bg-muted/50 border-dashed">
                    <CardTitle className="text-lg mb-2">
                      {editingServiceKey ? `Edit Service/Fee: ${editingServiceKey}` : 'Add New Service/Fee'}
                    </CardTitle>
                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="newServiceKey">Unique Key (ALL_CAPS_SNAKE_CASE)</Label>
                            <Input id="newServiceKey" value={newServiceKey} onChange={(e) => setNewServiceKey(e.target.value)} placeholder="e.g., INTERNATIONAL_HANDLING_FEE" disabled={!!editingServiceKey}/>
                        </div>
                        <div>
                            <Label htmlFor="newServiceDisplayDescription">Display Description</Label>
                            <Input id="newServiceDisplayDescription" value={newServiceDisplayDescription} onChange={(e) => setNewServiceDisplayDescription(e.target.value)} placeholder="e.g., International Handling Fee" />
                        </div>
                        <div>
                            <Label htmlFor="newServiceUnit">Unit Description</Label>
                            <Input id="newServiceUnit" value={newServiceUnit} onChange={(e) => setNewServiceUnit(e.target.value)} placeholder="e.g., Per Trip, Per Leg, Per Day" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="newServiceBuyRate">Buy Rate</Label>
                                <Input id="newServiceBuyRate" type="number" value={newServiceBuyRate} onChange={(e) => setNewServiceBuyRate(e.target.value)} placeholder="e.g., 200" />
                            </div>
                            <div>
                                <Label htmlFor="newServiceSellRate">Sell Rate</Label>
                                <Input id="newServiceSellRate" type="number" value={newServiceSellRate} onChange={(e) => setNewServiceSellRate(e.target.value)} placeholder="e.g., 250" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleAddOrUpdateServiceFee} size="sm">
                            <Save className="mr-2 h-4 w-4"/>{editingServiceKey ? 'Update Service/Fee' : 'Save New Service/Fee'}
                          </Button>
                          <Button variant="outline" onClick={handleCancelEditServiceFee} size="sm">
                              <XCircle className="mr-2 h-4 w-4"/>Cancel
                          </Button>
                        </div>
                    </div>
                 </Card>
            )}
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
                {Object.entries(otherCostRates).map(([key, rates]) => {
                  const margin = rates.sell - rates.buy;
                  const marginPercent = rates.buy > 0 && rates.buy !== 0 ? (margin / rates.buy) * 100 : 0;
                  return (
                    <TableRow key={key}>
                      <TableCell className="font-medium">{rates.displayDescription}</TableCell>
                      <TableCell>{rates.unitDescription}</TableCell>
                      <TableCell className="text-right">{formatCurrency(rates.buy)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(rates.sell)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(margin)} ({marginPercent.toFixed(1)}%)
                      </TableCell>
                       <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditServiceFeeClick(key)} className="mr-1 hover:text-primary">
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit {rates.displayDescription}</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteServiceFee(key)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                           <span className="sr-only">Delete {rates.displayDescription}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        <Card className="shadow-md border-primary/30">
            <CardHeader>
                <CardTitle>Backend Implementation Notes</CardTitle>
                <CardDescription>
                    Aircraft rates are now connected to backend flows (with Firestore placeholders). 
                    You will need to implement the Firestore read/write logic in <code>src/ai/flows/manage-aircraft-rates-flow.ts</code>.
                    Service & Fee rates are still client-side only for this demo.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>When editing aircraft rates, changing the "Aircraft ID / Name" is disabled if the new ID is different from the original, to prevent accidental key changes. To change an ID, delete and re-add.</li>
                    <li>For service fees, the "Unique Key" is not editable once created.</li>
                </ul>
            </CardContent>
        </Card>

      </div>
    </>
  );
}
