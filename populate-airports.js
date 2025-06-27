"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var csv_parser_1 = require("csv-parser");
var app_1 = require("firebase-admin/app");
var firestore_1 = require("firebase-admin/firestore");
// Adjust the path to go up from where the script is run (e.g., from the root)
var serviceAccountKey_json_1 = require("./serviceAccountKey.json");
var BATCH_SIZE = 500; // Firestore limit per batch
function populateAirports() {
    return __awaiter(this, void 0, void 0, function () {
        var serviceAccount, db, airportsCollection, csvFilePath, records;
        var _this = this;
        return __generator(this, function (_a) {
            console.log("Initializing Firebase Admin SDK...");
            serviceAccount = serviceAccountKey_json_1.default;
            (0, app_1.initializeApp)({
                credential: (0, app_1.cert)(serviceAccount)
            });
            db = (0, firestore_1.getFirestore)();
            airportsCollection = db.collection('airports');
            console.log("Firebase Admin SDK initialized.");
            csvFilePath = path.join(__dirname, 'world-airports.csv');
            console.log("Looking for CSV file at: ".concat(csvFilePath));
            if (!fs.existsSync(csvFilePath)) {
                console.error("Error: CSV file not found at ".concat(csvFilePath));
                return [2 /*return*/];
            }
            records = [];
            console.log("Starting to parse CSV file...");
            fs.createReadStream(csvFilePath)
                .pipe((0, csv_parser_1.default)())
                .on('data', function (row) {
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
                .on('end', function () { return __awaiter(_this, void 0, void 0, function () {
                var batch, commitCount, i, record, docRef;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            console.log("CSV file successfully parsed. Found ".concat(records.length, " medium/large airports with ICAO codes."));
                            batch = db.batch();
                            commitCount = 0;
                            console.log("Starting to batch write to Firestore...");
                            i = 0;
                            _a.label = 1;
                        case 1:
                            if (!(i < records.length)) return [3 /*break*/, 4];
                            record = records[i];
                            docRef = airportsCollection.doc(record.icao_code);
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
                            if (!((i + 1) % BATCH_SIZE === 0)) return [3 /*break*/, 3];
                            return [4 /*yield*/, batch.commit()];
                        case 2:
                            _a.sent();
                            commitCount++;
                            console.log("Committed batch #".concat(commitCount));
                            // Start a new batch
                            batch = db.batch();
                            _a.label = 3;
                        case 3:
                            i++;
                            return [3 /*break*/, 1];
                        case 4:
                            if (!((records.length % BATCH_SIZE) !== 0)) return [3 /*break*/, 6];
                            return [4 /*yield*/, batch.commit()];
                        case 5:
                            _a.sent();
                            commitCount++;
                            console.log("Committed final batch #".concat(commitCount));
                            _a.label = 6;
                        case 6:
                            console.log("\n\uD83C\uDF89 Successfully populated Firestore with ".concat(records.length, " airport records."));
                            console.log("Database population complete.");
                            return [2 /*return*/];
                    }
                });
            }); })
                .on('error', function (error) {
                console.error('Error parsing CSV file:', error);
            });
            return [2 /*return*/];
        });
    });
}
populateAirports().catch(console.error);
