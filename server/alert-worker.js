import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './config/database.js';
import { pollPersonalAlerts } from './services/personalAlerts.js';
import { createAlertWorkerRuntime, createAlertWorkerServer } from './services/alertWorkerRuntime.js';

const runtime = createAlertWorkerRuntime({
    connect: connectDB,
    poll: () => pollPersonalAlerts(null),
    connected: () => mongoose.connection.readyState === 1,
    onError: () => console.warn('Personal alert worker check deferred; retrying next minute.'),
});
const server = createAlertWorkerServer(runtime);
server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () => {
    console.log('Personal alert worker started. Health endpoints are available.');
    runtime.start();
});
let stopping = false;
async function stop() {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 25000);
    deadline.unref();
    await runtime.stop();
    await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    clearTimeout(deadline);
}
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
