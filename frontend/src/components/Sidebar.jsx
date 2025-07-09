import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaHistory,
  FaChartBar,
  FaUsers,
  FaSignOutAlt,
  FaBell,
} from "react-icons/fa";
import { apiURL } from '../utils/api';

const Sidebar = () => {
  const navigate = useNavigate();
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState(null);
  const location = useLocation();
  const bellRef = useRef();
  const [notifPos, setNotifPos] = useState({ top: 0, left: 0 });
  const isActive = (path) =>
    location.pathname === path ? "bg-blue-100 text-blue-600" : "text-gray-700";

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user") || "null");
    if (userData) {
      setUser(userData);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch(`${apiURL}/api/notifications/${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUser(user);
          setNotifications(data.notifications);
          setUnreadCount(data.notifications.filter((n) => !n.is_read).length);
        }
      });
  }, [user, showNotif]);

  useEffect(() => {
    if (showNotif && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      let left = rect.right - 288; // default: rata kanan sidebar
      // Jika dropdown keluar layar kanan, geser ke kiri
      if (left + 288 > window.innerWidth) {
        left = window.innerWidth - 288 - 8; // 8px padding dari kanan
      }
      if (left < 0) left = 8; // minimal padding kiri
      setNotifPos({ top: rect.bottom + 8, left });
    }
  }, [showNotif]);

  useEffect(() => {
    if (!showNotif) return;
    const handleClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target))
        setShowNotif(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [showNotif]);

  useEffect(() => {
    if (showNotif && notifications.length > 0) {
      // Mark all unread notifications as read
      const unread = notifications.filter((n) => !n.is_read);
      if (unread.length > 0) {
        Promise.all(
          unread.map((notif) =>
            fetch(`${apiURL}/api/notifications/${notif.id}/read`, {
              method: "POST",
            })
          )
        ).then(() => {
          setNotifications((prev) =>
            prev.map((n) => ({ ...n, is_read: true }))
          );
          setUnreadCount(0);
        });
      }
    }
  }, [showNotif, notifications]);

  const handleNotifClick = (notifId) => {
    fetch(`${apiURL}/api/notifications/${notifId}/read`, {
      method: "POST",
    }).then(() => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  // --- PROFILE SECTION ---
  const getInitials = (name) => {
    if (!name) return "";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <div className="w-72 bg-white shadow-lg flex flex-col h-screen fixed top-0 left-0 z-30">
      <div className="p-4 border-b flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-600">EmoTeam Sync</h1>
        {/* Bell notification */}
        <div
          className="relative cursor-pointer ml-2"
          ref={bellRef}
          onClick={() => setShowNotif(!showNotif)}
        >
          <FaBell className="text-2xl text-gray-500 hover:text-blue-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-sm rounded-full px-2 py-1">
              {unreadCount}
            </span>
          )}
        </div>
        {/* Notif dropdown as portal/fixed */}
        {showNotif && (
          <div
            style={{
              position: "fixed",
              top: notifPos.top,
              left: notifPos.left,
              width: 288,
              zIndex: 50,
            }}
            className="bg-white shadow-lg rounded-lg border"
          >
            <div className="p-2 font-semibold border-b">Notifikasi</div>
            {notifications.length === 0 ? (
              <div className="p-4 text-gray-400 text-base">
                Tidak ada notifikasi
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 border-b last:border-b-0 text-base hover:bg-blue-50 cursor-pointer ${
                    notif.is_read ? "" : "bg-blue-50"
                  }`}
                  onClick={() => handleNotifClick(notif.id)}
                >
                  <div>{notif.message}</div>
                  <div className="text-sm text-gray-400 mt-1">
                    {new Date(notif.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <Link
          to="/dashboard"
          className={`flex items-center p-3 rounded-lg transition-colors font-medium text-base ${isActive(
            "/dashboard"
          )} hover:bg-blue-50`}
        >
          <FaHome className="mr-3 text-lg" />
          <span>Dashboard</span>
        </Link>
        <Link
          to="/tim"
          className={`flex items-center p-3 rounded-lg transition-colors font-medium text-base ${isActive(
            "/tim"
          )} hover:bg-blue-50`}
        >
          <FaUsers className="mr-3 text-lg" />
          <span>Tim</span>
        </Link>
        <Link
          to="/riwayat"
          className={`flex items-center p-3 rounded-lg transition-colors font-medium text-base ${isActive(
            "/riwayat"
          )} hover:bg-blue-50`}
        >
          <FaHistory className="mr-3 text-lg" />
          <span>Riwayat</span>
        </Link>
        <Link
          to="/laporan"
          className={`flex items-center p-3 rounded-lg transition-colors font-medium text-base ${isActive(
            "/laporan"
          )} hover:bg-blue-50`}
        >
          <FaChartBar className="mr-3 text-lg" />
          <span>Laporan</span>
        </Link>
      </nav>
      {/* Profile user di bawah, di atas logout */}
      {user && (
        <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-3 mx-4 mb-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-200 text-blue-700 font-bold text-lg">
            {getInitials(user.nama)}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-gray-800 leading-tight text-base">
              {user.nama}
            </span>
            <span className="text-sm text-gray-500">{user.email}</span>
          </div>
        </div>
      )}
      <div className="p-4 border-t bg-white">
        <button
          onClick={handleLogout}
          className="flex items-center w-full p-3 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-base font-medium"
        >
          <FaSignOutAlt className="mr-3 text-lg" />
          <span>Keluar</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
