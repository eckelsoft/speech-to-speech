document.addEventListener('DOMContentLoaded', () => {
    const recordButton = document.getElementById('recordButton');
    const toggleQueueButton = document.getElementById('toggleQueueButton');
    const panicButton = document.getElementById('panicButton');
    const transcriptWrapper = document.getElementById('transcript-wrapper');
    const ttsQueueList = document.getElementById('ttsQueue');
    const speedSelect = document.getElementById('speedSelect');
    const visualizerCanvas = document.getElementById('visualizerCanvas');
    const pauseDelaySlider = document.getElementById('pauseDelaySlider');
    const pauseDelayValue = document.getElementById('pauseDelayValue');

    // --- STATE MANAGEMENT ---
    let isRecording = false;
    let isSoundActivationEnabled = false;
    let isQueuePaused = false;
    let isPlaying = false;
    let isAudioUnlocked = false;
    let currentAudio = null;
    let audioQueue = [];
    let finalTranscriptHolder = '';
    let interimTtsTimer = null;
    let pauseDelay = 800;
    let currentPlaybackRate = 1.35;

    // --- AUDIO & VISUALIZER SETUP ---
    const canvasCtx = visualizerCanvas.getContext('2d');
    let audioContext;
    let analyser;
    let microphoneStream; // Referenz auf den Stream für die Aktivierung

    // --- SPEECH RECOGNITION SETUP ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.interimResults = true;
    recognition.continuous = false; // Wichtig: Auf 'false' setzen, damit nach jedem Satz eine Pause erkannt wird

    // --- KERNFUNKTIONEN ---

    /**
     * Initialisiert die Web Audio API. Wird nur einmal aufgerufen.
     * Startet die permanente Visualisierung und Geräuscherkennung.
     */
    async function initAndStartVisualizer() {
        if (isAudioUnlocked) return;
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = audioContext.createMediaStreamSource(microphoneStream);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);
            isAudioUnlocked = true;
            
            // Starte die permanente Visualisierung und Geräuschüberwachung
            permanentVisualizeAndMonitor();
        } catch (err) {
            console.error("Fehler beim Zugriff auf das Mikrofon:", err);
            alert("Fehler beim Zugriff auf das Mikrofon. Bitte stellen Sie sicher, dass die Berechtigung erteilt wurde.");
        }
    }

    /**
     * Die Hauptschleife, die permanent läuft, um das Mikrofon zu visualisieren
     * und bei Bedarf die Aufnahme zu triggern.
     */
    function permanentVisualizeAndMonitor() {
        requestAnimationFrame(permanentVisualizeAndMonitor);

        if (!analyser) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        // 1. Visualisierung zeichnen (immer)
        canvasCtx.fillStyle = '#fafafa';
        canvasCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = isRecording ? '#dc3545' : 'rgb(0, 123, 255)'; // Farbe je nach Status
        canvasCtx.beginPath();
        const sliceWidth = visualizerCanvas.width * 1.0 / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * visualizerCanvas.height / 2;
            i === 0 ? canvasCtx.moveTo(x, y) : canvasCtx.lineTo(x, y);
            x += sliceWidth;
        }
        canvasCtx.lineTo(visualizerCanvas.width, visualizerCanvas.height / 2);
        canvasCtx.stroke();

        // 2. Geräuschpegel prüfen, um Aufnahme zu starten
        if (isSoundActivationEnabled && !isRecording) {
            // Einfache Lautstärkeprüfung
            let sum = 0;
            for(const amplitude of dataArray) {
                const value = Math.abs(amplitude - 128); // Abweichung vom Nullpunkt
                sum += value * value;
            }
            const rms = Math.sqrt(sum / dataArray.length);

            // Wenn der Pegel einen Schwellenwert überschreitet -> Aufnahme starten
            if (rms > 5) { // Schwellenwert, kann angepasst werden
                console.log("Geräusch erkannt! Starte Aufnahme...");
                recognition.start();
            }
        }
    }

    function processAndSend(text) {
        if (!text) return;
        const processedText = text.replace(/\s?fragezeichen/gi, '?').replace(/\s?punkt/gi, '.');
        finalTranscriptHolder += text + ' ';
        addFinalTranscriptToUI(processedText);
        sendToTtsServer(processedText);
    }

    // --- SPEECH RECOGNITION EVENT HANDLERS ---

    recognition.onstart = () => {
        isRecording = true;
        transcriptWrapper.classList.add('listening');
    };

    recognition.onend = () => {
        isRecording = false;
        clearTimeout(interimTtsTimer);
        transcriptWrapper.classList.remove('listening');
        // Nach Ende der Aufnahme geht es automatisch zurück in den Überwachungsmodus
    };

    recognition.onerror = (event) => {
        console.error('Fehler bei der Spracherkennung:', event.error);
        isRecording = false;
    };

    recognition.onresult = (event) => {
        clearTimeout(interimTtsTimer);
        let interimTranscript = '';
        let currentFullTranscript = finalTranscriptHolder;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                const finalSegment = event.results[i][0].transcript.trim();
                processAndSend(finalSegment);
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        displayInterimText(interimTranscript);
    };

    // --- UI UPDATE FUNCTIONS ---

    function updateRecordButtonUI() {
        if (isSoundActivationEnabled) {
            recordButton.classList.add('recording');
            recordButton.innerHTML = '🔊 Aktivierung an (Stopp)';
        } else {
            recordButton.classList.remove('recording');
            recordButton.innerHTML = '🎤 Aktivierung starten';
        }
    }
    
    function addFinalTranscriptToUI(text) {
        const existingInterim = transcriptWrapper.querySelector('.interim-text');
        if (existingInterim) existingInterim.remove();
        const p = document.createElement('p');
        p.textContent = text;
        transcriptWrapper.appendChild(p);
        transcriptWrapper.scrollTop = transcriptWrapper.scrollHeight;
    }

    function displayInterimText(text) {
        let interimElement = transcriptWrapper.querySelector('.interim-text');
        if (!interimElement) {
            interimElement = document.createElement('p');
            interimElement.className = 'interim-text';
            transcriptWrapper.appendChild(interimElement);
        }
        interimElement.textContent = text;
    }

    // --- EVENT LISTENERS ---

    recordButton.addEventListener('click', async () => {
        if (!isAudioUnlocked) {
            await initAndStartVisualizer();
        }
        
        isSoundActivationEnabled = !isSoundActivationEnabled;
        
        if (!isSoundActivationEnabled && isRecording) {
            // Wenn die Aktivierung ausgeschaltet wird, während eine Aufnahme läuft, diese auch stoppen.
            recognition.stop();
        }
        updateRecordButtonUI();
    });

    // --- (Restlicher Code bleibt größtenteils unverändert) ---
    
    toggleQueueButton.addEventListener('click', () => {
        isQueuePaused = !isQueuePaused;
        if (isQueuePaused) {
            toggleQueueButton.classList.add('paused');
            toggleQueueButton.innerHTML = '▶️ Warteschlange fortsetzen';
            if(currentAudio) currentAudio.pause();
        } else {
            toggleQueueButton.classList.remove('paused');
            toggleQueueButton.innerHTML = '⏸️ Warteschlange anhalten';
            if(currentAudio) currentAudio.play(); else playNextInQueue();
        }
    });

    panicButton.addEventListener('click', () => {
        if(currentAudio && audioQueue.length > 0) {
            currentAudio.pause();
            currentAudio.src = '';
            onPlaybackFinished(audioQueue[0]);
        }
    });
    
    speedSelect.addEventListener('change', (event) => {
        currentPlaybackRate = parseFloat(event.target.value);
        if (currentAudio) currentAudio.playbackRate = currentPlaybackRate;
    });

    pauseDelaySlider.addEventListener('input', (event) => {
        pauseDelay = parseInt(event.target.value, 10);
        pauseDelayValue.textContent = (pauseDelay / 1000).toFixed(1);
    });

    // --- SERVER COMMUNICATION & QUEUE MANAGEMENT ---

    function sendToTtsServer(text) {
        const ttsOptions = { text, lang: 'de', tld: 'de' };
        fetch('http://localhost:5000/erzeuge_tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ttsOptions),
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'erfolgreich' && data.dateiname) {
                audioQueue.push({ text, filename: data.dateiname });
                updateQueueListUI();
                playNextInQueue();
            } else { console.error('TTS-Anfrage fehlgeschlagen:', data.message); }
        })
        .catch(error => console.error('Fehler bei der TTS-Anfrage:', error));
    }

    function updateQueueListUI() {
        ttsQueueList.innerHTML = '';
        audioQueue.forEach((item, index) => {
            const li = document.createElement('li');
            if (index === 0 && isPlaying) { li.className = 'playing'; }
            const textDiv = document.createElement('div');
            textDiv.className = 'text-content';
            textDiv.textContent = `"${item.text}"`;
            const fileDiv = document.createElement('div');
            fileDiv.className = 'file-name';
            fileDiv.textContent = item.filename;
            li.appendChild(textDiv);
li.appendChild(fileDiv);
ttsQueueList.appendChild(li);
});
}
function onPlaybackFinished(finishedItem) {
    currentAudio = null;
    isPlaying = false;
    const index = audioQueue.findIndex(item => item.filename === finishedItem.filename);
    if (index > -1) {
        audioQueue.splice(index, 1);
    }
    panicButton.style.display = 'none';
    updateQueueListUI();
    playNextInQueue();
    fetch(`/delete_audio/${finishedItem.filename}`, { method: 'DELETE' })
        .catch(error => console.error('Fehler beim Löschen der Datei:', error));
}
function playNextInQueue() {
    if (isQueuePaused || isPlaying || audioQueue.length === 0) return;
    isPlaying = true;
    panicButton.style.display = 'flex';
    const currentItem = audioQueue[0];
    currentAudio = new Audio(`/tts_audio/${currentItem.filename}`);
    currentAudio.playbackRate = currentPlaybackRate;
    updateQueueListUI();
    currentAudio.play().then(() => {
        currentAudio.onended = () => onPlaybackFinished(currentItem);
    }).catch(error => {
        console.error('Fehler bei der Audiowiedergabe:', error);
        onPlaybackFinished(currentItem);
    });
}

// Initialer UI-Status des Buttons
updateRecordButtonUI();
visualizerCanvas.width = visualizerCanvas.offsetWidth;
visualizerCanvas.height = visualizerCanvas.offsetHeight;

});