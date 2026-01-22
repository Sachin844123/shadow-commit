import { auth, database } from './firebase-config.js';
import { checkAuthState, setupLogout, showToast } from './auth.js';
import { ref, onValue, update, get } from 'https://www.gstatic.com/firebasejs/10.11.1/firebase-database.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js';

let currentUser = null;
let allRequests = [];
let filteredRequests = [];

// Initialize dashboard
checkAuthState(async (user) => {
    if (!user) {
        window.location.href = 'provider-login.html';
        return;
    }
    
    // Verify user role
    const userRef = ref(database, `users/${user.uid}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
        const userData = snapshot.val();
        if (userData.role !== 'provider') {
            await signOut(auth);
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = { uid: user.uid, ...userData };
        document.getElementById('userInfo').textContent = `Welcome, ${userData.name} (${userData.serviceType})`;
    }
    
    setupLogout();
    initializeDashboard();
});

function initializeDashboard() {
    // Status filter
    const statusFilter = document.getElementById('statusFilter');
    statusFilter.addEventListener('change', (e) => {
        filterRequests(e.target.value);
    });
    
    // Load assigned requests
    loadAssignedRequests();
}

function loadAssignedRequests() {
    const requestsGrid = document.getElementById('requestsGrid');
    requestsGrid.innerHTML = '<div class="skeleton" style="height: 200px;"></div>';
    
    const requestsRef = ref(database, 'requests');
    
    onValue(requestsRef, (snapshot) => {
        allRequests = [];
        snapshot.forEach((childSnapshot) => {
            const request = {
                id: childSnapshot.key,
                ...childSnapshot.val()
            };
            
            // Show requests that match provider's service type and are either:
            // 1. Not assigned yet (Pending)
            // 2. Assigned to this provider
            if (request.serviceType === currentUser.serviceType || 
                request.serviceType === 'Others' ||
                request.assignedProviderId === currentUser.uid) {
                allRequests.push(request);
            }
        });
        
        // Sort by creation date (newest first)
        allRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Auto-assign pending requests to this provider
        autoAssignRequests();
        
        filterRequests(document.getElementById('statusFilter').value);
    }, (error) => {
        showToast('Error loading requests: ' + error.message, 'error');
        requestsGrid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Error loading requests</h3></div>';
    });
}

async function autoAssignRequests() {
    const pendingRequests = allRequests.filter(req => 
        req.status === 'Pending' && !req.assignedProviderId && 
        (req.serviceType === currentUser.serviceType || req.serviceType === 'Others')
    );
    
    for (const request of pendingRequests) {
        try {
            await update(ref(database, `requests/${request.id}`), {
                assignedProviderId: currentUser.uid,
                assignedProviderName: currentUser.name,
                status: 'Accepted'
            });
        } catch (error) {
            console.error('Error auto-assigning request:', error);
        }
    }
}

function filterRequests(status) {
    if (status === 'all') {
        filteredRequests = allRequests.filter(req => 
            req.assignedProviderId === currentUser.uid
        );
    } else {
        filteredRequests = allRequests.filter(req => 
            req.assignedProviderId === currentUser.uid && req.status === status
        );
    }
    
    displayRequests(filteredRequests);
}

function displayRequests(requests) {
    const requestsGrid = document.getElementById('requestsGrid');
    
    if (requests.length === 0) {
        requestsGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <h3>No requests found</h3>
                <p>You don't have any assigned requests at the moment</p>
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
                    <div class="request-description">
                        <strong>Customer:</strong> ${request.customerName}<br>
                        <strong>Issue:</strong> ${request.issueDescription}
                    </div>
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
                    </div>
                    <div class="request-actions">
                        <select class="status-select" id="status-${request.id}" onchange="updateRequestStatus('${request.id}', this.value)">
                            <option value="Pending" ${request.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="Accepted" ${request.status === 'Accepted' ? 'selected' : ''}>Accepted</option>
                            <option value="In Progress" ${request.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Completed" ${request.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Make function globally accessible
window.updateRequestStatus = async function(requestId, newStatus) {
    try {
        await update(ref(database, `requests/${requestId}`), {
            status: newStatus
        });
        
        showToast(`Request status updated to ${newStatus}`, 'success');
    } catch (error) {
        showToast('Error updating status: ' + error.message, 'error');
    }
};

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
