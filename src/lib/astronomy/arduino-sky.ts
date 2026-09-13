import data from './data/arduino-sky.json';
import type { ArduinoSkyCatalogue } from '../../types/sky';

// Compile-time schema check. Import this adapter rather than parsing C++ in the UI.
// Not connected to PlanetScene until destination-distance enrichment is implemented.
export const arduinoSky: ArduinoSkyCatalogue = data;
