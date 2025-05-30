
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SlidersHorizontal, DollarSign, Edit, Percent } from 'lucide-react';

// For display purposes, we'll duplicate the rate structures here.
// In a real app, these would come from a database or configuration store.
const AIRCRAFT_RATES: { [key: string]: { buy: number; sell: number } } = {
  'N123AB - Cessna Citation CJ3': { buy: 2800, sell: 3200 },
  'N456CD - Bombardier Global 6000': { buy: 5800, sell: 6500 },
  'N789EF - Gulfstream G650ER': { buy: 7500, sell: 8500 },
  'Category: Light Jet': { buy: 2400, sell: 2800 },
  'Category: Midsize Jet': { buy: 4000, sell: 4500 },
  'Category: Heavy Jet': { buy: 7000, sell: 7500 },
  'DEFAULT_AIRCRAFT_RATES': { buy: 3500, sell: 4000 }, // Fallback
};

const OTHER_COST_RATES = {
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
  return (
    <>
      <PageHeader 
        title="Quote Configuration" 
        description="Manage default rates and costs for flight quotes."
        icon={SlidersHorizontal}
        actions={
          <Button disabled> {/* Edit functionality for later */}
            <Edit className="mr-2 h-4 w-4" /> Edit Rates
          </Button>
        }
      />

      <div className="space-y-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary"/> Aircraft Hourly Rates</CardTitle>
            <CardDescription>Default buy and sell rates per flight hour for different aircraft types.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aircraft Type / Category</TableHead>
                  <TableHead className="text-right">Buy Rate (/hr)</TableHead>
                  <TableHead className="text-right">Sell Rate (/hr)</TableHead>
                  <TableHead className="text-right">Default Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(AIRCRAFT_RATES).map(([aircraft, rates]) => {
                  const margin = rates.sell - rates.buy;
                  const marginPercent = rates.buy > 0 ? (margin / rates.buy) * 100 : 0;
                  return (
                    <TableRow key={aircraft}>
                      <TableCell className="font-medium">{aircraft.replace('DEFAULT_AIRCRAFT_RATES', 'Default Fallback Rates')}</TableCell>
                      <TableCell className="text-right">{formatCurrency(rates.buy)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(rates.sell)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(margin)} ({marginPercent.toFixed(1)}%)
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
            <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5 text-primary"/> Standard Service & Fee Rates</CardTitle>
            <CardDescription>Default buy and sell rates for various services and fees.</CardDescription>
          </CardHeader>
          <CardContent>
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service / Fee Description</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Default Buy Rate</TableHead>
                  <TableHead className="text-right">Default Sell Rate</TableHead>
                  <TableHead className="text-right">Default Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(OTHER_COST_RATES).map(([key, rates]) => {
                  const margin = rates.sell - rates.buy;
                  const marginPercent = rates.buy > 0 ? (margin / rates.buy) * 100 : 0;
                  const description = key
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize each word
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
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        <Card className="shadow-md border-primary/30">
            <CardHeader>
                <CardTitle>Future Enhancements</CardTitle>
                <CardDescription>Items to be implemented for full quote configuration.</CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Ability to edit and save these rates.</li>
                    <li>Define different rate cards or client-specific pricing.</li>
                    <li>Tax calculation rules (e.g., FET).</li>
                    <li>Minimum flight time charges per aircraft.</li>
                    <li>Volume discounts or block hour rates.</li>
                </ul>
            </CardContent>
        </Card>

      </div>
    </>
  );
}
