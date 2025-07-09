import React, { useState, useEffect } from "react";
import jsPDF from "jspdf";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { apiURL } from '../utils/api';

const COLORS = [
  "#10B981",
  "#3B82F6",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#F97316",
  "#EC4899",
];

const LaporanPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportData, setReportData] = useState(null);

  // Fetch report data from API
  const fetchReportData = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem("user") || "{}");

      if (!user.id) {
        setError("User tidak ditemukan. Silakan login kembali.");
        return;
      }

      const response = await fetch(
        `${apiURL}/api/reports/monthly?user_id=${user.id}`
      );
      const result = await response.json();

      if (result.success) {
        setReportData(result.data);
        setError("");
      } else {
        setError(result.message || "Gagal memuat data laporan");
      }
    } catch (error) {
      console.error("Error fetching report data:", error);
      setError(
        "Terjadi kesalahan saat memuat data. Pastikan backend berjalan."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();

    // Auto refresh setiap 5 menit
    const interval = setInterval(fetchReportData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleExportPDF = () => {
    if (!reportData) {
      alert("Data laporan belum tersedia");
      return;
    }

    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.text("Laporan EmoTeam", 14, 20);

    doc.setFontSize(12);
    doc.text(
      `Periode: ${reportData.period.month_name} ${reportData.period.year}`,
      14,
      30
    );
    doc.text(
      `Tanggal Generate: ${new Date().toLocaleDateString("id-ID")}`,
      14,
      40
    );

    // Summary
    doc.setFontSize(14);
    doc.text("Ringkasan:", 14, 55);
    doc.setFontSize(11);

    let y = 65;
    const summary = reportData.summary;
    doc.text(`Total Tim: ${summary.total_teams}`, 14, y);
    y += 8;
    doc.text(`Total Anggota: ${summary.total_members}`, 14, y);
    y += 8;
    doc.text(`Total Sesi Bulan Ini: ${summary.monthly_sessions}`, 14, y);
    y += 6;
    doc.text(`Sesi Aktif: ${summary.active_sessions}`, 14, y);
    y += 8;
    doc.text(`Rata-rata Mood: ${summary.avg_mood_score}/100`, 14, y);
    y += 8;
    doc.text(`Mood Dominan: ${summary.dominant_emotion}`, 14, y);
    y += 12;

    // Distribusi Emosi dengan Detail
    doc.setFontSize(14);
    doc.text("Distribusi Emosi:", 14, y);
    y += 10;
    doc.setFontSize(11);

    const emotionData = reportData.emotion_distribution || [];
    const totalDetections = emotionData.reduce((a, b) => a + b.value, 0);

    emotionData.forEach((emotion) => {
      const percentage = ((emotion.value / totalDetections) * 100).toFixed(1);
      const avgDuration = emotion.avg_duration || 3.5; // Default 3.5 detik jika tidak ada data
      doc.text(
        `${emotion.name}: ${emotion.value} deteksi (${percentage}%)`,
        14,
        y
      );
      y += 6;
      doc.text(`  Rata-rata durasi: ${avgDuration.toFixed(1)} detik`, 16, y);
      y += 8;
    });

    // Analisis Timer dan Statistik
    y += 5;
    doc.setFontSize(14);
    doc.text("Analisis Timer Emosi:", 14, y);
    y += 10;
    doc.setFontSize(11);

    const totalTimer = emotionData.reduce((sum, emotion) => {
      const avgDuration = emotion.avg_duration || 3.5; // Default 3.5 detik jika tidak ada data
      return sum + avgDuration * emotion.value;
    }, 0);

    const avgTimerPerDetection =
      totalDetections > 0 ? (totalTimer / totalDetections).toFixed(1) : 0;
    const totalMinutes = (totalTimer / 60).toFixed(1);

    doc.text(`Total Deteksi Emosi: ${totalDetections} kali`, 14, y);
    y += 8;
    doc.text(`Total Waktu Rekaman: ${totalMinutes} menit`, 14, y);
    y += 8;
    doc.text(`Rata-rata per Deteksi: ${avgTimerPerDetection} detik`, 14, y);
    y += 8;

    // Emosi Dominan
    if (emotionData.length > 0) {
      const dominantEmotion = emotionData.reduce((prev, current) =>
        prev.value > current.value ? prev : current
      );
      const dominantPercentage = (
        (dominantEmotion.value / totalDetections) *
        100
      ).toFixed(1);

      y += 5;
      doc.text(
        `Emosi Dominan: ${dominantEmotion.name} (${dominantPercentage}%)`,
        14,
        y
      );
      y += 12;
    }

    // Kategorisasi Emosi
    y += 5;
    doc.setFontSize(14);
    doc.text("Kategorisasi Emosi:", 14, y);
    y += 10;
    doc.setFontSize(11);

    const positiveEmotions = emotionData.filter(
      (e) =>
        e.name.toLowerCase().includes("senang") ||
        e.name.toLowerCase().includes("bahagia") ||
        e.name.toLowerCase().includes("gembira")
    );
    const negativeEmotions = emotionData.filter(
      (e) =>
        e.name.toLowerCase().includes("sedih") ||
        e.name.toLowerCase().includes("marah") ||
        e.name.toLowerCase().includes("takut")
    );

    const positiveTotal = positiveEmotions.reduce((a, b) => a + b.value, 0);
    const negativeTotal = negativeEmotions.reduce((a, b) => a + b.value, 0);
    const positivePercent =
      totalDetections > 0
        ? ((positiveTotal / totalDetections) * 100).toFixed(1)
        : 0;
    const negativePercent =
      totalDetections > 0
        ? ((negativeTotal / totalDetections) * 100).toFixed(1)
        : 0;

    doc.text(
      `Emosi Positif: ${positiveTotal} deteksi (${positivePercent}%)`,
      14,
      y
    );
    y += 8;
    doc.text(
      `Emosi Negatif: ${negativeTotal} deteksi (${negativePercent}%)`,
      14,
      y
    );
    y += 12;

    // Aktivitas Terbaru
    if (reportData.recent_activities.length > 0) {
      y += 10;
      doc.setFontSize(14);
      doc.text("Aktivitas Terbaru:", 14, y);
      y += 10;
      doc.setFontSize(11);

      reportData.recent_activities.slice(0, 5).forEach((activity) => {
        if (y > 250) {
          // New page if needed
          doc.addPage();
          y = 20;
        }
        doc.text(`• ${activity.title}`, 14, y);
        y += 6;
        doc.text(`  ${activity.description}`, 16, y);
        y += 6;
        doc.text(`  Durasi: ${activity.duration}`, 16, y);
        y += 10;
      });
    }

    doc.save(
      `laporan-emoteam-${reportData.period.month_name.toLowerCase()}-${
        reportData.period.year
      }.pdf`
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Memuat data laporan...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-600 mr-3">⚠️</div>
            <div>
              <h3 className="text-red-800 font-medium text-lg">Error</h3>
              <p className="text-red-700 text-base mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchReportData}
            className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg text-base hover:bg-red-700 transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          <p>Data laporan tidak tersedia</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Laporan Bulanan</h1>
          <p className="text-gray-600 mt-1 text-lg">
            {reportData.period.month_name} {reportData.period.year}
          </p>
        </div>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center text-lg font-medium"
          onClick={handleExportPDF}
        >
          <span className="mr-2">📄</span>
          Unduh Laporan PDF
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Cards */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-semibold mb-4">Ringkasan Bulan Ini</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div
                key="summary-teams"
                className="text-center p-4 border rounded-lg"
              >
                <p className="text-gray-500 text-base">Total Tim</p>
                <p className="text-3xl font-bold text-blue-600">
                  {reportData.summary.total_teams}
                </p>
              </div>
              <div
                key="summary-members"
                className="text-center p-4 border rounded-lg"
              >
                <p className="text-gray-500 text-base">Total Anggota</p>
                <p className="text-3xl font-bold text-green-600">
                  {reportData.summary.total_members}
                </p>
              </div>
              <div
                key="summary-monthly-sessions"
                className="text-center p-4 border rounded-lg"
              >
                <p className="text-gray-500 text-base">Sesi Bulan Ini</p>
                <p className="text-3xl font-bold text-indigo-600">
                  {reportData.summary.monthly_sessions || 0}
                </p>
              </div>
              <div
                key="summary-active-sessions"
                className="text-center p-4 border rounded-lg"
              >
                <p className="text-gray-500 text-base">Sesi Aktif</p>
                <p className="text-3xl font-bold text-purple-600">
                  {reportData.summary.active_sessions}
                </p>
              </div>
              <div
                key="summary-mood"
                className="text-center p-4 border rounded-lg"
              >
                <p className="text-gray-500 text-base">Rata-rata Mood</p>
                <p className="text-3xl font-bold text-yellow-600">
                  {reportData.summary.avg_mood_score}/100
                </p>
                <div className="mt-2 flex flex-col items-center">
                  <span className="text-2xl">
                    {reportData.summary.avg_mood_score >= 75
                      ? "😊"
                      : reportData.summary.avg_mood_score >= 60
                      ? "🙂"
                      : reportData.summary.avg_mood_score >= 40
                      ? "😐"
                      : reportData.summary.avg_mood_score >= 25
                      ? "😔"
                      : "😢"}
                  </span>
                  <span className="text-xs text-gray-600 mt-1">
                    {reportData.summary.avg_mood_score >= 75
                      ? "Sangat Baik"
                      : reportData.summary.avg_mood_score >= 60
                      ? "Baik"
                      : reportData.summary.avg_mood_score >= 40
                      ? "Netral"
                      : reportData.summary.avg_mood_score >= 25
                      ? "Kurang Baik"
                      : "Buruk"}
                  </span>
                </div>
              </div>
              <div
                key="summary-emotions"
                className="text-center p-4 border rounded-lg"
              >
                <p className="text-gray-500 text-base">Total Deteksi Emosi</p>
                <p className="text-3xl font-bold text-pink-600">
                  {reportData.summary.total_emotions}
                </p>
              </div>
            </div>

            {/* Insight */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-800">
                💡 Insight Bulan Ini:
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                {reportData.summary.avg_mood_score > 75
                  ? `🎉 Mood tim sangat positif! Emosi dominan: ${reportData.summary.dominant_emotion}. Pertahankan momentum ini.`
                  : reportData.summary.avg_mood_score > 50
                  ? `👍 Mood tim cukup baik. Emosi dominan: ${reportData.summary.dominant_emotion}. Ada ruang untuk perbaikan.`
                  : `⚠️ Mood tim perlu perhatian. Emosi dominan: ${reportData.summary.dominant_emotion}. Pertimbangkan aktivitas team building.`}
              </p>
            </div>
          </div>

          {/* Distribusi Mood */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Distribusi Mood Tim</h2>
            {reportData.mood_distribution &&
            reportData.mood_distribution.length > 0 ? (
              <div className="flex flex-col lg:flex-row items-center justify-center gap-6">
                {/* Pie Chart */}
                <div className="h-80 w-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reportData.mood_distribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        label={({ percent }) =>
                          `${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {reportData.mood_distribution.map((entry, index) => (
                          <Cell
                            key={`mood-cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => {
                          const total = reportData.mood_distribution.reduce(
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

                {/* Legend */}
                <div className="flex flex-col gap-3">
                  <h3 className="font-medium text-gray-800 mb-2">
                    📊 Detail Mood:
                  </h3>
                  {reportData.mood_distribution.map((item, index) => {
                    const total = reportData.mood_distribution.reduce(
                      (sum, mood) => sum + mood.value,
                      0
                    );
                    const percentage =
                      total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
                    return (
                      <div
                        key={`mood-legend-${item.name}-${index}`}
                        className="flex items-center justify-between min-w-48"
                      >
                        <div className="flex items-center">
                          <div
                            className="w-4 h-4 rounded-full mr-3"
                            style={{
                              backgroundColor: COLORS[index % COLORS.length],
                            }}
                          />
                          <span className="text-sm font-medium">
                            {item.name}
                          </span>
                        </div>
                        <span className="text-sm text-gray-600 font-bold">
                          {item.value} orang ({percentage}%)
                        </span>
                      </div>
                    );
                  })}

                  {/* Summary Stats */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600">
                      <p>
                        <strong>Total Anggota:</strong>{" "}
                        {reportData.mood_distribution.reduce(
                          (sum, item) => sum + item.value,
                          0
                        )}{" "}
                        orang
                      </p>
                      <p>
                        <strong>Mood Dominan:</strong>{" "}
                        {
                          reportData.mood_distribution.reduce((prev, current) =>
                            prev.value > current.value ? prev : current
                          ).name
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <p>Belum ada data mood tersedia</p>
                  <p className="text-sm mt-2">
                    Mulai sesi untuk melihat data mood tim
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Recent Activities */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Aktivitas Terbaru</h2>
          <div className="space-y-4">
            {reportData.recent_activities &&
            reportData.recent_activities.length > 0 ? (
              reportData.recent_activities.map((activity, index) => (
                <div
                  key={`activity-${activity.id}-${index}`}
                  className="border-b pb-3 last:border-0"
                >
                  <p className="font-medium">{activity.title}</p>
                  <p className="text-sm text-gray-500">
                    {activity.description}
                  </p>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-gray-400">
                      Durasi: {activity.duration}
                    </p>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        activity.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {activity.status === "active" ? "Aktif" : "Selesai"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-8">
                <p>Belum ada aktivitas</p>
                <p className="text-sm mt-2">
                  Mulai sesi kolaborasi untuk melihat aktivitas
                </p>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <div className="mt-4 pt-4 border-t">
            <button
              onClick={fetchReportData}
              className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              🔄 Refresh Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaporanPage;
