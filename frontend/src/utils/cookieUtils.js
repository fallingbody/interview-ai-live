/**
 * cookieUtils.js
 * Helper functions for managing browser cookies.
 */

export const setCookie = (name, value, days = 7) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const secure = window.location.protocol === "https:" ? "Secure;" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; ${secure} SameSite=Lax`;
  // Fallback to localStorage
  try {
    localStorage.setItem(name, value);
  } catch (e) {
    console.warn("Failed to write to localStorage fallback:", e);
  }
};

export const getCookie = (name) => {
  let cookieValue = "";
  const cookies = document.cookie.split(";");
  for (let i = 0; i < cookies.length; i++) {
    const c = cookies[i].trim();
    if (c.startsWith(name + "=")) {
      cookieValue = decodeURIComponent(c.substring(name.length + 1));
      break;
    }
  }
  // Fallback to localStorage if cookie is empty
  if (!cookieValue) {
    try {
      cookieValue = localStorage.getItem(name) || "";
    } catch (e) {
      console.warn("Failed to read from localStorage fallback:", e);
    }
  }
  return cookieValue;
};

export const deleteCookie = (name) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
  // Fallback to localStorage
  try {
    localStorage.removeItem(name);
  } catch (e) {
    console.warn("Failed to delete from localStorage fallback:", e);
  }
};
