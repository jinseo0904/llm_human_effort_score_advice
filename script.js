// Get DOM elements
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const testApiBtn = document.getElementById('testApiBtn');
const advicePost = document.getElementById('advicePost');
const commentInput = document.getElementById('commentInput');
const commentSubmitBtn = document.getElementById('commentSubmitBtn');
const askAiFeedbackBtn = document.getElementById('askAiFeedbackBtn');

// Ollama API configuration
// Use relative path for Vercel deployment, or localhost for local development
const OLLAMA_API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'https://overnervous-ximena-torchy.ngrok-free.dev'  // ngrok public URL
    : '/api/ollama';  // Use Vercel serverless function when deployed

const MODEL_NAME = 'gemma3:27b';

// Store conversation history and advice post context
let conversationHistory = [];
let currentAdvicePost = '';

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
        conversationHistory = [];
        addMessage('assistant', getInitialGreeting());
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

async function sendMessage() {
    const message = messageInput.value.trim();
    
    if (message === '') return;
    
    // Add user message
    addMessage('user', message);
    conversationHistory.push({ role: 'user', content: message });
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Disable send button temporarily
    sendBtn.disabled = true;
    messageInput.disabled = true;
    
    // Show typing indicator
    const typingIndicator = addTypingIndicator();
    
    try {
        // Build the prompt with context
        const systemPrompt = buildSystemPrompt();
        const fullPrompt = buildFullPrompt(systemPrompt, conversationHistory);
        
        // Determine the URL based on whether we're using the proxy or direct connection
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const url = isLocalhost 
            ? `${OLLAMA_API_URL}/api/generate`
            : `${OLLAMA_API_URL}?endpoint=/api/generate`;
        
        const requestBody = {
            model: MODEL_NAME,
            prompt: fullPrompt,
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
            const modelResponse = data.response || 'I apologize, but I didn\'t receive a response. Please try again.';
            
            // Remove typing indicator
            removeTypingIndicator(typingIndicator);
            
            // Add assistant response
            addMessage('assistant', modelResponse);
            conversationHistory.push({ role: 'assistant', content: modelResponse });
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
            
            removeTypingIndicator(typingIndicator);
            addMessage('system', `❌ Failed to get AI response\n\n${errorDetails}`);
        }
    } catch (error) {
        removeTypingIndicator(typingIndicator);
        addMessage('system', `❌ Error: ${error.message}\n\nPlease check your connection and try again.`);
        console.error('Error sending message:', error);
    } finally {
        sendBtn.disabled = false;
        messageInput.disabled = false;
        messageInput.focus();
    }
}

function addMessage(type, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const label = type === 'user' ? 'You' : type === 'system' ? 'System' : 'Assistant';
    
    // Format text based on message type
    let formattedText;
    if (type === 'system') {
        formattedText = text.replace(/\n/g, '<br>');
    } else if (type === 'assistant') {
        // Parse markdown for assistant messages
        if (text.includes('<')) {
            // Already contains HTML, use as-is
            formattedText = text;
        } else {
            // Parse markdown
            formattedText = parseMarkdown(text);
        }
    } else {
        formattedText = escapeHtml(text);
    }
    
    contentDiv.innerHTML = `
        <strong>${label}:</strong>
        <div>${formattedText}</div>
    `;
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function buildSystemPrompt() {
    const adviceContext = currentAdvicePost 
        ? `\n\nAdvice request:\n${currentAdvicePost}\n`
        : '';
    
    return `You are an AI assistant helping a user write an advice response to someone else's challenging situation. 

IMPORTANT: The user you are chatting with is the person OFFERING advice (the advisor), NOT the person who asked for help. The advice request shown above is from someone else who needs help. Your role is to help the advisor craft their response.

Be concise and direct. Focus on practical guidance.

Guidelines:
- Provide specific, actionable suggestions.
- Identify key points to address
- Suggest improvements to clarity and structure
- Avoid flattery, emotional language, or lengthy explanations
- Remember: The user is writing advice TO someone else, not asking for advice themselves

${adviceContext}

Only respond with what the user asks for, and nothing else.`;
}

function buildFullPrompt(systemPrompt, history) {
    // Build conversation context
    let prompt = systemPrompt + '\n\n';
    
    // Add conversation history (keep reasonable context window)
    // Include all history up to the last user message
    const historyToInclude = history.slice(0, -1); // All except the last message (current user message)
    for (const msg of historyToInclude) {
        if (msg.role === 'user') {
            prompt += `User: ${msg.content}\n\n`;
        } else if (msg.role === 'assistant') {
            prompt += `Assistant: ${msg.content}\n\n`;
        }
    }
    
    // Add the current user message and prompt for response
    if (history.length > 0 && history[history.length - 1].role === 'user') {
        prompt += `User: ${history[history.length - 1].content}\n\nAssistant:`;
    }
    
    return prompt;
}

function getInitialGreeting() {
    return currentAdvicePost 
        ? 'Hi! I am your AI writing assistant. I can help you:<ul style="margin: 8px 0; padding-left: 24px;"><li><b>Understand the situation</b></li><li><b>Brainstorm advice ideas</b></li><li><b>Proofread your draft</b></li><li><b>Provide feedback on your language</b></li></ul>and a lot more! What do you want to do first?'
        : 'Ready to help. Load an advice request to begin.';
}

function addTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant typing-indicator';
    typingDiv.id = 'typing-indicator';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = `
        <strong>Assistant:</strong>
        <p class="typing-dots">
            <span>.</span><span>.</span><span>.</span>
        </p>
    `;
    
    typingDiv.appendChild(contentDiv);
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return typingDiv;
}

function removeTypingIndicator(indicator) {
    if (indicator && indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function parseMarkdown(text) {
    if (!text) return '';
    
    // Split into lines for processing
    const lines = text.split('\n');
    const result = [];
    let inList = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // Check if this is a bullet point (starts with *, -, or + followed by space)
        const bulletMatch = trimmed.match(/^[\*\-\+]\s+(.+)$/);
        
        if (bulletMatch) {
            // Start list if not already in one
            if (!inList) {
                result.push('<ul>');
                inList = true;
            }
            // Process the list item content (handle bold)
            let content = bulletMatch[1];
            content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            result.push(`<li>${content}</li>`);
        } else {
            // Close list if we were in one
            if (inList) {
                result.push('</ul>');
                inList = false;
            }
            
            // Process regular line
            if (trimmed) {
                // Convert **bold** to <strong>bold</strong>
                let processedLine = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                result.push(`<p>${processedLine}</p>`);
            } else if (i < lines.length - 1) {
                // Empty line (but not the last one) - add spacing
                result.push('<br>');
            }
        }
    }
    
    // Close any open list
    if (inList) {
        result.push('</ul>');
    }
    
    return result.join('');
}

// Load advice post from text file
async function loadAdvicePost(filename = 'sample1.txt') {
    try {
        const response = await fetch(`Advice_Situations/${filename}`);
        if (!response.ok) {
            throw new Error(`Failed to load file: ${response.statusText}`);
        }
        const text = await response.text();
        currentAdvicePost = text;
        advicePost.textContent = text;
    } catch (error) {
        console.error('Error loading advice post:', error);
        advicePost.innerHTML = `<p class="error-text">Error loading advice post: ${error.message}</p>`;
        currentAdvicePost = '';
    }
}

// Handle comment submit (placeholder - doesn't need to work yet)
commentSubmitBtn.addEventListener('click', function(e) {
    e.preventDefault();
    const comment = commentInput.value.trim();
    if (comment) {
        console.log('Comment submitted:', comment);
        // Placeholder - functionality to be implemented later
        alert('Comment submission functionality coming soon!');
    }
});

// Handle Ask AI Feedback button
askAiFeedbackBtn.addEventListener('click', async function(e) {
    e.preventDefault();
    const draft = commentInput.value.trim();
    
    if (!draft) {
        addMessage('system', 'Please write a draft in the text box before asking for feedback.');
        return;
    }
    
    // Disable button during request
    askAiFeedbackBtn.disabled = true;
    const originalText = askAiFeedbackBtn.innerHTML;
    askAiFeedbackBtn.innerHTML = '<span>Processing...</span>';
    
    // Add user message showing they're asking for feedback
    addMessage('user', 'Please provide feedback on my draft.');
    
    // Show typing indicator
    const typingIndicator = addTypingIndicator();
    
    try {
        // Build feedback prompt
        const feedbackPrompt = buildFeedbackPrompt(draft);
        
        // Determine the URL based on whether we're using the proxy or direct connection
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const url = isLocalhost 
            ? `${OLLAMA_API_URL}/api/generate`
            : `${OLLAMA_API_URL}?endpoint=/api/generate`;
        
        const requestBody = {
            model: MODEL_NAME,
            prompt: feedbackPrompt,
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
            const modelResponse = data.response || 'I apologize, but I didn\'t receive a response. Please try again.';
            
            // Remove typing indicator
            removeTypingIndicator(typingIndicator);
            
            // Add assistant response
            addMessage('assistant', modelResponse);
            conversationHistory.push({ role: 'user', content: 'Please provide feedback on my draft.' });
            conversationHistory.push({ role: 'assistant', content: modelResponse });
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
            
            removeTypingIndicator(typingIndicator);
            addMessage('system', `❌ Failed to get AI feedback\n\n${errorDetails}`);
        }
    } catch (error) {
        removeTypingIndicator(typingIndicator);
        addMessage('system', `❌ Error: ${error.message}\n\nPlease check your connection and try again.`);
        console.error('Error getting AI feedback:', error);
    } finally {
        askAiFeedbackBtn.disabled = false;
        askAiFeedbackBtn.innerHTML = originalText;
    }
});

function buildFeedbackPrompt(draft) {
    const systemPrompt = buildSystemPrompt();
    const adviceContext = currentAdvicePost 
        ? `\n\nAdvice request:\n${currentAdvicePost}\n`
        : '';
    
    return `${systemPrompt}

${adviceContext}

The user has written a draft of their advice response and is asking for feedback. Here is their draft:

---
${draft}
---

CRITICAL INSTRUCTIONS FOR FEEDBACK:
- DO NOT rewrite or rephrase their draft
- DO NOT provide a corrected version
- Provide specific, concrete suggestions for improvement
- Point out specific areas that need work (e.g., "The second paragraph could be clearer about...")
- Suggest what to add, remove, or modify
- Encourage the user to make edits themselves
- Focus on clarity, structure, tone, and effectiveness
- Be concise and actionable

Provide feedback that helps the user improve their draft through their own editing.`;
}

// Focus on input on load
window.addEventListener('load', async () => {
    await loadAdvicePost();
    // Add initial greeting after loading advice post
    addMessage('assistant', getInitialGreeting());
    messageInput.focus();
});

