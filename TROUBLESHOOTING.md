# Troubleshooting Guide

## 401 Unauthorized Error

If you're seeing `401 (Unauthorized)` errors when trying to load `auth.js` or `customer-auth.js`, follow these steps:

### Step 1: Verify Firebase Configuration

1. Open `scripts/firebase-config.js`
2. Ensure all values are filled in (not placeholders)
3. Verify your `databaseURL` is correct and ends with `/` (not `//`)

### Step 2: Check Firebase Console Settings

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Authentication** → **Sign-in method**
4. Ensure **Email/Password** is **enabled**
5. Go to **Realtime Database**
6. Verify database exists and is in the correct region

### Step 3: Verify Database Rules

In Firebase Console → Realtime Database → Rules:

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

Click **Publish** after updating.

### Step 4: Check Browser Console

1. Open browser Developer Tools (F12)
2. Go to **Console** tab
3. Look for specific error messages
4. Check **Network** tab for failed requests

### Step 5: Verify Local Server

**Important**: You MUST use a local web server, not `file://` protocol.

**Try these:**

```bash
# Python
python -m http.server 8000

# Node.js
npx http-server

# PHP
php -S localhost:8000
```

Then access: `http://localhost:8000`

### Step 6: Clear Browser Cache

1. Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
2. Clear cached files
3. Hard refresh: `Ctrl+F5` or `Cmd+Shift+R`

### Step 7: Check Firebase SDK Version

If errors persist, the Firebase SDK version might be incorrect. Try updating `scripts/firebase-config.js`:

Current version: `10.11.1`

If that doesn't work, try:
- `10.10.0`
- `10.9.0`
- `10.8.0`

### Step 8: Test Firebase Connection

Create a test file `test-firebase.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Firebase Test</title>
</head>
<body>
    <h1>Firebase Connection Test</h1>
    <div id="status">Testing...</div>
    <script type="module">
        import { auth, database } from './scripts/firebase-config.js';
        document.getElementById('status').textContent = 'Firebase loaded successfully!';
        console.log('Auth:', auth);
        console.log('Database:', database);
    </script>
</body>
</html>
```

Open this file through your local server. If it works, Firebase is configured correctly.

## Common Error Messages

### "Firebase: Error (auth/api-key-not-valid)"
- Your API key is incorrect
- Check `firebase-config.js` has the correct `apiKey`

### "Permission denied"
- Database rules are too restrictive
- Update rules as shown in Step 3

### "Failed to load resource: 401"
- Firebase SDK version might be wrong
- Try different version numbers (see Step 7)
- Check that you're using a local server

### "Cannot read property 'auth' of undefined"
- Firebase modules not loading
- Check browser console for import errors
- Verify you're using a local server

## Still Not Working?

1. **Check Firebase Project Status**: Ensure project is active and not suspended
2. **Verify Billing**: Free tier should work, but check if project has billing issues
3. **Try Different Browser**: Test in Chrome, Firefox, or Edge
4. **Disable Extensions**: Some browser extensions block Firebase
5. **Check Firewall**: Corporate firewalls might block Firebase CDN

## Getting Help

If you're still stuck:
1. Check browser console for full error messages
2. Check Network tab for failed requests
3. Verify all steps above
4. Try the test file from Step 8

---

**Note**: The 401 error usually means:
- Firebase SDK can't load (wrong URL/version)
- CORS issue (not using local server)
- Firebase project configuration issue
