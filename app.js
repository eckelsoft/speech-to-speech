document.addEventListener('DOMContentLoaded', () => {
    const recordButton = document.getElementById('recordButton');
    const toggleQueueButton = document.getElementById('toggleQueueButton');
    const panicButton = document.getElementById('panicButton');
    const transcriptWrapper = document.getElementById('transcript-wrapper');
    const ttsQueueList = document.getElementById('ttsQueue');
    const speedSelect = document.getElementById('speedSelect');
    const langSelect = document.getElementById('langSelect');
    const tldSelect = document.getElementById('tldSelect');
    
    const visualizerCanvas = document.getElementById('visualizerCanvas');
    
    // *** KORREKTUR 1: Canvas-Dimensionen explizit setzen ***
    // Dies stellt sicher, dass die Zeichenfläche die gleiche Größe wie das Element hat.
    visualizerCanvas.width = visualizerCanvas.offsetWidth;
    visualizerCanvas.height = visualizerCanvas.offsetHeight;
    
    const canvasCtx = visualizerCanvas.getContext('2d');
    let audioContext;
    let analyser;
    let dataArray;
    let visualizerFrameId;

    let audioQueue = [];
    let currentAudio = null;
    let isPlaying = false;
    let isAudioUnlocked = false;
    let isQueuePaused = false;
    let interimTranscriptElement = null;
    let currentPlaybackRate = 1.35;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.interimResults = true;
    recognition.continuous = true;
    
    async function initAudioVisualizer() {
        if (audioContext) return;
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = audioContext.createMediaStreamSource(stream);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
        } catch (err) {
            console.error("Fehler beim Zugriff auf das Mikrofon für den Visualizer:", err);
        }
    }
    
    function drawVisualizer() {
        if (!analyser) return;
        visualizerFrameId = requestAnimationFrame(drawVisualizer);
        analyser.getByteTimeDomainData(dataArray);
        canvasCtx.fillStyle = '#fafafa';
        canvasCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgb(0, 123, 255)';
        canvasCtx.beginPath();
        const sliceWidth = visualizerCanvas.width * 1.0 / analyser.frequencyBinCount;
        let x = 0;
        for (let i = 0; i < analyser.frequencyBinCount; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * visualizerCanvas.height / 2;
            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        canvasCtx.lineTo(visualizerCanvas.width, visualizerCanvas.height / 2);
        canvasCtx.stroke();
    }

    // Die fehlerhafte Logik von "zeichen punkt" etc. aus Ihrem letzten Upload habe ich hier ebenfalls korrigiert.
    function processPunctuationCommands(text) {
        let processedText = text;
        processedText = processedText.replace(/\s? fragezeichen/gi, '?');
        processedText = processedText.replace(/\s? punkt/gi, '.');
        return processedText;
    }

    recognition.onstart = () => {
        recordButton.classList.add('recording');
        recordButton.innerHTML = '🔴 Aufnahme läuft...';
        transcriptWrapper.classList.add('listening');
        drawVisualizer();
    };

    recognition.onend = () => {
        recordButton.classList.remove('recording');
        recordButton.innerHTML = '🎤 Aufnahme starten';
        transcriptWrapper.classList.remove('listening');
        cancelAnimationFrame(visualizerFrameId);
        canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    };

    recognition.onresult = (event) => {
        let finalTranscriptSegment = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscriptSegment += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        if (finalTranscriptSegment.trim()) {
            const processedFinalText = processPunctuationCommands(finalTranscriptSegment.trim());
            if (interimTranscriptElement) {
                interimTranscriptElement.remove();
                interimTranscriptElement = null;
            }
            const p = document.createElement('p');
            p.textContent = processedFinalText;
            transcriptWrapper.appendChild(p);
            transcriptWrapper.scrollTop = transcriptWrapper.scrollHeight;
            sendeAnTtsServer(processedFinalText);
        }
        if (interimTranscript.trim()) {
            if (!interimTranscriptElement) {
                interimTranscriptElement = document.createElement('p');
                interimTranscriptElement.className = 'interim-text';
                transcriptWrapper.appendChild(interimTranscriptElement);
            }
            interimTranscriptElement.textContent = interimTranscript;
            transcriptWrapper.scrollTop = transcriptWrapper.scrollHeight;
        }
    };
    
    // *** KORREKTUR 2: Den Klick-Handler "async" machen und auf die Initialisierung warten ***
    recordButton.addEventListener('click', async () => {
        if (!isAudioUnlocked) {
            isAudioUnlocked = true;
            await initAudioVisualizer(); // Warten, bis das Mikrofon bereit ist
            playNextInQueue();
        }
        if (recognition.running) {
            recognition.stop();
        } else {
            recognition.start();
        }
        recognition.running = !recognition.running;
    });
    
    toggleQueueButton.addEventListener('click', () => {
        isQueuePaused = !isQueuePaused;
        if (isQueuePaused) {
            toggleQueueButton.classList.add('paused');
            toggleQueueButton.innerHTML = '▶️ Warteschlange fortsetzen';
            if(currentAudio) { currentAudio.pause(); }
        } else {
            toggleQueueButton.classList.remove('paused');
            toggleQueueButton.innerHTML = '⏸️ Warteschlange anhalten';
            if(currentAudio) { currentAudio.play(); } else { playNextInQueue(); }
        }
    });

    panicButton.addEventListener('click', () => {
        if(currentAudio && audioQueue.length > 0) {
            currentAudio.pause();
            onPlaybackFinished(audioQueue[0]);
        }
    });
    
    speedSelect.addEventListener('change', (event) => {
        currentPlaybackRate = parseFloat(event.target.value);
        if (currentAudio) {
            currentAudio.playbackRate = currentPlaybackRate;
        }
    });

    function sendeAnTtsServer(text) {
        if (!text) return;
        const ttsOptions = { text: text, lang: langSelect.value, tld: tldSelect.value };
        fetch('http://localhost:5000/erzeuge_tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ttsOptions),
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'erfolgreich' && data.dateiname) {
                audioQueue.push({ text: text, filename: data.dateiname });
                updateQueueList();
                playNextInQueue();
            } else { console.error('TTS-Anfrage fehlgeschlagen:', data.message); }
        })
        .catch(error => console.error('Fehler bei der TTS-Anfrage:', error));
    }

    function updateQueueList() {
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
        fetch(`/delete_audio/${finishedItem.filename}`, { method: 'DELETE' })
            .catch(error => console.error('Fehler beim Löschen der Datei:', error))
            .finally(() => {
                const index = audioQueue.findIndex(item => item.filename === finishedItem.filename);
                if (index > -1) { audioQueue.splice(index, 1); }
                isPlaying = false;
                panicButton.style.display = 'none';
                updateQueueList();
                playNextInQueue();
            });
    }

    function playNextInQueue() {
        if (isQueuePaused || !isAudioUnlocked || isPlaying || audioQueue.length === 0) {
            return;
        }
        isPlaying = true;
        panicButton.style.display = 'flex';
        const currentItem = audioQueue[0];
        currentAudio = new Audio(`/tts_audio/${currentItem.filename}`);
        currentAudio.playbackRate = currentPlaybackRate;
        updateQueueList();
        const playPromise = currentAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                currentAudio.onended = () => onPlaybackFinished(currentItem);
            }).catch(error => {
                console.error('Fehler bei der Audiowiedergabe:', error);
                onPlaybackFinished(currentItem);
            });
        }
    }
});