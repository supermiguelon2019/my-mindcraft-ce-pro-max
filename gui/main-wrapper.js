
import process from 'node:process';

// Set process.send for IPC if not available
if (!process.send) {
    process.send = (message) => {
        console.log('IPC message:', message);
    };
}

// Import and run the main process
(async () => {
    await import('../main.js');
})().catch(err => {
    console.error('Error loading main process:', err);
});
