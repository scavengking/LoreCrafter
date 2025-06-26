// The API_BASE_URL is a relative path. This makes the frontend
// send API requests to the same server that served the webpage, which works
// for both local development and deployed environments, and avoids CORS issues.
const API_BASE_URL = '';

// --- State and DOM Element Cache ---
let mapInstance = null;
let cyInstance = null;
let mapMarkersLayer = L.layerGroup();

// Caching DOM elements for faster access
const dom = {
    apiStatus: document.getElementById('api-status'),
    generateBtn: document.getElementById('generate-btn'),
    worldPrompt: document.getElementById('world-prompt'),
    charList: document.getElementById('character-list'),
    locList: document.getElementById('location-list'),
    genLocBtn: document.getElementById('generate-location-btn'),
    locPrompt: document.getElementById('location-world-prompt'),
    exportJsonBtn: document.getElementById('export-json-btn'),
    exportPdfBtn: document.getElementById('export-pdf-btn'),
    fitMarkersBtn: document.getElementById('fit-markers-btn'),
    resetViewBtn: document.getElementById('reset-view-btn'),
    fitGraphBtn: document.getElementById('fit-graph-btn'),
    mapImageUrlInput: document.getElementById('map-image-url'),
    setMapImageBtn: document.getElementById('set-map-image-btn'),
    mapUploadInput: document.getElementById('map-upload-input'),
    mapUploadBtn: document.getElementById('map-upload-btn'),
    // User Menu
    userMenuBtn: document.getElementById('user-menu-btn'),
    userMenuDropdown: document.getElementById('user-menu-dropdown'),
    logoutBtn: document.getElementById('logout-btn'),
    // Tutorial elements
    tutorialModal: document.getElementById('tutorial-modal'),
    tutorialBox: document.getElementById('tutorial-box'),
    tutorialContent: document.getElementById('tutorial-content'),
    tutorialStepIndicator: document.getElementById('tutorial-step-indicator'),
    closeTutorialBtn: document.getElementById('close-tutorial'),
    nextTutorialBtn: document.getElementById('next-tutorial'),
    prevTutorialBtn: document.getElementById('prev-tutorial'),
    helpBtn: document.getElementById('help-btn'),
    // Generic Modal
    genericModal: document.getElementById('generic-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalMessage: document.getElementById('modal-message'),
    modalConfirmBtn: document.getElementById('modal-confirm-btn'),
    modalCancelBtn: document.getElementById('modal-cancel-btn'),
    toastContainer: document.getElementById('toast-container'),
};

// --- Main App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    initializeTutorial();
    
    // Animate the content into view for a polished feel
    gsap.set(".content-hidden", { autoAlpha: 0, y: 30 });
    gsap.to(".content-hidden", {
        duration: 0.8,
        autoAlpha: 1,
        y: 0,
        stagger: 0.07,
        ease: "power2.out",
        delay: 0.2
    });
});

function initializeApp() {
    checkApiHealth();
    initializeMap();
    fetchAllData();
    setupEventListeners();
}

function fetchAllData() {
    // Show loading spinners while data is being fetched
    showLoadingAnimation(dom.charList);
    showLoadingAnimation(dom.locList);
    
    // Fetch characters and locations in parallel for speed
    Promise.all([
        fetch(`${API_BASE_URL}/api/characters`).then(handleApiResponse),
        fetch(`${API_BASE_URL}/api/locations`).then(handleApiResponse)
    ]).then(([characters, locations]) => {
        // Once both requests are successful, update the UI
        displayCharacters(characters, locations);
        displayLocations(locations);
        initializeGraph({ characters, locations });
    }).catch((err) => {
        console.error("Fetch Error:", err);
        dom.charList.innerHTML = '<p class="text-red-700">Failed to load characters. Is the API running?</p>';
        dom.locList.innerHTML = '<p class="text-red-700">Failed to load locations. Check API connection.</p>';
        // If the user is not authorized, redirect them to the login page
        if (err.status === 401) {
            window.location.href = '/login';
        }
    });
}

// --- Display & UI Functions ---
function showLoadingAnimation(element) {
    element.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full p-8">
            <div class="w-12 h-12 border-4 border-[#4e342e] border-t-transparent rounded-full animate-spin mb-2"></div>
            <p class="text-[#4e342e]">Loading...</p>
        </div>
    `;
}

function displayCharacters(characters, locations) {
    dom.charList.innerHTML = '';
    if (characters.length === 0) {
        dom.charList.innerHTML = '<p class="text-center p-4">No characters generated yet.</p>';
        return;
    }
    // Sort characters by creation date to show the newest first
    characters.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).forEach(character => {
        // Create the dropdown options for assigning a location
        const locationOptions = locations.map(loc => `<option value="${loc._id}" ${loc._id === character.location_id ? 'selected' : ''}>${loc.name}</option>`).join('');
        
        const card = document.createElement('div');
        card.className = 'p-3 border border-[#d7c8a0] rounded bg-white/50 relative overflow-hidden character-card';
        card.style.setProperty('--char-color', character.color || '#4e342e');
        card.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <img src="https://ui-avatars.com/api/?name=${character.name.replace(/\s/g, '+')}&background=a78bfa&color=fff&rounded=true&bold=true" alt="${character.name}" class="w-10 h-10 rounded-full">
                    <div>
                        <h4 class="font-bold font-cinzel text-base" style="color:${character.color || '#5d4037'};">${character.name}</h4>
                        <p class="text-sm">${character.role || 'No role specified'}</p>
                    </div>
                </div>
                <button data-id="${character._id}" class="details-btn text-sm font-bold text-[#5d4037]">Details &gt;</button>
            </div>
            <div class="details-panel hidden mt-3 pt-3 border-t border-[#d7c8a0] space-y-3 text-sm">
                <p><b>Physical:</b> ${character.physical_description || 'N/A'}</p>
                <p><b>Personality:</b> ${character.personality_traits || 'N/A'}</p>
                <p><b>Backstory:</b> ${character.backstory}</p>
                <div class="flex items-center justify-between gap-2 pt-2">
                    <select data-id="${character._id}" class="location-select input-field w-full"><option value="">-- Assign Location --</option>${locationOptions}</select>
                    <button data-id="${character._id}" class="assign-btn btn-secondary flex-shrink-0">Assign</button>
                </div>
                <div class="flex items-center justify-between gap-2 pt-2">
                   <div class="flex items-center gap-2">
                    <label>Color:</label>
                    <input type="color" class="color-picker" data-id="${character._id}" data-type="characters" value="${character.color || '#58a6ff'}">
                   </div>
                    <button data-id="${character._id}" data-type="characters" class="delete-btn btn-secondary !bg-red-800 !text-white hover:!bg-red-700">Delete</button>
                </div>
            </div>
        `;
        dom.charList.appendChild(card);
    });
}

function displayLocations(locations) {
    dom.locList.innerHTML = '';
    displayLocationMarkers(locations);
    if (!locations || locations.length === 0) {
        dom.locList.innerHTML = '<p class="text-center p-4">No locations generated yet.</p>';
        return;
    }
    locations.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).forEach(location => {
        const coordsText = location.coords ? `[X: ${Math.round(location.coords.x)}, Y: ${Math.round(location.coords.y)}]` : 'Not Placed';
        const card = document.createElement('div');
        card.className = 'p-3 border border-[#d7c8a0] rounded bg-white/50 relative overflow-hidden character-card';
        card.style.setProperty('--char-color', location.color || '#00d1ff');
        card.innerHTML = `
            <div class="flex items-center justify-between">
                 <div class="flex items-center gap-3">
                     <div class="w-10 h-10 rounded-full flex items-center justify-center" style="background-color:${location.color || '#00d1ff'};">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                     </div>
                     <div>
                        <h4 class="font-bold font-cinzel text-base" style="color:${location.color || '#00d1ff'};">${location.name}</h4>
                        <p class="text-sm">${coordsText}</p>
                     </div>
                 </div>
                 <button data-id="${location._id}" class="details-btn text-sm font-bold text-[#5d4037]">Details &gt;</button>
            </div>
            <div class="details-panel hidden mt-3 pt-3 border-t border-[#d7c8a0] space-y-3 text-sm">
                <p>${location.description}</p>
                <div class="flex items-center justify-between gap-2 pt-2">
                    <button data-id="${location._id}" class="place-btn btn-secondary">Place on Map</button>
                    <div class="flex items-center gap-2">
                       <label>Color:</label>
                       <input type="color" class="color-picker" data-id="${location._id}" data-type="locations" value="${location.color || '#00d1ff'}">
                    </div>
                    <button data-id="${location._id}" data-type="locations" class="delete-btn btn-secondary !bg-red-800 !text-white hover:!bg-red-700">Delete</button>
                </div>
            </div>
        `;
        dom.locList.appendChild(card);
    });
}

// --- Map & Graph Functions ---
function initializeMap() {
    if (mapInstance) return;
    // Define the bounds of our simple coordinate system
    const bounds = L.latLngBounds([[0,0], [1000,1000]]);
    mapInstance = L.map('map', { 
        crs: L.CRS.Simple, // Use a simple Cartesian coordinate system
        minZoom: -5,
        maxZoom: 2,
        maxBounds: bounds,
        maxBoundsViscosity: 1.0, // Prevent dragging the map out of bounds
        attributionControl: false
    });
    
    // Load the last used map image from localStorage, or use a default
    const savedMapUrl = localStorage.getItem('loreCrafterMapUrl') || 'https://i.imgur.com/gD5A8H5.jpeg';
    setMapImage(savedMapUrl);
    mapMarkersLayer.addTo(mapInstance);
    mapInstance.on('click', handleMapClick);
}

function setMapImage(imageUrl) {
    if (mapInstance.imageOverlay) mapInstance.removeLayer(mapInstance.imageOverlay);
    const bounds = [[0,0], [1000,1000]];
    mapInstance.imageOverlay = L.imageOverlay(imageUrl, bounds, {
        // Provide a fallback image in case the URL is broken
        errorOverlayUrl: 'https://placehold.co/1000x1000/fdf6e3/5d4037?text=Map+Not+Found'
    }).addTo(mapInstance);
    mapInstance.fitBounds(bounds); // Fit the map to the image
    localStorage.setItem('loreCrafterMapUrl', imageUrl); // Save the URL for next time
}

function displayLocationMarkers(locations) {
    mapMarkersLayer.clearLayers();
    locations.forEach(location => {
        if (location.coords) {
            const markerColor = location.color || '#00d1ff';
            const markerHtml = `<div style="background-color: ${markerColor};" class="w-4 h-4 rounded-full border-2 border-white shadow-md"></div>`;
            const icon = L.divIcon({ 
                className: 'map-marker-icon', 
                html: markerHtml,
                iconSize: [16, 16],
                iconAnchor: [8, 8] // Center the icon
            });
            
            const marker = L.marker([location.coords.y, location.coords.x], { 
                icon,
                riseOnHover: true
            });
            
            // Create a styled popup for the marker
            marker.bindPopup(`
                <div class="popup-content">
                    <h3 class="font-cinzel text-lg">${location.name}</h3>
                    <p class="text-sm mt-1">${location.description.substring(0, 100)}...</p>
                </div>
            `);
            
            marker.on('mouseover', function() { this.openPopup(); });
            
            mapMarkersLayer.addLayer(marker);
        }
    });
}

function initializeGraph({ characters, locations }) {
    if (cyInstance) cyInstance.destroy();
    
    const elements = { 
        nodes: [
            ...characters.map(c => ({ data: { id: c._id, label: c.name, type: 'character', color: c.color || '#58a6ff' } })),
            ...locations.map(l => ({ data: { id: l._id, label: l.name, type: 'location', color: l.color || '#00d1ff' } }))
        ],
        edges: characters.filter(c => c.location_id).map(c => ({ data: { source: c._id, target: c.location_id } }))
    };

    cyInstance = cytoscape({
        container: document.getElementById('cy'),
        elements: elements,
        layout: { name: 'cose', idealEdgeLength: 150, nodeOverlap: 20, fit: true, padding: 20, animate: true, animationDuration: 500 },
        style: [
            { selector: 'node', style: { 'label': 'data(label)', 'text-valign': 'bottom', 'text-halign': 'center', 'font-size': '12px', 'font-family': 'Quattrocento, serif', 'color': '#4e342e', 'background-color': 'data(color)', 'text-outline-color': '#fdf6e3', 'text-outline-width': 3 } },
            { selector: 'node[type="location"]', style: { 'shape': 'rectangle' } },
            { selector: 'edge', style: { 'width': 2, 'line-color': 'rgba(78, 52, 46, 0.33)', 'target-arrow-color': 'rgba(78, 52, 46, 0.33)', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } },
        ]
    });
    
    // Add hover effects for interactivity
    cyInstance.on('mouseover', 'node', function(event) {
        const node = event.target;
        node.style({ 'border-width': 3, 'border-color': '#4e342e' });
        node.connectedEdges().style({ 'line-color': '#4e342e', 'opacity': 1 });
    });
    
    cyInstance.on('mouseout', 'node', function(event) {
        const node = event.target;
        node.style({ 'border-width': 0 });
        node.connectedEdges().style({ 'line-color': 'rgba(78, 52, 46, 0.33)', 'opacity': 0.7 });
    });
}


// --- Event Handlers & Setup ---
function setupEventListeners() {
    dom.generateBtn.addEventListener('click', () => handleGenerate('character'));
    dom.genLocBtn.addEventListener('click', () => handleGenerate('location'));
    dom.exportJsonBtn.addEventListener('click', handleExportJson);
    dom.exportPdfBtn.addEventListener('click', handleExportPdf);
    dom.fitMarkersBtn.addEventListener('click', () => mapInstance && mapMarkersLayer.getLayers().length > 0 && mapInstance.fitBounds(mapMarkersLayer.getBounds()));
    dom.resetViewBtn.addEventListener('click', () => {
        if(mapInstance) {
             const defaultUrl = 'https://i.imgur.com/gD5A8H5.jpeg';
             setMapImage(defaultUrl);
             dom.mapImageUrlInput.value = '';
        }
    });
    dom.fitGraphBtn.addEventListener('click', () => cyInstance && cyInstance.fit());
    
    // User menu listeners
    dom.userMenuBtn.addEventListener('click', () => {
        dom.userMenuDropdown.classList.toggle('hidden');
    });
    dom.logoutBtn.addEventListener('click', handleLogout);

    // Use event delegation for dynamically created elements
    document.addEventListener('click', handleCardActions);
    document.addEventListener('change', handleColorChange);

    dom.setMapImageBtn.addEventListener('click', () => {
        const url = dom.mapImageUrlInput.value.trim();
        if (url) setMapImage(url);
    });
    dom.mapUploadBtn.addEventListener('click', () => dom.mapUploadInput.click());
    dom.mapUploadInput.addEventListener('change', handleMapUpload);

    // Close user menu if clicked outside
    document.addEventListener('click', (e) => {
        if (!dom.userMenuBtn.contains(e.target) && !dom.userMenuDropdown.contains(e.target)) {
            dom.userMenuDropdown.classList.add('hidden');
        }
    });
}

function handleCardActions(e) {
    const target = e.target;
    // Toggle details panel
    if (target.closest('.details-btn')) {
        const btn = target.closest('.details-btn');
        const detailsPanel = btn.closest('.character-card').querySelector('.details-panel');
        detailsPanel.classList.toggle('hidden');
        btn.innerHTML = detailsPanel.classList.contains('hidden') ? 'Details &gt;' : 'Hide &lt;';
    // Handle delete button click
    } else if (target.closest('.delete-btn')) {
        const btn = target.closest('.delete-btn');
        const { id, type } = btn.dataset;
        showConfirm(
            `Delete ${type.slice(0, -1)}?`,
            `Are you sure you want to permanently delete this ${type.slice(0, -1)}? This action cannot be undone.`,
            () => {
                handleApiCall(`${API_BASE_URL}/api/${type}/${id}`, { method: 'DELETE' }).then(fetchAllData);
            }
        );
    // Handle assign location button click
    } else if (target.closest('.assign-btn')) {
        const btn = target.closest('.assign-btn');
        const { id } = btn.dataset;
        const select = btn.previousElementSibling;
        if (select.value) {
            handleApiCall(`${API_BASE_URL}/api/characters/${id}/link_location`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ location_id: select.value })
            }).then(fetchAllData);
        }
    // Handle place on map button click
    } else if (target.closest('.place-btn')) {
        // Set a global state to indicate we are in "placement mode"
        window.placementState = { locationId: target.closest('.place-btn').dataset.id };
        showToast('Placement Mode Activated: Click on the map to place this location.', 'info');
        document.getElementById('map').style.cursor = 'crosshair';
    }
}

function handleColorChange(e) {
    // Debounce this function to prevent too many API calls
    if (e.target.matches('.color-picker')) {
        const { id, type } = e.target.dataset;
        handleApiCall(`${API_BASE_URL}/api/${type}/${id}/color`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ color: e.target.value })
        }).then(fetchAllData);
    }
}

async function handleApiResponse(response) {
    if (response.status === 401) { // Unauthorized
        showToast('Session expired. Please log in again.', 'error');
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'API request failed' }));
        throw new Error(error.error || error.message);
    }
    return response.json();
}


function handleApiCall(url, options) {
    return fetch(url, options)
        .then(handleApiResponse)
        .catch(err => {
            showToast(`Error: ${err.message}`, 'error');
            throw err; // Re-throw to prevent subsequent .then() calls
        });
}

function handleGenerate(type) {
    const prompt = (type === 'character' ? dom.worldPrompt.value : dom.locPrompt.value).trim();
    const btn = type === 'character' ? dom.generateBtn : dom.genLocBtn;
    const container = type === 'character' ? dom.charList : dom.locList;

    if (!prompt) {
        showToast('Please provide a prompt.', 'error');
        return;
    }
    
    // Disable the button and show a loading animation to prevent multiple clicks
    btn.disabled = true;
    btn.classList.add('shimmer-animation');
    const originalText = btn.innerHTML;
    
    showLoadingAnimation(container);
    
    handleApiCall(`${API_BASE_URL}/api/generate/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
    }).then(() => {
        fetchAllData(); // Refresh all data to show the new item
    }).finally(() => {
        // Re-enable the button and restore its text
        btn.disabled = false;
        btn.innerHTML = originalText;
        btn.classList.remove('shimmer-animation');
    });
}

function handleMapClick(e) {
    // Only proceed if we are in placement mode
    if (!window.placementState || !window.placementState.locationId) return;
    const { lat, lng } = e.latlng;
    handleApiCall(`${API_BASE_URL}/api/locations/${window.placementState.locationId}/set_coords`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: lng, y: lat }),
    }).then(() => {
        showToast('Location placed successfully!', 'success');
        // Exit placement mode
        document.getElementById('map').style.cursor = '';
        window.placementState = null;
        fetchAllData(); // Refresh data to show the new marker
    });
}

function handleMapUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            setMapImage(e.target.result);
        };
        reader.readAsDataURL(file);
    } else {
        showToast('Please select a valid image file.', 'error');
    }
}

async function handleLogout(e) {
    e.preventDefault();
    try {
        const response = await fetch(`${API_BASE_URL}/api/logout`, { method: 'POST' });
        const data = await handleApiResponse(response);
        if (data.redirect_url) {
            window.location.href = data.redirect_url;
        }
    } catch (error) {
        console.error('Logout failed:', error);
        showToast('Logout failed. Please try again.', 'error');
    }
}

async function handleExportPdf() {
    dom.exportPdfBtn.disabled = true;
    dom.exportPdfBtn.querySelector('span').textContent = 'Generating...';

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    try {
        const [characters, locations] = await Promise.all([
            fetch(`${API_BASE_URL}/api/characters`).then(handleApiResponse),
            fetch(`${API_BASE_URL}/api/locations`).then(handleApiResponse)
        ]);

        let y = 15;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 15;

        // Helper to add a new page if content overflows
        function checkNewPage(neededHeight) {
            if (y + neededHeight > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }
        }

        doc.setFont('times', 'bold');
        doc.setFontSize(22);
        doc.text('LoreCrafter World Export', 105, y, { align: 'center' });
        y += 15;

        if (characters.length > 0) {
            checkNewPage(20);
            doc.setFontSize(18);
            doc.text('Characters', margin, y);
            y += 8;

            characters.forEach(char => {
                checkNewPage(40);
                doc.setFont('times', 'bold');
                doc.setFontSize(14);
                doc.text(char.name, margin, y);
                y += 6;
                
                doc.setFont('times', 'normal');
                doc.setFontSize(12);
                let details = `Role: ${char.role || 'N/A'}\n`;
                details += `Physical: ${char.physical_description || 'N/A'}\n`;
                details += `Personality: ${char.personality_traits || 'N/A'}\n`;
                details += `Backstory: ${char.backstory || 'N/A'}`;
                
                const splitText = doc.splitTextToSize(details, 180);
                doc.text(splitText, margin, y);
                y += doc.getTextDimensions(splitText).h + 10;
            });
        }

        if (locations.length > 0) {
            checkNewPage(20);
            y += 5;
            doc.setFontSize(18);
            doc.text('Locations', margin, y);
            y += 8;

            locations.forEach(loc => {
                checkNewPage(30);
                doc.setFont('times', 'bold');
                doc.setFontSize(14);
                doc.text(loc.name, margin, y);
                y += 6;
                
                doc.setFont('times', 'normal');
                doc.setFontSize(12);
                const splitText = doc.splitTextToSize(loc.description || 'No description provided.', 180);
                doc.text(splitText, margin, y);
                y += doc.getTextDimensions(splitText).h + 10;
            });
        }

        doc.save('lorecrafter-world.pdf');
    } catch (error) {
        showToast('Failed to generate PDF.', 'error');
    } finally {
        dom.exportPdfBtn.disabled = false;
        dom.exportPdfBtn.querySelector('span').textContent = 'Download as PDF';
    }
}

function handleExportJson() {
    dom.exportJsonBtn.disabled = true;
    handleApiCall(`${API_BASE_URL}/api/export/json`).then((data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lorecrafter-world.json';
        document.body.appendChild(a); // Required for Firefox
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }).finally(() => {
        dom.exportJsonBtn.disabled = false;
    });
}

function checkApiHealth() {
    fetch(`${API_BASE_URL}/api/health`)
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => {
            dom.apiStatus.textContent = `API: ${data.message} | DB: ${data.database}`;
            dom.apiStatus.className = 'mt-2 p-2 rounded bg-green-100 text-green-800 text-sm inline-block';
        })
        .catch(() => {
            dom.apiStatus.textContent = 'API Status: Connection Failed';
            dom.apiStatus.className = 'mt-2 p-2 rounded bg-red-100 text-red-800 text-sm inline-block';
        });
}

// --- Tutorial System ---
const tutorialSteps = [
    { title: "Welcome to LoreCrafter!", content: "This quick tour will guide you through the key features. Use the 'Next' and 'Previous' buttons to navigate." },
    { title: "Generate Content", content: "Use these cards to bring your world to life. Describe your setting and click 'Generate Character' or 'Generate Location' to have the AI create detailed entries for you.", selector: '#generate-btn, #generate-location-btn' },
    { title: "View Your Creations", content: "Generated items appear here. Click the 'Details' button on any card to see more information, assign characters to locations, change colors, or delete items.", selector: '#characters-panel, #locations-panel' },
    { title: "The World Graph & Map", content: "The graph visualizes relationships, while the map is your world's canvas. Place locations by clicking 'Details' then 'Place on Map'.", selector: '#world-graph-panel, #world-map-panel' },
    { title: "Custom World Map", content: "Use the 'World Map Settings' card to set your own map. You can paste a URL or upload an image from your computer.", selector: '#map-settings-panel' },
    { title: "Export Your World", content: "When you're ready, you can download your world as a JSON file for data, or as a beautifully formatted PDF to share.", selector: '#export-panel' }
];
let currentStep = 0;

function initializeTutorial() {
    // Show the tutorial on the user's first visit
    if (!localStorage.getItem('lorecrafterTutorialSeen')) {
        setTimeout(openTutorial, 1000); // Open after initial animations
    }
    dom.helpBtn.addEventListener('click', openTutorial);
    dom.closeTutorialBtn.addEventListener('click', closeTutorial);
    dom.nextTutorialBtn.addEventListener('click', nextStep);
    dom.prevTutorialBtn.addEventListener('click', prevStep);
}

function openTutorial() {
    currentStep = 0;
    dom.tutorialModal.classList.remove('hidden');
    gsap.to(dom.tutorialBox, { duration: 0.4, scale: 1, opacity: 1, ease: "back.out(1.7)" });
    renderTutorialStep();
}

function closeTutorial() {
    gsap.to(dom.tutorialBox, { 
        duration: 0.3, 
        scale: 0.95, 
        opacity: 0, 
        ease: "power2.in",
        onComplete: () => {
             dom.tutorialModal.classList.add('hidden');
             removeTutorialHighlights();
        }
    });
    // Remember that the user has seen the tutorial
    localStorage.setItem('lorecrafterTutorialSeen', 'true');
}

function renderTutorialStep() {
    const step = tutorialSteps[currentStep];
    dom.tutorialContent.innerHTML = `
        <div class="text-center mb-4">
             <img src="static/assets/wizard.jpg">
        </div>
        <h2 class="text-2xl glow mb-2 text-center">${step.title}</h2>
        <p class="text-center">${step.content}</p>
    `;
    dom.tutorialStepIndicator.textContent = `${currentStep + 1} / ${tutorialSteps.length}`;
    dom.prevTutorialBtn.style.visibility = currentStep === 0 ? 'hidden' : 'visible';
    dom.nextTutorialBtn.textContent = currentStep === tutorialSteps.length - 1 ? 'Finish' : 'Next';
    
    highlightTutorialElement(currentStep);
}

function nextStep() {
    if (currentStep < tutorialSteps.length - 1) {
        currentStep++;
        renderTutorialStep();
    } else {
        closeTutorial();
    }
}

function prevStep() {
    if (currentStep > 0) {
        currentStep--;
        renderTutorialStep();
    }
}

function removeTutorialHighlights() {
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
        el.classList.remove('tutorial-highlight');
    });
}

function highlightTutorialElement(stepIndex) {
    removeTutorialHighlights();
    const step = tutorialSteps[stepIndex];
    if (step && step.selector) {
        document.querySelectorAll(step.selector).forEach(el => {
            el.classList.add('tutorial-highlight');
        });
    }
}

// --- Modals and Toasts ---
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
        info: 'bg-blue-500',
        success: 'bg-green-500',
        error: 'bg-red-500',
    };
    toast.className = `p-4 rounded-lg text-white shadow-lg transform translate-x-full ${colors[type]}`;
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);
    
    gsap.to(toast, { x: 0, duration: 0.5, ease: 'power2.out' });
    setTimeout(() => {
        gsap.to(toast, { 
            autoAlpha: 0, 
            x: '100%', 
            duration: 0.5, 
            ease: 'power2.in', 
            onComplete: () => toast.remove() 
        });
    }, 4000);
}

function showConfirm(title, message, onConfirm) {
    dom.modalTitle.textContent = title;
    dom.modalMessage.textContent = message;
    dom.genericModal.classList.remove('hidden');

    const confirmHandler = () => {
        onConfirm();
        hideConfirm();
    };
    const cancelHandler = () => hideConfirm();
    
    // Use .onclick to ensure we can easily remove the listener
    dom.modalConfirmBtn.onclick = confirmHandler;
    dom.modalCancelBtn.onclick = cancelHandler;
}


function hideConfirm() {
    dom.genericModal.classList.add('hidden');
    dom.modalConfirmBtn.onclick = null;
    dom.modalCancelBtn.onclick = null;
}