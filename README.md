# Echtzeit-Anwendung für Spracherkennung und TTS

Eine Webanwendung zur Echtzeit-Transkription und Text-to-Speech-Wandlung von gesprochener Sprache.

## Quick Start mit Docker (Empfohlen)

Der einfachste und schnellste Weg, die gesamte Anwendung zu starten, ohne Node.js oder Python lokal installieren zu müssen.

### Voraussetzungen
- [Docker](https://www.docker.com/products/docker-desktop/) muss installiert sein und laufen.

### Anleitung
1.  **Code herunterladen:**
    Laden Sie alle Projektdateien (`Dockerfile`, `start.sh`, `requirements.txt`, etc.) in einen Ordner herunter.

2.  **Docker Image bauen:**
    Öffnen Sie ein Terminal im Projektordner und führen Sie aus:
    ```bash
    docker build -t speech-app .
    ```

3.  **Docker Container starten:**
    ```bash
    docker run -p 8080:8080 -p 5000:5000 --name speech-app-container speech-app
    ```

4.  **Anwendung öffnen:**
    Öffnen Sie Ihren Browser und gehen Sie zu **`http://localhost:8080`**.

### Container verwalten
```bash
# Live-Logs beider Server anzeigen
docker logs -f speech-app-container

# Container stoppen
docker stop speech-app-container

# Container entfernen
docker rm speech-app-container
```

---

## Manuelle Installation (Für die Entwicklung)

Folgen Sie diesen Schritten, wenn Sie die Anwendung ohne Docker direkt auf Ihrem System ausführen und entwickeln möchten. (Empfohlene Umgebung: Ubuntu via WSL2)

### Voraussetzungen
- **Node.js** (v18.x oder neuer) und npm
- **Python** (v3.8 oder neuer) und pip

### 1. Python Backend einrichten
```bash
# In den Projektordner wechseln
cd speech-tts-app

# Virtuelle Umgebung erstellen und aktivieren
python3 -m venv venv
source venv/bin/activate

# Python-Abhängigkeiten installieren
pip install -r requirements.txt
```

### 2. Node.js Frontend einrichten
```bash
# Node.js-Abhängigkeiten im Projektordner installieren
npm install express ws chokidar
```

### 3. Anwendung starten
Sie benötigen zwei geöffnete Terminals im Projektverzeichnis.

**Terminal 1: Python TTS-Server**
```bash
# Virtuelle Umgebung aktivieren
source venv/bin/activate

# Server starten
waitress-serve --host 127.0.0.1 --port=5000 tts_server:app
```

**Terminal 2: Node.js Web-Server**
```bash
# Server starten
node server.js
```

### 4. Anwendung öffnen
Öffnen Sie Ihren Browser und gehen Sie zu **`http://localhost:8080`**.

---

## Features

- **Echtzeit-Spracherkennung:** Transkribiert gesprochene Sprache direkt im Browser.
- **Dynamische Texthistorie:** Zeigt eine Historie der final erkannten Textsegmente an und hebt vorläufigen Text farblich hervor.
- **Text-to-Speech (TTS):** Ein separater Python-Server generiert aus dem erkannten Text Audiodateien.
- **Intelligente Warteschlange:** Alle erstellten Audiodateien werden verwaltet, nacheinander abgespielt und anschließend automatisch gelöscht.
- **Erweiterte Steuerung:**
    - Pausieren und Fortsetzen der Wiedergabe-Warteschlange.
    - "Panik"-Knopf zum sofortigen Stoppen der aktuellen Wiedergabe.
    - Visuelles Feedback über den Aufnahme- und Wiedergabestatus.
- **Flexible Anpassung:**
    - Einstellbare Wiedergabegeschwindigkeit.
    - Auswahl der TTS-Sprache und des regionalen Akzents.
- **Smarte Interpunktion:** Sprachbefehle wie "Punkt", "Ausrufezeichen" oder "Fragezeichen" werden automatisch in Satzzeichen umgewandelt.

### Anwendung nach Code-Änderungen aktualisieren

Wenn Sie Änderungen am Quellcode vorgenommen haben (z.B. in \`app.js\` oder \`index.html\`), müssen Sie das Docker-Image neu bauen und den Container neu starten, damit Ihre Änderungen wirksam werden. Das mitgelieferte Skript \`rebuild_and_run.sh\` automatisiert diesen gesamten Prozess.

**Anleitung:**

1.  **Änderungen speichern:** Stellen Sie sicher, dass alle Ihre Code-Änderungen gespeichert sind.

2.  **Skript ausführbar machen (einmalig):**
    Falls Sie dies noch nicht getan haben, machen Sie das Skript einmalig ausführbar:
    \`\`\`bash
    chmod +x rebuild_and_run.sh
    \`\`\`

3.  **Skript ausführen:**
    Führen Sie das Skript aus, um alles automatisch neu zu bauen und zu starten:
    \`\`\`bash
    ./rebuild_and_run.sh
    \`\`\`

**Beispiel-Ausgabe:**

Das Skript stoppt und entfernt den alten Container, baut das Image mit Ihren neuen Änderungen und startet einen frischen Container. Die Ausgabe im Terminal wird etwa so aussehen:

\`\`\`bash
./rebuild_and_run.sh
➡️ Stoppe und entferne alten Container (falls vorhanden)...
speech-app-container
speech-app-container
➡️ Baue neues Image 'speech-app'...
[+] Building 1.3s (16/16) FINISHED
 => [internal] load build definition from Dockerfile
... (detaillierte Build-Schritte werden hier angezeigt) ...
 => => naming to docker.io/library/speech-app
🚀 Starte neuen Container 'speech-app-container'...
81d85e067d7dc47dc5b7769b85dbf95e83ac0b302a811c1944d0cef3ca0c83bc
✅ Fertig! Die Anwendung läuft.
👀 Logs ansehen mit: docker logs -f speech-app-container
\`\`\`

Nachdem das Skript erfolgreich durchgelaufen ist, ist Ihre Anwendung mit den neuesten Änderungen sofort wieder unter **\`http://localhost:8080\`** erreichbar.

## Projektstruktur
```text
speech-tts-app/
├── tts_audio/        # Speicherort für generierte MP3s
├── Dockerfile        # Bauanleitung für den Docker-Container
├── start.sh          # Start-Skript für den Docker-Container
├── index.html        # Frontend-Struktur
├── app.js            # Frontend-Logik
├── server.js         # Node.js Backend-Server
├── tts_server.py     # Python TTS-Server
├── package.json      # Node.js-Abhängigkeiten
└── requirements.txt  # Python-Abhängigkeiten
```
