// src/services/mockFboService.ts
import type { Fbo } from '@/ai/tools/get-fbos-tool';

// ABSOLUTELY SIMPLIFIED MOCK for debugging
const ultraSimpleFboForDebug: Fbo = {
  id: 'ULTRA-SIMPLE-DEBUG-FBO',
  name: 'Ultra Simple Test FBO (from Service)',
  airportCode: 'ANY', // This will be updated
  contactPhone: '123-456-7890',
  fuelTypes: ['Jet A (Service)', '100LL (Service)'],
  services: ['Fueling (Service)', 'Parking (Service)', 'Coffee (Service)'],
  fees: [{ type: 'Ramp Fee (Service)', amount: 150, notes: "Waived with fuel (Service)" }],
};

export async function getFbosByAirportCode(airportCode: string): Promise<Fbo[]> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 10)); // Short delay
  const upperAirportCode = airportCode.toUpperCase();
  
  console.log(`[MockFboService DEBUG] Request for FBOs at: ${upperAirportCode}.`);
  
  const result: Fbo[] = [{ 
    ...ultraSimpleFboForDebug, 
    airportCode: upperAirportCode, 
    id: `${upperAirportCode}-UltraSimpleFromService` 
  }];
  
  console.log(`[MockFboService DEBUG] RETURNING FROM SERVICE: ${JSON.stringify(result)}`);
  return result;
}
