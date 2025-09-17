import os
import time
from flask import Flask, request, jsonify
from gtts import gTTS
from flask_cors import CORS

app = Flask(__name__)
CORS(app) 

# Der Ordner für die generierten Audiodateien liegt eine Ebene über diesem Skript
TTS_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'tts_audio')
os.makedirs(TTS_FOLDER, exist_ok=True)

@app.route('/erzeuge_tts', methods=['POST'])
def erzeuge_tts():
    """
    Nimmt einen Text per POST-Request entgegen, generiert daraus eine MP3-Datei
    und speichert sie im TTS_FOLDER.
    Erwartet JSON-Body: {"text": "...", "lang": "de", "tld": "de"}
    """
    try:
        # Daten aus dem Request holen
        data = request.get_json()
        if not data or 'text' not in data or not data['text'].strip():
            return jsonify({"status": "fehler", "message": "Leerer oder fehlender Text."}), 400
        
        text = data.get('text')
        lang = data.get('lang', 'de')
        tld = data.get('tld', 'de')
        
        dateiname = f"{int(time.time() * 1000)}.mp3"
        dateipfad = os.path.join(TTS_FOLDER, dateiname)

        tts = gTTS(text=text, lang=lang, tld=tld, slow=False)
        tts.save(dateipfad)
        
        print(f"TTS-Datei erstellt: {dateiname} für Text: '{text}'")
        return jsonify({"status": "erfolgreich", "dateiname": dateiname}), 201

    except Exception as e:
        print(f"Ein unerwarteter Fehler ist aufgetreten: {e}")
        return jsonify({"status": "fehler", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)