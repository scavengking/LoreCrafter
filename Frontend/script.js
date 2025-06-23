const API_BASE_URL = 'http://localhost:5001';

// Add these at the top with your other constants/variables
let mapInstance = null;
let mapMarkersLayer = L.layerGroup();
let placementState = {
    locationId: null,
    locationName: null
};

// --- DOM Element Selectors ---
const apiStatusEl = document.getElementById('api-status');
const generateBtn = document.getElementById('generate-btn');
const worldPromptEl = document.getElementById('world-prompt');
const resultContainer = document.getElementById('result-container');
const resultEl = document.getElementById('result');
const characterListEl = document.getElementById('character-list');
const locationListEl = document.getElementById('location-list');

// --- Functions ---

/**
 * Fetches the API health and updates the status element on the page.
 */
function checkApiHealth() {
    fetch(`${API_BASE_URL}/api/health`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            apiStatusEl.textContent = `API Status: ${data.message} | Database: ${data.database}`;
            apiStatusEl.className = 'mt-8 p-2 bg-green-800 rounded-md inline-block';
        })
        .catch(error => {
            apiStatusEl.textContent = 'API Status: Connection Failed';
            apiStatusEl.className = 'mt-8 p-2 bg-red-800 rounded-md inline-block';
            console.error('Failed to fetch API health:', error);
        });
}

/**
 * Fetches all characters from the backend and displays them as cards.
 */
function fetchAndDisplayCharacters() {
    const characterListEl = document.getElementById('character-list');
    characterListEl.innerHTML = '<p class="text-gray-400">Loading characters...</p>';

    // We need both characters and locations to build the UI
    Promise.all([
        fetch('http://localhost:5001/api/characters').then(res => res.json()),
        fetch('http://localhost:5001/api/locations').then(res => res.json())
    ]).then(([characters, locations]) => {
        characterListEl.innerHTML = '';

        if (characters.length === 0) {
            characterListEl.innerHTML = '<p class="text-gray-400">No characters have been generated yet.</p>';
            return;
        }

        characters.reverse().forEach(character => {
            const card = document.createElement('div');
            card.className = 'bg-gray-900 p-4 rounded-lg shadow';

            // Find the full location object for the character's location_id
            const assignedLocation = locations.find(loc => loc._id === character.location_id);

            // Create the dropdown <option> tags for all locations
            let locationOptions = '<option value="">-- Select a location --</option>';
            locations.forEach(loc => {
                const isSelected = loc._id === character.location_id ? 'selected' : '';
                locationOptions += `<option value="${loc._id}" ${isSelected}>${loc.name}</option>`;
            });

            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="text-xl font-semibold text-indigo-400">${character.name}</h3>
                        <p class="text-gray-400 font-medium mt-1">${character.role}</p>
                        <p class="text-gray-300 mt-2">${character.backstory}</p>
                        <div class="mt-3 text-sm">
                            <strong>Location:</strong> 
                            <span class="text-teal-400">${assignedLocation ? assignedLocation.name : 'Not Assigned'}</span>
                        </div>
                    </div>
                    <button data-id="${character._id}" data-type="character" class="delete-btn bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-xs flex-shrink-0">
                        Delete
                    </button>
                </div>
                <div class="mt-4 pt-4 border-t border-gray-700 flex items-center space-x-2">
                    <select data-id="${character._id}" class="location-select bg-gray-700 border-gray-600 rounded-md shadow-sm p-1 text-sm w-full">
                        ${locationOptions}
                    </select>
                    <button data-id="${character._id}" class="assign-btn bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-xs">
                        Assign
                    </button>
                </div>
            `;
            characterListEl.appendChild(card);
        });
    }).catch(err => {
        characterListEl.innerHTML = '<p class="text-red-500">Failed to load characters or locations.</p>';
        console.error(err);
    });
}

/**
 * Fetches all locations from the backend and displays them as cards.
 */
function fetchAndDisplayLocations() {
    locationListEl.innerHTML = '<p class="text-gray-400">Loading locations...</p>';

    fetch(`${API_BASE_URL}/api/locations`)
        .then(response => response.json())
        .then(locations => {
            locationListEl.innerHTML = '';
            
            displayLocationMarkers(locations); // <-- ADD THIS LINE
            
            if (!locations || locations.length === 0) {
                locationListEl.innerHTML = '<p class="text-gray-400">No locations have been generated yet.</p>';
                return;
            }

            locations.reverse().forEach(location => {
                const card = document.createElement('div');
                card.className = 'bg-gray-900 p-4 rounded-lg shadow';
                
                // Check if coordinates exist and create a display string
                const coordsText = location.coords 
                    ? `[X: ${Math.round(location.coords.x)}, Y: ${Math.round(location.coords.y)}]` 
                    : 'Not placed';

                card.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="text-xl font-semibold text-teal-400">${location.name}</h3>
                            <p class="text-gray-300 mt-2">${location.description}</p>
                        </div>
                        <button data-id="${location._id}" data-type="location" class="delete-btn bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-xs flex-shrink-0">
                            Delete
                        </button>
                    </div>
                    <div class="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between text-sm">
                        <div>
                            <strong>Coordinates:</strong>
                            <span class="text-gray-400">${coordsText}</span>
                        </div>
                        <button data-id="${location._id}" class="place-btn bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-xs">
                            Place on Map
                        </button>
                    </div>
                `;
                locationListEl.appendChild(card);
            });
        })
        .catch(err => {
            locationListEl.innerHTML = '<p class="text-red-500">Failed to load locations.</p>';
            console.error(err);
        });
}

/**
 * Initialize and render the Cytoscape graph
 */
function initializeGraph() {
    fetch('http://localhost:5001/api/graph-data')
        .then(response => response.json())
        .then(elements => {
            cytoscape({
                container: document.getElementById('cy'),
                elements: elements,
                layout: {
                    name: 'cose', // A good physics-based layout
                    idealEdgeLength: 100,
                    nodeOverlap: 20,
                    refresh: 20,
                    fit: true,
                    padding: 30
                },
                style: [
                    {
                        selector: 'node',
                        style: {
                            'label': 'data(label)',
                            'text-valign': 'bottom',
                            'text-halign': 'center',
                            'font-size': '10px',
                            'color': '#fff'
                        }
                    },
                    {
                        selector: 'edge',
                        style: {
                            'width': 2,
                            'line-color': '#4A5568', // gray-700
                            'target-arrow-color': '#4A5568',
                            'target-arrow-shape': 'triangle',
                            'curve-style': 'bezier'
                        }
                    },
                    {
                        selector: 'node[type="character"]',
                        style: {
                            'background-color': '#818CF8', // indigo-400
                        }
                    },
                    {
                        selector: 'node[type="location"]',
                        style: {
                            'background-color': '#5EEAD4', // teal-400
                            'shape': 'rectangle'
                        }
                    }
                ]
            });
        })
        .catch(error => console.error('Error fetching graph data:', error));
}

/**
 * Initializes the Leaflet map.
 */
function initializeMap() {
    mapInstance = L.map('map', {
        crs: L.CRS.Simple,
        minZoom: -1
    });

    const bounds = [[0,0], [1000,1000]];
    const imageUrl = 'assets/Map_1.png';
    
    L.imageOverlay(imageUrl, bounds).addTo(mapInstance);
    mapInstance.fitBounds(bounds);
    mapInstance.setView([500, 500], 0);

    // Add the empty marker layer to the map
    mapMarkersLayer.addTo(mapInstance);

    // Listen for clicks on the map
    mapInstance.on('click', function(e) {
        // Check if we are currently in "placement mode"
        if (placementState.locationId) {
            const coords = e.latlng; // Get coords from the click event
            const locationId = placementState.locationId;

            fetch(`${API_BASE_URL}/api/locations/${locationId}/set_coords`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: coords.lng, y: coords.lat }) // lng is X, lat is Y
            })
            .then(response => {
                if (!response.ok) throw new Error('Failed to save coordinates.');
                return response.json();
            })
            .then(data => {
                console.log(data.message);
                // Exit placement mode
                document.getElementById('map').style.cursor = '';
                placementState.locationId = null;
                placementState.locationName = null;
                // Refresh the locations list to show new coords and markers
                fetchAndDisplayLocations();
            })
            .catch(error => alert(error.message));
        }
    });

    console.log("🗺️ Map initialized with click listener.");
}

function displayLocationMarkers(locations) {
    // Clear all existing markers from the layer
    mapMarkersLayer.clearLayers();

    // Loop through locations and add a marker if coords exist
    locations.forEach(location => {
        if (location.coords && location.coords.x !== null && location.coords.y !== null) {
            const marker = L.marker([location.coords.y, location.coords.x]); // Leaflet uses [lat, lng] which is [y, x]
            marker.bindPopup(`<b>${location.name}</b>`);
            mapMarkersLayer.addLayer(marker);
        }
    });
}


/**
 * Handles the character generation request.
 */
function handleGenerateClick() {
    const prompt = worldPromptEl.value;
    if (!prompt) {
        alert('Please describe your world first!');
        return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    resultContainer.classList.add('hidden');

    fetch(`${API_BASE_URL}/api/generate/character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt }),
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errorData => {
                throw new Error(errorData.error || 'Unknown error occurred');
            });
        }
        return response.json();
    })
    .then(data => {
        document.getElementById('result-container').querySelector('h3').textContent = 'Generated Character:';
        resultEl.textContent = JSON.stringify(data, null, 2);
        resultContainer.classList.remove('hidden');
        fetchAndDisplayCharacters();
        initializeGraph();
    })
    .catch(error => {
        resultEl.textContent = `Error: ${error.message}`;
        resultContainer.classList.remove('hidden');
        console.error('Error generating character:', error);
    })
    .finally(() => {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Character';
    });
}


// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    checkApiHealth();
    initializeMap(); // Initialize the map
    fetchAndDisplayCharacters();
    fetchAndDisplayLocations();
    initializeGraph();
});

generateBtn.addEventListener('click', handleGenerateClick);

const generateLocationBtn = document.getElementById('generate-location-btn');
const locationWorldPromptEl = document.getElementById('location-world-prompt');

generateLocationBtn.addEventListener('click', () => {
    const prompt = locationWorldPromptEl.value;
    if (!prompt) {
        alert('Please enter a world description for the location.');
        return;
    }

    generateLocationBtn.disabled = true;
    generateLocationBtn.textContent = 'Generating...';

    fetch(`${API_BASE_URL}/api/generate/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errorData => {
                throw new Error(errorData.error || 'Unknown error occurred');
            });
        }
        return response.json();
    })
    .then(data => {
        document.getElementById('result-container').querySelector('h3').textContent = 'Generated Location:';
        resultEl.textContent = JSON.stringify(data, null, 2);
        resultContainer.classList.remove('hidden');
        fetchAndDisplayLocations();
        initializeGraph();
    })
    .catch(err => {
        alert(`Error: ${err.message}`);
    })
    .finally(() => {
        generateLocationBtn.disabled = false;
        generateLocationBtn.textContent = 'Generate Location';
    });
});

document.addEventListener('click', function(e) {
    const target = e.target;

    // --- Handle Delete Clicks ---
    if (target && target.classList.contains('delete-btn')) {
        const id = target.getAttribute('data-id');
        const type = target.getAttribute('data-type');
        
        if (!id || !type) return;

        if (confirm(`Are you sure you want to delete this ${type}?`)) {
            fetch(`${API_BASE_URL}/api/${type}s/${id}`, { method: 'DELETE' })
            .then(response => {
                if (!response.ok) throw new Error(`Failed to delete ${type}.`);
                return response.json();
            })
            .then(data => {
                console.log(data.message);
                fetchAndDisplayCharacters();
                fetchAndDisplayLocations();
                initializeGraph();
            })
            .catch(error => console.error('Error:', error));
        }
    }

    // --- Handle Assign Location Clicks ---
    if (target && target.classList.contains('assign-btn')) {
        const characterId = target.getAttribute('data-id');
        const selectEl = document.querySelector(`.location-select[data-id="${characterId}"]`);
        const locationId = selectEl.value;

        if (!locationId) {
            alert('Please select a location from the dropdown.');
            return;
        }

        fetch(`${API_BASE_URL}/api/characters/${characterId}/link_location`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location_id: locationId })
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to assign location.');
            return response.json();
        })
        .then(data => {
            console.log(data.message);
            fetchAndDisplayCharacters(); 
            initializeGraph();
        })
        .catch(error => {
            alert(`Error: ${error.message}`);
            console.error('Error:', error)
        });
    }
    
    // --- NEW: Handle Place on Map Clicks ---
    if (target && target.classList.contains('place-btn')) {
        const locationId = target.getAttribute('data-id');
        // Find the location name from the card's h3 element
        const locationName = target.closest('.shadow').querySelector('h3').textContent;

        placementState.locationId = locationId;
        placementState.locationName = locationName;

        // Give user feedback
        alert(`Placement Mode Activated for "${locationName}".\nNow click anywhere on the map to place it.`);
        document.getElementById('map').style.cursor = 'crosshair';
    }
});

// --- Event Listener for JSON Export Button ---
const exportJsonBtn = document.getElementById('export-json-btn');

exportJsonBtn.addEventListener('click', () => {
    exportJsonBtn.textContent = 'Exporting...';
    exportJsonBtn.disabled = true;

    fetch(`${API_BASE_URL}/api/export/json`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(worldData => {
            // This is the logic to trigger a file download
            const dataStr = JSON.stringify(worldData, null, 2); // Pretty-print the JSON
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = 'lorecrafter-world.json'; // The name of the downloaded file
            
            document.body.appendChild(link);
            link.click(); // Programmatically click the link to trigger the download
            document.body.removeChild(link); // Clean up by removing the link
            URL.revokeObjectURL(url); // Free up memory
        })
        .catch(error => {
            console.error('There was a problem with the export:', error);
            alert('Failed to export world data.');
        })
        .finally(() => {
            exportJsonBtn.textContent = 'Export World to JSON';
            exportJsonBtn.disabled = false;
        });
});