
// src/services/mockFboService.ts

import type { Fbo } from '@/ai/tools/get-fbos-tool';

// ABSOLUTELY SIMPLIFIED MOCK
const ultraSimpleFbo: Fbo = {
  id: 'ULTRA-SIMPLE-FBO',
  name: 'Ultra Simple Test FBO',
  airportCode: 'ANY', // This will be updated
  contactPhone: '123-456-7890',
  fuelTypes: ['Jet A', '100LL'],
  services: ['Fueling', 'Parking', 'Coffee'],
  fees: [{ type: 'Ramp Fee', amount: 100, notes: "Waived with fuel" }],
};

export async function getFbosByAirportCode(airportCode: string): Promise<Fbo[]> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 20));
  const upperAirportCode = airportCode.toUpperCase();
  
  console.log(`[MockFboService ULTRA-SIMPLIFIED] Request for FBOs at: ${upperAirportCode}.`);
  
  const result: Fbo[] = [{ 
    ...ultraSimpleFbo, 
    airportCode: upperAirportCode, 
    id: `${upperAirportCode}-UltraSimple` 
  }];
  
  console.log(`[MockFboService ULTRA-SIMPLIFIED] RETURNING: ${JSON.stringify(result)}`);
  return result;
}
