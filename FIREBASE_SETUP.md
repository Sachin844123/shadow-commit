# Firebase Setup Guide

This guide will help you set up Firebase for QuickFix Lite step by step.

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `quickfix-lite` (or any name you prefer)
4. Disable Google Analytics (optional, for simplicity)
5. Click **"Create project"**
6. Wait for project creation to complete
7. Click **"Continue"**

## Step 2: Enable Authentication

1. In Firebase Console, click **"Authentication"** in the left sidebar
2. Click **"Get started"** (if first time)
3. Go to **"Sign-in method"** tab
4. Click on **"Email/Password"**
5. Enable the first toggle (Email/Password)
6. Click **"Save"**

## Step 3: Create Realtime Database

1. In Firebase Console, click **"Realtime Database"** in the left sidebar
2. Click **"Create Database"**
3. Select a location (choose closest to your region)
4. Click **"Next"**
5. Choose **"Start in test mode"** (we'll update rules)
6. Click **"Enable"**
7. **Copy the database URL** - you'll need this!

## Step 4: Get Web App Configuration

1. In Firebase Console, click the **gear icon** (⚙️) next to "Project Overview"
2. Select **"Project settings"**
3. Scroll down to **"Your apps"** section
4. Click the **web icon** (`</>`) to add a web app
5. Register app:
   - App nickname: `QuickFix Lite Web`
   - Check "Also set up Firebase Hosting" (optional)
   - Click **"Register app"**
6. **Copy the firebaseConfig object** - you'll see something like:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## Step 5: Update firebase-config.js

1. Open `scripts/firebase-config.js` in your project
2. Replace the placeholder values with your actual Firebase config
3. **Important**: Add your database URL from Step 3:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_AUTH_DOMAIN_HERE",
    projectId: "YOUR_PROJECT_ID_HERE",
    storageBucket: "YOUR_STORAGE_BUCKET_HERE",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
    appId: "YOUR_APP_ID_HERE",
    databaseURL: "YOUR_DATABASE_URL_HERE"  // From Step 3
};
```

## Step 6: Set Up Database Rules

1. In Firebase Console, go to **Realtime Database**
2. Click on **"Rules"** tab
3. Replace the default rules with:

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
      ".write": "auth != null",
      "$requestId": {
        ".read": "auth != null && (data.child('customerId').val() === auth.uid || data.child('assignedProviderId').val() === auth.uid)",
        ".write": "auth != null && (data.child('customerId').val() === auth.uid || data.child('assignedProviderId').val() === auth.uid || !data.exists())"
      }
    }
  }
}
```

4. Click **"Publish"**

## Step 7: Test Your Setup

1. Start your local server (see README.md)
2. Open the application in your browser
3. Try registering a new customer account
4. Check Firebase Console → Authentication → Users (should see new user)
5. Check Firebase Console → Realtime Database (should see user data)

## Troubleshooting

### "Firebase: Error (auth/api-key-not-valid)"
- Double-check your API key in `firebase-config.js`
- Make sure there are no extra spaces or quotes

### "Permission denied" errors
- Verify database rules are published correctly
- Check that you're logged in (Authentication tab in Firebase Console)

### Database not connecting
- Verify `databaseURL` is correct in `firebase-config.js`
- Check that Realtime Database (not Firestore) is created
- Ensure database location matches your selection

### Authentication not working
- Verify Email/Password provider is enabled
- Check browser console for detailed error messages
- Ensure Firebase SDK is loading correctly

## Security Notes

⚠️ **Important**: The database rules provided are for development/testing. For production:
- Implement stricter validation
- Add rate limiting
- Consider using Firestore with more granular rules
- Add server-side validation

## Next Steps

Once Firebase is configured:
1. Test customer registration
2. Test provider registration
3. Create a service request as a customer
4. Login as a provider and verify you can see/update requests
5. Check real-time updates work correctly

---

Need help? Check the main README.md for more information.
