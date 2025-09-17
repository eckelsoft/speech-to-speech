# Starten mit einem bekannten und stabilen Linux als Basis
FROM ubuntu:22.04

# Umgebungsvariablen setzen, um interaktive Abfragen während der Installation zu vermeiden
ENV DEBIAN_FRONTEND=noninteractive

# Arbeitsverzeichnis im Container festlegen
WORKDIR /app

# 1. Systemabhängigkeiten installieren (Python, Node.js, etc.)
RUN apt-get update && apt-get install -y \
    curl \
    python3.10 \
    python3.10-venv \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Node.js 20.x installieren
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# 2. Projektdateien und Abhängigkeiten installieren
# Erst die Paket-Definitionsdateien kopieren, um Docker's Caching zu nutzen
COPY package*.json ./
COPY requirements.txt ./

# Node.js-Abhängigkeiten installieren
RUN npm install

# Python-Abhängigkeiten in einer virtuellen Umgebung installieren
RUN python3 -m venv venv
RUN venv/bin/pip install -r requirements.txt

# Den Rest des Quellcodes kopieren
COPY . .

# 3. Startskript ausführbar machen und Ports freigeben
RUN chmod +x start.sh
EXPOSE 8080 5000

# 4. Container starten
# Das Startskript wird ausgeführt, wenn der Container gestartet wird.
CMD ["./start.sh"]