#!/bin/bash
# Dieses Skript automatisiert den kompletten Prozess:
# 1. Stoppt und entfernt den alten Container (falls vorhanden)
# 2. Baut das neue Docker-Image mit den aktuellen Code-Änderungen
# 3. Startet einen neuen, sauberen Container

# Beendet das Skript, wenn ein Befehl fehlschlägt
set -e

CONTAINER_NAME="speech-app-container"
IMAGE_NAME="speech-app"

echo "➡️ Stoppe und entferne alten Container (falls vorhanden)..."
# '|| true' verhindert einen Fehler, wenn der Container beim ersten Mal nicht existiert
docker stop $CONTAINER_NAME || true
docker rm $CONTAINER_NAME || true

echo "➡️ Baue neues Image '$IMAGE_NAME'..."
docker build -t $IMAGE_NAME .

echo "🚀 Starte neuen Container '$CONTAINER_NAME'..."
# Wir verwenden --rm, damit der Container nach dem Stoppen automatisch entfernt wird
docker run --rm -d -p 8080:8080 -p 5000:5000 --name $CONTAINER_NAME $IMAGE_NAME

echo "✅ Fertig! Die Anwendung läuft."
echo "👀 Logs ansehen mit: docker logs -f $CONTAINER_NAME"