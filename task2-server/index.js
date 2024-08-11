import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { format, utcToZonedTime } from 'date-fns-tz';

const app = express();
const port = 8080;

// Create an HTTP server using Express
const server = createServer(app);

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

// Create a WebSocket server and attach it to the HTTP server
const wss = new WebSocketServer({ server });

// Helper function to get IST time
const getISTTime = (date) => {
    return format(utcToZonedTime(date, 'Asia/Kolkata'), "yyyy-MM-dd'T'HH:mm:ssXXX");
};

// Store recent updates to filter out duplicates
const recentUpdates = new Map();

// Store existing orders to determine if an order exists
const existingOrders = new Set();

// Function to determine the action based on order details
const determineAction = (order) => {
    const { priceType, status, AppOrderID } = order;
    if (status === 'cancelled' && ["LMT", "SL-LMT", "SL-MKT"].includes(priceType)) {
        return 'cancelOrder';
    } else if (["MKT", "LMT", "SL-LMT", "SL-MKT"].includes(priceType)) {
        if (status === 'complete' && !existingOrders.has(AppOrderID)) {
            return 'placeOrder';
        } else if (status === 'open' && existingOrders.has(AppOrderID)) {
            return 'modifyOrder';
        } else if (status === 'pending' && !existingOrders.has(AppOrderID)) {
            return 'placeOrder';
        } else if (status === 'pending' && existingOrders.has(AppOrderID)) {
            return 'modifyOrder';
        }
    }
    return 'unknownAction';
};

// Function to handle updates and log the actions
const handleUpdates = (updates) => {
    const timestamp = getISTTime(new Date());
    updates.forEach(update => {
        console.log(`Update sent to order book at ${timestamp}: ${update}`);
        // Send this update to your action handler
        // For example: actionHandler(update);
    });
};

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('Client connected');

    let updateBuffer = [];
    let lastUpdateTime = Date.now();

    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            const { AppOrderID, ...orderDetails } = parsedMessage;

            // Check if the update is a duplicate within 1 second
            if (recentUpdates.has(AppOrderID) && Date.now() - recentUpdates.get(AppOrderID) < 1000) {
                console.log(`Duplicate or redundant update ignored: ${message}`);
                return;
            }

            // Store the update with a timestamp
            recentUpdates.set(AppOrderID, Date.now());

            // Determine action based on order details
            const action = determineAction(parsedMessage);
            console.log(`Action determined: ${action}`);
            
            if (action !== 'unknownAction') {
                console.log(`For AppOrderID: ${AppOrderID} : ${action}`);
                
                if (action === 'placeOrder' || action === 'modifyOrder') {
                    existingOrders.add(AppOrderID);
                } else if (action === 'cancelOrder') {
                    existingOrders.delete(AppOrderID);
                }
            }

            // Buffer updates and aggregate if multiple updates are received within 1 second
            updateBuffer.push(message);

            if (Date.now() - lastUpdateTime > 1000) {
                if (updateBuffer.length > 0) {
                    handleUpdates(updateBuffer);
                    updateBuffer = [];
                }
                lastUpdateTime = Date.now();
            }
            
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error: ${error}`);
    });
});

// Start the HTTP server
server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
