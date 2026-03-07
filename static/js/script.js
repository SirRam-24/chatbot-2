document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatBox = document.getElementById('chat-box');
    const sendBtn = document.getElementById('send-btn');

    // Configure marked wrapper with highlight.js
    marked.setOptions({
        highlight: function (code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
        langPrefix: 'hljs language-',
        breaks: true
    });

    // Auto-resize textarea
    userInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight < 150 ? this.scrollHeight : 150) + 'px';
        if (this.value.trim() === '') {
            sendBtn.disabled = true;
        } else {
            sendBtn.disabled = false;
        }
    });

    // Submit on Enter (Shift+Enter for new line)
    userInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (this.value.trim() !== '') {
                chatForm.dispatchEvent(new Event('submit'));
            }
        }
    });

    let messageHistory = [
        // We will store the full chat history here to send to the API
    ];

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text) return;

        // Reset input
        userInput.value = '';
        userInput.style.height = 'auto';
        sendBtn.disabled = true;

        // Add user message to UI
        appendMessage('user', text);
        messageHistory.push({ role: 'user', content: text });

        // Add placeholder assistant message
        const assistantId = 'msg-' + Date.now();
        appendMessagePlaceholder('assistant', assistantId);

        // Fetch streaming response
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messages: messageHistory })
            });

            if (!response.body) throw new Error('ReadableStream not supported');

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let assistantResponse = '';

            // Remove typing indicator before streaming starts
            const msgEl = document.getElementById(assistantId);
            const contentEl = msgEl.querySelector('.content');
            contentEl.innerHTML = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                                assistantResponse += data.choices[0].delta.content;
                                // Update markdown streamingly
                                contentEl.innerHTML = marked.parse(assistantResponse);
                                chatBox.scrollTop = chatBox.scrollHeight;
                            }
                        } catch (err) {
                            console.error('Error parsing SSE:', err, line);
                        }
                    }
                }
            }

            // Apply code highlighting for block code tags
            msgEl.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });

            // Add TTS Button
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';

            const ttsBtn = document.createElement('button');
            ttsBtn.className = 'tts-btn';
            ttsBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
            `;
            ttsBtn.title = "Read aloud";

            let isSpeaking = false;
            ttsBtn.addEventListener('click', () => {
                if (window.speechSynthesis.speaking) {
                    window.speechSynthesis.cancel();
                    if (isSpeaking) {
                        isSpeaking = false;
                        ttsBtn.classList.remove('speaking');
                        return;
                    }
                }

                const utterance = new SpeechSynthesisUtterance(assistantResponse);

                // Try to find a good voice
                const voices = window.speechSynthesis.getVoices();
                const preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Natural')) || voices[0];
                if (preferredVoice) utterance.voice = preferredVoice;

                utterance.onend = () => {
                    isSpeaking = false;
                    ttsBtn.classList.remove('speaking');
                };

                window.speechSynthesis.speak(utterance);
                isSpeaking = true;
                ttsBtn.classList.add('speaking');
            });

            actionsDiv.appendChild(ttsBtn);
            msgEl.appendChild(actionsDiv);
            chatBox.scrollTop = chatBox.scrollHeight;

            messageHistory.push({ role: 'assistant', content: assistantResponse });

        } catch (error) {
            console.error('Error:', error);
            const msgEl = document.getElementById(assistantId);
            msgEl.querySelector('.content').innerHTML = '<span style="color: #ff7b72;">Sorry, there was an error communicating with the server. Please try again later.</span>';
        }
    });

    function appendMessage(role, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';

        if (role === 'user') {
            contentDiv.textContent = text;
        } else {
            contentDiv.innerHTML = marked.parse(text);
        }

        msgDiv.appendChild(contentDiv);
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function appendMessagePlaceholder(role, id) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        msgDiv.id = id;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';

        // Typing indicator
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.innerHTML = '<span></span><span></span><span></span>';

        contentDiv.appendChild(typingDiv);

        msgDiv.appendChild(contentDiv);
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
});
