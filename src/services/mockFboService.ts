
// src/services/mockFboService.ts

import type { Fbo } from '@/ai/tools/get-fbos-tool';

// Simplified: Always return this list for any airport code for testing
const alwaysReturnFbos: Fbo[] = [
  {
    id: 'GENERIC-FBO-1',
    name: 'Test FBO One',
    airportCode: 'ANY', // Placeholder, not used for filtering in this simplified version
    contactPhone: '555-1234',
    fuelTypes: ['Jet A'],
    services: ['Fueling', 'Parking'],
    fees: [{ type: 'Parking', amount: 50 }],
  },
  {
    id: 'GENERIC-FBO-2',
    name: 'Test FBO Two',
    airportCode: 'ANY',
    contactPhone: '555-5678',
    fuelTypes: ['Jet A', '100LL'],
    services: ['Handling', 'Catering'],
    fees: [{ type: 'Handling', amount: 200 }],
  },
];

export async function getFbosByAirportCode(airportCode: string): Promise<Fbo[]> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 50));

  const upperAirportCode = airportCode.toUpperCase();
  console.log(`[MockFboService SIMPLIFIED] Request for FBOs at: ${upperAirportCode}. Returning fixed list.`);
  
  // In this simplified version, always return the test list
  return alwaysReturnFbos.map(fbo => ({ ...fbo, airportCode: upperAirportCode, id: `${upperAirportCode}-${fbo.name.replace(/\s+/g, '')}` }));
}

// Keep genericFboBase for potential future use if needed, but it's not used by the simplified getFbosByAirportCode above.
// const genericFboBase: Omit<Fbo, 'id' | 'airportCode' | 'name'> = {
//   contactPhone: 'N/A',
//   fuelTypes: ['Jet A', 'Avgas 100LL'],
//   services: ['Basic Handling', 'Fueling'],
//   fees: [{ type: 'Standard Handling', amount: 200, notes: "Estimated fee"}],
// };
