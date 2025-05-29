
// src/services/mockFboService.ts

import type { Fbo } from '@/ai/tools/get-fbos-tool';

const sampleFboData: Fbo[] = [
  // KJFK FBOs
  {
    id: 'KJFK-FBO1',
    name: 'Sheltair JFK',
    airportCode: 'KJFK',
    contactPhone: '718-995-9176',
    fuelTypes: ['Jet A', 'Avgas 100LL'],
    services: ['Handling', 'De-icing', 'Catering', 'Hangar', 'Customs'],
    fees: [
      { type: 'Ramp Fee', amount: 150, notes: 'Waived with fuel purchase' },
      { type: 'Parking Fee (Daily)', amount: 75 },
      { type: 'Handling Fee', amount: 300 },
    ],
  },
  {
    id: 'KJFK-FBO2',
    name: 'Modern Aviation JFK',
    airportCode: 'KJFK',
    contactPhone: '718-553-8500',
    fuelTypes: ['Jet A'],
    services: ['Ground Handling', 'Fueling', 'Lavatory Service', 'GPU'],
    fees: [
      { type: 'Facility Fee', amount: 200 },
      { type: 'Overnight Parking', amount: 100 },
    ],
  },
  // KLAX FBOs
  {
    id: 'KLAX-FBO1',
    name: 'Atlantic Aviation LAX',
    airportCode: 'KLAX',
    contactPhone: '310-646-9500',
    fuelTypes: ['Jet A', 'Avgas 100LL', 'Sustainable Aviation Fuel (SAF)'],
    services: ['Full Service FBO', 'Customs', 'Gourmet Catering', 'Rental Cars'],
    fees: [
      { type: 'Ramp Fee', amount: 180 },
      { type: 'International Handling', amount: 500 },
    ],
  },
  {
    id: 'KLAX-FBO2',
    name: 'Signature Flight Support LAX',
    airportCode: 'KLAX',
    contactPhone: '310-646-6100',
    fuelTypes: ['Jet A', 'SAF'],
    services: ['Executive Terminal', 'Pilot Lounge', 'Conference Rooms', 'Aircraft Detailing'],
    fees: [
      { type: 'Facility Fee', amount: 250 },
      { type: 'Parking (Per Night)', amount: 90 },
    ],
  },
  // KMIA FBOs
  {
    id: 'KMIA-FBO1',
    name: 'Signature Flight Support MIA',
    airportCode: 'KMIA',
    contactPhone: '305-871-3200',
    fuelTypes: ['Jet A'],
    services: ['24/7 Operations', 'Customs On-Site', 'VIP Lounges', 'Secured Parking'],
    fees: [
      { type: 'Handling Fee (Light Jet)', amount: 250 },
      { type: 'Handling Fee (Heavy Jet)', amount: 600 },
      { type: 'Ramp Fee', amount: 100, notes: 'Waived with min fuel uplift' }
    ],
  },
  {
    id: 'KMIA-FBO2',
    name: 'Reliance Aviation MIA',
    airportCode: 'KMIA',
    contactPhone: '305-869-3500',
    fuelTypes: ['Jet A', 'Avgas 100LL'],
    services: ['Aircraft Maintenance (Part 145)', 'Avionics', 'Fueling', 'Passenger Lobby'],
    fees: [
       { type: 'Facility Usage', amount: 175 },
       { type: 'Overnight Parking', amount: 80 },
    ],
  },
  // KTEB FBOs
  {
    id: 'KTEB-FBO1',
    name: 'Meridian Teterboro',
    airportCode: 'KTEB',
    contactPhone: '201-288-5040',
    fuelTypes: ['Jet A', 'Avgas 100LL'],
    services: ['Award Winning FBO', 'Hangar', 'Customs', 'Catering', 'Maintenance'],
    fees: [
      { type: 'Handling Fee', amount: 350 },
      { type: 'Ramp Fee', amount: 150, notes: 'Often waived with fuel' },
    ],
  },
  {
    id: 'KTEB-FBO2',
    name: 'Jet Aviation Teterboro',
    airportCode: 'KTEB',
    contactPhone: '201-462-4000',
    fuelTypes: ['Jet A', 'SAF'],
    services: ['Global FBO Network', 'Maintenance', 'Completions', 'Staffing'],
    fees: [
      { type: 'Facility Fee', amount: 400 },
      { type: 'Parking (Daily)', amount: 120 },
    ],
  },
];

const genericFboBase: Omit<Fbo, 'id' | 'airportCode' | 'name'> = {
  contactPhone: 'N/A',
  fuelTypes: ['Jet A', 'Avgas 100LL'],
  services: ['Basic Handling', 'Fueling'],
  fees: [{ type: 'Standard Handling', amount: 200, notes: "Estimated fee"}],
};

export async function getFbosByAirportCode(airportCode: string): Promise<Fbo[]> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 50));

  const upperAirportCode = airportCode.toUpperCase();
  console.log(`[MockFboService DEBUG] Request for FBOs at: ${upperAirportCode}`);

  const specificFbos = sampleFboData.filter(fbo => fbo.airportCode === upperAirportCode);

  console.log(`[MockFboService DEBUG] Filtered specific FBOs for ${upperAirportCode}:`, JSON.stringify(specificFbos));

  if (specificFbos.length > 0) {
    console.log(`[MockFboService DEBUG] Returning ${specificFbos.length} specific FBOs for ${upperAirportCode}.`);
    return specificFbos;
  } else {
    console.log(`[MockFboService DEBUG] No specific FBOs found for ${upperAirportCode}, returning generic FBO.`);
    // Always return at least one generic FBO if no specifics are found
    return [
      {
        ...genericFboBase,
        id: `${upperAirportCode}-GENERIC-FBO`,
        name: `Generic FBO at ${upperAirportCode}`, // Changed from "Other FBO" to be more specific
        airportCode: upperAirportCode,
      }
    ];
  }
}
