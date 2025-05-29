
// src/app/(app)/quotes/new/components/costs-summary-display.tsx
"use client";

import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, ListChecks, DollarSign, Percent } from "lucide-react";

export interface LineItem {
  id: string;
  description: string;
  buyRate: number;
  sellRate: number;
  unitDescription: string;
  quantity: number;
  buyTotal: number;
  sellTotal: number;
}

interface CostsSummaryDisplayProps {
  lineItems: LineItem[];
}

export function CostsSummaryDisplay({ lineItems }: CostsSummaryDisplayProps) {
  const totalBuyCost = lineItems.reduce((sum, item) => sum + item.buyTotal, 0);
  const totalSellPrice = lineItems.reduce((sum, item) => sum + item.sellTotal, 0);
  const marginAmount = totalSellPrice - totalBuyCost;
  const marginPercentage = totalBuyCost > 0 ? (marginAmount / totalBuyCost) * 100 : 0;

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
  };

  return (
    <Card className="shadow-md border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" /> Costs Breakdown</CardTitle>
          <CardDescription>Review the detailed buy and sell prices for the quote.</CardDescription>
        </div>
        <Button variant="outline" size="sm" disabled> {/* Edit Costs functionality for later */}
          <Edit className="mr-2 h-4 w-4" /> Edit Costs
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Description</TableHead>
              <TableHead className="text-right">Buy Rate</TableHead>
              <TableHead className="text-right">Sell Rate</TableHead>
              <TableHead className="text-center">Quantity</TableHead>
              <TableHead className="text-right">Buy Total</TableHead>
              <TableHead className="text-right">Sell Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                  No cost items calculated yet. Fill in leg details and select options.
                </TableCell>
              </TableRow>
            )}
            {lineItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.description}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.buyRate)}
                  <span className="text-xs text-muted-foreground ml-1">/{item.unitDescription}</span>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.sellRate)}
                   <span className="text-xs text-muted-foreground ml-1">/{item.unitDescription}</span>
                </TableCell>
                <TableCell className="text-center">{item.quantity.toFixed(2)}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.buyTotal)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(item.sellTotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {lineItems.length > 0 && (
            <TableFooter className="bg-muted/50">
              <TableRow>
                <TableCell colSpan={4} className="text-right font-semibold text-muted-foreground">Subtotal Cost (Buy):</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totalBuyCost)}</TableCell>
                <TableCell className="text-right font-bold text-lg text-primary">{formatCurrency(totalSellPrice)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={5} className="text-right font-semibold text-muted-foreground">Margin:</TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(marginAmount)} 
                  <span className={`ml-1 ${marginAmount >=0 ? 'text-green-600' : 'text-red-600'}`}>
                    ({marginAmount >=0 ? '+' : ''}{marginPercentage.toFixed(1)}%)
                  </span>
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
        <div className="mt-6 text-right p-4 bg-primary/10 rounded-lg">
            <p className="text-sm text-muted-foreground">Total Client Price (Sell Total):</p>
            <p className="text-3xl font-bold text-primary flex items-center justify-end gap-1">
                <DollarSign className="h-7 w-7" /> {totalSellPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
        </div>
      </CardContent>
    </Card>
  );
}

