import { auth, database } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js';
import { ref, set, get } from 'https://www.gstatic.com/firebasejs/10.11.1/firebase-database.js';
import { showToast } from './auth.js';

// Check if we're on registration or login page
const isRegisterPage = window.location.pathname.includes('register');
const form = document.getElementById(isRegisterPage ? 'registerForm' : 'loginForm');
const submitBtn = document.getElementById(isRegisterPage ? 'registerBtn' : 'loginBtn');

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (isRegisterPage) {
            await handleRegister();
        } else {
            await handleLogin();
        }
    });
}

async function handleRegister() {
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const phone = document.getElementById('phone').value;
    const serviceType = document.getElementById('serviceType').value;
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    if (!serviceType) {
        showToast('Please select a service type', 'error');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registering...';
    
    try {
        // Create user account
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Store user data in database
        await set(ref(database, `users/${user.uid}`), {
            name: name,
            email: email,
            phone: phone,
            role: 'provider',
            serviceType: serviceType,
            createdAt: new Date().toISOString()
        });
        
        showToast('Registration successful!', 'success');
        setTimeout(() => {
            window.location.href = 'provider-dashboard.html';
        }, 1500);
    } catch (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register';
        showToast(getErrorMessage(error.code), 'error');
    }
}

async function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Verify user role
        const userRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            const userData = snapshot.val();
            if (userData.role !== 'provider') {
                await signOut(auth);
                showToast('Access denied. This is a provider login page.', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
                return;
            }
        }
        
        showToast('Login successful!', 'success');
        setTimeout(() => {
            window.location.href = 'provider-dashboard.html';
        }, 1000);
    } catch (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
        showToast(getErrorMessage(error.code), 'error');
    }
}

function getErrorMessage(errorCode) {
    const errorMessages = {
        'auth/email-already-in-use': 'Email is already registered',
        'auth/invalid-email': 'Invalid email address',
        'auth/weak-password': 'Password is too weak',
        'auth/user-not-found': 'User not found',
        'auth/wrong-password': 'Incorrect password',
        'auth/too-many-requests': 'Too many attempts. Please try again later',
        'auth/network-request-failed': 'Network error. Please check your connection'
    };
    return errorMessages[errorCode] || 'An error occurred. Please try again';
}
