// Vercel Serverless Function - Send Email via Resend
// This sends submission data via email using Resend API

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    // Get environment variables
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL || process.env.EMAIL_TO;
    const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';
    
    if (!RESEND_API_KEY) {
        console.error('RESEND_API_KEY not configured');
        res.status(500).json({ 
            error: 'Email service not configured',
            message: 'RESEND_API_KEY environment variable is missing'
        });
        return;
    }

    if (!RECIPIENT_EMAIL) {
        console.error('RECIPIENT_EMAIL not configured');
        res.status(500).json({ 
            error: 'Email recipient not configured',
            message: 'RECIPIENT_EMAIL environment variable is missing'
        });
        return;
    }

    try {
        const { submissionData } = req.body;

        if (!submissionData) {
            res.status(400).json({ error: 'Missing submissionData in request body' });
            return;
        }

        // Format the email content
        const timestamp = new Date(submissionData.timestamp).toLocaleString();
        const emailSubject = `Advice Response Submission - ${timestamp}`;
        
        // Create HTML email body
        const emailHtml = `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border: 1px solid #e0e0e0; }
        .section { margin-bottom: 20px; }
        .section-title { font-weight: bold; color: #667eea; margin-bottom: 10px; font-size: 18px; }
        .metric { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
        .metric-label { font-weight: 500; }
        .metric-value { color: #666; }
        .response-box { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0; }
        pre { background: #f4f4f4; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Advice Response Submission</h1>
            <p>Timestamp: ${timestamp}</p>
        </div>
        <div class="content">
            <div class="section">
                <div class="section-title">📊 Human Effort Score</div>
                <div class="metric"><span class="metric-label">Calculated HES:</span><span class="metric-value">${submissionData.humanEffortScore.calculated}</span></div>
                <div class="metric"><span class="metric-label">Time on Page:</span><span class="metric-value">${submissionData.metrics.timeOnPage.formatted}</span></div>
                <div class="metric"><span class="metric-label">Total Interactions:</span><span class="metric-value">${submissionData.metrics.totalInteractions}</span></div>
            </div>
            
            <div class="section">
                <div class="section-title">📝 Raw Metrics</div>
                <div class="metric"><span class="metric-label">Situation Scrolls:</span><span class="metric-value">${submissionData.humanEffortScore.raw.situationScroll}</span></div>
                <div class="metric"><span class="metric-label">Chat Scrolls:</span><span class="metric-value">${submissionData.humanEffortScore.raw.chatScroll}</span></div>
                <div class="metric"><span class="metric-label">Response Typing:</span><span class="metric-value">${submissionData.humanEffortScore.raw.responseTyping}</span></div>
                <div class="metric"><span class="metric-label">Chat Typing:</span><span class="metric-value">${submissionData.humanEffortScore.raw.chatTyping}</span></div>
                <div class="metric"><span class="metric-label">AI Prompts:</span><span class="metric-value">${submissionData.humanEffortScore.raw.aiPrompts}</span></div>
                <div class="metric"><span class="metric-label">AI Feedback Requests:</span><span class="metric-value">${submissionData.humanEffortScore.raw.aiFeedback}</span></div>
            </div>
            
            <div class="section">
                <div class="section-title">✍️ Final Response</div>
                <div class="response-box">
                    <p><strong>Word Count:</strong> ${submissionData.wordCount}</p>
                    <p><strong>Similarity to AI Text:</strong> ${submissionData.draftSimilarity}%</p>
                    <hr style="margin: 15px 0; border: none; border-top: 1px solid #e0e0e0;">
                    <div style="white-space: pre-wrap;">${submissionData.finalResponse.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">💬 Chat History</div>
                <p>Total messages: ${submissionData.chatHistory.length}</p>
            </div>
            
            <div class="section">
                <div class="section-title">📄 Full JSON Data</div>
                <pre>${JSON.stringify(submissionData, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
            </div>
        </div>
    </div>
</body>
</html>`;
        
        // Create plain text version
        const emailText = `Advice Response Submission

Timestamp: ${timestamp}

Human Effort Score: ${submissionData.humanEffortScore.calculated}
Time on Page: ${submissionData.metrics.timeOnPage.formatted}
Total Interactions: ${submissionData.metrics.totalInteractions}

Raw Metrics:
- Situation Scrolls: ${submissionData.humanEffortScore.raw.situationScroll}
- Chat Scrolls: ${submissionData.humanEffortScore.raw.chatScroll}
- Response Typing: ${submissionData.humanEffortScore.raw.responseTyping}
- Chat Typing: ${submissionData.humanEffortScore.raw.chatTyping}
- AI Prompts: ${submissionData.humanEffortScore.raw.aiPrompts}
- AI Feedback Requests: ${submissionData.humanEffortScore.raw.aiFeedback}

Final Response:
Word Count: ${submissionData.wordCount}
Similarity to AI Text: ${submissionData.draftSimilarity}%

${submissionData.finalResponse}

Full JSON data is available in the HTML version.`;

        // Send email via Resend API
        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: RECIPIENT_EMAIL,
                subject: emailSubject,
                html: emailHtml,
                text: emailText,
            }),
        });

        if (!resendResponse.ok) {
            const errorData = await resendResponse.json();
            throw new Error(errorData.message || `Resend API error: ${resendResponse.status}`);
        }

        const result = await resendResponse.json();
        
        res.status(200).json({
            success: true,
            message: 'Email sent successfully',
            emailId: result.id
        });

    } catch (error) {
        console.error('Email sending error:', error);
        res.status(500).json({
            error: 'Failed to send email',
            message: error.message
        });
    }
}
