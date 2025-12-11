'use client';

import React, { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

type IdiomaOrigen = 'ingles' | 'japones' | 'chino' | 'coreano' | 'tailandes' | 'portugues';

export default function Home() {
  const [contexto, setContexto] = useState('');
  const [archivoContexto, setArchivoContexto] = useState('');
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [idioma, setIdioma] = useState<IdiomaOrigen>('japones');
  const [tono, setTono] = useState('neutro');
  const [textoOriginal, setTextoOriginal] = useState('');
  const [resultado, setResultado] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cargandoArchivo, setCargandoArchivo] = useState(false);

  // OCR States
  const [imagenSrc, setImagenSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isScanning, setIsScanning] = useState(false);
  const [zoom, setZoom] = useState(1); // 1 = 100%
  const imgRef = useRef<HTMLImageElement>(null);

  // Verificador de texto OCR
  const [textoOCRBruto, setTextoOCRBruto] = useState('');
  const [textoVerificado, setTextoVerificado] = useState('');
  const [mostrarVerificador, setMostrarVerificador] = useState(false);

  // Abecedarios simples
  const hiragana = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんー'.split('');
  const katakana = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンー'.split('');
  const hangul = '가나다라마바사아자차카타파하'.split('');

  // ─────────────────── Lectura de archivos de contexto ───────────────────

  const leerArchivoPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let textoCompleto = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      textoCompleto += pageText + '\n';
    }

    return textoCompleto.trim();
  };

  const leerArchivoTXT = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const manejarArchivoContexto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    const tipoValido = file.type === 'text/plain' || file.type === 'application/pdf';
    const extensionValida = file.name.endsWith('.txt') || file.name.endsWith('.pdf');

    if (!tipoValido && !extensionValida) {
      setError('Solo se permiten archivos TXT y PDF');
      return;
    }

    // Validar tamaño (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo es demasiado grande (máximo 5MB)');
      return;
    }

    setCargandoArchivo(true);
    setError('');

    try {
      let texto = '';
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        texto = await leerArchivoPDF(file);
      } else {
        texto = await leerArchivoTXT(file);
      }

      setArchivoContexto(texto);
      setNombreArchivo(file.name);
    } catch (err) {
      setError('Error al leer el archivo');
      console.error(err);
    } finally {
      setCargandoArchivo(false);
    }
  };

  // ─────────────────── Manejo de imagen / zoom ───────────────────

  const manejarImagenOCR = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImagenSrc(reader.result?.toString() || '');
        setZoom(1); // Reset zoom on new image
        setCrop(undefined);
        setCompletedCrop(undefined);
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.altKey) {
      e.preventDefault();
      const delta = e.deltaY * -0.01;
      setZoom(prev => Math.min(Math.max(0.5, prev + delta * 0.1), 3));
    }
  };

  /**
   * Procesa el recorte para OCR.
   * - Escala
   * - Pone borde blanco
   * - Para CJK: gris suave
   * - Para otros: BN + contraste
   */
  const procesarImagenParaOCR = (
    image: HTMLImageElement,
    crop: PixelCrop,
    idiomaActual: IdiomaOrigen
  ): string => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const resolutionScale = 3.0;
    const padding = 40;

    const cropWidth = crop.width * scaleX * resolutionScale;
    const cropHeight = crop.height * scaleY * resolutionScale;

    canvas.width = cropWidth + padding * 2;
    canvas.height = cropHeight + padding * 2;

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Fondo blanco
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Dibujar recorte centrado
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      padding,
      padding,
      cropWidth,
      cropHeight
    );

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    if (idiomaActual === 'coreano' || idiomaActual === 'japones' || idiomaActual === 'chino') {
      // Gris suave + pequeño boost de contraste
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        let gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        gray = Math.min(255, Math.max(0, gray * 1.1));

        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
    } else {
      // Otros idiomas: BN + contraste
      const umbralBlanco = 220;
      const umbralNegro = 60;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        let gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        if (gray > umbralBlanco) {
          gray = 255;
        } else if (gray < umbralNegro) {
          gray = 0;
        } else {
          gray = ((gray - umbralNegro) / (umbralBlanco - umbralNegro)) * 255;
        }

        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  };

  /**
   * Reconstruye japonés vertical usando los símbolos y sus bounding boxes.
   * Orden: columnas de derecha a izquierda, dentro de cada columna de arriba a abajo.
   */
  const reconstruirJaponesVertical = (data: any): string => {
    if (!data?.symbols) return (data?.text || '').trim();

    const chars = data.symbols
      .filter((s: any) => s.text && s.text.trim())
      .map((s: any) => ({
        ch: s.text,
        x: s.bbox?.x0 ?? 0,
        y: s.bbox?.y0 ?? 0,
      }));

    if (!chars.length) return (data.text || '').trim();

    const xs = chars.map(c => c.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const approxCols = 4;
    const colThreshold = (maxX - minX) / (approxCols * 2 || 1) || 10;

    chars.sort((a, b) => {
      const dx = b.x - a.x; // derecha → izquierda
      if (Math.abs(dx) > colThreshold) return dx;
      return a.y - b.y;     // dentro de columna: arriba → abajo
    });

    return chars.map(c => c.ch).join('');
  };

  // ─────────────────── OCR principal ───────────────────

  const escanearSeleccion = async () => {
    if (!completedCrop || !imgRef.current) return;

    setIsScanning(true);
    setError('');
    setMostrarVerificador(false);

    try {
      const imagenProcesada = procesarImagenParaOCR(imgRef.current, completedCrop, idioma);

      // Determinar idioma y PSM
      let lang = 'jpn';
      let psm = '3';

      if (idioma === 'ingles') {
        lang = 'eng';
        psm = '3';
      }
      if (idioma === 'coreano') {
        lang = 'kor';
        psm = '7'; // línea corta
      }
      if (idioma === 'chino') {
        lang = 'chi_sim_vert';
        psm = '5';
      }
      if (idioma === 'japones') {
        lang = 'jpn_vert';
        psm = '6';
      }

      const { data } = await Tesseract.recognize(
        imagenProcesada,
        lang,
        {
          // @ts-ignore
          tessedit_pageseg_mode: psm,
          logger: m => console.log(m)
        }
      );

      let rawText = data.text || '';
      console.log('OCR RAW:', JSON.stringify(rawText));

      // Para japonés, intentamos reconstruir columnas
      if (idioma === 'japones') {
        rawText = reconstruirJaponesVertical(data);
      }

      // Limpieza básica
      let textoLimpio = rawText.replace(/\s+/g, ' ').trim();

      // Para CJK: unir todo sin espacios
      if (['japones', 'chino', 'coreano'].includes(idioma)) {
        textoLimpio = textoLimpio.replace(/\s+/g, '');
      }

      if (textoLimpio.length > 0) {
        // No lo mandamos directo a Texto Original
        // Lo mandamos al verificador
        setTextoOCRBruto(textoLimpio);
        setTextoVerificado(textoLimpio);
        setMostrarVerificador(true);
      } else {
        setError(`No detecté texto (${lang}, PSM:${psm}).`);
      }

    } catch (err) {
      console.error(err);
      setError('Error al escanear. Intenta seleccionar solo el texto de la burbuja.');
    } finally {
      setIsScanning(false);
    }
  };

  // ─────────────────── Traducción / acciones ───────────────────

  const removerArchivo = () => {
    setArchivoContexto('');
    setNombreArchivo('');
  };

  const traducir = async () => {
    if (!textoOriginal.trim()) {
      setError('Por favor ingresa texto para traducir');
      return;
    }

    setLoading(true);
    setError('');
    setResultado('');

    try {
      const contextoCompleto = [archivoContexto, contexto]
        .filter(Boolean)
        .join('\n\n');

      const response = await fetch('/api/traducir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contexto: contextoCompleto,
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
    setArchivoContexto('');
    setNombreArchivo('');
    setTextoOriginal('');
    setResultado('');
    setError('');
    setImagenSrc('');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setMostrarVerificador(false);
    setTextoOCRBruto('');
    setTextoVerificado('');
  };

  const copiar = async () => {
    await navigator.clipboard.writeText(resultado);
    alert('¡Copiado al portapapeles!');
  };

  // ─────────────────── UI ───────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-blue-400 mb-2">
          Traductor BBG.
        </h1>
        <p className="text-center text-gray-300 mb-8">
          Traduce manga, manhwa, manhua, etc.
        </p>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Columna Izquierda: Configuración y Contexto */}
          <div className="space-y-4 xl:col-span-1">
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
              <h2 className="text-lg font-semibold text-blue-300 mb-4 border-b border-gray-700 pb-2">Configuración</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Idioma de origen
                  </label>
                  <select
                    value={idioma}
                    onChange={(e) => setIdioma(e.target.value as IdiomaOrigen)}
                    className="w-full p-3 bg-gray-900 text-gray-100 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ingles">🇬🇧 Inglés</option>
                    <option value="japones">🇯🇵 Japonés (Manga)</option>
                    <option value="chino">🇨🇳 Chino (Manhua)</option>
                    <option value="coreano">🇰🇷 Coreano (Manhwa)</option>
                    <option value="tailandes">🇹🇭 Tailandés</option>
                    <option value="portugues">🇧🇷 Portugués</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Contexto (opcional)
                  </label>
                  <textarea
                    value={contexto}
                    onChange={(e) => setContexto(e.target.value)}
                    className="w-full h-24 p-3 bg-gray-900 text-gray-100 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                    placeholder="Nombres, estilo, resumen..."
                  />
                </div>

                {/* Adjuntar contexto */}
                <div className="pt-2 border-t border-gray-700">
                  {!nombreArchivo ? (
                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        accept=".txt,.pdf"
                        onChange={manejarArchivoContexto}
                        className="hidden"
                        disabled={cargandoArchivo}
                      />
                      <div className="flex items-center justify-center gap-2 p-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg transition">
                        <span className="text-xl">📎</span>
                        <span className="text-sm text-gray-300">Adjuntar Contexto (PDF/TXT)</span>
                      </div>
                    </label>
                  ) : (
                    <div className="flex justify-between items-center bg-green-900/30 p-2 rounded border border-green-600">
                      <span className="text-xs text-green-200 truncate">{nombreArchivo}</span>
                      <button onClick={removerArchivo} className="text-red-400 font-bold ml-2">✕</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* OCR / Imagen */}
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
              <h2 className="text-lg font-semibold text-blue-300 mb-4 border-b border-gray-700 pb-2">OCR / Escáner</h2>

              <div className="mb-4">
                <label className="cursor-pointer block w-full">
                  <input type="file" accept="image/*" onChange={manejarImagenOCR} className="hidden" />
                  <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-600 rounded-lg hover:border-blue-500 hover:bg-gray-700/50 transition duration-200">
                    <span className="text-3xl mb-2">🖼️</span>
                    <span className="text-sm text-gray-400">Subir imagen para escanear</span>
                  </div>
                </label>
              </div>

              {imagenSrc && (
                <div className="bg-gray-900 p-2 rounded-lg border border-gray-700">
                  {/* Controles de Zoom */}
                  <div className="flex justify-between items-center mb-2 px-1 bg-gray-800 p-2 rounded">
                    <p className="text-xs text-gray-400">Zoom:</p>
                    <div className="flex gap-2 items-center">
                      <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded text-lg hover:bg-gray-600 active:bg-gray-500 transition shadow">-</button>
                      <span className="text-xs text-gray-300 w-12 text-center font-mono">{Math.round(zoom * 100)}%</span>
                      <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded text-lg hover:bg-gray-600 active:bg-gray-500 transition shadow">+</button>
                      <button onClick={() => setZoom(1)} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600 ml-2 shadow">Reset</button>
                    </div>
                  </div>

                  <div
                    className="max-h-[500px] overflow-auto border border-gray-700 bg-gray-950 p-4"
                    onWheel={handleWheel}
                  >
                    <div className="mx-auto" style={{ width: `${zoom * 100}%`, transition: 'width 0.1s ease-out' }}>
                      <ReactCrop
                        crop={crop}
                        onChange={(c) => setCrop(c)}
                        onComplete={(c) => setCompletedCrop(c as PixelCrop)}
                        aspect={undefined}
                      >
                        <img ref={imgRef} src={imagenSrc} alt="Upload" className="w-full h-auto" />
                      </ReactCrop>
                    </div>
                  </div>

                  <button
                    onClick={escanearSeleccion}
                    disabled={isScanning || !completedCrop?.width}
                    className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 shadow-lg"
                  >
                    {isScanning ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Escaneando...
                      </>
                    ) : (
                      <>🔍 Extraer Texto</>
                    )}
                  </button>

                  {/* Debug Preview */}
                  <div className="mt-4 border-t border-gray-700 pt-2">
                    <p className="text-xs text-gray-500 mb-1">Previsualización (Lo que ve el OCR):</p>
                    {completedCrop && imgRef.current && (
                      <img
                        src={procesarImagenParaOCR(imgRef.current, completedCrop, idioma)}
                        className="border border-gray-600 rounded bg-white max-h-32 mx-auto"
                        alt="Debug OCR"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Columna Central: Texto Original + Verificador */}
          <div className="space-y-4 xl:col-span-1">
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 h-full flex flex-col">
              <label className="block text-lg font-semibold text-gray-200 mb-4">
                Texto Original
              </label>

              {/* Panel de verificación */}
              {mostrarVerificador && (
                <div className="mb-4 bg-gray-900 border border-yellow-500 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-yellow-300">
                    Verificar texto detectado
                  </h3>

                  <p className="text-xs text-gray-300">
                    OCR detectó:
                    <span className="block mt-1 font-mono bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs">
                      {textoOCRBruto || '(vacío)'}
                    </span>
                  </p>

                  <label className="block text-xs text-gray-300 mb-1">
                    Ajusta el texto (puedes corregir errores):
                  </label>
                  <textarea
                    value={textoVerificado}
                    onChange={(e) => setTextoVerificado(e.target.value)}
                    className="w-full min-h-[80px] bg-gray-950 border border-gray-700 rounded p-2 text-gray-100 text-sm font-mono"
                  />

                  {/* Abecedarios */}
                  <div className="space-y-2">
                    <p className="text-xs text-gray-300">Teclas rápidas ({idioma}):</p>

                    {idioma === 'japones' && (
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                          {hiragana.map((ch) => (
                            <button
                              key={`h-${ch}`}
                              type="button"
                              onClick={() => setTextoVerificado((prev) => prev + ch)}
                              className="px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
                            >
                              {ch}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto border-t border-gray-700 pt-1">
                          {katakana.map((ch) => (
                            <button
                              key={`k-${ch}`}
                              type="button"
                              onClick={() => setTextoVerificado((prev) => prev + ch)}
                              className="px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
                            >
                              {ch}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {idioma === 'coreano' && (
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {hangul.map((ch) => (
                          <button
                            key={`ko-${ch}`}
                            type="button"
                            onClick={() => setTextoVerificado((prev) => prev + ch)}
                            className="px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
                          >
                            {ch}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-700">
                    <button
                      type="button"
                      onClick={() => {
                        setMostrarVerificador(false);
                        setTextoOCRBruto('');
                        setTextoVerificado('');
                      }}
                      className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const limpio = textoVerificado.trim();
                        if (!limpio) {
                          setError('El texto verificado está vacío');
                          return;
                        }
                        setTextoOriginal((prev) => (prev ? prev + '\n\n' + limpio : limpio));
                        setMostrarVerificador(false);
                        setTextoOCRBruto('');
                        setTextoVerificado('');
                      }}
                      className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 rounded text-white font-semibold"
                    >
                      ✔ Confirmar texto
                    </button>
                  </div>
                </div>
              )}

              <textarea
                value={textoOriginal}
                onChange={(e) => setTextoOriginal(e.target.value)}
                className="flex-1 w-full p-3 bg-gray-900 text-gray-100 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder-gray-500 min-h-[260px] resize-y"
                placeholder="Pega texto aquí o usa el escáner OCR..."
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={traducir}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
                >
                  {loading ? '⏳ Traduciendo...' : '🌐 Traducir'}
                </button>
                <button onClick={limpiar} className="bg-gray-600 hover:bg-gray-700 text-white px-4 rounded-lg">
                  🗑️
                </button>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Resultado */}
          <div className="space-y-4 xl:col-span-1">
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 h-full flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-lg font-semibold text-gray-200">
                  Traducción
                </label>
                {resultado && (
                  <button onClick={copiar} className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition">
                    Copiar
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex-1 flex items-center justify-center bg-gray-900 border border-gray-600 rounded-lg min-h-[300px]">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-gray-400 animate-pulse">Trabajando...</p>
                  </div>
                </div>
              ) : (
                <textarea
                  value={resultado}
                  readOnly
                  className="flex-1 w-full p-3 bg-gray-900 text-gray-100 border border-gray-600 rounded-lg font-mono placeholder-gray-500 min-h-[300px] resize-y"
                  placeholder="La traducción aparecerá aquí..."
                />
              )}
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg text-sm">
                ❌ {error}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-gray-500 text-xs">
          <p>Potenciado por IA • OCR by Tesseract.js</p>
        </div>
      </div>
    </div>
  );
}
