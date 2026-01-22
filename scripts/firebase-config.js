// Firebase Configuration
// IMPORTANT: Replace these values with your Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyAAqXfLChE60-ZPJjAwsEiYjBoDUCPLiRc",
    authDomain: "shadowcommit-98a4d.firebaseapp.com",
    projectId: "shadowcommit-98a4d",
    storageBucket: "shadowcommit-98a4d.firebasestorage.app",
    messagingSenderId: "753126087657",
    appId: "1:753126087657:web:a0c41feecc803ec2074978",
    measurementId: "G-N7SMXEMCQL",
    databaseURL: "https://shadowcommit-98a4d-default-rtdb.asia-southeast1.firebasedatabase.app/"
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
