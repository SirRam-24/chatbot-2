document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatBox = document.getElementById('chat-box');
    const sendBtn = document.getElementById('send-btn');
    const imageUpload = document.getElementById('image-upload');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const themeToggle = document.getElementById('theme-toggle');
    const iconLight = document.getElementById('theme-icon-light');
    const iconDark = document.getElementById('theme-icon-dark');

    // Theme logic
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.setAttribute('data-theme', 'dark');
        if (iconLight) iconLight.classList.add('hidden');
        if (iconDark) iconDark.classList.remove('hidden');
    }

    if (themeToggle && iconLight && iconDark) {
        themeToggle.addEventListener('click', () => {
            const isDark = document.body.getAttribute('data-theme') === 'dark';
            if (isDark) {
                document.body.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                iconLight.classList.remove('hidden');
                iconDark.classList.add('hidden');
            } else {
                document.body.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                iconLight.classList.add('hidden');
                iconDark.classList.remove('hidden');
            }
        });
    }


    // Sidebar toggle logic
    const sidebar = document.getElementById('sidebar');
    const openSidebarBtn = document.getElementById('open-sidebar-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');

    if (openSidebarBtn && closeSidebarBtn && sidebar) {
        openSidebarBtn.addEventListener('click', () => {
            sidebar.classList.add('open');
        });
        closeSidebarBtn.addEventListener('click', () => {
            sidebar.classList.remove('open');
        });
    }

    let selectedImages = [];

    // Configure marked wrapper with highlight.js
    marked.setOptions({
        highlight: function (code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
        langPrefix: 'hljs language-',
        breaks: true
    });

    function checkEmptyInput() {
        if (userInput.value.trim() === '') {
            sendBtn.disabled = true;
        } else {
            sendBtn.disabled = false;
        }
    }

    // Auto-resize textarea
    userInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight < 150 ? this.scrollHeight : 150) + 'px';
        checkEmptyInput();
    });

    // Image selection handler
    imageUpload.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);

        if (selectedImages.length + files.length > 5) {
            alert('You can only upload a maximum of 5 images.');
            return;
        }

        files.forEach(file => {
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                selectedImages.push({ file, dataUrl });
                renderImagePreviews();
                checkEmptyInput();
            };
            reader.readAsDataURL(file);
        });

        imageUpload.value = '';
    });

    function renderImagePreviews() {
        imagePreviewContainer.innerHTML = '';
        selectedImages.forEach((imgObj, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'img-preview-wrapper';

            const imgEl = document.createElement('img');
            imgEl.src = imgObj.dataUrl;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'img-remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = () => {
                selectedImages.splice(index, 1);
                renderImagePreviews();
                checkEmptyInput();
            };

            wrapper.appendChild(imgEl);
            wrapper.appendChild(removeBtn);
            imagePreviewContainer.appendChild(wrapper);
        });
    }

    // Submit on Enter (Shift+Enter for new line)
    userInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (this.value.trim() !== '' || selectedImages.length > 0) {
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
        if (!text && selectedImages.length === 0) return;

        // Reset input
        userInput.value = '';
        userInput.style.height = 'auto';
        sendBtn.disabled = true;

        const currentImages = [...selectedImages];
        selectedImages = [];
        renderImagePreviews();

        let messageContent = text;
        let uiContent = text;

        if (currentImages.length > 0) {
            messageContent = [];
            if (text) {
                messageContent.push({ type: "text", text: text });
            }

            uiContent = document.createDocumentFragment();
            if (text) {
                const textNode = document.createElement('div');
                textNode.textContent = text;
                uiContent.appendChild(textNode);
            }

            const imgContainer = document.createElement('div');
            imgContainer.style.display = 'flex';
            imgContainer.style.gap = '8px';
            imgContainer.style.flexWrap = 'wrap';
            imgContainer.style.marginTop = text ? '8px' : '0';

            currentImages.forEach(img => {
                messageContent.push({
                    type: "image_url",
                    image_url: { url: img.dataUrl }
                });

                const imgEl = document.createElement('img');
                imgEl.src = img.dataUrl;
                imgEl.style.maxWidth = '200px';
                imgEl.style.maxHeight = '200px';
                imgEl.style.borderRadius = '8px';
                imgEl.style.objectFit = 'cover';
                imgContainer.appendChild(imgEl);
            });
            uiContent.appendChild(imgContainer);
        }

        // Add user message to UI
        appendMessage('user', uiContent);
        messageHistory.push({ role: 'user', content: messageContent });

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

            // Setup variables for stream reading
            const msgEl = document.getElementById(assistantId);
            const contentEl = msgEl.querySelector('.content');

            let isFirstChunk = true;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Remove typing indicator only when actual stream data starts arriving
                if (isFirstChunk) {
                    contentEl.innerHTML = '';
                    isFirstChunk = false;
                }

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

    function appendMessage(role, data) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;

        const innerDiv = document.createElement('div');
        innerDiv.className = 'message-inner';

        // Avatar
        const avatarDiv = document.createElement('div');
        if (role === 'assistant') {
            avatarDiv.className = 'avatar ai-avatar';
            avatarDiv.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17L12 22L22 17" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12L12 17L22 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        } else {
            avatarDiv.className = 'avatar user-avatar';
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';

        if (role === 'user') {
            if (typeof data === 'string') {
                contentDiv.textContent = data;
            } else {
                contentDiv.appendChild(data);
            }
        } else {
            contentDiv.innerHTML = marked.parse(data);

            // Apply highlighting to new blocks
            contentDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }

        if (role === 'assistant') {
            innerDiv.appendChild(avatarDiv);
        }
        innerDiv.appendChild(contentDiv);
        msgDiv.appendChild(innerDiv);

        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function appendMessagePlaceholder(role, id) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        msgDiv.id = id;

        const innerDiv = document.createElement('div');
        innerDiv.className = 'message-inner';

        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar ai-avatar';
        avatarDiv.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17L12 22L22 17" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12L12 17L22 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';

        const typingDiv = document.createElement('div');
        typingDiv.className = 'skeleton-loader';
        typingDiv.innerHTML = `
            <div class="skeleton-row"></div>
            <div class="skeleton-row"></div>
            <div class="skeleton-row"></div>
        `;

        contentDiv.appendChild(typingDiv);

        innerDiv.appendChild(avatarDiv);
        innerDiv.appendChild(contentDiv);
        msgDiv.appendChild(innerDiv);

        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
});
