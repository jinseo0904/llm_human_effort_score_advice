# Simple Static Chat Interface

A minimal, beautiful chat interface built with pure HTML, CSS, and JavaScript. No backend required - perfect for static hosting on Vercel!

## Features

- 🎨 Modern, gradient-based design
- 💬 Simple chat interface with message history
- 📱 Responsive design for mobile and desktop
- 🚀 Static site - no backend needed
- ⚡ Fast and lightweight
- 🎯 Easy to customize and extend

## Quick Start

### Local Development

Simply open `index.html` in your browser, or use a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js (with npx)
npx serve

# Using PHP
php -S localhost:8000
```

Then visit `http://localhost:8000`

### Deploy to Vercel

1. Install Vercel CLI (optional):
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

Or simply:
- Push to GitHub
- Import the repository in Vercel dashboard
- Deploy automatically!

## Customization

### Changing Colors

Edit `styles.css` to modify the gradient colors:

```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### Adding API Integration

Modify the `getResponse()` function in `script.js` to connect to your API:

```javascript
async function getResponse(message) {
    const response = await fetch('YOUR_API_ENDPOINT', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
    });
    const data = await response.json();
    return data.reply;
}
```

## File Structure

```
.
├── index.html      # Main HTML structure
├── styles.css      # Styling
├── script.js       # Chat functionality
├── vercel.json     # Vercel configuration
└── README.md       # This file
```

## Browser Support

Works on all modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## License

Free to use for any purpose.

