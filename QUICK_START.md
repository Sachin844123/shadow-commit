# Quick Start Guide

Get QuickFix Lite up and running in 5 minutes!

## Prerequisites Check

- [ ] Firebase account (free tier works)
- [ ] Modern web browser (Chrome, Firefox, Edge, Safari)
- [ ] Local web server (see options below)

## Quick Setup (5 Steps)

### 1. Firebase Setup (3 minutes)

Follow the detailed guide in `FIREBASE_SETUP.md` or:

1. Create Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication → Email/Password
3. Create Realtime Database
4. Copy your config values

### 2. Configure Firebase (1 minute)

Open `scripts/firebase-config.js` and paste your Firebase config:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    // ... etc
};
```

### 3. Set Database Rules (30 seconds)

In Firebase Console → Realtime Database → Rules, paste:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid || !data.exists()"
      }
    },
    "requests": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

### 4. Start Local Server (30 seconds)

**Option A - Python:**
```bash
python -m http.server 8000
```

**Option B - Node.js:**
```bash
npx http-server
```

**Option C - VS Code:**
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

### 5. Test It! (1 minute)

1. Open `http://localhost:8000` in your browser
2. Click "Customer" → Register a test account
3. Login and create a service request
4. Open a new incognito window
5. Click "Service Provider" → Register as provider
6. Login and see the request appear!

## Testing Checklist

- [ ] Landing page loads with animations
- [ ] Customer registration works
- [ ] Customer login works
- [ ] Customer can create service request
- [ ] Provider registration works
- [ ] Provider login works
- [ ] Provider can see assigned requests
- [ ] Provider can update request status
- [ ] Status updates appear in real-time for customer
- [ ] Toast notifications appear
- [ ] Mobile responsive design works

## Common Issues

**"Firebase not initialized"**
→ Check `firebase-config.js` has correct values

**"Permission denied"**
→ Check database rules are published

**"Cannot read property..."**
→ Open browser console, check for errors

**Page not loading**
→ Make sure you're using a local server (not file://)

## Next Steps

- Customize colors in `styles/main.css`
- Add more service types
- Enhance UI animations
- Add more features!

---

**Need help?** Check `README.md` for detailed documentation.
