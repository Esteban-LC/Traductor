import { NextRequest, NextResponse } from 'next/server';
import translate from '@iamtraction/google-translate';
import { GoogleGenerativeAI } from '@google/generative-ai';

const codigosIdioma: Record<string, string> = {
    ingles: 'en',
    japones: 'ja',
    chino: 'zh-CN',
    coreano: 'ko',
    tailandes: 'th',
    portugues: 'pt',
};

const nombresIdioma: Record<string, string> = {
    ingles: 'inglés',
    japones: 'japonés',
    chino: 'chino',
    coreano: 'coreano',
    tailandes: 'tailandés',
    portugues: 'portugués',
};

function extraerNombresDelContexto(contexto: string) {
    if (!contexto || !contexto.trim()) return {};
    const nombres: Record<string, string> = {};

    const matchParentesis = contexto.matchAll(/\(([A-Za-z]+(?:\s+[A-Za-z]+)?)\)/g);
    for (const match of matchParentesis) {
        const partes = match[1].split(/\s+/);
        partes.forEach((parte) => {
            if (parte.length >= 3) nombres[parte.toLowerCase()] = parte;
        });
    }

    const lineas = contexto.split('\n');
    for (const linea of lineas) {
        const match = linea.match(/([A-Za-z]+)\s*[-=>]+\s*([A-Za-z]+)/);
        if (match) nombres[match[1].toLowerCase()] = match[2];
    }

    if (nombres['kazuya']) {
        nombres['kazria'] = nombres['kazuya'];
        nombres['kazuria'] = nombres['kazuya'];
    }

    return nombres;
}

function aplicarNombresDelContexto(texto: string, nombresContexto: Record<string, string>) {
    let resultado = texto;
    for (const [nombreOriginal, nombreEspanol] of Object.entries(nombresContexto)) {
        const regex = new RegExp(`\\b${nombreOriginal}\\b`, 'gi');
        resultado = resultado.replace(regex, nombreEspanol);
    }
    return resultado;
}

async function traducirConGoogleTranslate(texto: string, idiomaOrigen: string) {
    const codigoIdioma = codigosIdioma[idiomaOrigen] || 'auto';
    try {
        const resultado = await translate(texto, { from: codigoIdioma, to: 'es' });
        return resultado.text;
    } catch {
        throw new Error('Error al traducir');
    }
}

/** --------- Clasificador simple para línea SFX/gemidos --------- */
type ModoLinea = 'dialogo' | 'sfx_gemido' | 'narracion';

function esLineaCorta(t: string) {
    const s = t.replace(/\s+/g, '');
    return s.length > 0 && s.length <= 10;
}

function tieneMuchosSimbolos(t: string) {
    const s = t.trim();
    const soloSimbolos = s.replace(/[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñぁ-んァ-ン一-龯々ー\uAC00-\uD7AF]/g, '');
    return soloSimbolos.length >= Math.max(2, Math.floor(s.length * 0.35));
}

function pareceSfxOGemido(t: string, idiomaOrigen: string): boolean {
    const s = t.trim();
    if (!s) return false;

    if (s.startsWith('[') && s.endsWith(']')) return true;
    if (esLineaCorta(s) && (tieneMuchosSimbolos(s) || /[…。！？!?,、]/.test(s))) return true;
    if (/(.)\1\1/.test(s)) return true;

    if (/(はぁ|ふぅ|んっ|あっ|あぁ|うっ|きゃ|いや|ドキ|ギシ|ビク|グチュ|ぐにゅ|ぐちゅ)/.test(s)) return true;
    if (/(하아|흣|앙|꺄|덜컥|부들부들|철썩|쯧|두근두근)/.test(s)) return true;
    if (/(啊|嗯|呀|咯吱|扑通|滴答)/.test(s)) return true;

    const noSpaces = s.replace(/\s+/g, '');
    if (noSpaces.length <= 12 && !/\s/.test(s) && !/[a-zA-Z]/.test(s)) return true;

    if (s.startsWith('-') || s.length >= 25) return false;
    if (idiomaOrigen === 'japones' && esLineaCorta(s)) return true;
    if (idiomaOrigen === 'coreano' && esLineaCorta(s)) return true;

    return false;
}

function clasificarLinea(linea: string, idiomaOrigen: string): ModoLinea {
    const s = linea.trim();
    if (/^\/\//i.test(s) || /^N\/T:/i.test(s)) return 'narracion';
    if (pareceSfxOGemido(s, idiomaOrigen)) return 'sfx_gemido';
    return 'dialogo';
}

/** --------- Inferir “nivel de explicitud” automáticamente --------- */
type NivelExplicito = 'bajo' | 'medio' | 'alto';

function inferirNivelExplicito(contexto: string, original: string, baseEs: string): NivelExplicito {
    const ctxNsfw = /(nsfw|\+18|r-?18|adulto|hentai|ecchi|smut|lewd|explicit|sin censura)/i.test(contexto || '');

    const sexExplicit =
        /(セックス|性交|挿入|精液|乳首|陰茎|陰部|ちんこ|まんこ|勃起|オナ|潮|喘|エロ)/i.test(original) ||
        /(섹스|성교|삽입|정액|유두|음경|음부|자지|보지|발기|오나|절정|헐떡|신음)/i.test(original) ||
        /(性交|插入|精液|乳头|阴茎|阴道|高潮|呻吟|色情)/i.test(original) ||
        /(corrida|pene|vagina|pezón|mastur|orgasmo|follar|coger|venirse)/i.test(baseEs);

    const violenciaInsulto =
        /(死ね|殺す|ぶっ殺|クズ|クソ|ゴミ|畜生|殴|蹴)/i.test(original) ||
        /(죽어|죽인다|쓰레기|개새|미친|좆같)/i.test(original) ||
        /(杀了|去死|垃圾|畜生)/i.test(original) ||
        /(muérete|te voy a matar|basura|maldito|mierda|imbécil|estúpido)/i.test(baseEs);

    const sfxHumedo =
        /(グチュ|ぐちゅ|ぐにゅ|ぬち|ぬる|ズチュ|ちゅ|ちゅっ|じゅ)/i.test(original) ||
        /(철썩|질척|끈적|축축|쩍)/i.test(original) ||
        /(湿|黏|啵|咕唧|水声)/i.test(original);

    if (ctxNsfw || sexExplicit) return 'alto';
    if (violenciaInsulto || sfxHumedo) return 'medio';
    return 'bajo';
}

/**
 * Refinar con Gemini:
 * - Tono: casual/scantrad por defecto
 * - Auto-explicitud: NO suaviza si el original es fuerte
 * - Fallback de modelos (evita 404 infinito)
 */
async function refinarConGemini(
    traduccionBase: string,
    idiomaOrigen: string,
    contexto: string,
    textoOriginal: string,
    modo: ModoLinea,
    tono: string | undefined
): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const genAI = new GoogleGenerativeAI(apiKey);

    // Modelos candidatos: pon el tuyo arriba si quieres (env)
    const candidatos = [
        process.env.GEMINI_MODEL,
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-2.5-pro',
        'gemini-2.0-pro',
        'gemini-1.5-flash-002',
        'gemini-1.5-pro-002',
    ].filter(Boolean) as string[];

    const nombreIdioma = nombresIdioma[idiomaOrigen] || idiomaOrigen;

    const tipoObra =
        idiomaOrigen === 'japones' ? 'manga' :
            idiomaOrigen === 'coreano' ? 'manhwa' :
                idiomaOrigen === 'chino' ? 'manhua' : 'obra';

    const nivel = inferirNivelExplicito(contexto, textoOriginal, traduccionBase);

    const tonoFinal = (tono && tono.trim())
        ? tono.trim()
        : 'casual, natural, estilo scantrad (español latino), nada tieso';

    const instruccionFormato =
        `La traducción de un ${tipoObra} debe ser coherente, natural y fiel al contexto, como scantrad.`;

    const moduloCatalogo = `
MÓDULO SFX/GEMIDOS:
- Si el ORIGINAL es onomatopeya/efecto/gemido/grito corto:
  - NO lo vuelvas frase larga.
  - SFX: usa corchetes: [crujido], [latidos], [golpe], [sonido húmedo], etc.
  - Gemidos: «Ah…», «Mmm…», «Haa…» o [jadea], [gime].
- NO inventes acciones/eventos.
- Mantén el nivel de explicitud del original.
`;

    const guiaModo =
        modo === 'sfx_gemido'
            ? `MODO: SFX/GEMIDO. Resultado MUY corto.`
            : `MODO: DIÁLOGO. Fluido, natural, casual.`;

    const reglaAuto = `
CONTROL DE EXPLICITUD AUTOMÁTICO:
- Nivel inferido: ${nivel.toUpperCase()}
- Si el ORIGINAL es explícito/sexual/insultante, NO lo suavices.
- NO lo hagas más explícito de lo que el ORIGINAL dice.
`;

    const prompt = `Eres traductor profesional de ${tipoObra}.
Objetivo: traducción fiel, NATURAL y CASUAL (scantrad), sin censura artificial.

${instruccionFormato}

TONO:
${tonoFinal}

${reglaAuto}

${moduloCatalogo}
${guiaModo}

REGLAS:
1) Puedes reescribir por completo la traducción base si suena robótica.
2) El ORIGINAL manda.
3) Devuelve SOLO la traducción final (sin títulos, sin explicación).
4) Español latino natural (coloquial cuando toque).

CONTEXTO:
${contexto ? contexto : 'Obra narrativa con registros variados.'}

ORIGINAL (${nombreIdioma}):
${textoOriginal}

TRADUCCIÓN BASE:
${traduccionBase}

Devuelve SOLO la traducción final.`;

    for (const modelName of candidatos) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            let t = response.text().trim();

            t = t
                .replace(/^.*?aquí tienes.*?:/gi, '')
                .replace(/^.*?versión mejorada.*?:/gi, '')
                .replace(/^.*?traducción.*?:/gi, '')
                .trim();

            if (t) return t;
        } catch (err: any) {
            // Si es 404 de modelo, probamos el siguiente sin spamear
            if (err?.status === 404) continue;
            console.error('❌ Error con Gemini:', err);
            return null;
        }
    }

    // Ningún modelo funcionó
    return null;
}

function mejorarNaturalidad(texto: string) {
    let resultado = texto;

    resultado = resultado
        .replace(/．+/g, '')
        .replace(/。/g, '')
        .replace(/、/g, ',')
        .replace(/！/g, '!')
        .replace(/？/g, '?')
        .replace(/　/g, ' ');

    resultado = resultado
        .replace(/\s*\.\s*\.\s*\.\s*/g, '…')
        .replace(/\.{2,}/g, '…');

    resultado = resultado
        .replace(/\s\s+/g, ' ')
        .replace(/\s\./g, '.')
        .replace(/\s,/g, ',')
        .replace(/\s!/g, '!')
        .replace(/\s\?/g, '?')
        .trimEnd();

    return resultado;
}

async function traducirTexto(texto: string, idiomaOrigen: string, contexto: string, tono: string | undefined, modo: ModoLinea) {
    const traduccionBase = await traducirConGoogleTranslate(texto, idiomaOrigen);
    const traduccionRefinada = await refinarConGemini(traduccionBase, idiomaOrigen, contexto, texto, modo, tono);
    const traduccionFinal = traduccionRefinada || traduccionBase;
    return mejorarNaturalidad(traduccionFinal);
}

async function procesarLineas(textoOriginal: string, idioma: string, contexto: string, tono: string | undefined) {
    const lineas = textoOriginal.split('\n');
    const lineasProcesadas: string[] = [];
    const nombresContexto = extraerNombresDelContexto(contexto);

    for (const linea of lineas) {
        if (!linea.trim()) {
            lineasProcesadas.push(linea);
            continue;
        }

        const esNota = /^\/\//i.test(linea) || /^N\/T:/i.test(linea);
        if (esNota) {
            lineasProcesadas.push(linea);
            continue;
        }

        const modo = clasificarLinea(linea, idioma);
        let traducido = await traducirTexto(linea, idioma, contexto, tono, modo);
        traducido = aplicarNombresDelContexto(traducido, nombresContexto);

        lineasProcesadas.push(traducido);
    }

    return lineasProcesadas.join('\n');
}

export async function POST(request: NextRequest) {
    try {
        const { contexto, idioma, tono, textoOriginal } = await request.json();

        if (!textoOriginal) {
            return NextResponse.json({ success: false, error: 'Texto original requerido' }, { status: 400 });
        }

        const resultado = await procesarLineas(textoOriginal, idioma, contexto, tono);
        return NextResponse.json({ success: true, resultado });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ success: false, error: 'Error al traducir' }, { status: 500 });
    }
}
