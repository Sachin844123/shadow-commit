import { auth, database } from './firebase-config.js';
import { checkAuthState, setupLogout, showToast } from './auth.js';
import { ref, onValue, update, get, query, orderByChild, equalTo } from 'https://www.gstatic.com/firebasejs/10.11.1/firebase-database.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js';

let currentUser = null;
let allRequests = [];
let filteredRequests = [];
let providerMap = null;
let requestMarkers = [];
let selectedRequestMarker = null;

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
    
    // View toggle buttons
    const listViewBtn = document.getElementById('listViewBtn');
    const mapViewBtn = document.getElementById('mapViewBtn');
    
    listViewBtn.addEventListener('click', () => switchToListView());
    mapViewBtn.addEventListener('click', () => switchToMapView());
    
    // Load requests
    loadRequests();
}

function loadRequests() {
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
            
            // Show requests that:
            // 1. Match provider's service type (or are "Others") AND are pending (available to accept)
            // 2. OR are assigned to this provider (regardless of status)
            if (((request.serviceType === currentUser.serviceType || request.serviceType === 'Others') && request.status === 'Pending' && !request.assignedProviderId) ||
                (request.assignedProviderId === currentUser.uid)) {
                allRequests.push(request);
            }
        });
        
        // Sort by creation date (newest first)
        allRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        filterRequests(document.getElementById('statusFilter').value);
    }, (error) => {
        showToast('Error loading requests: ' + error.message, 'error');
        requestsGrid.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-exclamation-triangle"></i></div><h3>Error loading requests</h3></div>';
    });
}

function filterRequests(status) {
    if (status === 'all') {
        filteredRequests = allRequests;
    } else if (status === 'Pending') {
        // Show only pending requests that are not assigned to anyone
        filteredRequests = allRequests.filter(req => req.status === 'Pending' && !req.assignedProviderId);
    } else {
        // Show only requests assigned to this provider with the selected status
        filteredRequests = allRequests.filter(req => req.assignedProviderId === currentUser.uid && req.status === status);
    }
    
    displayRequests(filteredRequests);
}

function displayRequests(requests) {
    const requestsGrid = document.getElementById('requestsGrid');
    const sectionTitle = document.querySelector('.section-title');
    const currentFilter = document.getElementById('statusFilter').value;
    
    // Update section title based on filter
    let titleText = 'Service Requests';
    if (currentFilter === 'Pending') {
        titleText = `New Requests Available (${requests.length})`;
    } else if (currentFilter === 'all') {
        titleText = `All My Requests (${requests.length})`;
    } else {
        titleText = `${currentFilter} Requests (${requests.length})`;
    }
    sectionTitle.textContent = titleText;
    
    if (requests.length === 0) {
        let emptyMessage = 'No requests found';
        let emptyDescription = 'No requests match the current filter';
        
        if (currentFilter === 'Pending') {
            emptyMessage = 'No pending requests';
            emptyDescription = 'There are no new requests available to accept at the moment';
        } else if (currentFilter === 'all') {
            emptyMessage = 'No requests available';
            emptyDescription = 'You have no pending requests to accept or assigned requests to manage';
        }
        
        requestsGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="fas fa-clipboard-list"></i></div>
                <h3>${emptyMessage}</h3>
                <p>${emptyDescription}</p>
            </div>
        `;
        return;
    }
    
    requestsGrid.innerHTML = requests.map(request => {
        const statusClass = getStatusClass(request.status);
        const isAssignedToMe = request.assignedProviderId === currentUser.uid;
        const isPending = request.status === 'Pending' && !request.assignedProviderId;
        
        return `
            <div class="request-card">
                <div class="request-card-inner">
                    <div class="request-header">
                        <div class="request-service">${request.serviceType}</div>
                        <span class="status-badge ${statusClass}">${request.status}</span>
                    </div>
                    <div class="request-description">
                        <strong>Customer:</strong> ${request.customerName}<br>
                        <strong>Issue:</strong> ${request.issueDescription}
                    </div>
                    <div class="request-details">
                        <div class="request-detail-item">
                            <i class="fas fa-envelope"></i>
                            <span>${request.contactEmail}</span>
                        </div>
                        <div class="request-detail-item">
                            <i class="fas fa-phone"></i>
                            <span>${request.contactPhone}</span>
                        </div>
                        <div class="request-detail-item">
                            <i class="fas fa-calendar"></i>
                            <span>${formatDate(request.createdAt)}</span>
                        </div>
                        ${request.serviceLocation ? `
                            <div class="request-detail-item">
                                <i class="fas fa-map-marker-alt"></i>
                                <span>${request.serviceLocation}</span>
                            </div>
                        ` : ''}
                        ${isAssignedToMe ? `
                            <div class="request-detail-item">
                                <i class="fas fa-user-check"></i>
                                <span>Assigned to you</span>
                            </div>
                        ` : isPending ? `
                            <div class="request-detail-item">
                                <i class="fas fa-clock"></i>
                                <span>Available to accept</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="request-actions">
                        ${isPending ? `
                            <button class="btn-primary" onclick="acceptRequest('${request.id}')">
                                <i class="fas fa-check"></i> Accept Request
                            </button>
                        ` : isAssignedToMe ? `
                            <select class="status-select" id="status-${request.id}" onchange="updateRequestStatus('${request.id}', this.value)">
                                <option value="Accepted" ${request.status === 'Accepted' ? 'selected' : ''}>Accepted</option>
                                <option value="In Progress" ${request.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                <option value="Completed" ${request.status === 'Completed' ? 'selected' : ''}>Completed</option>
                            </select>
                        ` : `
                            <div class="status-info">
                                <i class="fas fa-info-circle"></i>
                                <span>Request not available</span>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getStatusClass(status) {
    switch(status) {
        case 'Pending': return 'status-pending';
        case 'Accepted': return 'status-accepted';
        case 'In Progress': return 'status-progress';
        case 'Completed': return 'status-completed';
        default: return 'status-pending';
    }
}

// Make functions globally accessible
window.acceptRequest = async function(requestId) {
    try {
        const updates = {
            assignedProviderId: currentUser.uid,
            assignedProviderName: currentUser.name,
            status: 'Accepted',
            updatedAt: new Date().toISOString()
        };
        
        await update(ref(database, `requests/${requestId}`), updates);
        showToast('Request accepted successfully!', 'success');
    } catch (error) {
        showToast('Error accepting request: ' + error.message, 'error');
    }
};

window.updateRequestStatus = async function(requestId, newStatus) {
    try {
        const updates = {
            status: newStatus,
            updatedAt: new Date().toISOString()
        };
        
        await update(ref(database, `requests/${requestId}`), updates);
        showToast(`Request status updated to ${newStatus}`, 'success');
    } catch (error) {
        showToast('Error updating status: ' + error.message, 'error');
        // Reset the select to previous value
        const selectElement = document.getElementById(`status-${requestId}`);
        if (selectElement) {
            // Find the current status from allRequests
            const request = allRequests.find(r => r.id === requestId);
            if (request) {
                selectElement.value = request.status;
            }
        }
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

// Map and View Functions
function switchToListView() {
    document.getElementById('listViewBtn').classList.add('active');
    document.getElementById('mapViewBtn').classList.remove('active');
    document.getElementById('requestsGrid').style.display = 'grid';
    document.getElementById('providerMapContainer').style.display = 'none';
}

function switchToMapView() {
    document.getElementById('listViewBtn').classList.remove('active');
    document.getElementById('mapViewBtn').classList.add('active');
    document.getElementById('requestsGrid').style.display = 'none';
    document.getElementById('providerMapContainer').style.display = 'block';
    
    // Initialize map if not already done
    if (!providerMap && window.L) {
        initializeProviderMap();
    }
    
    // Update map with current requests
    setTimeout(() => {
        updateMapMarkers();
    }, 100);
}

function initializeProviderMap() {
    const mapContainer = document.getElementById('providerMap');
    
    // Default to a central location (you can change this to your city)
    const defaultCenter = [40.7128, -74.0060]; // New York City
    
    providerMap = L.map('providerMap').setView(defaultCenter, 12);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(providerMap);
}

function updateMapMarkers() {
    if (!providerMap) return;
    
    // Clear existing markers
    requestMarkers.forEach(marker => providerMap.removeLayer(marker));
    requestMarkers = [];
    
    // Add markers for requests with location
    const requestsWithLocation = filteredRequests.filter(req => req.locationCoordinates);
    
    if (requestsWithLocation.length === 0) {
        showToast('No requests with location data found', 'info');
        return;
    }
    
    const group = new L.featureGroup();
    
    requestsWithLocation.forEach((request, index) => {
        const position = [request.locationCoordinates.lat, request.locationCoordinates.lng];
        
        const marker = L.marker(position, {
            icon: createCustomIcon(getStatusColor(request.status))
        }).addTo(providerMap);
        
        // Create popup content
        const popupContent = createMapInfoContent(request);
        marker.bindPopup(popupContent);
        
        marker.on('click', () => {
            showRequestDetails(request);
        });
        
        requestMarkers.push(marker);
        group.addLayer(marker);
    });
    
    // Fit map to show all markers
    if (requestsWithLocation.length > 1) {
        providerMap.fitBounds(group.getBounds(), { padding: [20, 20] });
    } else if (requestsWithLocation.length === 1) {
        providerMap.setView([requestsWithLocation[0].locationCoordinates.lat, requestsWithLocation[0].locationCoordinates.lng], 15);
    }
}

function createCustomIcon(color) {
    return L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div style="
            background-color: ${color};
            width: 25px;
            height: 25px;
            border-radius: 50% 50% 50% 0;
            border: 3px solid white;
            transform: rotate(-45deg);
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
        "></div>`,
        iconSize: [25, 25],
        iconAnchor: [12, 24]
    });
}

function getStatusColor(status) {
    switch(status) {
        case 'Pending': return '#718096';
        case 'Accepted': return '#3182ce';
        case 'In Progress': return '#ed8936';
        case 'Completed': return '#38a169';
        default: return '#718096';
    }
}

function createMapInfoContent(request) {
    const statusIcon = getStatusIcon(request.status);
    
    return `
        <div style="padding: 15px; max-width: 300px; font-family: 'Inter', sans-serif;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <i class="${getServiceIcon(request.serviceType)}" style="color: #FF7A18; font-size: 1.2rem;"></i>
                <h4 style="margin: 0; color: #1A1A1A; font-size: 1.1rem; font-family: 'Poppins', sans-serif;">${request.serviceType}</h4>
            </div>
            <div style="margin-bottom: 8px;">
                <strong style="color: #1A1A1A;">Customer:</strong> ${request.customerName}
            </div>
            <div style="margin-bottom: 8px;">
                <strong style="color: #1A1A1A;">Location:</strong> ${request.serviceLocation || 'Location not specified'}
            </div>
            <div style="margin-bottom: 10px;">
                <span style="background: ${getStatusColor(request.status)}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">
                    <i class="${statusIcon}"></i> ${request.status}
                </span>
            </div>
            <div style="color: #6B7280; font-size: 0.9rem; line-height: 1.4;">
                ${request.issueDescription.substring(0, 100)}${request.issueDescription.length > 100 ? '...' : ''}
            </div>
        </div>
    `;
}

function getServiceIcon(serviceType) {
    switch(serviceType) {
        case 'Plumber': return 'fas fa-wrench';
        case 'Electrician': return 'fas fa-bolt';
        case 'Carpenter': return 'fas fa-hammer';
        case 'Cleaning': return 'fas fa-broom';
        case 'Others': return 'fas fa-tools';
        default: return 'fas fa-tools';
    }
}

function getStatusIcon(status) {
    switch(status) {
        case 'Pending': return 'fas fa-clock';
        case 'Accepted': return 'fas fa-check';
        case 'In Progress': return 'fas fa-spinner';
        case 'Completed': return 'fas fa-check-circle';
        default: return 'fas fa-clock';
    }
}

function showRequestDetails(request) {
    const detailsContainer = document.getElementById('selectedRequestInfo');
    const isAssignedToMe = request.assignedProviderId === currentUser.uid;
    const isPending = request.status === 'Pending' && !request.assignedProviderId;
    
    detailsContainer.innerHTML = `
        <h4>
            <i class="${getServiceIcon(request.serviceType)}"></i>
            ${request.serviceType}
        </h4>
        <p><strong>Customer:</strong> ${request.customerName}</p>
        <p><strong>Phone:</strong> ${request.contactPhone}</p>
        <p><strong>Email:</strong> ${request.contactEmail}</p>
        <p><strong>Location:</strong> ${request.serviceLocation || 'Not specified'}</p>
        <p><strong>Issue:</strong> ${request.issueDescription}</p>
        <div class="request-actions">
            ${isPending ? `
                <button class="btn-primary" onclick="acceptRequest('${request.id}')">
                    <i class="fas fa-check"></i> Accept Request
                </button>
            ` : isAssignedToMe ? `
                <select class="status-select" onchange="updateRequestStatus('${request.id}', this.value)">
                    <option value="Accepted" ${request.status === 'Accepted' ? 'selected' : ''}>Accepted</option>
                    <option value="In Progress" ${request.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Completed" ${request.status === 'Completed' ? 'selected' : ''}>Completed</option>
                </select>
            ` : `
                <div class="status-info">
                    <i class="fas fa-info-circle"></i>
                    <span>Request not available</span>
                </div>
            `}
        </div>
    `;
    
    detailsContainer.style.display = 'block';
}
