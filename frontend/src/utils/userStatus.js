import { apiURL } from './api';

// Utility functions untuk mengelola status user online/offline

// Function untuk update status user
export const updateUserStatus = async (userId, status) => {
  try {
    const response = await fetch(`${apiURL}/api/user/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        status: status, // 'online' atau 'offline'
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`Status user berhasil diupdate menjadi ${status}`);
      return { success: true, data };
    } else {
      console.error("Gagal update status user:", data.error);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error("Error updating user status:", error);
    return { success: false, error: "Network error" };
  }
};

// Function untuk set user online (saat login)
export const setUserOnline = (userId) => {
  return updateUserStatus(userId, "online");
};

// Function untuk set user offline (saat logout)
export const setUserOffline = (userId) => {
  return updateUserStatus(userId, "offline");
};

// Function untuk logout dengan update status
export const logoutUser = async () => {
  const storedUser = localStorage.getItem("user");

  if (storedUser) {
    try {
      const userData = JSON.parse(storedUser);

      // Set status offline sebelum logout
      await setUserOffline(userData.id);
    } catch (error) {
      console.error("Error during logout:", error);
    }
  }

  // Clear localStorage
  localStorage.removeItem("user");
  localStorage.removeItem("token");

  // Redirect ke login page
  window.location.href = "/login";
};

// Function untuk setup status tracking
export const setupStatusTracking = () => {
  const storedUser = localStorage.getItem("user");

  if (storedUser) {
    try {
      const userData = JSON.parse(storedUser);

      // Set user online saat aplikasi dibuka
      setUserOnline(userData.id);

      // Set user offline saat tab/window ditutup
      const handleBeforeUnload = () => {
        // Gunakan sendBeacon untuk request yang reliable
        const data = JSON.stringify({
          user_id: userData.id,
          status: "offline",
        });

        navigator.sendBeacon(`${apiURL}/api/user/status`, data);
      };

      // Set user offline saat tab kehilangan focus (optional)
      const handleVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
          setUserOffline(userData.id);
        } else if (document.visibilityState === "visible") {
          setUserOnline(userData.id);
        }
      };

      // Add event listeners
      window.addEventListener("beforeunload", handleBeforeUnload);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      // Cleanup function
      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
      };
    } catch (error) {
      console.error("Error setting up status tracking:", error);
    }
  }

  return null;
};
