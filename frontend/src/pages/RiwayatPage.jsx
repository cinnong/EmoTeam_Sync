import React, { useState, useEffect } from "react";
import EmotionPieChart from "../components/EmotionPieChart";
import jsPDF from "jspdf";
import { apiURL } from '../utils/api';

const RiwayatPage = () => {
  const [riwayatSesi, setRiwayatSesi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [emotionData, setEmotionData] = useState([]);
  const user = JSON.parse(localStorage.getItem("user"));

  // Fetch riwayat sesi
  const fetchRiwayatSesi = async () => {
    try {
      const response = await fetch(
        `${apiURL}/api/user/${user.id}/sessions`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRiwayatSesi(data.sessions || []);
      } else {
        setError("Gagal memuat riwayat sesi");
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
      setError("Terjadi kesalahan saat memuat data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch data emosi untuk sesi tertentu (riwayat lengkap)
  const fetchEmotionData = async (sessionId) => {
    try {
      const response = await fetch(
        `${apiURL}/api/sessions/${sessionId}/emotions/all`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEmotionData(data.emotions || []);
        setSelectedSession(sessionId);
      } else {
        console.error("Gagal memuat data emosi");
      }
    } catch (error) {
      console.error("Error fetching emotion data:", error);
    }
  };

  // Fungsi hapus sesi
  const handleHapusSesi = async (sessionId) => {
    if (
      !window.confirm(
        "Yakin ingin menghapus sesi ini? Semua data emosi akan ikut terhapus."
      )
    )
      return;
    try {
      const response = await fetch(
        `${apiURL}/api/sessions/${sessionId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ user_id: user.id }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        setRiwayatSesi((prev) => prev.filter((s) => s.id !== sessionId));
        setSelectedSession(null);
        setEmotionData([]);
        alert("Sesi berhasil dihapus!");
      } else {
        alert(data.error || "Gagal menghapus sesi");
      }
    } catch {
      alert("Gagal koneksi ke server");
    }
  };

  // Export PDF untuk data emosi sesi terpilih
  const handleExportPDF = () => {
    if (!selectedSession || emotionData.length === 0) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Laporan Data Emosi Sesi", 14, 18);
    doc.setFontSize(12);
    let y = 30;
    doc.text(`Sesi ID: ${selectedSession}`, 14, y);
    y += 8;
    doc.text(`Total Data: ${emotionData.length}`, 14, y);
    y += 8;
    doc.text("Emosi (user, waktu, emosi, confidence)", 14, y);
    y += 8;
    emotionData.slice(0, 40).forEach((e) => {
      doc.text(
        `${e.user_name}, ${new Date(e.timestamp).toLocaleString()}, ${
          e.emotion
        }, ${e.confidence}%`,
        14,
        y
      );
      y += 7;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });
    doc.save(`data-emosi-sesi-${selectedSession}.pdf`);
  };

  useEffect(() => {
    fetchRiwayatSesi();
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("id-ID");
  };

  // const getEmotionIcon = (emotion) => {
  //   const icons = {
  //     happy: "😊",
  //     sad: "😢",
  //     angry: "😠",
  //     surprised: "😲",
  //     fearful: "😨",
  //     disgust: "🤢", // ganti dari 'disgusted' ke 'disgust' agar konsisten dengan backend
  //     neutral: "😐",
  //   };
  //   return icons[emotion] || "🎭";
  // };

  const getDuration = (start, end) => {
    if (!start || !end) return "-";
    const startTime = new Date(start);
    const endTime = new Date(end);
    const diffMs = endTime - startTime;
    if (isNaN(diffMs) || diffMs < 0) return "-";
    const totalSec = Math.floor(diffMs / 1000);
    const jam = Math.floor(totalSec / 3600);
    const menit = Math.floor((totalSec % 3600) / 60);
    const detik = totalSec % 60;
    return [
      jam > 0 ? `${jam}j` : null,
      menit > 0 ? `${menit}m` : null,
      `${detik}s`,
    ]
      .filter(Boolean)
      .join(" ");
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat riwayat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        📊 Riwayat Sesi & Data Emosi
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-12rem)]">
        {/* Riwayat Sesi */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 flex-shrink-0">
            <h2 className="text-xl font-semibold">🗓️ Riwayat Sesi</h2>
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            {riwayatSesi.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-gray-500">
                  Belum ada sesi yang pernah dilakukan
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {riwayatSesi.map((sesi) => (
                  <div
                    key={sesi.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      selectedSession === sesi.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => fetchEmotionData(sesi.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-800">
                        {sesi.team_name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            sesi.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : sesi.status === "active"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {sesi.status === "completed"
                            ? "Selesai"
                            : sesi.status === "active"
                            ? "Aktif"
                            : "Pending"}
                        </span>
                        {/* Tombol hapus hanya untuk ketua/creator */}
                        {sesi.creator_id === user.id && (
                          <button
                            className="ml-2 text-red-600 hover:text-red-800"
                            title="Hapus sesi"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleHapusSesi(sesi.id);
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-gray-500 text-xs">
                      Dimulai: {formatDate(sesi.started_at)}
                    </div>
                    {sesi.ended_at && (
                      <div className="text-gray-500 text-xs">
                        Selesai: {formatDate(sesi.ended_at)}
                      </div>
                    )}
                    {sesi.ended_at && (
                      <div className="text-gray-700 text-xs font-semibold">
                        Durasi: {getDuration(sesi.started_at, sesi.ended_at)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pie Chart Data Emosi Sesi */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-yellow-400 to-pink-500 text-white p-4 flex-shrink-0 flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              🧑‍💻 Diagram Emosi Selama Sesi
            </h2>
            {selectedSession && emotionData.length > 0 && (
              <button
                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                onClick={handleExportPDF}
              >
                Export PDF
              </button>
            )}
          </div>
          <div className="p-4 flex flex-col items-center justify-center flex-1 overflow-y-auto">
            {selectedSession && emotionData.length > 0 ? (
              <>
                <EmotionPieChart data={emotionData} />
                {/* Insight otomatis */}
                <div className="mt-6 w-full bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                  <h3 className="font-bold text-blue-700 mb-1">Insight</h3>
                  {(() => {
                    // Hitung insight
                    const count = {};
                    emotionData.forEach((e) => {
                      count[e.emotion] = (count[e.emotion] || 0) + 1;
                    });
                    const total = emotionData.length;
                    const sorted = Object.entries(count).sort(
                      (a, b) => b[1] - a[1]
                    );
                    const dominant = sorted[0] ? sorted[0][0] : "-";
                    const dominantPct = sorted[0]
                      ? Math.round((sorted[0][1] / total) * 100)
                      : 0;
                    let saran = "";
                    if (dominant === "happy")
                      saran = "Tim Anda cukup positif selama sesi ini!";
                    else if (dominant === "neutral")
                      saran =
                        "Emosi tim cenderung netral, pertahankan komunikasi.";
                    else if (
                      dominant === "sad" ||
                      dominant === "angry" ||
                      dominant === "disgust" ||
                      dominant === "fear"
                    )
                      saran =
                        "Terdeteksi emosi negatif dominan, coba lakukan ice breaking atau diskusi terbuka.";
                    else saran = "Data emosi bervariasi.";
                    return (
                      <>
                        <div className="mb-1">
                          Emosi dominan:{" "}
                          <span className="font-semibold">{dominant}</span> (
                          {dominantPct}%)
                        </div>
                        <div className="mb-1">Total data emosi: {total}</div>
                        <div className="text-blue-700 font-medium">{saran}</div>
                      </>
                    );
                  })()}
                </div>
              </>
            ) : selectedSession ? (
              <div className="text-center py-8 text-gray-500">
                Belum ada data emosi pada sesi ini.
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                Klik salah satu sesi untuk melihat data emosi.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiwayatPage;
