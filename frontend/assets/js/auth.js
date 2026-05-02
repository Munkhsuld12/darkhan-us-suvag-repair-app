// Auth helpers — JWT stored in localStorage

const TOKEN_KEY = "dhs_token";
const USER_KEY  = "dhs_user";

export const setSession = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const getUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const isAuthenticated = () => {
  const token = getToken();
  if (!token) return false;
  // Quick expiry check via JWT payload (no signature verify)
  try {
    // JWT uses base64url (RFC 4648 §5): replace - → + and _ → / for atob()
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64));
    return payload.exp * 1000 > Date.now();
  } catch { return false; }
};

export const requireAuth = () => {
  if (!isAuthenticated()) {
    window.location.href = "/login.html";
    return null;
  }
  const user = getUser();
  if (user && user.profileComplete === false) {
    window.location.href = "/profile-setup.html";
    return null;
  }
  return user;
};

export const logout = () => {
  clearSession();
  window.location.href = "/login.html";
};

export const getRoleRedirect = (role) => {
  switch (role) {
    case "dispatcher":          return "/app.html";
    case "general_engineer":    return "/app.html";
    case "department_engineer": return "/app.html";
    case "brigade_leader":      return "/app.html";
    case "admin":               return "/app.html";
    default:                    return "/login.html";
  }
};
