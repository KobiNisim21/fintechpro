
import app from '../server/app.js';
import { dbConnection } from '../server/app.js';

console.log('Attempting to import app.js...');

try {
    console.log('App imported successfully');
    if (app) {
        console.log('App is defined');
    }
    console.log('Waiting for DB connection (simulated)...');
    // We won't actually wait for DB connection to avoid hanging, just checking if code loads
    console.log('Test complete: No syntax errors found during import.');
    process.exit(0);
} catch (error) {
    console.error('CRITICAL ERROR:', error);
    process.exit(1);
}
