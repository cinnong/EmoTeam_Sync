import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiURL } from '../utils/api';

function TimPage() {
  const navigate = useNavigate();
  const [daftarTim, setDaftarTim] = useState([]);
  const [namaTim, setNamaTim] = useState("");
  const [kodeTim, setKodeTim] = useState("");
  const [mode, setMode] = useState(null); // "buat" | "join"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Function untuk refresh data tim
  const refreshTimData = useCallback(async () => {
    const storedUser = localStorage.getItem("user");
    const user_id = storedUser ? JSON.parse(storedUser).id : null;
    if (!user_id) return;

    try {
      const res = await fetch(`${apiURL}/api/my-teams/${user_id}`);
      const data = await res.json();

      // Standarisasi format data tim
      const timTerstandarisasi = data.map((tim) => ({
        id: tim.id,
        nama: tim.name || tim.nama, // Support both formats
        kode: tim.code || tim.kode, // Support both formats
        anggota: tim.anggota || [], // Default empty array jika tidak ada
        creator_id: tim.creator_id,
        ketua_nama: tim.ketua_nama,
        is_ketua: tim.is_ketua, // apakah user saat ini adalah ketua tim ini
      }));

      setDaftarTim(timTerstandarisasi);
      console.log("Data tim berhasil di-refresh");
    } catch (error) {
      console.error("Gagal refresh data tim:", error);
    }
  }, []);

  // Ambil daftar tim saat komponen pertama kali dimuat
  useEffect(() => {
    refreshTimData();
  }, [refreshTimData]);

  const handleBuatTim = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const storedUser = localStorage.getItem("user");
      const user_id = storedUser ? JSON.parse(storedUser).id : null;

      console.log("Creating team with user_id:", user_id);

      if (!user_id || user_id === "null" || user_id === "undefined") {
        setError("User belum login! Silakan login terlebih dahulu.");
        setLoading(false);
        return;
      }

      if (!namaTim.trim()) {
        setError("Nama tim tidak boleh kosong!");
        setLoading(false);
        return;
      }

      const res = await fetch(`${apiURL}/api/teams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id,
          name: namaTim,
        }),
      });

      console.log("Response status:", res.status);
      const data = await res.json();
      console.log("Response data:", data);

      if (res.ok) {
        // Tambahkan langsung tim baru ke daftar
        const timBaru = {
          id: data.tim.id,
          nama: data.tim.name,
          kode: data.tim.code || "N/A", // Ambil dari response backend
          anggota: [
            {
              id: parseInt(user_id),
              nama: JSON.parse(localStorage.getItem("user")).nama,
              email: JSON.parse(localStorage.getItem("user")).email,
              is_ketua: 1,
              status: "online",
            },
          ],
          creator_id: parseInt(user_id),
          ketua_nama: JSON.parse(localStorage.getItem("user")).nama,
          is_ketua: true, // user yang membuat tim adalah ketua
        };

        setDaftarTim((prev) => [...prev, timBaru]);
        setNamaTim("");
        setMode(null);
        alert(`Tim berhasil dibuat!\nKode Tim: ${timBaru.kode}`);
      } else {
        setError(data.error || "Gagal membuat tim");
      }
    } catch (error) {
      console.error("Error creating team:", error);
      setError("Gagal koneksi ke server. Pastikan backend sedang berjalan.");
    }
    setLoading(false);
  };

  const handleJoinTim = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const storedUser = localStorage.getItem("user");
      const user_id = storedUser ? JSON.parse(storedUser).id : null;

      console.log("kodeTim:", kodeTim);
      console.log("user_id:", user_id);

      if (!user_id) {
        setError("User belum login!");
        setLoading(false);
        return;
      }
      const res = await fetch(`${apiURL}/api/teams/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode: kodeTim, user_id }),
      });
      const data = await res.json();
      if (res.ok) {
        setDaftarTim((prev) => [...prev, data.tim]);
        setKodeTim("");
        setMode(null);
        alert("Berhasil bergabung dengan tim!");
      } else {
        setError(data.error || "Gagal bergabung dengan tim");
      }
    } catch (error) {
      console.error("Join team error:", error);
      setError("Gagal koneksi ke server");
    }
    setLoading(false);
  };

  const handleHapusTim = async (timId, namaTim, e) => {
    // Prevent event bubbling agar tidak trigger navigate
    e.stopPropagation();

    const konfirmasi = window.confirm(
      `Apakah Anda yakin ingin menghapus tim "${namaTim}"?\n\nTindakan ini tidak dapat dibatalkan dan akan menghapus semua data tim termasuk anggota dan riwayat sesi.`
    );

    if (!konfirmasi) return;

    try {
      const storedUser = localStorage.getItem("user");
      const user_id = storedUser ? JSON.parse(storedUser).id : null;

      if (!user_id) {
        alert("User belum login!");
        return;
      }

      const res = await fetch(`${apiURL}/api/teams/${timId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ user_id }),
      });

      const data = await res.json();

      if (res.ok) {
        // Remove tim dari daftar
        setDaftarTim((prev) => prev.filter((tim) => tim.id !== timId));
        alert("Tim berhasil dihapus!");
      } else {
        alert(
          data.error || "Gagal menghapus tim. Pastikan Anda adalah ketua tim."
        );
      }
    } catch (error) {
      console.error("Error deleting team:", error);
      alert("Gagal koneksi ke server");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="w-full">
        <div className="bg-white rounded-2xl shadow-xl p-6 lg:p-8 border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-extrabold text-gray-700">
              Daftar Tim
            </h2>
            <button
              onClick={refreshTimData}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-base font-medium"
              title="Refresh data tim"
            >
              🔄 Refresh
            </button>
          </div>

          {/* Forms */}
          {mode === "buat" && (
            <form
              className="mt-2 flex flex-col gap-3 mb-6"
              onSubmit={handleBuatTim}
            >
              <input
                type="text"
                placeholder="Nama Tim"
                value={namaTim}
                onChange={(e) => setNamaTim(e.target.value)}
                className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Membuat..." : "Buat Tim"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  className="px-4 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {mode === "join" && (
            <form
              className="mt-2 flex flex-col gap-3 mb-6"
              onSubmit={handleJoinTim}
            >
              <input
                type="text"
                placeholder="Kode Tim"
                value={kodeTim}
                onChange={(e) => setKodeTim(e.target.value)}
                className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? "Bergabung..." : "Gabung Tim"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  className="px-4 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded mb-6">
              {error}
            </div>
          )}

          {/* Buttons untuk membuat/join tim */}
          {!mode && (
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <button
                onClick={() => setMode("buat")}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                + Buat Tim
              </button>
              <button
                onClick={() => setMode("join")}
                className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
              >
                Gabung Tim
              </button>
            </div>
          )}

          {/* Daftar Tim */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
            {daftarTim.length === 0 ? (
              <div className="text-center py-8 text-gray-600 col-span-full">
                <div className="text-5xl mb-4">👥</div>
                <p className="text-lg font-semibold">Belum ada tim</p>
                <p className="text-base mt-2">
                  Buat tim baru atau gabung dengan tim yang sudah ada
                </p>
              </div>
            ) : (
              daftarTim.map((tim) => (
                <div
                  key={tim.id}
                  className="p-6 border-2 border-gray-200 rounded-2xl hover:border-blue-400 hover:shadow-xl transition-all cursor-pointer group bg-white flex flex-col h-full"
                  onClick={() => navigate(`/tim/${tim.id}`)}
                >
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow">
                      {tim.nama ? tim.nama.charAt(0).toUpperCase() : "T"}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition-colors mb-1">
                        {tim.nama}
                      </h3>
                      <p className="text-xs text-gray-600">
                        Kode:{" "}
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                          {tim.kode}
                        </span>
                      </p>
                      {tim.ketua_nama && (
                        <p className="text-xs text-gray-500 mt-1">
                          Ketua: {tim.ketua_nama}
                        </p>
                      )}
                    </div>
                    {/* Tombol Hapus - Hanya untuk ketua tim */}
                    {tim.is_ketua && (
                      <button
                        onClick={(e) => handleHapusTim(tim.id, tim.nama, e)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all group/delete"
                        title={`Hapus tim "${tim.nama}"`}
                        onClickCapture={(e) => e.stopPropagation()}
                      >
                        <svg
                          className="w-5 h-5"
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
                  <div className="flex-1 flex flex-col justify-end">
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm text-gray-600">
                        👥 {tim.anggota ? tim.anggota.length : 0} anggota
                      </p>
                      <div className="flex items-center text-blue-600 group-hover:text-blue-700">
                        <span className="text-sm font-medium mr-2">
                          Lihat Detail & Monitoring
                        </span>
                        <svg
                          className="w-5 h-5 transform group-hover:translate-x-1 transition-transform"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TimPage;
