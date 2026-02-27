import { searchIsraeliSecurities } from './server/services/israeliSecuritiesService.js';

try {
    const res = searchIsraeliSecurities("מיטב");
    console.log("Success:", res.length, "results");
} catch (e) {
    console.error("Error:", e);
}
