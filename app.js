const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const easymidi = require('easymidi');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Log MIDI inputs and outputs for debugging
console.log('Available MIDI inputs:', easymidi.getInputs());
console.log('Available MIDI outputs:', easymidi.getOutputs());

const desiredDevice = 'loopMIDI Port'; // Forzar loopMIDI Port como salida
let midiOutput;

try {
    midiOutput = new easymidi.Output(desiredDevice);
    console.log('Using MIDI output device:', desiredDevice);
} catch (e) {
    console.error('Failed to initialize MIDI output device:', e.message);
    console.error('Ensure loopMIDI is running and "loopMIDI Port" is active.');
    process.exit(1);
}

// Serve static files (e.g., index.html)
app.use(express.static(__dirname));

// Root route
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// WebSocket connections
wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    ws.on('message', (message) => {
        console.log('Raw message received:', message);

        try {
            const data = JSON.parse(message);
            const { ccNumber, ccValue, value } = data;
            console.log('Parsed data:', { ccNumber, ccValue, value });

            if (ccNumber === 144) { // Note On
                sendMidiNoteOn(ccValue, value || 127);
            } else if (ccNumber === 128) { // Note Off
                sendMidiNoteOff(ccValue, value || 0);
            } else {
                console.log('Unsupported MIDI message:', ccNumber);
            }
        } catch (e) {
            console.error('Error parsing message:', e.message);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
});

// Send MIDI Note On
function sendMidiNoteOn(note, velocity) {
    if (midiOutput) {
        midiOutput.send('noteon', {
            note: note,
            velocity: velocity,
            channel: 0 // MIDI channel 1 (0-based)
        });
        console.log(`Sent Note On: note=${note}, velocity=${velocity} to ${desiredDevice}`);
    } else {
        console.log('No MIDI output available for Note On');
    }
}

// Send MIDI Note Off
function sendMidiNoteOff(note, velocity) {
    if (midiOutput) {
        midiOutput.send('noteoff', {
            note: note,
            velocity: velocity,
            channel: 0 // MIDI channel 1 (0-based)
        });
        console.log(`Sent Note Off: note=${note} to ${desiredDevice}`);
    } else {
        console.log('No MIDI output available for Note Off');
    }
}

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Node.js server listening on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down server...');
    if (midiOutput) midiOutput.close();
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});