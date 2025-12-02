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

// Track last draft sent for AI feedback (to prevent abuse)
let lastFeedbackDraft = '';

// Stopwatch variables
let stopwatchStartTime = null;
let stopwatchInterval = null;

// Typing pattern detection to prevent gaming
const typingPatterns = {
    responseInput: {
        previousValue: '',
        previousLength: 0,
        lastChangeTime: Date.now(),
        consecutiveRepeats: 0,
        lastChar: '',
        changeHistory: [] // Track recent changes
    },
    chatInput: {
        previousValue: '',
        previousLength: 0,
        lastChangeTime: Date.now(),
        consecutiveRepeats: 0,
        lastChar: '',
        changeHistory: []
    }
};

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

// Debounce function to delay execution until after user stops typing
function debounce(func, delay) {
    let timeoutId;
    return function() {
        const args = arguments;
        const context = this;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(context, args), delay);
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

// Update score display (without similarity calculation for performance)
function updateScoreDisplayFast() {
    situationScrollCount.textContent = scores.situationScroll;
    chatScrollCount.textContent = scores.chatScroll;
    responseTypingCount.textContent = scores.responseTyping;
    chatTypingCount.textContent = scores.chatTyping;
    aiPromptCount.textContent = scores.aiPrompts;
    aiFeedbackCount.textContent = scores.aiFeedback;
    
    // Update time display
    timeOnPage.textContent = formatTime(scores.timeOnPageSeconds);
    
    const total = scores.situationScroll + scores.chatScroll + scores.responseTyping + scores.chatTyping + scores.aiPrompts + scores.aiFeedback;
    totalCount.textContent = total;
}

// Update score display with similarity calculation (expensive)
function updateScoreDisplay() {
    situationScrollCount.textContent = scores.situationScroll;
    chatScrollCount.textContent = scores.chatScroll;
    responseTypingCount.textContent = scores.responseTyping;
    chatTypingCount.textContent = scores.chatTyping;
    aiPromptCount.textContent = scores.aiPrompts;
    aiFeedbackCount.textContent = scores.aiFeedback;
    
    // Calculate and display draft similarity (expensive operation)
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

// Debounced version of updateScoreDisplay for typing events
const debouncedUpdateScoreDisplay = debounce(updateScoreDisplay, 500);

// Start stopwatch
function startStopwatch() {
    stopwatchStartTime = Date.now();
    
    // Update every second (use fast version to avoid expensive similarity calculation)
    stopwatchInterval = setInterval(() => {
        const elapsed = (Date.now() - stopwatchStartTime) / 1000; // Convert to seconds
        scores.timeOnPageSeconds = elapsed;
        // Use fast update for timer (similarity doesn't change with time)
        updateScoreDisplayFast();
        // Only update similarity/HES occasionally (every 5 seconds)
        if (Math.floor(elapsed) % 5 === 0) {
            updateScoreDisplay();
        }
    }, 1000);
}

// Check if typing is valid (not repetitive or meaningless)
function isValidTyping(currentValue, pattern, currentLength, now, inputType) {
    const timeSinceLastChange = now - pattern.lastChangeTime;
    
    // If length decreased, it's deletion (already filtered by keydown, but double-check)
    if (currentLength < pattern.previousLength) {
        return false;
    }
    
    // Check for rapid repetitive typing (same character repeated quickly)
    if (currentLength > pattern.previousLength) {
        const addedChar = currentValue[currentLength - 1];
        
        // If same character as last time, check for repetition
        if (addedChar === pattern.lastChar && timeSinceLastChange < 100) {
            pattern.consecutiveRepeats++;
            
            // If same character repeated 5+ times quickly, ignore
            if (pattern.consecutiveRepeats >= 5) {
                showNotification('⚠️ Repetitive typing detected. This will not count toward your score.', 'warning');
                return false;
            }
        } else {
            pattern.consecutiveRepeats = 0;
        }
        
        pattern.lastChar = addedChar;
    }
    
    // Check for repeated words/phrases (e.g., "asdf asdf asdf" or "hello hello hello")
    if (currentLength >= 6) { // Only check if there's enough text
        const words = currentValue.toLowerCase().trim().split(/\s+/);
        
        // Check if same word appears 3+ times consecutively
        if (words.length >= 3) {
            let consecutiveRepeats = 1;
            let lastWord = words[0];
            
            for (let i = 1; i < words.length; i++) {
                if (words[i] === lastWord) {
                    consecutiveRepeats++;
                    if (consecutiveRepeats >= 3) {
                        showNotification('⚠️ Repeated words detected. This will not count toward your score.', 'warning');
                        return false; // Same word repeated 3+ times
                    }
                } else {
                    consecutiveRepeats = 1;
                    lastWord = words[i];
                }
            }
        }
        
        // Check for repeated short sequences (2-6 characters) like "asdf asdf asdf"
        const normalizedValue = currentValue.toLowerCase().trim();
        const minSequenceLength = 2;
        const maxSequenceLength = 6;
        
        for (let seqLen = minSequenceLength; seqLen <= maxSequenceLength; seqLen++) {
            if (normalizedValue.length < seqLen * 3) continue; // Need at least 3 repetitions
            
            // Extract potential sequences
            const sequences = [];
            for (let i = 0; i <= normalizedValue.length - seqLen; i++) {
                const seq = normalizedValue.substring(i, i + seqLen);
                // Only consider sequences that are separated by spaces or are at word boundaries
                if (i === 0 || normalizedValue[i - 1] === ' ' || 
                    (i + seqLen < normalizedValue.length && normalizedValue[i + seqLen] === ' ')) {
                    sequences.push({ seq, pos: i });
                }
            }
            
            // Check for repeated sequences
            if (sequences.length >= 3) {
                for (let i = 0; i < sequences.length - 2; i++) {
                    const seq1 = sequences[i].seq;
                    const seq2 = sequences[i + 1].seq;
                    const seq3 = sequences[i + 2].seq;
                    
                    // Check if three consecutive sequences are the same
                    if (seq1 === seq2 && seq2 === seq3 && seq1.length >= 2) {
                        // Verify they're separated (not part of a longer word)
                        const pos1 = sequences[i].pos;
                        const pos2 = sequences[i + 1].pos;
                        const pos3 = sequences[i + 2].pos;
                        
                        // Check if sequences are properly separated
                        const gap1 = pos2 - (pos1 + seqLen);
                        const gap2 = pos3 - (pos2 + seqLen);
                        
                        // If gaps are small (0-2 chars, allowing for spaces), it's a repeat
                        if (gap1 <= 2 && gap2 <= 2) {
                            showNotification('⚠️ Repeated phrases detected. This will not count toward your score.', 'warning');
                            return false;
                        }
                    }
                }
            }
        }
        
        // Check for character-level patterns (e.g., "ababab" or "abcabcabc")
        if (normalizedValue.length >= 6) {
            // Check for 2-4 character patterns repeated
            for (let patternLen = 2; patternLen <= 4; patternLen++) {
                if (normalizedValue.length < patternLen * 3) continue;
                
                const pattern = normalizedValue.substring(0, patternLen);
                let matches = 1;
                
                // Check if pattern repeats
                for (let i = patternLen; i <= normalizedValue.length - patternLen; i += patternLen) {
                    const nextPattern = normalizedValue.substring(i, i + patternLen);
                    if (nextPattern === pattern) {
                        matches++;
                    if (matches >= 3) {
                        showNotification('⚠️ Repetitive pattern detected. This will not count toward your score.', 'warning');
                        return false; // Pattern repeated 3+ times
                    }
                    } else {
                        break;
                    }
                }
            }
        }
    }
    
    // Check for typing and erasing repeatedly (oscillating length)
    pattern.changeHistory.push({
        length: currentLength,
        time: now,
        value: currentValue
    });
    
    // Keep only last 10 changes
    if (pattern.changeHistory.length > 10) {
        pattern.changeHistory.shift();
    }
    
    // If length oscillates between similar values repeatedly, it's meaningless
    if (pattern.changeHistory.length >= 6) {
        const recent = pattern.changeHistory.slice(-6);
        const lengths = recent.map(c => c.length);
        const uniqueLengths = new Set(lengths);
        
        // If oscillating between 2-3 similar lengths, likely meaningless
        if (uniqueLengths.size <= 3) {
            const variance = Math.max(...lengths) - Math.min(...lengths);
            if (variance <= 5) { // Small variance, likely meaningless typing
                showNotification('⚠️ Meaningless typing detected. This will not count toward your score.', 'warning');
                return false;
            }
        }
    }
    
    // Check for very rapid typing (likely spam)
    if (timeSinceLastChange < 50 && currentLength === pattern.previousLength + 1) {
        // Very fast single character addition might be spam
        // But allow it if it's part of normal typing
        return true; // Allow for now, consecutive repeats check will catch spam
    }
    
    return true;
}

// Update typing pattern tracking
function updateTypingPattern(pattern, currentValue, currentLength, now) {
    pattern.previousValue = currentValue;
    pattern.previousLength = currentLength;
    pattern.lastChangeTime = now;
}

// Check if AI prompt is relevant to the advice-writing context
async function checkPromptRelevance(userPrompt) {
    if (!userPrompt || userPrompt.trim().length < 10) {
        return { relevant: true, reason: 'Prompt too short' };
    }
    
    const adviceContext = currentAdvicePost || 'Someone is asking for advice on a personal situation.';
    
    const relevanceCheckPrompt = `You are checking if a user's question is relevant to helping them write advice.

Context: The user is writing advice to help someone with this situation:
${adviceContext}

User's question: "${userPrompt}"

Is this question relevant to helping write advice? Respond with ONLY "YES" or "NO" followed by a brief reason (one sentence).

Examples of RELEVANT questions:
- "How should I start my advice?"
- "What tone should I use?"
- "Is this sentence clear?"
- "What should I include?"

Examples of IRRELEVANT questions:
- "What's the weather?"
- "Tell me a joke"
- "What's 2+2?"
- Random unrelated questions`;

    try {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const url = isLocalhost 
            ? `${OLLAMA_API_URL}/api/generate`
            : `${OLLAMA_API_URL}?endpoint=/api/generate`;
        
        const requestBody = {
            model: MODEL_NAME,
            prompt: relevanceCheckPrompt,
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
            const result = data.response || '';
            const isRelevant = result.toUpperCase().includes('YES');
            
            return {
                relevant: isRelevant,
                reason: result
            };
        } else {
            // If check fails, assume relevant (don't block user)
            return { relevant: true, reason: 'Relevance check failed' };
        }
    } catch (error) {
        console.error('Relevance check error:', error);
        // If check fails, assume relevant (don't block user)
        return { relevant: true, reason: 'Relevance check error' };
    }
}

// Show notification in corner
function showNotification(message, type = 'warning') {
    // Remove existing notification if any
    const existing = document.getElementById('hes-notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.id = 'hes-notification';
    notification.className = `hes-notification hes-notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 5000);
}

// Initialize score tracking
function initializeScoreTracking() {
    // Scroll tracking disabled for performance
    // Track scrolling in situation box
    // const advicePostContent = document.querySelector('.advice-post-content');
    // if (advicePostContent) {
    //     advicePostContent.addEventListener('scroll', throttle(function() {
    //         scores.situationScroll++;
    //         updateScoreDisplay();
    //     }, 100)); // Throttle to once per 100ms
    // }
    
    // Track scrolling in AI chat box
    // if (chatMessages) {
    //     chatMessages.addEventListener('scroll', throttle(function() {
    //         scores.chatScroll++;
    //         updateScoreDisplay();
    //     }, 100)); // Throttle to once per 100ms
    // }
    
    // Track typing in response input with pattern detection
    if (commentInput) {
        commentInput.addEventListener('keydown', function(e) {
            // Don't count backspace
            if (e.key === 'Backspace' || e.key === 'Delete') {
                return;
            }
        });
        
        commentInput.addEventListener('input', function(e) {
            const currentValue = this.value;
            const pattern = typingPatterns.responseInput;
            const currentLength = currentValue.length;
            const now = Date.now();
            
            // Update word count display
            const wordCount = countWords(currentValue);
            const wordCountElement = document.getElementById('wordCount');
            if (wordCountElement) {
                wordCountElement.textContent = `${wordCount} word${wordCount !== 1 ? 's' : ''}`;
                // Change color if below threshold
                if (wordCount < 31) {
                    wordCountElement.style.color = '#dc3545';
                } else {
                    wordCountElement.style.color = '#333';
                }
            }
            
            // Check if this is valid typing (not repetitive or meaningless)
            if (isValidTyping(currentValue, pattern, currentLength, now, 'response')) {
                scores.responseTyping++;
                // Update fast display (without expensive similarity calculation)
                updateScoreDisplayFast();
                // Debounce expensive similarity calculation
                debouncedUpdateScoreDisplay();
            }
            
            // Update pattern tracking
            updateTypingPattern(pattern, currentValue, currentLength, now);
        });
    }
    
    // Track typing in AI chat input with pattern detection
    if (messageInput) {
        messageInput.addEventListener('keydown', function(e) {
            // Don't count backspace
            if (e.key === 'Backspace' || e.key === 'Delete') {
                return;
            }
        });
        
        messageInput.addEventListener('input', function(e) {
            const currentValue = this.value;
            const pattern = typingPatterns.chatInput;
            const currentLength = currentValue.length;
            const now = Date.now();
            
            // Check if this is valid typing (not repetitive or meaningless)
            if (isValidTyping(currentValue, pattern, currentLength, now, 'chat')) {
                scores.chatTyping++;
                // Update fast display (without expensive similarity calculation)
                updateScoreDisplayFast();
                // Debounce expensive similarity calculation
                debouncedUpdateScoreDisplay();
            }
            
            // Update pattern tracking
            updateTypingPattern(pattern, currentValue, currentLength, now);
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
    
    // Add user message first (for better UX)
    addMessage('user', message);
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Disable send button temporarily
    sendBtn.disabled = true;
    messageInput.disabled = true;
    
    // Check if prompt is relevant before counting and processing
    const relevanceCheck = await checkPromptRelevance(message);
    
    if (!relevanceCheck.relevant) {
        // Show warning notification
        showNotification('⚠️ Your question is not relevant to writing advice. Please ask questions related to crafting your response.', 'warning');
        // Don't increment count, don't send to AI
        // Show a response indicating the question is off-topic
        addMessage('assistant', 'I can only help you with writing your advice response. Please ask questions related to crafting your advice, such as tone, structure, or clarity.');
        sendBtn.disabled = false;
        messageInput.disabled = false;
        messageInput.focus();
        return;
    }
    
    // Track AI prompt (only if relevant)
    scores.aiPrompts++;
    // Use fast update - similarity doesn't change when sending prompt
    updateScoreDisplayFast();
    
    // Add to conversation history
    conversationHistory.push({ role: 'user', content: message });
    
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
            // Update similarity when new AI text is added (full update needed)
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

// Count words in text
function countWords(text) {
    if (!text || text.trim().length === 0) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

// Calculate similarity percentage between two texts
function calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    const normalize = (str) => str.toLowerCase().replace(/\s+/g, ' ').trim();
    const norm1 = normalize(text1);
    const norm2 = normalize(text2);
    
    if (norm1 === norm2) return 100;
    if (norm1.length === 0 || norm2.length === 0) return 0;
    
    // Use Levenshtein distance
    const len1 = norm1.length;
    const len2 = norm2.length;
    const matrix = [];
    
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            if (norm1[i - 1] === norm2[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + 1
                );
            }
        }
    }
    
    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return Math.round((1 - distance / maxLen) * 100);
}

// Stop the stopwatch
function stopStopwatch() {
    if (stopwatchInterval) {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
    }
    // Final update of time
    if (stopwatchStartTime) {
        scores.timeOnPageSeconds = (Date.now() - stopwatchStartTime) / 1000;
        updateScoreDisplay();
    }
}

// Collect all submission data
function collectSubmissionData() {
    const draft = commentInput.value.trim();
    const wordCount = countWords(draft);
    const similarity = calculateDraftSimilarity(draft);
    
    // Get all chat messages
    const chatMessagesElements = chatMessages.querySelectorAll('.message');
    const chatHistory = [];
    
    chatMessagesElements.forEach(msgEl => {
        const type = msgEl.classList.contains('user') ? 'user' : 
                     msgEl.classList.contains('assistant') ? 'assistant' : 
                     msgEl.classList.contains('system') ? 'system' : 'unknown';
        
        const contentDiv = msgEl.querySelector('.message-content');
        if (contentDiv) {
            const label = contentDiv.querySelector('strong');
            const textDiv = contentDiv.querySelector('div');
            const text = textDiv ? textDiv.textContent.trim() : '';
            
            if (text) {
                chatHistory.push({
                    type: type,
                    label: label ? label.textContent : '',
                    content: text,
                    timestamp: new Date().toISOString() // Approximate timestamp
                });
            }
        }
    });
    
    return {
        timestamp: new Date().toISOString(),
        advicePost: currentAdvicePost,
        finalResponse: draft,
        wordCount: wordCount,
        draftSimilarity: similarity,
        humanEffortScore: {
            raw: scores,
            calculated: calculateHES(),
            weights: hesWeights
        },
        chatHistory: chatHistory,
        conversationHistory: conversationHistory,
        aiGeneratedTexts: aiGeneratedTexts.length,
        metrics: {
            totalInteractions: scores.situationScroll + scores.chatScroll + 
                             scores.responseTyping + scores.chatTyping + 
                             scores.aiPrompts + scores.aiFeedback,
            timeOnPage: {
                seconds: Math.round(scores.timeOnPageSeconds),
                formatted: formatTime(scores.timeOnPageSeconds)
            }
        }
    };
}

// Download JSON file
function downloadJSON(data, filename) {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Upload to Google Drive (requires Google Drive API setup)
async function uploadToGoogleDrive(jsonData) {
    // This would require:
    // 1. Google Drive API credentials
    // 2. OAuth authentication
    // 3. Server-side proxy (for security)
    // 
    // Example structure:
    // const response = await fetch('/api/upload-to-drive', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ data: jsonData })
    // });
    
    console.log('Google Drive upload not configured. Downloading file instead.');
    return false;
}

// Email submission via Resend API
async function emailSubmission(jsonData) {
    try {
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ submissionData: jsonData })
        });

        if (response.ok) {
            const result = await response.json();
            return { success: true, message: result.message || 'Email sent successfully' };
        } else {
            const error = await response.json();
            return { success: false, message: error.message || 'Failed to send email' };
        }
    } catch (error) {
        console.error('Email submission error:', error);
        return { success: false, message: error.message || 'Network error while sending email' };
    }
}

// Handle comment submit
commentSubmitBtn.addEventListener('click', async function(e) {
    e.preventDefault();
    const draft = commentInput.value.trim();
    
    if (!draft) {
        showNotification('⚠️ Please write a response before submitting.', 'warning');
        return;
    }
    
    // Show confirmation dialog
    const confirmed = confirm(
        'Are you sure you want to submit your response?\n\n' +
        'This will:\n' +
        '- Stop the timer\n' +
        '- Save all data to a JSON file\n' +
        '- Complete your submission\n\n' +
        'Click OK to proceed or Cancel to continue editing.'
    );
    
    if (!confirmed) {
        return;
    }
    
    // Stop the stopwatch
    stopStopwatch();
    
    // Disable submit button to prevent double submission
    commentSubmitBtn.disabled = true;
    commentSubmitBtn.innerHTML = '<span>Submitting...</span>';
    
    // Collect all data
    const submissionData = collectSubmissionData();
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `advice-response-submission-${timestamp}.json`;
    
    // Download JSON file
    downloadJSON(submissionData, filename);
    
    // Try to send email
    const emailResult = await emailSubmission(submissionData);
    
    if (emailResult.success) {
        showNotification('✅ Submission complete! Email sent and JSON file downloaded.', 'success');
    } else {
        // Email failed, but file was downloaded
        showNotification(`⚠️ JSON file downloaded, but email failed: ${emailResult.message}`, 'warning');
    }
    
    // Update button
    setTimeout(() => {
        commentSubmitBtn.disabled = false;
        commentSubmitBtn.innerHTML = '<span>Submitted</span>';
        commentSubmitBtn.style.opacity = '0.6';
        commentSubmitBtn.style.cursor = 'not-allowed';
    }, 1000);
});

// Handle Ask AI Feedback button
askAiFeedbackBtn.addEventListener('click', async function(e) {
    e.preventDefault();
    const draft = commentInput.value.trim();
    
    if (!draft) {
        addMessage('system', 'Please write a draft in the text box before asking for feedback.');
        showNotification('⚠️ Please write a draft before asking for feedback.', 'warning');
        return;
    }
    
    // Validate word count (must be more than 30 words)
    const wordCount = countWords(draft);
    if (wordCount <= 30) {
        addMessage('system', `Your draft has ${wordCount} words. Please write at least 31 words before asking for feedback.`);
        showNotification(`⚠️ Draft too short (${wordCount} words). Need at least 31 words for feedback.`, 'warning');
        return;
    }
    
    // Validate that draft is significantly different from last feedback draft (at least 10% different)
    if (lastFeedbackDraft) {
        const similarity = calculateTextSimilarity(draft, lastFeedbackDraft);
        const difference = 100 - similarity;
        
        if (difference < 10) {
            addMessage('system', `Your draft is ${difference.toFixed(1)}% different from your last feedback request. Please make at least 10% changes before requesting feedback again.`);
            showNotification(`⚠️ Draft too similar to last feedback (${difference.toFixed(1)}% different). Need at least 10% changes.`, 'warning');
            return;
        }
    }
    
    // Track AI feedback request (only if validation passes)
    scores.aiFeedback++;
    // Use fast update - similarity doesn't change when requesting feedback
    updateScoreDisplayFast();
    
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
            // Store this draft as the last feedback draft
            lastFeedbackDraft = draft;
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

