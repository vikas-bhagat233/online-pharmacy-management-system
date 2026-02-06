let map;
let marker;

function initMap(lat = 28.7041, lng = 77.1025) {
    if (!window.google || !google.maps) {
        // Google Maps script not loaded (likely missing API key)
        return;
    }
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat, lng },
        zoom: 12
    });
    marker = new google.maps.Marker({ position: { lat, lng }, map });
}

function trackOrder() {
    const trackingNumber = document.getElementById('trackingInput').value;

    fetch(`${Config.API_BASE}/api/delivery/track/${trackingNumber}`)
        .then(res => res.json())
        .then(delivery => {
            // ...

            // Connect to real-time updates
            const socket = io(Config.API_BASE);
            socket.emit('joinDeliveryRoom', delivery._id);

            socket.on('locationUpdate', (updatedDelivery) => {
                const { lat, lng } = updatedDelivery.currentLocation;
                if (marker && map) {
                    marker.setPosition({ lat, lng });
                    map.panTo({ lat, lng });
                } else {
                    initMap(lat, lng);
                }
                document.getElementById('status').textContent = updatedDelivery.status;
            });
        });
}

// Expose initMap for Google Maps callback
window.initMap = initMap;