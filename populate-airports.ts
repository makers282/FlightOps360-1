
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, WriteBatch } from 'firebase-admin/firestore';

// Adjust the path to go up from where the script is run (e.g., from the root)
import serviceAccountCredentials from './serviceAccountKey.json'; 

const BATCH_SIZE = 500; // Firestore limit per batch

interface AirportRecord {
  icao_code: string;
  name: string;
  latitude_deg: string;
  longitude_deg: string;
  elevation_ft: string;
  type: string;
  continent: string;
  iso_country: string;
  iso_region: string;
  municipality: string;
}

async function populateAirports() {
  console.log("Initializing Firebase Admin SDK...");
  
  // Cast the imported JSON to the ServiceAccount type
  const serviceAccount = serviceAccountCredentials as ServiceAccount;

  initializeApp({
    credential: cert(serviceAccount)
  });

  const db = getFirestore();
  const airportsCollection = db.collection('airports');
  console.log("Firebase Admin SDK initialized.");

  // Path to the CSV file in the root directory
  const csvFilePath = path.join(__dirname, 'world-airports.csv');
  console.log(`Looking for CSV file at: ${csvFilePath}`);

  if (!fs.existsSync(csvFilePath)) {
    console.error(`Error: CSV file not found at ${csvFilePath}`);
    return;
  }

  const records: AirportRecord[] = [];
  
  console.log("Starting to parse CSV file...");
  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (row: any) => {
      // Filter for medium and large airports that have an ICAO code
      if (row.icao_code && (row.type === 'medium_airport' || row.type === 'large_airport')) {
        records.push({
          icao_code: row.icao_code,
          name: row.name,
          latitude_deg: row.latitude_deg,
          longitude_deg: row.longitude_deg,
          elevation_ft: row.elevation_ft,
          type: row.type,
          continent: row.continent,
          iso_country: row.iso_country,
          iso_region: row.iso_region,
          municipality: row.municipality,
        });
      }
    })
    .on('end', async () => {
      console.log(`CSV file successfully parsed. Found ${records.length} medium/large airports with ICAO codes.`);
      
      let batch: WriteBatch = db.batch();
      let commitCount = 0;
      
      console.log("Starting to batch write to Firestore...");

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        // The document ID will be the ICAO code for easy lookup
        const docRef = airportsCollection.doc(record.icao_code);
        
        batch.set(docRef, {
          icao: record.icao_code,
          name: record.name,
          lat: parseFloat(record.latitude_deg),
          lon: parseFloat(record.longitude_deg),
          elevationFt: parseInt(record.elevation_ft, 10) || 0,
          type: record.type,
          continent: record.continent,
          country: record.iso_country,
          region: record.iso_region,
          city: record.municipality,
        });

        if ((i + 1) % BATCH_SIZE === 0) {
          await batch.commit();
          commitCount++;
          console.log(`Committed batch #${commitCount}`);
          // Start a new batch
          batch = db.batch();
        }
      }

      // Commit the final batch if it has any writes
      if ((records.length % BATCH_SIZE) !== 0) {
        await batch.commit();
        commitCount++;
        console.log(`Committed final batch #${commitCount}`);
      }

      console.log(`
🎉 Successfully populated Firestore with ${records.length} airport records.`);
      console.log("Database population complete.");
    })
    .on('error', (error) => {
      console.error('Error parsing CSV file:', error);
    });
}

populateAirports().catch(console.error);
