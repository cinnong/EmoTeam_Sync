import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiURL } from '../utils/api';

const CreateTeamPage = () => {
  const [teamName, setTeamName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Cek apakah user sudah login
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user || !user.id) {
      navigate('/login');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!teamName.trim()) {
      setError('Nama tim tidak boleh kosong');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${apiURL}/api/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: teamName.trim(),
          user_id: user.id  // Pastikan user_id dikirim ke backend
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        // Update user data with team info
        const updatedUser = { ...user, team_id: data.team.id };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // Redirect to dashboard
        navigate('/dashboard');
      } else {
        setError(data.message || 'Gagal membuat tim. Silakan coba lagi.');
      }
    } catch (err) {
      console.error('Error creating team:', err);
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Buat Tim Baru
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Buat tim baru dan undang anggota lain untuk bergabung
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="team-name" className="sr-only">
                Nama Tim
              </label>
              <input
                id="team-name"
                name="teamName"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Nama Tim"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
            >
              {isLoading ? 'Membuat Tim...' : 'Buat Tim'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTeamPage;
