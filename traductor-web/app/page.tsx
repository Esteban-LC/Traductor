'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

type IdiomaOrigen = 'ingles' | 'japones' | 'chino' | 'coreano' | 'tailandes' | 'portugues';

const TESSDATA_PATH = '/tessdata'; // ✅ usa public/tessdata

export default function Home() {
  const [contexto, setContexto] = useState('');
  const [archivoContexto, setArchivoContexto] = useState('');
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [idioma, setIdioma] = useState<IdiomaOrigen>('japones');

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
  const [zoom, setZoom] = useState(1);
  const imgRef = useRef<HTMLImageElement>(null);

  // Verificador OCR
  const [textoOCRBruto, setTextoOCRBruto] = useState('');
  const [textoVerificado, setTextoVerificado] = useState('');
  const [mostrarVerificador, setMostrarVerificador] = useState(false);

  // ✅ “Aprender frases” (opcional, para tu catálogo personal)
  const [catalogoUsuarioJP, setCatalogoUsuarioJP] = useState<string[]>([]);
  const [catalogoUsuarioKO, setCatalogoUsuarioKO] = useState<string[]>([]);

  useEffect(() => {
    try {
      const jp = JSON.parse(localStorage.getItem('catalogoJP') || '[]');
      const ko = JSON.parse(localStorage.getItem('catalogoKO') || '[]');
      if (Array.isArray(jp)) setCatalogoUsuarioJP(jp);
      if (Array.isArray(ko)) setCatalogoUsuarioKO(ko);
    } catch { }
  }, []);

  const aprenderFrase = (frase: string) => {
    const limpia = (frase || '').trim();
    if (!limpia) return;

    if (idioma === 'japones') {
      const nuevo = Array.from(new Set([limpia, ...catalogoUsuarioJP]));
      setCatalogoUsuarioJP(nuevo);
      localStorage.setItem('catalogoJP', JSON.stringify(nuevo));
    }
    if (idioma === 'coreano') {
      const nuevo = Array.from(new Set([limpia, ...catalogoUsuarioKO]));
      setCatalogoUsuarioKO(nuevo);
      localStorage.setItem('catalogoKO', JSON.stringify(nuevo));
    }
  };

  // ─────────────────── Catálogos (tus botones) ───────────────────

  const hiragana = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんー'.split('');
  const katakana = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンー'.split('');
  const expresiones = ['ありがとう', 'ごめん', 'すみません', 'ください', 'おねがい', 'やめて', 'だめ', 'いや', 'うん', 'ええ', 'そう', 'ちがう', 'わかった', 'わからない', 'きた', 'いく', 'みる', 'きく', 'する', 'いい', 'すき', 'きらい', 'ほしい'];
  const onomatopeyas = ['ドキドキ', 'バタバタ', 'ガタガタ', 'ゴゴゴ', 'キラキラ', 'フワフワ', 'ムニュ', 'ザワザワ', 'ギュッ', 'ビクッ', 'ガシャン', 'ズキュン', 'チュパッ'];
  const ecchi = ['あっ', 'んっ', 'やだ', 'いや', 'やめ', 'だめ', 'きもちいい', 'すごい', 'もっと', 'ねえ', 'あん', 'きゃ', 'いく', 'いっちゃう', 'はぁ', 'んん'];
  const puntuacionJP = '…？！♥♡★☆「」『』【】〈〉《》、。・ー～'.split('');

  const frasesComunes = [
    'これで', 'それで', 'あれで', 'どうして', 'なんで', 'どこ', 'なに', 'だれ',
    'これ', 'それ', 'あれ', 'この', 'その', 'あの',
    'わたくしは', 'わたしは', 'ぼくは', 'おれは', 'あなたは', 'きみは',
    'タイラー様', 'ご主人様', '主人様', 'お嬢様', 'お兄様', '先生', 'さん', 'くん', 'ちゃん',
    '奴隷です', '僕です', '私です', 'です', 'だ',
    'わたくしはタイラー様の奴隷です',
    'お願いします', 'ありがとうございます', 'すみません', 'ごめんなさい',
    'いってきます', 'ただいま', 'おかえり', 'おはよう', 'こんにちは', 'こんばんは',
    'どうしたの', 'なにがあった', 'どういうこと',
    'そうだね', 'そうです', 'そうなの', 'ちがう', 'うそ', 'ほんとう',
    'わかりました', 'わかった', 'わからない', 'しらない',
    'やめて', 'やめろ', 'だめ', 'いや', 'むり', 'できない',
    'すごい', 'すてき', 'かわいい', 'きれい', 'かっこいい', 'こわい', 'うれしい', 'かなしい',
    'いく', 'くる', 'みる', 'きく', 'する', 'なる', 'ある', 'いる',
    'まって', 'ちょっと', 'もう', 'まだ'
  ];

  const hangulComun = '가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조초코토포호구누두루무부수우주추쿠투푸후'.split('');
  const hangulExtra = '정말뭐왜네예이그저것어떻게안돼됐싫좋알겠습니까요은는을를의에서도'.split('');
  const puntuacionKO = '...?!~♥♡★☆「」『』【】〈〉《》、。·ㅋㅎㅠㅜ'.split('');

  // ─────────────────── Lectura de contexto ───────────────────

  const leerArchivoPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let textoCompleto = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
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

    const tipoValido = file.type === 'text/plain' || file.type === 'application/pdf';
    const extensionValida = file.name.endsWith('.txt') || file.name.endsWith('.pdf');
    if (!tipoValido && !extensionValida) { setError('Solo se permiten archivos TXT y PDF'); return; }

    if (file.size > 5 * 1024 * 1024) { setError('El archivo es demasiado grande (máximo 5MB)'); return; }

    setCargandoArchivo(true);
    setError('');

    try {
      let texto = '';
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) texto = await leerArchivoPDF(file);
      else texto = await leerArchivoTXT(file);

      setArchivoContexto(texto);
      setNombreArchivo(file.name);
    } catch (err) {
      setError('Error al leer el archivo');
      console.error(err);
    } finally {
      setCargandoArchivo(false);
    }
  };

  // ─────────────────── Imagen / zoom ───────────────────

  const manejarImagenOCR = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImagenSrc(reader.result?.toString() || '');
        setZoom(1);
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

  // ─────────────────── Preprocesado “manga” ───────────────────
  // Devuelve 2 variantes: normal y “invertida” (a veces mejora mucho).
  const procesarImagenParaOCR_Manga = (image: HTMLImageElement, crop: PixelCrop) => {
    const make = (invert: boolean) => {
      const canvas = document.createElement('canvas');
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      // ✅ subir bastante la resolución ayuda mucho en vertical
      const resolutionScale = 6.0;
      const padding = 24;

      const cropWidth = crop.width * scaleX * resolutionScale;
      const cropHeight = crop.height * scaleY * resolutionScale;

      canvas.width = cropWidth + padding * 2;
      canvas.height = cropHeight + padding * 2;

      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

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

      // Grises
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        let gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        // un poco de contraste para manga
        gray = (gray - 128) * 1.4 + 128;
        gray = Math.max(0, Math.min(255, gray));

        // binarización simple (manga suele ser B/N)
        const thr = 175;
        let v = gray > thr ? 255 : 0;

        if (invert) v = 255 - v;

        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
      }

      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL('image/png');
    };

    return {
      normal: make(false),
      invertida: make(true),
    };
  };

  // ─────────────────── Utilidades de scoring ───────────────────

  const limpiarCJK = (s: string) => (s || '').replace(/\s+/g, '').trim();

  const ratioJapones = (s: string) => {
    const t = limpiarCJK(s);
    if (!t) return 0;
    const jp = t.match(/[\u3040-\u30ff\u3400-\u9fff]/g)?.length || 0; // hiragana/katakana/kanji
    return jp / t.length;
  };

  const ratioCoreano = (s: string) => {
    const t = limpiarCJK(s);
    if (!t) return 0;
    const ko = t.match(/[\uac00-\ud7af]/g)?.length || 0;
    return ko / t.length;
  };

  const scoreTexto = (text: string, conf: number, idiomaActual: IdiomaOrigen) => {
    const t = limpiarCJK(text);
    const len = Math.min(t.length / 30, 1); // 0..1
    const c = Math.max(0, Math.min(1, (conf || 0) / 100));

    let r = 0;
    if (idiomaActual === 'japones') r = ratioJapones(t);
    if (idiomaActual === 'coreano') r = ratioCoreano(t);
    if (idiomaActual === 'chino') r = (t.match(/[\u3400-\u9fff]/g)?.length || 0) / (t.length || 1);

    // Ponderación
    return c * 0.55 + r * 0.35 + len * 0.10;
  };

  // ─────────────────── Reconstrucción vertical ───────────────────
  // Cuando hay cajas: ordena “columnas derecha→izquierda” y “arriba→abajo”.
  const reconstruirVertical = (data: any) => {
    const symbols = data?.symbols || [];
    const words = data?.words || [];

    const items = (symbols.length ? symbols : words)
      .filter((s: any) => s.text && s.text.trim())
      .map((s: any) => ({
        ch: s.text,
        x: s.bbox?.x0 ?? 0,
        y: s.bbox?.y0 ?? 0,
      }));

    if (!items.length) return (data?.text || '').trim();

    const xs = items.map((c: any) => c.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const span = Math.max(1, maxX - minX);

    // umbral de columna dinámico
    const colThreshold = Math.max(18, span / 10);

    items.sort((a: any, b: any) => {
      const dx = b.x - a.x; // derecha→izquierda
      if (Math.abs(dx) > colThreshold) return dx;
      return a.y - b.y;     // arriba→abajo
    });

    return items.map((c: any) => c.ch).join('');
  };

  // ─────────────────── OCR principal (multi-PSM + multi-variant + score) ───────────────────

  const correrTesseract = async (img: string, lang: string, psm: string) => {
    const res = await Tesseract.recognize(img, lang, {
      langPath: TESSDATA_PATH, // ✅ local
      // @ts-ignore
      tessedit_pageseg_mode: psm,
      // @ts-ignore
      user_defined_dpi: '300',
      // @ts-ignore
      preserve_interword_spaces: '1',
      // @ts-ignore
      tessedit_ocr_engine_mode: '1',
      logger: m => console.log(m),
    });

    return res.data;
  };

  const escanearSeleccion = async () => {
    if (!completedCrop || !imgRef.current) return;

    setIsScanning(true);
    setError('');
    setMostrarVerificador(false);

    try {
      const { normal, invertida } = procesarImagenParaOCR_Manga(imgRef.current, completedCrop);

      // ✅ idiomas/psm a probar
      let langs: string[] = ['eng'];
      let psms: string[] = ['3', '6'];

      if (idioma === 'japones') {
        // ✅ prueba vertical + fallback horizontal
        langs = ['jpn_vert', 'jpn'];
        psms = ['5', '6', '11', '12', '13', '7', '8'];
      } else if (idioma === 'coreano') {
        langs = ['kor'];
        psms = ['7', '6', '11', '12', '13', '8', '3'];
      } else if (idioma === 'chino') {
        // ✅ tú tienes chi_sim.traineddata (NO chi_sim_vert)
        langs = ['chi_sim'];
        psms = ['6', '11', '12', '13', '3'];
      } else if (idioma === 'tailandes') {
        langs = ['tha'];
        psms = ['6', '11', '3'];
      } else if (idioma === 'portugues') {
        langs = ['por'];
        psms = ['6', '3'];
      }

      // ✅ prueba 2 variantes: normal + invertida
      const variantes = [normal, invertida].filter(Boolean);

      let best = {
        text: '',
        conf: 0,
        score: -1,
        lang: '',
        psm: '',
        data: null as any,
      };

      for (const lang of langs) {
        for (const psm of psms) {
          for (const img of variantes) {
            const data = await correrTesseract(img, lang, psm);
            let text = (data?.text || '').trim();

            // ✅ si es japonés vertical, intenta reconstrucción por cajas
            if (idioma === 'japones') {
              const rec = reconstruirVertical(data);
              if (rec && rec.length >= text.length) text = rec;
            }

            // Limpieza mínima
            if (['japones', 'coreano', 'chino'].includes(idioma)) {
              text = limpiarCJK(text);
            } else {
              text = text.replace(/\s+/g, ' ').trim();
            }

            const conf = Number(data?.confidence ?? 0);
            const sc = scoreTexto(text, conf, idioma);

            if (text.length > 0 && sc > best.score) {
              best = { text, conf, score: sc, lang, psm, data };
            }
          }
        }
      }

      if (best.text) {
        setTextoOCRBruto(`[Tesseract ${best.lang}, PSM:${best.psm}, conf:${Math.round(best.conf)} score:${best.score.toFixed(2)}] ${best.text}`);
        setTextoVerificado(best.text);
        setMostrarVerificador(true);
      } else {
        setError(`No detecté texto (probé ${langs.join(', ')}). Selecciona más ajustado a las letras (sin borde de burbuja) y prueba de nuevo.`);
      }
    } catch (err) {
      console.error(err);
      setError('Error al escanear. Intenta seleccionar solo el texto (sin borde y sin fondo).');
    } finally {
      setIsScanning(false);
    }
  };

  // ─────────────────── Traducción ───────────────────

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
      const contextoCompleto = [archivoContexto, contexto].filter(Boolean).join('\n\n');

      const response = await fetch('/api/traducir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contexto: contextoCompleto, idioma, textoOriginal })
      });

      const data = await response.json();
      if (data.success) setResultado(data.resultado);
      else setError(data.error || 'Error al traducir');
    } catch {
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
        <h1 className="text-4xl font-bold text-center text-blue-400 mb-2">Traductor BBG.</h1>
        <p className="text-center text-gray-300 mb-8">Traduce manga, manhwa, manhua, etc.</p>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Columna Izquierda */}
          <div className="space-y-4 xl:col-span-1">
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
              <h2 className="text-lg font-semibold text-blue-300 mb-4 border-b border-gray-700 pb-2">Configuración</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Idioma de origen</label>
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
                  <label className="block text-sm font-medium text-gray-200 mb-2">Contexto (opcional)</label>
                  <textarea
                    value={contexto}
                    onChange={(e) => setContexto(e.target.value)}
                    className="w-full h-24 p-3 bg-gray-900 text-gray-100 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                    placeholder="Nombres, estilo, resumen..."
                  />
                </div>

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

            {/* OCR */}
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
                  <div className="flex justify-between items-center mb-2 px-1 bg-gray-800 p-2 rounded">
                    <p className="text-xs text-gray-400">Zoom:</p>
                    <div className="flex gap-2 items-center">
                      <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded text-lg hover:bg-gray-600">-</button>
                      <span className="text-xs text-gray-300 w-12 text-center font-mono">{Math.round(zoom * 100)}%</span>
                      <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded text-lg hover:bg-gray-600">+</button>
                      <button onClick={() => setZoom(1)} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600 ml-2">Reset</button>
                    </div>
                  </div>

                  <div className="max-h-[500px] overflow-auto border border-gray-700 bg-gray-950 p-4" onWheel={handleWheel}>
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
                    className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
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

                  <div className="mt-4 border-t border-gray-700 pt-2">
                    <p className="text-xs text-gray-500 mb-1">Tip rápido:</p>
                    <p className="text-xs text-gray-500">
                      Selecciona SOLO las letras (evita borde de burbuja y fondos con trama). Eso cambia muchísimo el resultado.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Columna Central */}
          <div className="space-y-4 xl:col-span-1">
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 h-full flex flex-col">
              <label className="block text-lg font-semibold text-gray-200 mb-4">Texto Original</label>

              {mostrarVerificador && (
                <div className="mb-4 bg-gray-900 border border-yellow-500 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-yellow-300">Verificar texto detectado</h3>

                  <p className="text-xs text-gray-300">
                    OCR detectó:
                    <span className="block mt-1 font-mono bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs">
                      {textoOCRBruto || '(vacío)'}
                    </span>
                  </p>

                  <label className="block text-xs text-gray-300 mb-1">Ajusta el texto (puedes corregir errores):</label>
                  <textarea
                    value={textoVerificado}
                    onChange={(e) => setTextoVerificado(e.target.value)}
                    className="w-full min-h-[80px] bg-gray-950 border border-gray-700 rounded p-2 text-gray-100 text-sm font-mono"
                  />

                  {/* Botones rápidos */}
                  {idioma === 'japones' && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-300">Teclas rápidas (japonés):</p>

                      <p className="text-xs text-gray-500">Hiragana:</p>
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                        {hiragana.map((ch) => (
                          <button key={`h-${ch}`} type="button" onClick={() => setTextoVerificado((p) => p + ch)} className="px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded">
                            {ch}
                          </button>
                        ))}
                      </div>

                      <p className="text-xs text-gray-500 pt-1">Katakana:</p>
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto border-t border-gray-700 pt-1">
                        {katakana.map((ch) => (
                          <button key={`k-${ch}`} type="button" onClick={() => setTextoVerificado((p) => p + ch)} className="px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded">
                            {ch}
                          </button>
                        ))}
                      </div>

                      <p className="text-xs text-gray-500 pt-1">Sugerencias rápidas (catálogo):</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setTextoVerificado('わたくしはタイラー様の奴隷です')}
                          className="px-3 py-2 text-sm bg-yellow-600 hover:bg-yellow-500 rounded font-bold flex-1"
                        >
                          📝 わたくしはタイラー様の奴隷です
                        </button>
                        <button
                          type="button"
                          onClick={() => setTextoVerificado('')}
                          className="px-3 py-2 text-sm bg-red-700 hover:bg-red-600 rounded"
                          title="Limpiar"
                        >
                          🗑️
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto border-t border-gray-700 pt-2">
                        {frasesComunes.map((f, idx) => (
                          <button key={`fc-${idx}`} type="button" onClick={() => setTextoVerificado(f)} className="px-2 py-1 text-sm bg-green-700 hover:bg-green-600 rounded">
                            {f}
                          </button>
                        ))}
                      </div>

                      <p className="text-xs text-gray-500 pt-1">Expresiones:</p>
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto border-t border-gray-700 pt-1">
                        {expresiones.map((w, idx) => (
                          <button key={`ex-${idx}`} type="button" onClick={() => setTextoVerificado((p) => p + w)} className="px-2 py-1 text-sm bg-blue-700 hover:bg-blue-600 rounded">
                            {w}
                          </button>
                        ))}
                      </div>

                      <p className="text-xs text-gray-500 pt-1">Onomatopeyas:</p>
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto border-t border-gray-700 pt-1">
                        {onomatopeyas.map((o, idx) => (
                          <button key={`ono-${idx}`} type="button" onClick={() => setTextoVerificado((p) => p + o)} className="px-2 py-1 text-sm bg-purple-700 hover:bg-purple-600 rounded">
                            {o}
                          </button>
                        ))}
                      </div>

                      <p className="text-xs text-gray-500 pt-1">Ecchi/Adulto:</p>
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto border-t border-gray-700 pt-1">
                        {ecchi.map((o, idx) => (
                          <button key={`ec-${idx}`} type="button" onClick={() => setTextoVerificado((p) => p + o)} className="px-2 py-1 text-sm bg-pink-700 hover:bg-pink-600 rounded">
                            {o}
                          </button>
                        ))}
                      </div>

                      <p className="text-xs text-gray-500 pt-1">Puntuación:</p>
                      <div className="flex flex-wrap gap-1 max-h-12 overflow-y-auto border-t border-gray-700 pt-1">
                        {puntuacionJP.map((p, idx) => (
                          <button key={`pj-${idx}`} type="button" onClick={() => setTextoVerificado((prev) => prev + p)} className="px-2 py-1 text-sm bg-gray-600 hover:bg-gray-500 rounded">
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {idioma === 'coreano' && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">Sílabas comunes:</p>
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                        {hangulComun.map((ch) => (
                          <button key={`ko-${ch}`} type="button" onClick={() => setTextoVerificado((p) => p + ch)} className="px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded">
                            {ch}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 pt-1">Palabras frecuentes:</p>
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto border-t border-gray-700 pt-1">
                        {hangulExtra.map((ch) => (
                          <button key={`kox-${ch}`} type="button" onClick={() => setTextoVerificado((p) => p + ch)} className="px-2 py-1 text-sm bg-indigo-700 hover:bg-indigo-600 rounded">
                            {ch}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 pt-1">Puntuación:</p>
                      <div className="flex flex-wrap gap-1 max-h-12 overflow-y-auto border-t border-gray-700 pt-1">
                        {puntuacionKO.map((ch, idx) => (
                          <button key={`kop-${idx}`} type="button" onClick={() => setTextoVerificado((p) => p + ch)} className="px-2 py-1 text-sm bg-gray-600 hover:bg-gray-500 rounded">
                            {ch}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

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
                      onClick={() => aprenderFrase(textoVerificado)}
                      className="px-3 py-1 text-xs bg-blue-700 hover:bg-blue-600 rounded text-white"
                    >
                      ➕ Aprender
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
                <button onClick={limpiar} className="bg-gray-600 hover:bg-gray-700 text-white px-4 rounded-lg">🗑️</button>
              </div>
            </div>
          </div>

          {/* Columna Derecha */}
          <div className="space-y-4 xl:col-span-1">
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 h-full flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-lg font-semibold text-gray-200">Traducción</label>
                {resultado && (
                  <button onClick={copiar} className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition">Copiar</button>
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
          <p>OCR by Tesseract.js (tessdata local) • Versión prueba</p>
        </div>
      </div>
    </div>
  );
}
