// --- ⚙️ PASTE YOUR KEYS HERE ---
const THINGSPEAK_WRITE_API_KEY = 'DIGYM9O9V39V9YGU';
const FORMSPREE_ACTION_URL = 'https://formspree.io/f/mkgvajaq'; // Or your new Formspree URL
const THINGSPEAK_CHANNEL_UPDATE_URL = 'https://api.thingspeak.com/update.json';

// --- ELEMENT REFERENCES ---
const latField = document.getElementById('latitude');
const lonField = document.getElementById('longitude');
const locateBtn = document.getElementById('locate-me-btn');
const reliefForm = document.getElementById('relief-form');
const formContainer = document.getElementById('form-container');
const formStatus = document.getElementById('form-status');
const offlineOverlay = document.getElementById('offline-overlay');
const loginBtn = document.getElementById('login-btn');
const loginModal = document.getElementById('login-modal');
const closeBtn = document.querySelector('.close-btn');
const loginForm = document.getElementById('login-form');

// --- OFFLINE DETECTION ---
function updateOnlineStatus() { navigator.onLine ? offlineOverlay.style.display = 'none' : offlineOverlay.style.display = 'flex'; }
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// --- MAP LOGIC ---
let map; let marker;
function initMap() {
    const defaultLocation = { lat: 13.0827, lng: 80.2707 };
    map = new google.maps.Map(document.getElementById('map'), { zoom: 12, center: defaultLocation, mapTypeControl: false });
    marker = new google.maps.Marker({ position: defaultLocation, map: map, draggable: true, title: "Drag me!" });
    updateFields(defaultLocation.lat, defaultLocation.lng);
    google.maps.event.addListener(marker, 'dragend', () => updateFields(marker.getPosition().lat(), marker.getPosition().lng()));
}
function updateFields(lat, lng) { latField.value = lat.toFixed(6); lonField.value = lng.toFixed(6); }
function updateLocation(lat, lng) {
    const newPos = { lat, lng };
    map.setCenter(newPos); map.setZoom(17); marker.setPosition(newPos); updateFields(lat, lng);
}
locateBtn.addEventListener('click', () => {
    navigator.geolocation.getCurrentPosition(
        (pos) => updateLocation(pos.coords.latitude, pos.coords.longitude),
        () => alert("Could not get location. Please allow permission.")
    );
});

// --- LOGIN MODAL LOGIC ---
loginBtn.onclick = () => loginModal.style.display = 'block';
closeBtn.onclick = () => loginModal.style.display = 'none';
window.onclick = (e) => { if (e.target == loginModal) loginModal.style.display = 'none'; };
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (document.getElementById('username').value === 'admin' && document.getElementById('password').value === 'admin') {
        window.location.href = 'admin.html';
    } else {
        const loginError = document.getElementById('login-error');
        loginError.textContent = 'Invalid username or password.';
        loginError.style.display = 'block';
    }
});

// --- FORM SUBMISSION LOGIC ---
reliefForm.addEventListener("submit", async function(event) {
    event.preventDefault();
    let validationError = false;
    reliefForm.querySelectorAll('.item-request').forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        const quantity = item.querySelector('input[type="number"]');
        if (checkbox.checked && (!quantity.value || parseInt(quantity.value, 10) < 1)) {
            alert(`Please enter a valid quantity for "${item.dataset.itemName}".`);
            quantity.focus();
            validationError = true;
        }
    });
    if (validationError) return;

    const formData = new FormData(reliefForm);
    const formObject = Object.fromEntries(formData.entries());
    const orderId = Date.now();

    formContainer.style.display = 'none';
    formStatus.innerHTML = "Submitting request...";
    formStatus.className = 'form-status success';
    formStatus.style.display = 'block';

    let suppliesSummary = '';
    if (formObject.request_medkit) suppliesSummary += `Medkit(${formObject.medkit_quantity || 1}), `;
    if (formObject.request_water) suppliesSummary += `Water(${formObject.water_quantity || 1}), `;
    if (formObject.request_biscuits) suppliesSummary += `Biscuits(${formObject.biscuits_quantity || 1}), `;
    if (formObject.request_comm_device) suppliesSummary += `CommDevice(${formObject.comm_device_quantity || 1})`;
    suppliesSummary = suppliesSummary.trim().replace(/,\s*$/, "");

    const data = {
        api_key: THINGSPEAK_WRITE_API_KEY,
        field1: formObject.name || '',
        field2: formObject.phone || '',
        field3: formObject.latitude || '',
        field4: formObject.longitude || '',
        field5: 'received',
        field6: orderId,
        field7: suppliesSummary,
        field8: formObject.number_of_people || 0
    };
    const body = Object.keys(data).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(data[key])).join('&');

    try {
        const thingspeakPromise = fetch(THINGSPEAK_CHANNEL_UPDATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        });
        const formspreePromise = fetch(FORMSPREE_ACTION_URL, {
            method: 'POST', body: formData, headers: { 'Accept': 'application/json' }
        });
        const responses = await Promise.all([thingspeakPromise, formspreePromise]);

        if (responses.every(res => res.ok)) {
            formStatus.innerHTML = `
                <h3>Thank you!</h3>
                <p>Your order has been received. It will be delivered shortly.</p>
                <button id="submit-another" class="btn btn-primary">Submit Another Request</button>
            `;
            document.getElementById('submit-another').addEventListener('click', () => {
                reliefForm.reset();
                formStatus.style.display = 'none';
                formContainer.style.display = 'block';
            });
        } else {
            throw new Error('One or both API submissions failed.');
        }
    } catch (error) {
        console.error('Submission Error:', error);
        formStatus.innerHTML = "Oops! There was a problem submitting your form.";
        formStatus.className = 'form-status error';
    }
});