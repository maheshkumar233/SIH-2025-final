// Global variables for the map and marker
let map;
let marker;

// Get references to the HTML elements
const latField = document.getElementById('latitude');
const lonField = document.getElementById('longitude');
const locateBtn = document.getElementById('locate-me-btn');
const permissionMessage = document.getElementById('permission-denied-message');

// This function is called by the Google Maps script once it has finished loading.
function initMap() {
    const defaultLocation = { lat: 13.0827, lng: 80.2707 }; // Default to Chennai

    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        center: defaultLocation,
        mapTypeControl: false,
    });

    marker = new google.maps.Marker({
        position: defaultLocation,
        map: map,
        draggable: true,
        title: "Drag me to your exact location!"
    });

    updateFields(defaultLocation.lat, defaultLocation.lng);

    google.maps.event.addListener(marker, 'dragend', function() {
        const newPosition = marker.getPosition();
        updateFields(newPosition.lat(), newPosition.lng());
    });
}

// Function to update the visible latitude and longitude form fields
function updateFields(lat, lng) {
    latField.value = lat;
    lonField.value = lng;
}

// Function to update the map's center and the marker's position
function updateLocation(lat, lng) {
    const newPos = { lat: lat, lng: lng };
    map.setCenter(newPos);
    map.setZoom(17);
    marker.setPosition(newPos);
    updateFields(lat, lng);
}

// --- OPTIMIZED PERMISSION HANDLING ---
locateBtn.addEventListener('click', function() {
    // Hide any previous message
    permissionMessage.style.display = 'none';

    if (navigator.permissions && navigator.permissions.query) {
        // Use the modern Permissions API for smarter handling
        navigator.permissions.query({ name: 'geolocation' }).then(function(permissionStatus) {
            if (permissionStatus.state === 'granted') {
                // Permission is already granted, get the location
                getGeolocation();
            } else if (permissionStatus.state === 'prompt') {
                // Permission has not been asked yet, getGeolocation will trigger the prompt
                getGeolocation();
            } else if (permissionStatus.state === 'denied') {
                // Permission was denied, show the helpful message
                permissionMessage.style.display = 'block';
            }
            
            // Listen for changes in permission status (e.g., if user enables it in settings)
            permissionStatus.onchange = function() {
                if (this.state === 'granted') {
                    permissionMessage.style.display = 'none';
                    getGeolocation();
                }
            };
        });
    } else if (navigator.geolocation) {
        // Fallback for older browsers that don't support the Permissions API
        getGeolocation();
    } else {
        alert("Geolocation is not supported by your browser.");
    }
});

// This function contains the actual logic to request the user's position
function getGeolocation() {
    locateBtn.textContent = '🛰️ Locating...';
    locateBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            updateLocation(lat, lng);
            locateBtn.textContent = '📍 Find My Current Location';
            locateBtn.disabled = false;
        },
        (error) => {
            // Error handling is still useful for timeouts or other device issues
             if (error.code === error.PERMISSION_DENIED) {
                // If getCurrentPosition fails because of denial, show the message
                permissionMessage.style.display = 'block';
             } else {
                alert("Could not get location. A timeout or other error occurred. Please try again.");
             }
            locateBtn.textContent = '📍 Find My Current Location';
            locateBtn.disabled = false;
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}