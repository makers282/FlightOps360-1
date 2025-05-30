
"use client";

import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SlidersHorizontal, DollarSign, Edit, Percent, PlusCircle, Trash2, Save, XCircle } from 'lucide-react';

// Initial data (will be moved to state)
const INITIAL_AIRCRAFT_RATES_DATA: { [key: string]: { buy: number; sell: number } } = {
  'N123AB - Cessna Citation CJ3': { buy: 2800, sell: 3200 },
  'N456CD - Bombardier Global 6000': { buy: 5800, sell: 6500 },
  'N789EF - Gulfstream G650ER': { buy: 7500, sell: 8500 },
  'Category: Light Jet': { buy: 2400, sell: 2800 },
  'Category: Midsize Jet': { buy: 4000, sell: 4500 },
  'Category: Heavy Jet': { buy: 7000, sell: 7500 },
  'DEFAULT_AIRCRAFT_RATES': { buy: 3500, sell: 4000 },
};

const INITIAL_OTHER_COST_RATES_DATA: { [key: string]: { buy: number; sell: number; unitDescription: string } } = {
  FUEL_SURCHARGE_PER_BLOCK_HOUR: { buy: 300, sell: 400, unitDescription: "Per Block Hour" },
  LANDING_FEE_PER_LEG: { buy: 400, sell: 500, unitDescription: "Per Leg" },
  OVERNIGHT_FEE_PER_NIGHT: { buy: 1000, sell: 1300, unitDescription: "Per Night"},
  MEDICS_FEE_FLAT: { buy: 1800, sell: 2500, unitDescription: "Per Service" }, 
  CATERING_FEE_FLAT: { buy: 350, sell: 500, unitDescription: "Per Service" },
};

const formatCurrency = (amount: number) => {
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
};

export default function QuoteConfigPage() {
  const [aircraftRates, setAircraftRates] = useState<{ [key: string]: { buy: number; sell: number } }>(INITIAL_AIRCRAFT_RATES_DATA);
  const [otherCostRates, setOtherCostRates] = useState<{ [key: string]: { buy: number; sell: number; unitDescription: string } }>(INITIAL_OTHER_COST_RATES_DATA);

  const [showAddAircraftForm, setShowAddAircraftForm] = useState(false);
  const [newAircraftName, setNewAircraftName] = useState('');
  const [newAircraftBuyRate, setNewAircraftBuyRate] = useState('');
  const [newAircraftSellRate, setNewAircraftSellRate] = useState('');
  const [editingAircraftKey, setEditingAircraftKey] = useState<string | null>(null);


  const [showAddServiceForm, setShowAddServiceForm] = useState(false);
  const [newServiceKey, setNewServiceKey] = useState('');
  const [newServiceDescription, setNewServiceDescription] = useState(''); // Not used for key, but good for display name if we enhance
  const [newServiceUnit, setNewServiceUnit] = useState('');
  const [newServiceBuyRate, setNewServiceBuyRate] = useState('');
  const [newServiceSellRate, setNewServiceSellRate] = useState('');


  const handleEditAircraftClick = (key: string) => {
    const aircraftToEdit = aircraftRates[key];
    if (aircraftToEdit) {
      setEditingAircraftKey(key);
      setNewAircraftName(key); // Or a more display-friendly name if key isn't the name
      setNewAircraftBuyRate(String(aircraftToEdit.buy));
      setNewAircraftSellRate(String(aircraftToEdit.sell));
      setShowAddAircraftForm(true);
    }
  };

  const handleAddOrUpdateAircraftRate = () => {
    if (!newAircraftName || !newAircraftBuyRate || !newAircraftSellRate) {
      alert("Please fill in all fields for the aircraft rate.");
      return;
    }
    const buyRateNum = parseFloat(newAircraftBuyRate);
    const sellRateNum = parseFloat(newAircraftSellRate);
    if (isNaN(buyRateNum) || isNaN(sellRateNum)) {
        alert("Buy and Sell rates must be valid numbers.");
        return;
    }

    if (editingAircraftKey) { // Editing existing aircraft
      setAircraftRates(prev => {
        const updated = { ...prev };
        // If name (key) was changed, delete old key and add new one
        if (newAircraftName !== editingAircraftKey) {
          delete updated[editingAircraftKey];
        }
        updated[newAircraftName] = { buy: buyRateNum, sell: sellRateNum };
        return updated;
      });
      setEditingAircraftKey(null);
    } else { // Adding new aircraft
      setAircraftRates(prev => ({
        ...prev,
        [newAircraftName]: { buy: buyRateNum, sell: sellRateNum }
      }));
    }

    setNewAircraftName('');
    setNewAircraftBuyRate('');
    setNewAircraftSellRate('');
    setShowAddAircraftForm(false);
  };
  
  const handleCancelEditAircraft = () => {
    setEditingAircraftKey(null);
    setNewAircraftName('');
    setNewAircraftBuyRate('');
    setNewAircraftSellRate('');
    setShowAddAircraftForm(false);
  };


  const handleDeleteAircraftRate = (key: string) => {
    setAircraftRates(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    if (editingAircraftKey === key) { // If deleting the one being edited
      handleCancelEditAircraft();
    }
  };

  const handleAddServiceFee = () => {
    const key = newServiceKey.toUpperCase().replace(/\s+/g, '_');
    if (!key || !newServiceDescription || !newServiceUnit || !newServiceBuyRate || !newServiceSellRate) {
        alert("Please fill in all fields for the new service/fee.");
        return;
    }
    const buyRateNum = parseFloat(newServiceBuyRate);
    const sellRateNum = parseFloat(newServiceSellRate);
     if (isNaN(buyRateNum) || isNaN(sellRateNum)) {
        alert("Buy and Sell rates must be valid numbers.");
        return;
    }

    setOtherCostRates(prev => ({
        ...prev,
        [key]: { buy: buyRateNum, sell: sellRateNum, unitDescription: newServiceUnit }
    }));
    setNewServiceKey('');
    setNewServiceDescription('');
    setNewServiceUnit('');
    setNewServiceBuyRate('');
    setNewServiceSellRate('');
    setShowAddServiceForm(false);
  };

  const handleDeleteServiceFee = (key: string) => {
    setOtherCostRates(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  return (
    <>
      <PageHeader 
        title="Quote Configuration" 
        description="Manage default rates and costs for flight quotes. Changes are client-side only for this demo."
        icon={SlidersHorizontal}
      />

      <div className="space-y-6">
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary"/> Aircraft Hourly Rates</CardTitle>
                    <CardDescription>Default buy and sell rates per flight hour.</CardDescription>
                </div>
                {!showAddAircraftForm && (
                    <Button variant="outline" size="sm" onClick={() => { setEditingAircraftKey(null); setShowAddAircraftForm(true); setNewAircraftName(''); setNewAircraftBuyRate(''); setNewAircraftSellRate(''); }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Aircraft Rate
                    </Button>
                )}
            </div>
          </CardHeader>
          <CardContent>
            {showAddAircraftForm && (
              <Card className="p-4 mb-4 bg-muted/50 border-dashed">
                <CardTitle className="text-lg mb-2">
                    {editingAircraftKey ? `Edit Aircraft Rate: ${editingAircraftKey}` : 'Add New Aircraft Rate'}
                </CardTitle>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="newAircraftName">Aircraft Type / Category Name</Label>
                    <Input id="newAircraftName" value={newAircraftName} onChange={(e) => setNewAircraftName(e.target.value)} placeholder="e.g., Category: Super Mid Jet" />
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
                    <Button onClick={handleAddOrUpdateAircraftRate} size="sm">
                        <Save className="mr-2 h-4 w-4"/>{editingAircraftKey ? 'Update Aircraft Rate' : 'Save New Aircraft'}
                    </Button>
                    <Button variant="outline" onClick={handleCancelEditAircraft} size="sm">
                        <XCircle className="mr-2 h-4 w-4"/>Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aircraft Type / Category</TableHead>
                  <TableHead className="text-right">Buy Rate (/hr)</TableHead>
                  <TableHead className="text-right">Sell Rate (/hr)</TableHead>
                  <TableHead className="text-right">Default Margin</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(aircraftRates).map(([aircraftKey, rates]) => {
                  const margin = rates.sell - rates.buy;
                  const marginPercent = rates.buy > 0 && rates.buy !== 0 ? (margin / rates.buy) * 100 : 0;
                  return (
                    <TableRow key={aircraftKey}>
                      <TableCell className="font-medium">{aircraftKey.replace('DEFAULT_AIRCRAFT_RATES', 'Default Fallback Rates')}</TableCell>
                      <TableCell className="text-right">{formatCurrency(rates.buy)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(rates.sell)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(margin)} ({marginPercent.toFixed(1)}%)
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditAircraftClick(aircraftKey)} className="mr-1 hover:text-primary">
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit {aircraftKey}</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteAircraftRate(aircraftKey)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete {aircraftKey}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
             <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5 text-primary"/> Standard Service & Fee Rates</CardTitle>
                    <CardDescription>Default buy and sell rates for various services and fees.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowAddServiceForm(!showAddServiceForm)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> {showAddServiceForm ? 'Cancel Add' : 'Add Service/Fee'}
                </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showAddServiceForm && (
                 <Card className="p-4 mb-4 bg-muted/50 border-dashed">
                    <CardTitle className="text-lg mb-2">Add New Service/Fee</CardTitle>
                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="newServiceKey">Unique Key (ALL_CAPS_SNAKE_CASE)</Label>
                            <Input id="newServiceKey" value={newServiceKey} onChange={(e) => setNewServiceKey(e.target.value)} placeholder="e.g., INTERNATIONAL_HANDLING_FEE" />
                        </div>
                        <div>
                            <Label htmlFor="newServiceDescription">Display Description (for tables)</Label>
                            <Input id="newServiceDescription" value={newServiceDescription} onChange={(e) => setNewServiceDescription(e.target.value)} placeholder="e.g., International Handling Fee" />
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
                        <Button onClick={handleAddServiceFee} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Save New Service/Fee</Button>
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
                  const description = key
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase()) 
                    .replace('Per Block Hour', '(per Block Hour)')
                    .replace('Per Leg', '(per Leg)')
                    .replace('Per Night', '(per Night)')
                    .replace('Flat', '(Flat Rate)');
                  return (
                    <TableRow key={key}>
                      <TableCell className="font-medium">{description}</TableCell>
                      <TableCell>{rates.unitDescription}</TableCell>
                      <TableCell className="text-right">{formatCurrency(rates.buy)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(rates.sell)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(margin)} ({marginPercent.toFixed(1)}%)
                      </TableCell>
                       <TableCell className="text-right">
                        {/* Edit button for services can be added here later if needed */}
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteServiceFee(key)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                           <span className="sr-only">Delete {description}</span>
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
                <CardTitle>Notes</CardTitle>
                <CardDescription>These configurations are currently client-side only and will reset on page refresh. Full persistence would require backend integration.</CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Editing of service/fee rates is not yet implemented.</li>
                    <li>No robust input validation is performed on the "add new" forms beyond basic checks.</li>
                    <li>The unique key for services/fees must be in ALL_CAPS_SNAKE_CASE format for consistency.</li>
                </ul>
            </CardContent>
        </Card>

      </div>
    </>
  );
}
