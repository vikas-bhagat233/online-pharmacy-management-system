const API_URL = `${Config.API_BASE}/api`;

window.__AUTH_JS_VERSION__ = '2026-02-01';

async function login() {
  const email = document.getElementById('email').value?.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    alert('Please enter email and password.');
    return;
  }

  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    alert(data.error || 'Login failed.');
    return;
  }

  if (!data.token) {
    alert('Login failed: missing token.');
    return;
  }

  localStorage.setItem('token', data.token);
  localStorage.setItem('userRole', data.user?.role || 'user');
  localStorage.setItem('userEmail', data.user?.email || '');

  if (data.user?.role === 'admin') {
    window.location.href = 'admin.html';
  } else {
    window.location.href = 'medicines.html';
  }
}

async function signup() {
  const name = document.getElementById('name').value?.trim();
  const email = document.getElementById('email').value?.trim();
  const password = document.getElementById('password').value;

  if (!name || !email || !password) {
    alert('Please fill all fields.');
    return;
  }

  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    alert(data.error || 'Registration failed.');
    return;
  }

  alert('Registered successfully. Please login.');
  window.location.href = 'login.html';
}

async function resetPassword() {
  const email = document.getElementById('email')?.value?.trim();
  if (!email) {
    alert('Please enter your email.');
    return;
  }

  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(data.error || 'Failed to send reset link.');
    return;
  }

  // In dev the backend may return resetLink when email is skipped.
  if (data.resetLink) {
    const proceed = confirm('Email sending is not configured. Open the reset link now?');
    if (proceed) window.location.href = data.resetLink;
    return;
  }

  alert(data.message || 'If the account exists, a reset link has been sent.');
}

async function updatePassword() {
  const password = document.getElementById('password')?.value || '';
  const confirmPassword = document.getElementById('confirmPassword')?.value || '';
  const token = new URLSearchParams(window.location.search).get('token');

  if (!token) {
    alert('Missing reset token. Please open the link from your email again.');
    return;
  }
  if (!password) {
    alert('Please enter a new password.');
    return;
  }
  if (password.length < 6) {
    alert('Password must be at least 6 characters long.');
    return;
  }
  if (password !== confirmPassword) {
    alert('Passwords do not match.');
    return;
  }

  const res = await fetch(`${API_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(data.error || 'Failed to reset password.');
    return;
  }

  alert(data.message || 'Password updated. Please login.');
  window.location.href = 'login.html';
}