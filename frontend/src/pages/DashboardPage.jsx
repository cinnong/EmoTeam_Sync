import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { apiURL } from '../utils/api';

const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444"];

const DashboardPage = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboardData, setDashboardData] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Fetch dashboard data from API
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem("user") || "{}");

      const response = await fetch(
        `${apiURL}/api/dashboard/stats?user_id=${user.id}`
      );
      const result = await response.json();

      if (result.success) {
        setDashboardData(result.data);
      } else {
        setError(result.message || "Gagal memuat data dashboard");
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setError("Terjadi kesalahan saat memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Update waktu setiap detik
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Get current user data
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setCurrentUser(userData);
      } catch (e) {
        console.error("Error parsing user data:", e);
      }
    }

    // Fetch data saat component mount
    fetchDashboardData();

    // Auto refresh setiap 30 detik
    const refreshTimer = setInterval(fetchDashboardData, 30000);

    return () => {
      clearInterval(timer);
      clearInterval(refreshTimer);
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat data dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-medium">Error</h2>
          <p className="text-red-600 mt-1">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-3 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Tidak ada data tersedia</p>
        </div>
      </div>
    );
  }

  const { stats, emotion_trend, team_members, mood_distribution } =
    dashboardData;

  return (
    <div className="p-6 space-y-6 print:p-4 print:space-y-4 print:bg-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center print:flex-col print:items-start print:mb-6">
        <div>
          {currentUser && (
            <h1 className="text-3xl font-bold text-gray-900 mb-2 print:text-3xl print:text-black print:font-extrabold print:mb-3">
              👋 Selamat datang kembali, {currentUser.nama}!
            </h1>
          )}

          <p className="text-lg font-semibold text-gray-700 print:text-xl print:font-bold">
            {currentTime.toLocaleDateString("id-ID", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            {" • "}
            {currentTime.toLocaleTimeString("id-ID")}
          </p>
        </div>
        <div className="mt-4 md:mt-0 print:hidden">
          <button
            onClick={fetchDashboardData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:gap-4 print:mb-6">
        <StatCard
          title="Tim Saya"
          value={stats.total_teams}
          change={`${stats.total_members} total anggota`}
          icon="👥"
          color="blue"
        />
        <StatCard
          title="Rata-rata Mood"
          value={`${stats.avg_mood}%`}
          change={
            stats.avg_mood >= 75
              ? "Sangat Baik"
              : stats.avg_mood >= 60
              ? "Baik"
              : stats.avg_mood >= 40
              ? "Netral"
              : stats.avg_mood >= 25
              ? "Kurang Baik"
              : "Buruk"
          }
          icon={
            stats.avg_mood >= 75
              ? "😊"
              : stats.avg_mood >= 60
              ? "🙂"
              : stats.avg_mood >= 40
              ? "😐"
              : stats.avg_mood >= 25
              ? "😔"
              : "😢"
          }
          color={
            stats.avg_mood >= 75
              ? "green"
              : stats.avg_mood >= 60
              ? "green"
              : stats.avg_mood >= 40
              ? "yellow"
              : stats.avg_mood >= 25
              ? "red"
              : "red"
          }
        />
        <StatCard
          title="Sesi Aktif"
          value={stats.active_sessions}
          change={`${
            stats.active_sessions > 0
              ? "Ada sesi berjalan"
              : "Tidak ada sesi aktif"
          }`}
          icon="🔄"
          color="purple"
        />
      </div>

      {/* Grafik Tren Emosi - Full Width */}
      <div className="bg-white p-6 rounded-xl shadow print:shadow-none print:border-2 print:border-gray-800 print:p-4">
        <h2 className="text-xl font-bold mb-4 print:text-2xl print:font-bold print:text-black print:mb-3">
          📈 Tren Emosi Mingguan
        </h2>
        <div className="h-80 print:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={emotion_trend}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="senang"
                stackId="1"
                stroke="#10B981"
                fill="#D1FAE5"
              />
              <Area
                type="monotone"
                dataKey="netral"
                stackId="1"
                stroke="#3B82F6"
                fill="#DBEAFE"
              />
              <Area
                type="monotone"
                dataKey="sedih"
                stackId="1"
                stroke="#F59E0B"
                fill="#FEF3C7"
              />
              <Area
                type="monotone"
                dataKey="marah"
                stackId="1"
                stroke="#EF4444"
                fill="#FEE2E2"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Aktivitas Anggota dan Distribusi Mood */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:gap-4">
        <div className="bg-white p-6 rounded-xl shadow print:shadow-none print:border-2 print:border-gray-800 print:p-4">
          <h2 className="text-xl font-bold mb-4 print:text-2xl print:font-bold print:text-black print:mb-3">
            👥 Aktivitas Anggota
          </h2>
          <div className="space-y-4 print:space-y-3">
            {team_members && team_members.length > 0 ? (
              team_members.map((member, index) => (
                <div
                  key={`team-member-${member.id}-${index}`}
                  className="flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors print:hover:bg-white print:border print:border-gray-300"
                >
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-2xl mr-4 print:bg-gray-100">
                    {member.mood}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-lg print:font-bold print:text-black">
                        {member.name}
                      </h3>
                      <span
                        className={`text-base font-semibold px-3 py-1 rounded-full print:font-semibold print:text-black ${
                          member.is_online
                            ? "bg-green-100 text-green-800 print:bg-green-200"
                            : "bg-gray-100 text-gray-600 print:bg-gray-200"
                        }`}
                      >
                        {member.is_online ? "Online" : "Offline"}
                      </span>
                    </div>
                    <p className="text-base font-semibold text-gray-700 mt-1 print:text-black print:font-medium">
                      {member.team}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-600 py-8 print:text-black print:font-medium">
                <p className="text-lg font-bold">Belum ada anggota tim</p>
                <p className="text-base mt-2 font-medium">
                  Buat atau bergabung dengan tim untuk melihat aktivitas anggota
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow print:shadow-none print:border-2 print:border-gray-800 print:p-4">
          <h2 className="text-xl font-bold mb-4 print:text-2xl print:font-bold print:text-black print:mb-3">
            📊 Distribusi Mood
          </h2>
          <div className="h-80 flex flex-col items-center justify-center print:h-64">
            {mood_distribution.reduce((sum, item) => sum + item.value, 0) >
            0 ? (
              <>
                <div className="h-52 w-full mb-4 print:h-40 print:mb-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mood_distribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        label={({ percent }) =>
                          `${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {mood_distribution.map((entry, index) => (
                          <Cell
                            key={`mood-cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => {
                          const total = mood_distribution.reduce(
                            (sum, mood) => sum + mood.value,
                            0
                          );
                          const percentage =
                            total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                          return [`${value} orang (${percentage}%)`, name];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-4 text-base font-semibold print:text-lg print:gap-3">
                  {mood_distribution.map((item, index) => {
                    const total = mood_distribution.reduce(
                      (sum, mood) => sum + mood.value,
                      0
                    );
                    const percentage =
                      total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
                    return (
                      <div
                        key={`mood-legend-${item.name}-${index}`}
                        className="flex items-center print:font-semibold"
                      >
                        <div
                          className="w-4 h-4 rounded-full mr-3 print:w-5 print:h-5"
                          style={{
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                        <span className="text-gray-800 font-bold print:text-black">
                          {item.name}: {item.value} orang ({percentage}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center text-gray-600 py-8 print:text-black print:font-medium">
                <p className="text-lg font-bold">
                  Belum ada data mood tersedia
                </p>
                <p className="text-base mt-2 font-medium">
                  Mulai sesi untuk melihat data mood tim
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Komponen Stat Card
const StatCard = ({ title, value, change, icon, color }) => {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-600 print:bg-blue-200 print:text-blue-800",
    green:
      "bg-green-100 text-green-600 print:bg-green-200 print:text-green-800",
    red: "bg-red-100 text-red-600 print:bg-red-200 print:text-red-800",
    yellow:
      "bg-yellow-100 text-yellow-600 print:bg-yellow-200 print:text-yellow-800",
    purple:
      "bg-purple-100 text-purple-600 print:bg-purple-200 print:text-purple-800",
    indigo:
      "bg-indigo-100 text-indigo-600 print:bg-indigo-200 print:text-indigo-800",
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow print:shadow-none print:border-2 print:border-gray-800 print:p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-lg font-bold text-gray-700 print:text-xl print:font-bold print:text-black">
            {title}
          </p>
          <p className="text-4xl font-bold mt-2 print:text-5xl print:text-black">
            {value}
          </p>
          <p className="text-base font-semibold text-gray-700 mt-2 print:text-lg print:font-semibold print:text-gray-800">
            {change}
          </p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]} print:p-2`}>
          <span className="text-3xl print:text-4xl">{icon}</span>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
