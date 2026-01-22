import { auth, database } from './firebase-config.js';
import { checkAuthState, setupLogout, showToast } from './auth.js';
import { ref, push, onValue, query, orderByChild, equalTo, get } from 'https://www.gstatic.com/firebasejs/10.11.1/firebase-database.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js';

let currentUser = null;
let selectedService = null;

// Initialize dashboard
checkAuthState(async (user) => {
    if (!user) {
        window.location.href = 'customer-login.html';
        return;
    }
    
    // Verify user role
    const userRef = ref(database, `users/${user.uid}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
        const userData = snapshot.val();
        if (userData.role !== 'customer') {
            await signOut(auth);
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = { uid: user.uid, ...userData };
        document.getElementById('userInfo').textContent = `Welcome, ${userData.name}`;
    }
    
    setupLogout();
    initializeDashboard();
});

function initializeDashboard() {
    // Service selection
    const serviceCards = document.querySelectorAll('.service-card');
    serviceCards.forEach(card => {
        card.addEventListener('click', () => {
            selectedService = card.dataset.service;
            document.getElementById('serviceType').value = selectedService;
            document.getElementById('requestFormSection').style.display = 'block';
            document.getElementById('requestFormSection').scrollIntoView({ behavior: 'smooth' });
        });
    });
    
    // Request form submission
    const requestForm = document.getElementById('requestForm');
    requestForm.addEventListener('submit', handleRequestSubmit);
    
    // Load user requests
    loadUserRequests();
}

async function handleRequestSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitRequestBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    const serviceType = document.getElementById('serviceType').value;
    const issueDescription = document.getElementById('issueDescription').value;
    const contactPhone = document.getElementById('contactPhone').value;
    const contactEmail = document.getElementById('contactEmail').value;
    
    try {
        const requestData = {
            customerId: currentUser.uid,
            customerName: currentUser.name,
            customerEmail: currentUser.email,
            customerPhone: currentUser.phone,
            serviceType: serviceType,
            issueDescription: issueDescription,
            contactPhone: contactPhone,
            contactEmail: contactEmail,
            status: 'Pending',
            createdAt: new Date().toISOString(),
            assignedProviderId: null,
            assignedProviderName: null
        };
        
        await push(ref(database, 'requests'), requestData);
        
        showToast('Service request submitted successfully!', 'success');
        
        // Reset form
        requestForm.reset();
        document.getElementById('requestFormSection').style.display = 'none';
        selectedService = null;
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Request';
    } catch (error) {
        showToast('Error submitting request: ' + error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Request';
    }
}

function loadUserRequests() {
    const requestsGrid = document.getElementById('requestsGrid');
    requestsGrid.innerHTML = '<div class="skeleton" style="height: 200px;"></div>';
    
    const requestsRef = ref(database, 'requests');
    const userRequestsQuery = query(requestsRef, orderByChild('customerId'), equalTo(currentUser.uid));
    
    onValue(userRequestsQuery, (snapshot) => {
        const requests = [];
        snapshot.forEach((childSnapshot) => {
            requests.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        // Sort by creation date (newest first)
        requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        displayRequests(requests);
    }, (error) => {
        showToast('Error loading requests: ' + error.message, 'error');
        requestsGrid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Error loading requests</h3></div>';
    });
}

function displayRequests(requests) {
    const requestsGrid = document.getElementById('requestsGrid');
    
    if (requests.length === 0) {
        requestsGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <h3>No requests yet</h3>
                <p>Select a service above to create your first request</p>
            </div>
        `;
        return;
    }
    
    requestsGrid.innerHTML = requests.map(request => {
        const statusClass = `status-${request.status.toLowerCase().replace(' ', '-')}`;
        const statusDisplay = request.status === 'In Progress' ? 'In Progress' : request.status;
        
        return `
            <div class="request-card">
                <div class="request-card-inner">
                    <div class="request-header">
                        <div class="request-service">${request.serviceType}</div>
                        <span class="status-badge ${statusClass}">${statusDisplay}</span>
                    </div>
                    <div class="request-description">${request.issueDescription}</div>
                    <div class="request-details">
                        <div class="request-detail-item">
                            <span>📧</span>
                            <span>${request.contactEmail}</span>
                        </div>
                        <div class="request-detail-item">
                            <span>📞</span>
                            <span>${request.contactPhone}</span>
                        </div>
                        <div class="request-detail-item">
                            <span>📅</span>
                            <span>${formatDate(request.createdAt)}</span>
                        </div>
                        ${request.assignedProviderName ? `
                            <div class="request-detail-item">
                                <span>👤</span>
                                <span>Provider: ${request.assignedProviderName}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
