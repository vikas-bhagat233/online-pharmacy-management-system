(function requireAuth() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      // Pages live under /pages, so login.html is a sibling.
      window.location.replace('login.html');
    }
  } catch (e) {
    // If storage is blocked, treat as not authenticated.
    window.location.replace('login.html');
  }
})();

// Used by profile.html
window.logout = function logout() {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
  } catch (e) {
    // ignore
  }
  window.location.replace('login.html');
};
