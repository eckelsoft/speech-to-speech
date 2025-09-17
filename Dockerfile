FROM ubuntu:22.04
# Interaktive Abfragen während der Installation vermeiden
ENV DEBIAN_FRONTEND=noninteractive

# 1. Systemabhängigkeiten installieren
WORKDIR /app
RUN apt-get update && apt-get install -y \
    curl \
    python3.10 \
    python3.10-venv \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# 2. Python Backend einrichten
COPY backend_python/requirements.txt ./backend_python/
WORKDIR /app/backend_python
RUN python3 -m venv venv
RUN venv/bin/pip install -r requirements.txt

# 3. Node.js Backend einrichten
WORKDIR /app
COPY backend_node/package*.json ./backend_node/
WORKDIR /app/backend_node
RUN npm install

# 4. Restlichen Quellcode in die jeweiligen Ordner kopieren
WORKDIR /app
COPY backend_python/ ./backend_python/
COPY backend_node/ ./backend_node/

# 5. Startskript direkt im Dockerfile erstellen und ausführbar machen
RUN echo '#!/bin/bash' > start.sh && \
    echo 'set -e' >> start.sh && \
    echo '' >> start.sh && \
    echo 'echo "Starting Python TTS Server in /app/backend_python..."' >> start.sh && \
    echo 'cd /app/backend_python' >> start.sh && \
    echo 'source venv/bin/activate' >> start.sh && \
    echo 'waitress-serve --host 0.0.0.0 --port=5000 tts_server:app &' >> start.sh && \
    echo 'cd /app' >> start.sh && \
    echo '' >> start.sh && \
    echo 'echo "Starting Node.js Web Server in /app/backend_node..."' >> start.sh && \
    echo 'cd /app/backend_node' >> start.sh && \
    echo 'node server.js' >> start.sh && \
    chmod +x start.sh

EXPOSE 8080 5000

# 6. Das erstellte Startskript wird ausgeführt, wenn der Container gestartet wird.
CMD ["./start.sh"]