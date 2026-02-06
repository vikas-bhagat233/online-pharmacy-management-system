(function requireAdmin() {
  try {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');

    if (!token) {
      window.location.replace('login.html');
      return;
    }

    if (role !== 'admin') {
      // Non-admin user should never access admin dashboard
      window.location.replace('index.html');
    }
  } catch (e) {
    window.location.replace('login.html');
  }
})();
