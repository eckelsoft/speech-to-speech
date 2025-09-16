const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const output = document.getElementById('gesprochenerText');
const ttsQueueList = document.getElementById('ttsQueue');
const audioInfo = document.getElementById('audioInfo');

let audioQueue = [];
let isPlaying = false;
let finalTranscript = '';
let isAudioUnlocked = false;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

recognition.lang = 'de-DE';
recognition.interimResults = true;
recognition.continuous = true;

recognition.onstart = () => {
    startButton.style.backgroundColor = '#dc3545';
    startButton.textContent = 'Aufnahme läuft...';
};

recognition.onend = () => {
    startButton.style.backgroundColor = '#007bff';
    startButton.textContent = 'Aufnahme starten';
};

recognition.onresult = (event) => {
    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
            sendeAnTtsServer(event.results[i][0].transcript.trim());
        } else {
            interimTranscript += event.results[i][0].transcript;
        }
    }
    output.textContent = finalTranscript + interimTranscript;
};

startButton.addEventListener('click', () => {
    if (!isAudioUnlocked) {
        isAudioUnlocked = true;
        audioInfo.style.display = 'none';
        playNextInQueue();
    }
    finalTranscript = '';
    output.textContent = '';
    recognition.start();
});

stopButton.addEventListener('click', () => {
    recognition.stop();
});

function sendeAnTtsServer(text) {
    if (!text) return;
    fetch('http://localhost:5000/erzeuge_tts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: text }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.status !== 'erfolgreich') {
            console.error('TTS-Anfrage fehlgeschlagen:', data.message);
        }
    })
    .catch((error) => {
        console.error('Fehler bei der TTS-Anfrage:', error);
    });
}

const ws = new WebSocket('ws://localhost:8080');

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'queue_update') {
        audioQueue = data.files;
        updateQueueList();
        playNextInQueue();
    }
};

function updateQueueList() {
    ttsQueueList.innerHTML = '';
    audioQueue.forEach(file => {
        const li = document.createElement('li');
        li.textContent = file;
        ttsQueueList.appendChild(li);
    });
}

function onPlaybackFinished(filename) {
    fetch(`/delete_audio/${filename}`, { method: 'DELETE' })
        .catch(error => console.error('Fehler beim Löschen der Datei:', error))
        .finally(() => {
            audioQueue.shift();
            updateQueueList();
            isPlaying = false;
            playNextInQueue();
        });
}

function playNextInQueue() {
    if (!isAudioUnlocked || isPlaying || audioQueue.length === 0) {
        return;
    }
    
    isPlaying = true;
    const audioFile = audioQueue[0];
    const audio = new Audio(`/tts_audio/${audioFile}`);
    
    const playPromise = audio.play();

    if (playPromise !== undefined) {
        playPromise.then(() => {
            audio.onended = () => {
                onPlaybackFinished(audioFile);
            };
        }).catch(error => {
            console.error('Fehler bei der Audiowiedergabe:', error);
            onPlaybackFinished(audioFile);
        });
    }
}