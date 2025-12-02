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

// Human Effort Score tracking
const situationScrollCount = document.getElementById('situationScrollCount');
const chatScrollCount = document.getElementById('chatScrollCount');
const responseTypingCount = document.getElementById('responseTypingCount');
const chatTypingCount = document.getElementById('chatTypingCount');
const aiPromptCount = document.getElementById('aiPromptCount');
const aiFeedbackCount = document.getElementById('aiFeedbackCount');
const draftSimilarity = document.getElementById('draftSimilarity');
const timeOnPage = document.getElementById('timeOnPage');
const hesScore = document.getElementById('hesScore');
const totalCount = document.getElementById('totalCount');

// Score tracking variables
let scores = {
    situationScroll: 0,
    chatScroll: 0,
    responseTyping: 0,
    chatTyping: 0,
    aiPrompts: 0,
    aiFeedback: 0,
    timeOnPageSeconds: 0
};

// Store all AI-generated text for similarity comparison
let aiGeneratedTexts = [];

// Stopwatch variables
let stopwatchStartTime = null;
let stopwatchInterval = null;

// Human Effort Score weights (configurable - experiment with these values)
const hesWeights = {
    situationScroll: 0.1,      // Weight for scrolling situation box
    chatScroll: 0.1,           // Weight for scrolling chat
    responseTyping: 2,       // Weight for typing in response input (higher - more effort)
    chatTyping: 1,           // Weight for typing in chat input
    aiPrompts: 1,           // Positive weight - using AI increases effort
    aiFeedback: 1,          // Positive weight - using AI feedback increases effort
    draftSimilarity: -2,     // Negative weight - copying AI text reduces effort (more negative = more penalty)
    timeOnPage: 0.1         // Weight for time spent (seconds converted to score)
};

// Throttle function to limit event frequency
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Calculate text similarity using Levenshtein distance (normalized)
function calculateSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    // Normalize texts: lowercase, remove extra whitespace
    const normalize = (str) => str.toLowerCase().replace(/\s+/g, ' ').trim();
    const norm1 = normalize(text1);
    const norm2 = normalize(text2);
    
    if (norm1 === norm2) return 100;
    if (norm1.length === 0 || norm2.length === 0) return 0;
    
    // Check if one text contains the other (substring match)
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
        const shorter = Math.min(norm1.length, norm2.length);
        const longer = Math.max(norm1.length, norm2.length);
        return Math.round((shorter / longer) * 100);
    }
    
    // Calculate Levenshtein distance
    const len1 = norm1.length;
    const len2 = norm2.length;
    const matrix = [];
    
    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            if (norm1[i - 1] === norm2[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,     // deletion
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j - 1] + 1 // substitution
                );
            }
        }
    }
    
    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    const similarity = Math.round((1 - distance / maxLen) * 100);
    
    return Math.max(0, similarity);
}

// Calculate what percentage of the draft is AI-generated (original vs copied)
function calculateDraftSimilarity(draft) {
    if (!draft || draft.trim().length === 0) return 0;
    if (aiGeneratedTexts.length === 0) return 0;
    
    // Normalize the draft
    const normalizedDraft = draft.toLowerCase().replace(/\s+/g, ' ').trim();
    const draftLength = normalizedDraft.length;
    
    if (draftLength === 0) return 0;
    
    // Track which characters/segments are AI-generated
    // We'll use a sliding window approach to find matching segments
    const aiGeneratedLength = new Set(); // Store indices of AI-generated characters
    
    // Compare with each AI-generated text
    for (const aiText of aiGeneratedTexts) {
        const normalizedAI = aiText.toLowerCase().replace(/\s+/g, ' ').trim();
        
        if (normalizedAI.length === 0) continue;
        
        // Use sliding window to find matching segments
        // Check segments of different lengths (from 10 chars to full text)
        const minSegmentLength = 10; // Minimum segment length to consider
        
        // Check for exact substring matches
        for (let segmentLength = Math.min(draftLength, normalizedAI.length); 
             segmentLength >= minSegmentLength; 
             segmentLength--) {
            
            // Slide through the draft
            for (let i = 0; i <= draftLength - segmentLength; i++) {
                const draftSegment = normalizedDraft.substring(i, i + segmentLength);
                
                // Check if this segment exists in AI text
                if (normalizedAI.includes(draftSegment)) {
                    // Mark all characters in this segment as AI-generated
                    for (let j = i; j < i + segmentLength; j++) {
                        aiGeneratedLength.add(j);
                    }
                }
            }
        }
        
        // Also check if the entire draft is contained in AI text (full copy-paste)
        if (normalizedAI.includes(normalizedDraft)) {
            // Mark all characters as AI-generated
            for (let i = 0; i < draftLength; i++) {
                aiGeneratedLength.add(i);
            }
        }
        
        // Check if entire AI text is contained in draft (copy-paste of full AI response)
        if (normalizedDraft.includes(normalizedAI)) {
            // Find where AI text appears in draft
            const startIndex = normalizedDraft.indexOf(normalizedAI);
            for (let i = startIndex; i < startIndex + normalizedAI.length; i++) {
                aiGeneratedLength.add(i);
            }
        }
    }
    
    // Calculate percentage: (AI-generated characters / total characters) × 100
    const aiGeneratedCount = aiGeneratedLength.size;
    const percentage = Math.round((aiGeneratedCount / draftLength) * 100);
    
    return Math.min(100, Math.max(0, percentage));
}

// Format time as MM:SS
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Calculate Human Effort Score (HES) using weighted sum
function calculateHES() {
    const draft = commentInput.value.trim();
    const similarity = calculateDraftSimilarity(draft);
    
    // Calculate weighted sum
    let hes = 0;
    
    // Positive contributions (effort)
    hes += scores.situationScroll * hesWeights.situationScroll;
    hes += scores.chatScroll * hesWeights.chatScroll;
    hes += scores.responseTyping * hesWeights.responseTyping;
    hes += scores.chatTyping * hesWeights.chatTyping;
    
    // Negative contributions (reduced effort / AI assistance)
    hes += scores.aiPrompts * hesWeights.aiPrompts;
    hes += scores.aiFeedback * hesWeights.aiFeedback;
    hes += similarity * hesWeights.draftSimilarity; // Similarity is already a percentage
    
    // Time contribution
    hes += scores.timeOnPageSeconds * hesWeights.timeOnPage;
    
    // Ensure score doesn't go below 0
    return Math.max(0, Math.round(hes));
}

// Update score display
function updateScoreDisplay() {
    situationScrollCount.textContent = scores.situationScroll;
    chatScrollCount.textContent = scores.chatScroll;
    responseTypingCount.textContent = scores.responseTyping;
    chatTypingCount.textContent = scores.chatTyping;
    aiPromptCount.textContent = scores.aiPrompts;
    aiFeedbackCount.textContent = scores.aiFeedback;
    
    // Calculate and display draft similarity
    const draft = commentInput.value.trim();
    const similarity = calculateDraftSimilarity(draft);
    draftSimilarity.textContent = similarity + '%';
    
    // Update time display
    timeOnPage.textContent = formatTime(scores.timeOnPageSeconds);
    
    // Calculate and display HES
    const hes = calculateHES();
    hesScore.textContent = hes;
    
    const total = scores.situationScroll + scores.chatScroll + scores.responseTyping + scores.chatTyping + scores.aiPrompts + scores.aiFeedback;
    totalCount.textContent = total;
}

// Start stopwatch
function startStopwatch() {
    stopwatchStartTime = Date.now();
    
    // Update every second
    stopwatchInterval = setInterval(() => {
        const elapsed = (Date.now() - stopwatchStartTime) / 1000; // Convert to seconds
        scores.timeOnPageSeconds = elapsed;
        updateScoreDisplay();
    }, 1000);
}

// Initialize score tracking
function initializeScoreTracking() {
    // Track scrolling in situation box
    const advicePostContent = document.querySelector('.advice-post-content');
    if (advicePostContent) {
        advicePostContent.addEventListener('scroll', throttle(function() {
            scores.situationScroll++;
            updateScoreDisplay();
        }, 100)); // Throttle to once per 100ms
    }
    
    // Track scrolling in AI chat box
    if (chatMessages) {
        chatMessages.addEventListener('scroll', throttle(function() {
            scores.chatScroll++;
            updateScoreDisplay();
        }, 100)); // Throttle to once per 100ms
    }
    
    // Track typing in response input and update similarity in real-time
    if (commentInput) {
        commentInput.addEventListener('input', function() {
            scores.responseTyping++;
            // Update similarity calculation in real-time
            updateScoreDisplay();
        });
    }
    
    // Track typing in AI chat input
    if (messageInput) {
        messageInput.addEventListener('input', function() {
            scores.chatTyping++;
            updateScoreDisplay();
        });
    }
}

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
    
    // Track AI prompt
    scores.aiPrompts++;
    updateScoreDisplay();
    
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
            
            // Store AI-generated text for similarity comparison
            aiGeneratedTexts.push(modelResponse);
            // Update similarity when new AI text is added
            updateScoreDisplay();
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
        // Store AI-generated text for similarity comparison (skip HTML-only messages like initial greeting)
        if (!text.includes('<ul') && !text.includes('<li')) {
            aiGeneratedTexts.push(text);
        }
        
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
    
    // Update similarity if this is an assistant message
    if (type === 'assistant' && !text.includes('<ul')) {
        updateScoreDisplay();
    }
}

function buildSystemPrompt() {
    const adviceContext = currentAdvicePost 
        ? `\n\nAdvice request:\n${currentAdvicePost}\n`
        : '';
    
    return `You are an expert Writing Assistant. Your goal is to help the user (The Advisor) draft a supportive response to an anonymous person (The Advisee).

<roles>
You: The Writing Assistant (helpful, concise, objective).
User: The Advisor (writing the advice).
Target Audience: The Advisee (the person described in the context below).
</roles>

<instruction>
The user will ask you for help drafting parts of their response. 
- If the user asks for an opening sentence, write one FROM the User TO the Advisee.
- Never write from the perspective of the person having the problem.
- Keep the tone empathetic but practical.
</instruction>

<advice_context_reference>
${adviceContext}
</advice_context_reference>

respond_to_user:`;
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
    
    // Track AI feedback request
    scores.aiFeedback++;
    updateScoreDisplay();
    
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
            
            // Store AI-generated text for similarity comparison
            aiGeneratedTexts.push(modelResponse);
            // Update similarity when new AI text is added
            updateScoreDisplay();
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
    // Initialize score tracking
    initializeScoreTracking();
    // Start stopwatch
    startStopwatch();
    // Initialize score display
    updateScoreDisplay();
    messageInput.focus();
});

// Clean up interval on page unload
window.addEventListener('beforeunload', () => {
    if (stopwatchInterval) {
        clearInterval(stopwatchInterval);
    }
});

