// --- ⚙️ PASTE YOUR KEYS HERE ---
const THINGSPEAK_CHANNEL_ID = '3084308';
const THINGSPEAK_WRITE_API_KEY = 'DIGYM9O9V39V9YGU';
const THINGSPEAK_READ_API_KEY = 'V1650J5TD5NGGKTD'; // Required to read from a private channel

const THINGSPEAK_READ_URL = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json?api_key=${THINGSPEAK_READ_API_KEY}&results=8000`;
const THINGSPEAK_WRITE_URL = 'https://api.thingspeak.com/update.json';

document.addEventListener('DOMContentLoaded', () => {
    const orderContainer = document.getElementById('order-container');
    const loader = document.getElementById('loader');
    const navLinks = document.querySelectorAll('.nav-link');
    const menuIcon = document.getElementById('menu-icon');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('admin-main');
    let currentView = 'received';
    let allOrders = {};

    async function fetchAndProcessOrders() {
        loader.style.display = 'block';
        orderContainer.innerHTML = '';
        try {
            const response = await fetch(THINGSPEAK_READ_URL);
            if (!response.ok) { throw new Error(`ThingSpeak API Error: ${response.status}. Check your Channel ID and Read API Key.`); }
            const data = await response.json();
            const latestOrders = {};
            if (data.feeds) {
                data.feeds.forEach(feed => {
                    const orderId = feed.field6;
                    if (orderId) {
                        latestOrders[orderId] = {
                            orderId: orderId, status: feed.field5, orderData: {
                                name: feed.field1, phone: feed.field2, latitude: feed.field3, longitude: feed.field4,
                                supplies: feed.field7, casualties: feed.field8, date: new Date(feed.created_at).toLocaleString()
                            }
                        };
                    }
                });
            }
            allOrders = latestOrders;
            renderOrders();
        } catch (error) {
            console.error('Failed to fetch orders:', error);
            orderContainer.innerHTML = `<p style="color: red;">Error loading orders. ${error.message}</p>`;
        } finally {
            loader.style.display = 'none';
        }
    }

    function renderOrders() {
        orderContainer.innerHTML = '';
        const filteredOrders = Object.values(allOrders).filter(order => {
            // NEW: Added a case for 'history' to show all orders
            if (currentView === 'history') return true; 
            if (currentView === 'received') return order.status === 'received';
            if (currentView === 'approved') return ['approved', 'pending', 'delivered'].includes(order.status);
            if (currentView === 'rejected') return order.status === 'rejected';
            return false;
        }).sort((a, b) => b.orderId - a.orderId);

        if (filteredOrders.length === 0) {
            orderContainer.innerHTML = '<p>No orders in this category.</p>';
            return;
        }

        const list = document.createElement('div');
        list.className = 'order-container';
        filteredOrders.forEach(order => list.appendChild(createOrderCard(order)));
        orderContainer.appendChild(list);
    }

    function createOrderCard(order) {
        const card = document.createElement('div');
        card.className = 'order-card';
        card.dataset.id = order.orderId;

        let actions = '';
        if (order.status === 'received') {
            actions = `<button class="btn btn-primary action-btn" data-action="approve">Approve</button> <button class="btn btn-secondary action-btn" data-action="reject">Reject</button>`;
        } else if (order.status === 'approved' || order.status === 'pending') {
            actions = `<button class="btn btn-primary action-btn" data-action="deliver">Mark Delivered</button> <button class="btn btn-secondary action-btn" data-action="pend">Mark Pending</button>`;
        }

        // NEW: Show a status badge for every order in history view
        let statusBadge = '';
        const statusMap = {
            'received': 'status-received',
            'approved': 'status-approved',
            'pending': 'status-pending',
            'delivered': 'status-delivered',
            'rejected': 'status-rejected'
        };
        if (statusMap[order.status]) {
            statusBadge = `<span class="status-badge ${statusMap[order.status]}">${order.status}</span>`;
        }

        const orderData = order.orderData || {};
        const lat = orderData.latitude || 'N/A';
        const lon = orderData.longitude || 'N/A';
        // NEW: Create the Google Maps link
        const mapLink = (lat !== 'N/A' && lon !== 'N/A') 
            ? `<a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" rel="noopener noreferrer" class="location-link">${lat}, ${lon}</a>` 
            : 'N/A';

        card.innerHTML = `
            <h4>Order #${order.orderId}</h4>
            <p><strong>Date:</strong> ${orderData.date || 'N/A'}</p>
            <p><strong>Name:</strong> ${orderData.name || 'N/A'}</p>
            <p><strong>Phone:</strong> ${orderData.phone || 'N/A'}</p>
            <p><strong>Location:</strong> ${mapLink}</p> <!-- Map link is used here -->
            <p><strong>Supplies:</strong> ${orderData.supplies || 'None'}</p>
            <p><strong>Casualties:</strong> ${orderData.casualties || 'N/A'}</p>
            ${statusBadge}
            <div class="actions">${actions}</div>
        `;
        return card;
    }

    async function updateOrderStatus(orderId, newStatus) {
        // This function is unchanged
        const orderToUpdate = allOrders[orderId];
        if (!orderToUpdate) return;
        loader.style.display = 'block';
        
        const data = {
            api_key: THINGSPEAK_WRITE_API_KEY,
            field1: orderToUpdate.orderData.name, field2: orderToUpdate.orderData.phone,
            field3: orderToUpdate.orderData.latitude, field4: orderToUpdate.orderData.longitude,
            field5: newStatus, field6: orderId, field7: orderToUpdate.orderData.supplies,
            field8: orderToUpdate.orderData.casualties
        };
        const body = Object.keys(data).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(data[key])).join('&');
        
        try {
            const response = await fetch(THINGSPEAK_WRITE_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body
            });
            if (!response.ok) throw new Error('ThingSpeak API Error on update');
            await fetchAndProcessOrders();
        } catch (error) {
            console.error('Update Error:', error);
            alert('Failed to update order status.');
            loader.style.display = 'none';
        }
    }

    // This event listener is unchanged
    orderContainer.addEventListener('click', e => {
        if (e.target.classList.contains('action-btn')) {
            const action = e.target.dataset.action;
            const orderId = e.target.closest('.order-card').dataset.id;
            const newStatusMap = { 'approve': 'approved', 'reject': 'rejected', 'deliver': 'delivered', 'pend': 'pending' };
            if (newStatusMap[action]) updateOrderStatus(orderId, newStatusMap[action]);
        }
    });

    // This event listener is unchanged
    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            currentView = e.target.dataset.view;
            navLinks.forEach(nav => nav.classList.remove('active'));
            e.target.classList.add('active');
            renderOrders();
        });
    });

    // This event listener is unchanged
    menuIcon.addEventListener('click', () => {
        if (sidebar.style.width === '250px') {
            sidebar.style.width = '0';
            mainContent.style.marginLeft = '0';
        } else {
            sidebar.style.width = '250px';
            mainContent.style.marginLeft = '250px';
        }
    });
    
    fetchAndProcessOrders(); // Initial load
});