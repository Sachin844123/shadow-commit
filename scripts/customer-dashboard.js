import { auth, database } from './firebase-config.js';
import { checkAuthState, setupLogout, showToast } from './auth.js';
import { ref, push, onValue, query, orderByChild, equalTo, get } from 'https://www.gstatic.com/firebasejs/10.11.1/firebase-database.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js';

let currentUser = null;
let selectedService = null;
let allUserRequests = [];
let filteredUserRequests = [];
let customerMap = null;
let customerMarker = null;
let selectedLocation = null;

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
    
    // Form close buttons
    const closeFormBtn = document.getElementById('closeFormBtn');
    const cancelRequestBtn = document.getElementById('cancelRequestBtn');
    
    if (closeFormBtn) {
        closeFormBtn.addEventListener('click', closeRequestForm);
    }
    
    if (cancelRequestBtn) {
        cancelRequestBtn.addEventListener('click', closeRequestForm);
    }
    
    // Request form submission
    const requestForm = document.getElementById('requestForm');
    requestForm.addEventListener('submit', handleRequestSubmit);
    
    // Status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            filterUserRequests(e.target.value);
        });
    }
    
    // Get current location button
    const getCurrentLocationBtn = document.getElementById('getCurrentLocationBtn');
    if (getCurrentLocationBtn) {
        getCurrentLocationBtn.addEventListener('click', getCurrentLocation);
    }
    
    // Service location input
    const serviceLocationInput = document.getElementById('serviceLocation');
    if (serviceLocationInput) {
        serviceLocationInput.addEventListener('input', handleLocationInput);
    }
    
    // Load user requests
    loadUserRequests();
}

function closeRequestForm() {
    document.getElementById('requestFormSection').style.display = 'none';
    document.getElementById('requestForm').reset();
    selectedService = null;
}

async function handleRequestSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitRequestBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    const serviceType = document.getElementById('serviceType').value;
    const serviceLocation = document.getElementById('serviceLocation').value;
    const issueDescription = document.getElementById('issueDescription').value;
    const contactPhone = document.getElementById('contactPhone').value;
    const contactEmail = document.getElementById('contactEmail').value;
    
    if (!serviceLocation.trim()) {
        showToast('Please enter a service location', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Request';
        return;
    }
    
    try {
        const requestData = {
            customerId: currentUser.uid,
            customerName: currentUser.name,
            customerEmail: currentUser.email,
            customerPhone: currentUser.phone,
            serviceType: serviceType,
            serviceLocation: serviceLocation,
            locationCoordinates: selectedLocation,
            issueDescription: issueDescription,
            contactPhone: contactPhone,
            contactEmail: contactEmail,
            status: 'Pending',
            createdAt: new Date().toISOString(),
            assignedProviderId: null,
            assignedProviderName: null,
            updatedAt: new Date().toISOString()
        };
        
        await push(ref(database, 'requests'), requestData);
        
        showToast('Service request submitted successfully!', 'success');
        
        // Reset form
        requestForm.reset();
        closeRequestForm();
        selectedService = null;
        selectedLocation = null;
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Request';
    } catch (error) {
        showToast('Error submitting request: ' + error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Request';
    }
}

// Location and Map Functions
function getCurrentLocation() {
    const btn = document.getElementById('getCurrentLocationBtn');
    const originalText = btn.innerHTML;
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting Location...';
    btn.disabled = true;
    
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by this browser', 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            selectedLocation = { lat, lng };
            
            // Reverse geocode to get address
            try {
                const address = await reverseGeocode(lat, lng);
                document.getElementById('serviceLocation').value = address;
                
                // Show map
                showCustomerMap(lat, lng, address);
                
                showToast('Location detected successfully!', 'success');
            } catch (error) {
                document.getElementById('serviceLocation').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                showCustomerMap(lat, lng, 'Current Location');
                showToast('Location detected, but address lookup failed', 'info');
            }
            
            btn.innerHTML = originalText;
            btn.disabled = false;
        },
        (error) => {
            let errorMessage = 'Unable to get your location';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Location access denied. Please enable location permissions.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Location information unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Location request timed out.';
                    break;
            }
            
            showToast(errorMessage, 'error');
            btn.innerHTML = originalText;
            btn.disabled = false;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        }
    );
}

function handleLocationInput() {
    const location = document.getElementById('serviceLocation').value;
    if (location.length > 3) {
        // Debounce the geocoding
        clearTimeout(window.locationTimeout);
        window.locationTimeout = setTimeout(() => {
            geocodeAddress(location);
        }, 1000);
    }
}

async function geocodeAddress(address) {
    if (!window.L) return;
    
    try {
        const geocoder = L.Control.Geocoder.nominatim();
        
        geocoder.geocode(address, (results) => {
            if (results && results.length > 0) {
                const result = results[0];
                const lat = result.center.lat;
                const lng = result.center.lng;
                
                selectedLocation = { lat, lng };
                showCustomerMap(lat, lng, result.name || address);
            }
        });
    } catch (error) {
        console.log('Geocoding failed:', error);
    }
}

async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await response.json();
        
        if (data && data.display_name) {
            return data.display_name;
        } else {
            throw new Error('No address found');
        }
    } catch (error) {
        throw new Error('Reverse geocoding failed');
    }
}

function showCustomerMap(lat, lng, address) {
    const mapContainer = document.getElementById('customerMap');
    mapContainer.style.display = 'block';
    
    if (!customerMap) {
        // Initialize map
        customerMap = L.map('customerMap').setView([lat, lng], 15);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(customerMap);
        
        // Add click handler to map
        customerMap.on('click', function(e) {
            const clickedLat = e.latlng.lat;
            const clickedLng = e.latlng.lng;
            
            selectedLocation = { lat: clickedLat, lng: clickedLng };
            
            // Update marker position
            if (customerMarker) {
                customerMarker.setLatLng([clickedLat, clickedLng]);
            } else {
                customerMarker = L.marker([clickedLat, clickedLng], {
                    icon: createCustomIcon('#FF7A18')
                }).addTo(customerMap);
            }
            
            // Reverse geocode the clicked location
            reverseGeocode(clickedLat, clickedLng)
                .then(address => {
                    document.getElementById('serviceLocation').value = address;
                    customerMarker.bindPopup(`<b>Service Location</b><br>${address}`).openPopup();
                })
                .catch(() => {
                    const coords = `${clickedLat.toFixed(6)}, ${clickedLng.toFixed(6)}`;
                    document.getElementById('serviceLocation').value = coords;
                    customerMarker.bindPopup(`<b>Service Location</b><br>${coords}`).openPopup();
                });
        });
    } else {
        customerMap.setView([lat, lng], 15);
    }
    
    // Remove existing marker
    if (customerMarker) {
        customerMap.removeLayer(customerMarker);
    }
    
    // Add new marker
    customerMarker = L.marker([lat, lng], {
        icon: createCustomIcon('#FF7A18')
    }).addTo(customerMap);
    
    // Add popup
    customerMarker.bindPopup(`<b>Service Location</b><br>${address}`).openPopup();
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
        "></div>`,
        iconSize: [25, 25],
        iconAnchor: [12, 24]
    });
}

function loadUserRequests() {
    const requestsGrid = document.getElementById('requestsGrid');
    requestsGrid.innerHTML = '<div class="skeleton" style="height: 200px;"></div>';
    
    const requestsRef = ref(database, 'requests');
    const userRequestsQuery = query(requestsRef, orderByChild('customerId'), equalTo(currentUser.uid));
    
    onValue(userRequestsQuery, (snapshot) => {
        allUserRequests = [];
        snapshot.forEach((childSnapshot) => {
            allUserRequests.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        // Sort by creation date (newest first)
        allUserRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Update statistics
        updateDashboardStats();
        
        // Apply current filter
        const currentFilter = document.getElementById('statusFilter')?.value || 'all';
        filterUserRequests(currentFilter);
    }, (error) => {
        showToast('Error loading requests: ' + error.message, 'error');
        requestsGrid.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-exclamation-triangle"></i></div><h3>Error loading requests</h3></div>';
    });
}

function updateDashboardStats() {
    const totalRequests = allUserRequests.length;
    const pendingRequests = allUserRequests.filter(req => req.status === 'Pending').length;
    const completedRequests = allUserRequests.filter(req => req.status === 'Completed').length;
    
    document.getElementById('totalRequests').textContent = totalRequests;
    document.getElementById('pendingRequests').textContent = pendingRequests;
    document.getElementById('completedRequests').textContent = completedRequests;
}

function filterUserRequests(status) {
    if (status === 'all') {
        filteredUserRequests = allUserRequests;
    } else {
        filteredUserRequests = allUserRequests.filter(req => req.status === status);
    }
    
    displayRequests(filteredUserRequests);
}

function displayRequests(requests) {
    const requestsGrid = document.getElementById('requestsGrid');
    
    if (requests.length === 0) {
        const currentFilter = document.getElementById('statusFilter')?.value || 'all';
        let emptyMessage = 'No requests found';
        let emptyDescription = 'You haven\'t created any service requests yet';
        
        if (currentFilter !== 'all') {
            emptyMessage = `No ${currentFilter.toLowerCase()} requests`;
            emptyDescription = `You don't have any ${currentFilter.toLowerCase()} requests at the moment`;
        }
        
        requestsGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="fas fa-clipboard-list"></i></div>
                <h3>${emptyMessage}</h3>
                <p>${emptyDescription}</p>
                ${currentFilter === 'all' ? `
                    <button class="btn-primary" onclick="document.querySelector('.services-grid').scrollIntoView({behavior: 'smooth'})">
                        <i class="fas fa-plus"></i> Create Your First Request
                    </button>
                ` : ''}
            </div>
        `;
        return;
    }
    
    requestsGrid.innerHTML = requests.map(request => {
        const statusClass = getStatusClass(request.status);
        const statusIcon = getStatusIcon(request.status);
        const timeAgo = getTimeAgo(request.createdAt);
        
        return `
            <div class="request-card">
                <div class="request-card-inner">
                    <div class="request-header">
                        <div class="request-service">
                            <i class="${getServiceIcon(request.serviceType)}"></i>
                            ${request.serviceType}
                        </div>
                        <span class="status-badge ${statusClass}">
                            <i class="${statusIcon}"></i>
                            ${request.status}
                        </span>
                    </div>
                    <div class="request-description">${request.issueDescription}</div>
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
                            <span>${formatDate(request.createdAt)} (${timeAgo})</span>
                        </div>
                        ${request.serviceLocation ? `
                            <div class="request-detail-item">
                                <i class="fas fa-map-marker-alt"></i>
                                <span>${request.serviceLocation}</span>
                            </div>
                        ` : ''}
                        ${request.assignedProviderName ? `
                            <div class="request-detail-item">
                                <i class="fas fa-user-cog"></i>
                                <span>Provider: ${request.assignedProviderName}</span>
                            </div>
                        ` : request.status === 'Pending' ? `
                            <div class="request-detail-item">
                                <i class="fas fa-clock"></i>
                                <span>Waiting for provider assignment</span>
                            </div>
                        ` : ''}
                        ${request.updatedAt && request.updatedAt !== request.createdAt ? `
                            <div class="request-detail-item">
                                <i class="fas fa-sync-alt"></i>
                                <span>Last updated: ${getTimeAgo(request.updatedAt)}</span>
                            </div>
                        ` : ''}
                    </div>
                    ${getRequestActions(request)}
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

function getStatusIcon(status) {
    switch(status) {
        case 'Pending': return 'fas fa-clock';
        case 'Accepted': return 'fas fa-check';
        case 'In Progress': return 'fas fa-spinner';
        case 'Completed': return 'fas fa-check-circle';
        default: return 'fas fa-clock';
    }
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

function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
    
    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths}mo ago`;
}

function getRequestActions(request) {
    if (request.status === 'Completed') {
        return `
            <div class="request-actions">
                <div class="completion-badge">
                    <i class="fas fa-trophy"></i>
                    <span>Service Completed</span>
                </div>
            </div>
        `;
    }
    
    if (request.status === 'In Progress') {
        return `
            <div class="request-actions">
                <div class="progress-badge">
                    <i class="fas fa-cog fa-spin"></i>
                    <span>Work in Progress</span>
                </div>
            </div>
        `;
    }
    
    if (request.status === 'Accepted') {
        return `
            <div class="request-actions">
                <div class="accepted-badge">
                    <i class="fas fa-handshake"></i>
                    <span>Provider Assigned</span>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="request-actions">
            <div class="pending-badge">
                <i class="fas fa-hourglass-half"></i>
                <span>Awaiting Provider</span>
            </div>
        </div>
    `;
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
