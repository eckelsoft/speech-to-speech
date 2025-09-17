#!/bin/bash

# Beendet das Skript sofort, wenn ein Befehl fehlschlägt
set -e

# WICHTIG: Ändere den Host für den Python-Server auf 0.0.0.0
echo "Starting Python TTS Server on 0.0.0.0:5000..."
# Starte den Python-Server im Hintergrund (mit &)
source venv/bin/activate && waitress-serve --host 0.0.0.0 --port=5000 tts_server:app &

# Starte den Node.js-Server im Vordergrund
# Dieser Befehl hält den Container am Laufen
echo "Starting Node.js Web Server on 0.0.0.0:8080..."
node server.js