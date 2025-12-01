// Get DOM elements
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const testApiBtn = document.getElementById('testApiBtn');

// Ollama API configuration
// Use relative path for Vercel deployment, or localhost for local development
const OLLAMA_API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'https://overnervous-ximena-torchy.ngrok-free.dev'  // ngrok public URL
    : '/api/ollama';  // Use Vercel serverless function when deployed

// Auto-resize textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Send message on button click
sendBtn.addEventListener('click', sendMessage);

// Send message on Enter key (Shift+Enter for new line)
messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Clear chat
clearBtn.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear the chat?')) {
        chatMessages.innerHTML = '';
        addMessage('assistant', 'Hello! How can I help you today?');
    }
});

// Test Ollama API with gemma3:27b model
testApiBtn.addEventListener('click', async function() {
    testApiBtn.disabled = true;
    addMessage('system', '🤖 Connecting to Ollama with gemma3:27b...');
    
    try {
        // Determine the URL based on whether we're using the proxy or direct connection
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const url = isLocalhost 
            ? `${OLLAMA_API_URL}/api/generate`
            : `${OLLAMA_API_URL}?endpoint=/api/generate`;
        
        const requestBody = {
            model: 'gemma3:27b',
            prompt: 'Please introduce yourself briefly in 2-3 sentences.',
            stream: false
        };
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
            const data = await response.json();
            const modelResponse = data.response || 'No response received';
            
            addMessage('assistant', modelResponse);
            addMessage('system', `✅ Model: ${data.model || 'gemma3:27b'}\n⏱️ Generation time: ${data.total_duration ? (data.total_duration / 1e9).toFixed(2) + 's' : 'N/A'}\n📊 Tokens: ${data.eval_count || 'N/A'}`);
        } else {
            // Try to get error details from response
            let errorDetails = `Status: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData.error || errorData.message) {
                    errorDetails += `\n\nError: ${errorData.error || errorData.message}`;
                }
            } catch (e) {
                // Response wasn't JSON, that's okay
            }
            
            addMessage('system', `❌ API Connection Failed\n\n${errorDetails}\n\nPossible issues:\n- Model not available on server\n- Check if model is pulled: ollama pull gemma3:27b`);
        }
    } catch (error) {
        addMessage('system', `❌ API Connection Failed\n\nError: ${error.message}\n\nCheck browser console for details`);
    } finally {
        testApiBtn.disabled = false;
    }
});

function sendMessage() {
    const message = messageInput.value.trim();
    
    if (message === '') return;
    
    // Add user message
    addMessage('user', message);
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Disable send button temporarily
    sendBtn.disabled = true;
    
    // Simulate typing indicator and response
    setTimeout(() => {
        addMessage('assistant', getResponse(message));
        sendBtn.disabled = false;
        messageInput.focus();
    }, 1000);
}

function addMessage(type, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const label = type === 'user' ? 'You' : type === 'system' ? 'System' : 'Assistant';
    
    // Preserve formatting for system messages
    const formattedText = type === 'system' ? 
        text.replace(/\n/g, '<br>') : 
        escapeHtml(text);
    
    contentDiv.innerHTML = `
        <strong>${label}:</strong>
        <p>${formattedText}</p>
    `;
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getResponse(message) {
    // Simple response logic - can be customized or connected to an API
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        return 'Hello! How are you doing today?';
    } else if (lowerMessage.includes('how are you')) {
        return "I'm doing well, thank you for asking! How can I assist you?";
    } else if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
        return 'Goodbye! Have a great day!';
    } else if (lowerMessage.includes('help')) {
        return "I'm a simple chat interface. You can type any message and I'll respond. This is a demo that can be extended to connect to any API!";
    } else if (lowerMessage.includes('name')) {
        return "I'm a simple chat assistant. What's your name?";
    } else {
        const responses = [
            "That's interesting! Tell me more.",
            "I understand. What else would you like to know?",
            "Thanks for sharing that with me!",
            "Interesting perspective! Anything else on your mind?",
            "I see. Is there anything specific I can help you with?"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Focus on input on load
window.addEventListener('load', () => {
    messageInput.focus();
});

