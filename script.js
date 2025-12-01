// Get DOM elements
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const testApiBtn = document.getElementById('testApiBtn');

// Ollama API configuration
const OLLAMA_API_URL = 'http://129.10.112.25:11434';

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

// Test Ollama API connection
testApiBtn.addEventListener('click', async function() {
    testApiBtn.disabled = true;
    addMessage('system', '🔍 Testing Ollama API connection...');
    
    try {
        const response = await fetch(`${OLLAMA_API_URL}/api/tags`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        
        if (response.ok) {
            const data = await response.json();
            const modelCount = data.models ? data.models.length : 0;
            const modelNames = data.models ? data.models.map(m => m.name).join(', ') : 'none';
            
            addMessage('system', `✅ API Connection Successful!\n\nFound ${modelCount} model(s): ${modelNames}\n\nFull response:\n${JSON.stringify(data, null, 2)}`);
        } else {
            addMessage('system', `❌ API Connection Failed\n\nStatus: ${response.status} ${response.statusText}\n\nThe API endpoint returned an error.`);
        }
    } catch (error) {
        addMessage('system', `❌ API Connection Failed\n\nError: ${error.message}\n\nPossible issues:\n- CORS policy blocking the request\n- Network connectivity\n- API server not accessible from browser\n\nNote: The API might work with curl but be blocked by browser CORS policies.`);
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

