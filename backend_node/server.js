const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const publicPath = path.join(__dirname, 'public');
const ttsAudioPath = path.join(__dirname, '..', 'tts_audio');

if (!fs.existsSync(ttsAudioPath)) {
    fs.mkdirSync(ttsAudioPath, { recursive: true });
}

// --- MIDDLEWARE ---
app.use(express.static(publicPath));
app.use('/tts_audio', express.static(ttsAudioPath));


// --- WEBSOCKET LOGIC ---
// Sendet die aktualisierte Liste der Audiodateien an alle verbundenen Clients.
function broadcastQueueUpdate() {
    fs.readdir(ttsAudioPath, (err, files) => {
        if (err) {
            console.error("Fehler beim Lesen des Audio-Verzeichnisses:", err);
            return;
        }
        const mp3Files = files.filter(file => file.endsWith('.mp3') && !file.startsWith('.'));
        const message = JSON.stringify({ type: 'queue_update', files: mp3Files });
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
}

// Event-Handler für neue WebSocket-Verbindungen
wss.on('connection', (ws) => {
    console.log('Ein neuer Client hat sich verbunden.');
    // Dem neuen Client sofort die aktuelle Warteschlange senden
    broadcastQueueUpdate();
    ws.on('close', () => {
        console.log('Ein Client hat die Verbindung getrennt.');
    });
});

const watcher = chokidar.watch(ttsAudioPath, {
    ignored: /^\./,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
    }
});

watcher.on('add', (filePath) => {
    console.log(`Neue Datei erkannt: ${path.basename(filePath)}`);
    broadcastQueueUpdate();
});

app.delete('/delete_audio/:filename', (req, res) => {
    const filename = req.params.filename;

    // --- SICHERHEITSVERBESSERUNG ---
    // Verhindert Path Traversal Angriffe (z.B. ../../andere_datei.txt)
    const safeFilename = path.normalize(filename).replace(/^(\.\.(\/|\\|$))+/, '');
    const fileToDelete = path.join(ttsAudioPath, safeFilename);

    if (!path.resolve(fileToDelete).startsWith(path.resolve(ttsAudioPath))) {
        return res.status(403).send('Zugriff verweigert: Ungültiger Pfad.');
    }
    
    fs.unlink(fileToDelete, (err) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.log(`Datei nicht gefunden, konnte nicht gelöscht werden: ${filename}`);
                return res.status(404).send('Datei nicht gefunden.');
            }
            console.error(`Fehler beim Löschen der Datei ${filename}:`, err);
            return res.status(500).send('Fehler beim Löschen der Datei.');
        }
        console.log(`Datei erfolgreich gelöscht: ${filename}`);
        res.status(200).send('Datei erfolgreich gelöscht.');
    });
});


const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Node.js Server läuft auf http://localhost:${PORT}`);
});