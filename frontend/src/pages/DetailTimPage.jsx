import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import WebcamEmotion from "../components/WebcamEmotion";
import { apiURL } from '../utils/api';

function DetailTimPage() {
  const { timId } = useParams();
  const navigate = useNavigate();

  const [tim, setTim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sesiAktif, setSesiAktif] = useState(false);
  const [sesiAktifId, setSesiAktifId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Ambil data user saat ini
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setCurrentUser({
          id: userData.id,
          name: userData.nama,
        });
      } catch (e) {
        console.error("Error parsing user data:", e);
        setError("Data user tidak valid");
      }
    }
  }, []);

  // Function untuk mengambil detail tim
  const fetchDetailTim = useCallback(async () => {
    if (!timId) return;

    setLoading(true);
    try {
      const storedUser = localStorage.getItem("user");

      if (!storedUser) {
        setError("User belum login");
        setLoading(false);
        return;
      }

      const userData = JSON.parse(storedUser);
      const userId = userData.id;

      // Ambil daftar tim user untuk mendapatkan detail tim
      const res = await fetch(`${apiURL}/api/my-teams/${userId}`);
      const data = await res.json();

      console.log("Detail tim response:", data);

      if (Array.isArray(data)) {
        // Jika response langsung array tim
        const selectedTeam = data.find((t) => t.id === parseInt(timId));

        if (selectedTeam) {
          // Standarisasi format data tim
          const standardizedTeam = {
            ...selectedTeam,
            members: selectedTeam.anggota || selectedTeam.members || [],
            creator_id: selectedTeam.creator_id,
            ketua_nama: selectedTeam.ketua_nama,
            is_ketua: selectedTeam.is_ketua, // apakah user saat ini adalah ketua
          };
          setTim(standardizedTeam);
          setError("");
          console.log("Tim ditemukan:", standardizedTeam);
        } else {
          setError("Tim tidak ditemukan atau Anda bukan anggota tim ini");
        }
      } else if (data.success && data.teams) {
        // Jika response dalam format {success: true, teams: [...]}
        const selectedTeam = data.teams.find((t) => t.id === parseInt(timId));

        if (selectedTeam) {
          // Standarisasi format data tim
          const standardizedTeam = {
            ...selectedTeam,
            members: selectedTeam.anggota || selectedTeam.members || [],
            creator_id: selectedTeam.creator_id,
            ketua_nama: selectedTeam.ketua_nama,
            is_ketua: selectedTeam.is_ketua, // apakah user saat ini adalah ketua
          };
          setTim(standardizedTeam);
          setError("");
          console.log("Tim ditemukan:", standardizedTeam);
        } else {
          setError("Tim tidak ditemukan atau Anda bukan anggota tim ini");
        }
      } else {
        setError("Gagal memuat data tim");
      }
    } catch (err) {
      console.error("Error fetching team detail:", err);
      setError("Gagal koneksi ke server");
    }
    setLoading(false);
  }, [timId]);

  useEffect(() => {
    fetchDetailTim();
  }, [fetchDetailTim]);

  // Function untuk cek apakah user adalah ketua tim
  const isKetuaTim = () => {
    if (!tim || !currentUser) {
      console.log("isKetuaTim check failed:", {
        tim: !!tim,
        currentUser: !!currentUser,
      });
      return false;
    }

    // Gunakan data is_ketua dari backend yang sudah dihitung
    if (tim.is_ketua !== undefined) {
      console.log("Using backend is_ketua:", tim.is_ketua);
      return tim.is_ketua;
    }

    // Fallback: cek dari members jika ada
    if (tim.members && tim.members.length > 0) {
      console.log("Checking leadership from members for:", {
        currentUserId: currentUser.id,
        currentUserName: currentUser.name,
        members: tim.members,
      });

      const currentMember = tim.members.find(
        (member) =>
          member.id === currentUser.id || member.id === parseInt(currentUser.id)
      );

      console.log("Found member:", currentMember);

      // Support both is_leader and is_ketua
      const isLeader =
        currentMember &&
        (currentMember.is_leader === 1 ||
          currentMember.is_ketua === 1 ||
          currentMember.is_leader === true ||
          currentMember.is_ketua === true);

      console.log("Is leader result:", isLeader);
      return isLeader;
    }

    return false;
  };

  // Function untuk menghapus anggota
  const handleHapusAnggota = async (userId) => {
    if (!window.confirm("Yakin ingin menghapus anggota ini?")) return;

    try {
      const res = await fetch(
        `${apiURL}/api/teams/${tim.id}/members/${userId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ketua_id: currentUser.id, // Kirim ID ketua
          }),
        }
      );

      const data = await res.json();

      if (res.ok) {
        // Update anggota tim
        setTim((prev) => ({
          ...prev,
          members: prev.members.filter((member) => member.id !== userId),
        }));
        alert("Anggota berhasil dihapus!");
      } else {
        alert(data.error || "Gagal menghapus anggota");
      }
    } catch (error) {
      console.error("Delete member error:", error);
      alert("Gagal koneksi ke server");
    }
  };

  // Function untuk memulai sesi
  const handleMulaiSesi = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user || !tim) return;

      const response = await fetch(
        `${apiURL}/api/teams/${tim.id}/sessions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            creator_id: user.id,
            title: tim.name, // Langsung pakai nama tim
            description: `Sesi kolaborasi tim ${tim.name}`,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setSesiAktif(true);
        setSesiAktifId(data.session.id);
        console.log("✅ Sesi berhasil dimulai:", data.session);
      } else {
        console.error("❌ Gagal memulai sesi:", data.message);
        alert(data.message || "Gagal memulai sesi");
      }
    } catch (error) {
      console.error("❌ Error memulai sesi:", error);
      alert("Gagal koneksi ke server");
    }
  };

  // Function untuk menghentikan sesi
  const handleStopSesi = async () => {
    if (!sesiAktifId) {
      setSesiAktif(false);
      return;
    }

    try {
      const response = await fetch(
        `${apiURL}/api/sessions/${sesiAktifId}/stop`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        setSesiAktif(false);
        setSesiAktifId(null);
        console.log("✅ Sesi berhasil dihentikan");
      } else {
        console.error("❌ Gagal menghentikan sesi:", data.message);
        // Tetap stop sesi di frontend meski backend error
        setSesiAktif(false);
        setSesiAktifId(null);
      }
    } catch (error) {
      console.error("❌ Error menghentikan sesi:", error);
      // Tetap stop sesi di frontend meski ada error
      setSesiAktif(false);
      setSesiAktifId(null);
    }
  };

  // Function untuk menangani deteksi emosi dari webcam
  const handleDeteksiEmosi = async (data) => {
    console.log("Emosi terdeteksi:", data);

    // Simpan data emosi ke backend jika ada sesi aktif
    if (sesiAktif && sesiAktifId) {
      try {
        const user = JSON.parse(localStorage.getItem("user"));
        if (!user) return;

        const response = await fetch(
          `${apiURL}/api/sessions/${sesiAktifId}/emotion`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({
              user_id: user.id,
              emotion: data.emotion,
              confidence: data.confidence,
            }),
          }
        );

        const result = await response.json();

        if (response.ok) {
          console.log("✅ Data emosi berhasil disimpan:", result);
        } else {
          console.error("❌ Gagal menyimpan data emosi:", result.message);
        }
      } catch (error) {
        console.error("❌ Error menyimpan data emosi:", error);
      }
    }
  };

  // Function untuk refresh data tim
  const refreshData = () => {
    fetchDetailTim();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Memuat detail tim...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-4 text-lg">{error}</p>
          <button
            onClick={() => navigate("/tim")}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Kembali ke Daftar Tim
          </button>
        </div>
      </div>
    );
  }

  if (!tim) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Tim Tidak Ditemukan
          </h2>
          <button
            onClick={() => navigate("/tim")}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Kembali ke Daftar Tim
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate("/tim")}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                title="Kembali ke daftar tim"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <div>
                <h1 className="text-4xl font-bold text-gray-800 mb-2">
                  {tim.name}
                </h1>
                <p className="text-gray-600 text-lg">
                  Kode:{" "}
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                    {tim.code}
                  </span>
                </p>
                {isKetuaTim() ? (
                  <div className="mt-2">
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-base rounded-full font-semibold border border-yellow-200">
                      👑 Anda Ketua Tim
                    </span>
                  </div>
                ) : (
                  tim.ketua_nama && (
                    <p className="text-sm text-gray-500 mt-2">
                      Ketua Tim: {tim.ketua_nama}
                    </p>
                  )
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={refreshData}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                title="Refresh data"
              >
                🔄 Refresh
              </button>
              {isKetuaTim() && (
                <>
                  {!sesiAktif ? (
                    <button
                      onClick={handleMulaiSesi}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                    >
                      🚀 Mulai Sesi
                    </button>
                  ) : (
                    <button
                      onClick={handleStopSesi}
                      className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
                    >
                      🛑 Stop Sesi
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Layout utama - Area monitoring di atas, anggota tim di bawah */}
        <div className="space-y-6">
          {/* Area Monitoring Emosi - Full width untuk kamera yang lebih besar */}
          <div className="w-full">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
              {/* <h3 className="text-2xl font-bold mb-6 text-gray-700 text-center">
                🎭 Monitoring Emosi
              </h3> */}

              {sesiAktif ? (
                <div className="space-y-4">
                  <div className="p-3 bg-green-100 border border-green-200 rounded-lg">
                    <div className="flex items-center mb-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                      <span className="font-semibold text-green-800">
                        Sesi Monitoring Aktif
                      </span>
                    </div>
                    <p className="text-sm text-green-700">
                      Webcam sedang mendeteksi emosi secara real-time
                    </p>
                  </div>

                  <WebcamEmotion
                    onDetect={handleDeteksiEmosi}
                    isActive={sesiAktif}
                  />
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🎭</div>
                  <h4 className="text-xl font-semibold text-gray-600 mb-2">
                    Monitoring Tidak Aktif
                  </h4>
                  <p className="text-gray-500 mb-6">
                    Ketua tim dapat memulai sesi monitoring untuk mendeteksi
                    emosi anggota secara real-time
                  </p>
                  {!isKetuaTim() && (
                    <p className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                      💡 Hanya ketua tim yang dapat memulai sesi monitoring
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Area Anggota Tim - Full width di bawah monitoring */}
          <div className="w-full">
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">
                  Anggota Tim ({tim.members ? tim.members.length : 0})
                </h2>
              </div>

              {/* Daftar Anggota */}
              <div className="space-y-4">
                {tim.members && tim.members.length > 0 ? (
                  tim.members.map((member) => (
                    <div
                      key={member.id}
                      className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        {/* Bagian kiri: Avatar dan info */}
                        <div className="flex items-center space-x-4 flex-1">
                          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            {member.name || member.nama
                              ? (member.name || member.nama)
                                  .charAt(0)
                                  .toUpperCase()
                              : "?"}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800 text-xl">
                              {member.name || member.nama}
                            </p>
                            <p className="text-gray-600 text-base">
                              {member.email}
                            </p>

                            {/* Status Ketua di bawah email */}
                            {(member.is_leader === 1 ||
                              member.is_ketua === 1 ||
                              member.is_moderator === 1) && (
                              <div className="mt-1">
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full font-semibold border border-yellow-200">
                                  Ketua Tim
                                </span>
                              </div>
                            )}

                            {/* Emosi saat sesi aktif */}
                            {sesiAktif && (
                              <div className="mt-2">
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                                  😊 {member.emotion_current || "neutral"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Bagian kanan: Status dan tombol hapus */}
                        <div className="flex items-center space-x-3">
                          {/* Status Online/Offline */}
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-sm font-medium ${
                              member.status === "online"
                                ? "bg-green-100 text-green-800 border border-green-200"
                                : "bg-gray-100 text-gray-600 border border-gray-200"
                            }`}
                          >
                            <div
                              className={`w-2 h-2 rounded-full mr-1 ${
                                member.status === "online"
                                  ? "bg-green-500"
                                  : "bg-gray-400"
                              }`}
                            ></div>
                            {member.status === "online" ? "on" : "off"}
                          </span>

                          {/* Tombol Hapus - hanya untuk ketua, dan tidak bisa hapus diri sendiri */}
                          {isKetuaTim() &&
                            member.id !== currentUser?.id &&
                            !(
                              member.is_leader === 1 ||
                              member.is_ketua === 1 ||
                              member.is_moderator === 1
                            ) && (
                              <button
                                onClick={() => handleHapusAnggota(member.id)}
                                className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                title="Hapus anggota dari tim"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">👥</div>
                    <p>Belum ada anggota lain</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DetailTimPage;
