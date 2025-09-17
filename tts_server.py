from flask import Flask, request, jsonify
from gtts import gTTS
import os
import time
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

TTS_FOLDER = "tts_audio"
if not os.path.exists(TTS_FOLDER):
    os.makedirs(TTS_FOLDER)

@app.route('/erzeuge_tts', methods=['POST'])
def erzeuge_tts():
    try:
        data = request.get_json()
        if not data or 'text' not in data or not data['text'].strip():
            return jsonify({"status": "fehler", "message": "Leerer Text empfangen."}), 400
        
        text = data.get('text')
        lang = data.get('lang', 'de')
        tld = data.get('tld', 'de')
        
        dateiname = f"{int(time.time() * 1000)}.mp3"
        dateipfad = os.path.join(TTS_FOLDER, dateiname)

        tts = gTTS(text=text, lang=lang, tld=tld, slow=False)
        tts.save(dateipfad)
        
        print(f"TTS-Datei erstellt: {dateiname} (lang={lang}, tld={tld}) für Text: '{text}'")
        return jsonify({"status": "erfolgreich", "dateiname": dateiname})
    except Exception as e:
        print(f"Fehler bei der TTS-Erstellung: {e}")
        return jsonify({"status": "fehler", "message": str(e)}), 500