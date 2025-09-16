document.addEventListener('DOMContentLoaded', () => {
    const recordButton = document.getElementById('recordButton');
    const toggleQueueButton = document.getElementById('toggleQueueButton');
    const panicButton = document.getElementById('panicButton');
    const transcriptWrapper = document.getElementById('transcript-wrapper');
    const ttsQueueList = document.getElementById('ttsQueue');

    let audioQueue = [];
    let currentAudio = null;
    let isPlaying = false;
    let isAudioUnlocked = false;
    let isQueuePaused = false;
    let interimTranscriptElement = null;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
        recordButton.classList.add('recording');
        recordButton.innerHTML = '🔴 Aufnahme läuft...';
        transcriptWrapper.classList.add('listening');
    };

    recognition.onend = () => {
        recordButton.classList.remove('recording');
        recordButton.innerHTML = '🎤 Aufnahme starten';
        transcriptWrapper.classList.remove('listening');
    };

    recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        if (finalTranscript.trim()) {
            if (interimTranscriptElement) {
                interimTranscriptElement.remove();
                interimTranscriptElement = null;
            }
            const p = document.createElement('p');
            p.textContent = finalTranscript.trim();
            transcriptWrapper.appendChild(p);
            transcriptWrapper.scrollTop = transcriptWrapper.scrollHeight;
            sendeAnTtsServer(finalTranscript.trim());
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

    recordButton.addEventListener('click', () => {
        if (recognition.running) {
            recognition.stop();
        } else {
            if (!isAudioUnlocked) {
                isAudioUnlocked = true;
                playNextInQueue();
            }
            recognition.start();
        }
        recognition.running = !recognition.running;
    });
    
    toggleQueueButton.addEventListener('click', () => {
        isQueuePaused = !isQueuePaused;
        if (isQueuePaused) {
            toggleQueueButton.classList.add('paused');
            toggleQueueButton.innerHTML = '▶️ Warteschlange fortsetzen';
            if(currentAudio) {
                currentAudio.pause();
            }
        } else {
            toggleQueueButton.classList.remove('paused');
            toggleQueueButton.innerHTML = '⏸️ Warteschlange anhalten';
            playNextInQueue();
        }
    });

    panicButton.addEventListener('click', () => {
        if(currentAudio && audioQueue.length > 0) {
            currentAudio.pause();
            onPlaybackFinished(audioQueue[0]);
        }
    });

    function sendeAnTtsServer(text) {
        if (!text) return;
        fetch('http://localhost:5000/erzeuge_tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'erfolgreich' && data.dateiname) {
                audioQueue.push({ text: text, filename: data.dateiname });
                updateQueueList();
                playNextInQueue();
            } else {
                console.error('TTS-Anfrage fehlgeschlagen:', data.message);
            }
        })
        .catch(error => console.error('Fehler bei der TTS-Anfrage:', error));
    }

    function updateQueueList() {
        ttsQueueList.innerHTML = '';
        audioQueue.forEach((item, index) => {
            const li = document.createElement('li');
            if (index === 0 && isPlaying) {
                li.className = 'playing';
            }
            
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
                if (index > -1) {
                    audioQueue.splice(index, 1);
                }
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
        updateQueueList();

        const playPromise = currentAudio.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                currentAudio.onended = () => {
                    onPlaybackFinished(currentItem);
                };
            }).catch(error => {
                console.error('Fehler bei der Audiowiedergabe:', error);
                onPlaybackFinished(currentItem);
            });
        }
    }
});