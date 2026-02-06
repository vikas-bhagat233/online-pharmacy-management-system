const API = `${Config.API_BASE}/api`;

function token() {
    return localStorage.getItem('token');
}

async function loadProfile() {
    const res = await fetch(`${API}/users/profile`, {
        headers: { 'Authorization': `Bearer ${token()}` }
    });
    const user = await res.json();

    if (document.getElementById('pName')) document.getElementById('pName').value = user.name || '';
    if (document.getElementById('pEmail')) document.getElementById('pEmail').value = user.email || '';
    if (document.getElementById('pPhone')) document.getElementById('pPhone').value = user.phone || '';
    if (document.getElementById('pAddress')) document.getElementById('pAddress').value = user.address || '';
}

async function updateProfile(e) {
    e.preventDefault();
    const phone = document.getElementById('pPhone').value;
    const address = document.getElementById('pAddress').value;

    // Name/Email usually not editable lightly, but we can allow if needed. Let's just do address/phone for now as requested.
    // Actually controller allows body update.
    const name = document.getElementById('pName').value;

    const res = await fetch(`${API}/users/profile`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token()}`
        },
        body: JSON.stringify({ name, phone, address })
    });

    if (res.ok) {
        alert('Profile updated');
    } else {
        alert('Failed to update profile');
    }
}

window.onload = () => {
    loadProfile();
    const form = document.getElementById('profileForm');
    if (form) form.addEventListener('submit', updateProfile);
};

window.logout = function () {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
};
