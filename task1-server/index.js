import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const app = express();
const port = 8080;

// Create an HTTP server using Express
const server = createServer(app);

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

// Create a WebSocket server and attach it to the HTTP server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('Client connected');

    const sendOrderUpdates = () => {
        let updateCount = 0;

        // Function to send updates
        const sendUpdates = (count, delay) => {
            setTimeout(() => {
                for (let i = 0; i < count; i++) {
                    const timestamp = new Date().toISOString();
                    const message = `Order update ${updateCount + 1} at ${timestamp}`;
                    console.log(`Sending: ${message}`);
                    ws.send(message);
                    updateCount++;
                }
            }, delay);
        };

        // Send the updates according to the specified intervals
        sendUpdates(10, 1000);  // First 10 updates in 1 second
        sendUpdates(20, 3000);  // Next 20 updates after 2 seconds
        sendUpdates(40, 6000);  // 40 updates after 3 seconds
        sendUpdates(30, 11000); // Final 30 updates after 5 seconds
    };

    // Event handler for incoming messages
    ws.on('message', (message) => {
        sendOrderUpdates();
        ws.send('complete');
    });

});
