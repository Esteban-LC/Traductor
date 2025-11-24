'use client';

import { useState } from 'react';

export default function Home() {
  const [contexto, setContexto] = useState('');
  const [idioma, setIdioma] = useState('japones');
  const [tono, setTono] = useState('neutro');
  const [textoOriginal, setTextoOriginal] = useState('');
  const [resultado, setResultado] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const traducir = async () => {
    if (!textoOriginal.trim()) {
      setError('Por favor ingresa texto para traducir');
      return;
    }

    setLoading(true);
    setError('');
    setResultado('');

    try {
      const response = await fetch('/api/traducir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contexto,
          idioma,
          tono,
          textoOriginal
        })
      });

      const data = await response.json();

      if (data.success) {
        setResultado(data.resultado);
      } else {
        setError(data.error || 'Error al traducir');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const limpiar = () => {
    setContexto('');
    setTextoOriginal('');
    setResultado('');
    setError('');
  };

  const copiar = async () => {
    await navigator.clipboard.writeText(resultado);
    alert('¡Copiado al portapapeles!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-blue-400 mb-2">
          Traductor BBG
        </h1>
        <p className="text-center text-gray-300 mb-8">
          Traduce manga, manhwa, manhua, etc.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel Izquierdo */}
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Contexto (opcional)
              </label>
              <textarea
                value={contexto}
                onChange={(e) => setContexto(e.target.value)}
                className="w-full h-24 p-3 bg-gray-900 text-gray-100 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
                placeholder="Nombres de personajes, estilo del manga, etc."
              />
            </div>

            <div className="bg-gray-800 rounded-lg shadow-lg p-6 space-y-4 border border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Idioma de origen
                </label>
                <select
                  value={idioma}
                  onChange={(e) => setIdioma(e.target.value)}
                  className="w-full p-3 bg-gray-900 text-gray-100 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ingles">🇬🇧 Inglés</option>
                  <option value="japones">🇯🇵 Japonés</option>
                  <option value="chino">🇨🇳 Chino</option>
                  <option value="coreano">🇰🇷 Coreano</option>
                  <option value="tailandes">🇹🇭 Tailandés</option>
                  <option value="portugues">🇧🇷 Portugués</option>
                </select>
              </div>


            </div>

            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Texto original
              </label>
              <textarea
                value={textoOriginal}
                onChange={(e) => setTextoOriginal(e.target.value)}
                className="w-full h-64 p-3 bg-gray-900 text-gray-100 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono placeholder-gray-500"
                placeholder="Pega aquí el texto a traducir..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={traducir}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
              >
                {loading ? '⏳ Traduciendo...' : '🌐 Traducir'}
              </button>
              <button
                onClick={limpiar}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
              >
                🗑️ Limpiar
              </button>
            </div>
          </div>

          {/* Panel Derecho */}
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-200">
                  Resultado
                </label>
                {resultado && (
                  <button
                    onClick={copiar}
                    className="text-sm bg-green-500 hover:bg-green-600 text-white px-4 py-1 rounded-lg transition duration-200"
                  >
                    📋 Copiar
                  </button>
                )}
              </div>
              {loading ? (
                <div className="w-full h-[calc(100vh-16rem)] flex items-center justify-center bg-gray-900 border border-gray-600 rounded-lg">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-gray-400 animate-pulse">Traduciendo...</p>
                  </div>
                </div>
              ) : (
                <textarea
                  value={resultado}
                  readOnly
                  className="w-full h-[calc(100vh-16rem)] p-3 bg-gray-900 text-gray-100 border border-gray-600 rounded-lg font-mono placeholder-gray-500"
                  placeholder="La traducción aparecerá aquí..."
                />
              )}
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
                ❌ {error}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>💡 Tip: Agrega nombres en el contexto como "NombreMal → NombreCorrecto" para corregir traducciones</p>
        </div>
      </div>
    </div>
  );
}
