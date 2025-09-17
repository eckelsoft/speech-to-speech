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
// Der Audio-Ordner liegt eine Ebene über dem Skript-Verzeichnis
const ttsAudioPath = path.join(__dirname, '..', 'tts_audio');

if (!fs.existsSync(ttsAudioPath)) {
    fs.mkdirSync(ttsAudioPath);
}

app.use(express.static(publicPath));
app.use('/tts_audio', express.static(ttsAudioPath));

function broadcastQueueUpdate() {
    fs.readdir(ttsAudioPath, (err, files) => {
        if (err) {
            console.error("Fehler beim Lesen des Audio-Verzeichnisses:", err);
            return;
        }
        const mp3Files = files.filter(file => file.endsWith('.mp3'));
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'queue_update', files: mp3Files }));
            }
        });
    });
}

wss.on('connection', (ws) => {
    console.log('Ein neuer Client hat sich verbunden.');
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
    console.log(`Neue, stabile Datei erkannt: ${path.basename(filePath)}`);
    broadcastQueueUpdate();
});

app.delete('/delete_audio/:filename', (req, res) => {
    const filename = req.params.filename;
    if (filename.includes('..')) {
        return res.status(400).send('Ungültiger Dateiname.');
    }
    const filePath = path.join(ttsAudioPath, filename);
    fs.unlink(filePath, (err) => {
        if (err) {
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