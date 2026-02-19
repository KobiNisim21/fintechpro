
console.log('Testing node-fetch import...');
import fetch from 'node-fetch';
console.log('Imported fetch');
try {
    console.log('fetch is:', typeof fetch);
} catch (e) {
    console.log('Error checking fetch:', e.message);
}
