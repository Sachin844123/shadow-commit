// Firebase Configuration
// IMPORTANT: Replace these values with your Firebase project configuration
const firebaseConfig = {
    
};

// Initialize Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.11.1/firebase-database.js';

let app, auth, database;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    database = getDatabase(app);
} catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
}

export { auth, database };
