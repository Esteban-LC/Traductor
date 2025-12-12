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

    // JP (incluye ぐにゅ / グチュ etc.)
    if (/(はぁ|ふぅ|んっ|あっ|あぁ|うっ|きゃ|いや|ドキ|ギシ|ビク|グチュ|ぐにゅ|ぐちゅ)/.test(s)) return true;
    // KR
    if (/(하아|흣|앙|꺄|덜컥|부들부들|철썩|쯧|두근두근)/.test(s)) return true;
    // ZH
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
    const ctx = (contexto || '').toLowerCase();
    const o = (original || '').toLowerCase();
    const b = (baseEs || '').toLowerCase();

    // Marcadores de contexto (si existen)
    const ctxNsfw = /(nsfw|\+18|r-?18|adulto|hentai|ecchi|smut|lewd|explicit|sin censura)/i.test(contexto || '');

    // Sexual explícito (JP/KR/ZH + algunas palabras ES)
    const sexExplicit =
        /(セックス|性交|挿入|精液|乳首|陰茎|陰部|ちんこ|まんこ|勃起|オナ|潮|喘|エロ)/i.test(original) ||
        /(섹스|성교|삽입|정액|유두|음경|음부|자지|보지|발기|오나|절정|헐떡|신음)/i.test(original) ||
        /(性交|插入|精液|乳头|阴茎|阴道|高潮|呻吟|色情)/i.test(original) ||
        /(corrida|pene|vagina|pezón|mastur|orgasmo|follar|coger|venirse)/i.test(b);

    // Violencia explícita / insulto duro (si quieres que también se mantenga fuerte)
    const violenciaInsulto =
        /(死ね|殺す|ぶっ殺|クズ|クソ|ゴミ|畜生|殴|蹴)/i.test(original) ||
        /(죽어|죽인다|쓰레기|개새|미친|좆같)/i.test(original) ||
        /(杀了|去死|垃圾|畜生)/i.test(original) ||
        /(muérete|te voy a matar|basura|maldito|mierda|imbécil|estúpido)/i.test(b);

    // SFX húmedo / viscoso (no inventa acto, solo permite traducción más directa)
    const sfxHumedo = /(グチュ|ぐちゅ|ぐにゅ|ぬち|ぬる|ズチュ|ちゅ|ちゅっ|じゅ)/i.test(original) ||
        /(철썩|질척|끈적|축축|쩍)/i.test(original) ||
        /(湿|黏|啵|咕唧|水声)/i.test(original);

    if (ctxNsfw || sexExplicit) return 'alto';
    if (violenciaInsulto || sfxHumedo) return 'medio';
    return 'bajo';
}

/**
 * Refinar con Gemini:
 * - Decide SOLO qué tan explícito debe ser, basado en ORIGINAL + contexto.
 * - Si el original es explícito, no lo suaviza.
 * - Si el original es sugerente, lo mantiene sugerente.
 */
async function refinarConGemini(
    traduccionBase: string,
    idiomaOrigen: string,
    contexto: string,
    textoOriginal: string,
    modo: ModoLinea,
    tono: string
): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // ⚠️ CAMBIA ESTE NOMBRE POR EL MODELO QUE TENGAS DISPONIBLE
        // Ejemplos: "gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-thinking-exp-1219' });

        const nombreIdioma = nombresIdioma[idiomaOrigen] || idiomaOrigen;

        const tipoObra =
            idiomaOrigen === 'japones'
                ? 'manga'
                : idiomaOrigen === 'coreano'
                    ? 'manhwa'
                    : idiomaOrigen === 'chino'
                        ? 'manhua'
                        : 'obra';

        const instruccionFormato = `La traducción de un ${tipoObra} debe ser coherente, natural, con buena gramática y manteniendo el contexto.`;

        const nivel = inferirNivelExplicito(contexto, textoOriginal, traduccionBase);

        const moduloCatalogo = `
MÓDULO ESPECIAL: SFX / GEMIDOS / INTERJECCIONES (común en ${tipoObra})
- Si el ORIGINAL es principalmente onomatopeya, efecto de sonido, gemido, jadeo o grito corto:
  - NO lo conviertas en frases largas.
  - Devuelve algo corto estilo scantrad.
  - SFX: preferir corchetes: [crujido], [latidos acelerados], [golpe seco], [goteo], [se estremece], [sonido húmedo], etc.
  - Gemidos/Jadeos: «Ah…», «Mmm…», «Haa…» o [jadea], [gime].
- NO inventes acciones/eventos que no existan en el original.
- Mantén el nivel de explicitud del original. Si es directo, sé directo. Si es sugerente, sé sugerente.

Ejemplos guía (para orientar estilo):
- ドキドキ → [latidos acelerados]
- ギシギシ → [crujido]
- ビクッ → [se estremece]
- グチュ → [sonido húmedo] / [chapoteo húmedo]
- ぐにゅっ → [aplastamiento blando] / [chof] (si el contexto es húmedo/viscoso: [aplastamiento húmedo])
- あっ… → «Ah…»
- んっ… → «Mmm…»
- はぁ…はぁ… → [jadeando]
`;

        const guiaModo =
            modo === 'sfx_gemido'
                ? `
MODO ACTIVO: SFX/GEMIDO/INTERJECCIÓN.
- Resultado muy corto.
- SFX => [ ... ]
- Gemido/jadeo => «...», o [jadea]/[gime]
`
                : `
MODO ACTIVO: DIÁLOGO normal.
- Traduce natural y fluido, fiel al tono.
`;

        // ✅ Aquí está lo importante: NO hay “elige NSFW”; el modelo decide con esta regla + nivel inferido
        const reglaAuto = `
CONTROL DE EXPLICITUD AUTOMÁTICO:
- Nivel inferido: ${nivel.toUpperCase()}
- Si el ORIGINAL (no la base) es explícito/sexual/insultante, NO lo suavices.
- Si la traducción base suena “demasiado limpia”, corrígela usando el ORIGINAL como autoridad.
- NO hagas más explícito de lo que el ORIGINAL realmente dice.
`;

        const prompt = `Eres un traductor profesional especializado en ${tipoObra}.
Tu objetivo: traducción FIEL al tono e intención del ORIGINAL.

PRINCIPIO FUNDAMENTAL:
- El ORIGINAL manda. Si la traducción base está mal, suavizada o censurada, corrígela.
- No inventes acciones/eventos que no existen en el ORIGINAL.
- No añadas moral ni censura.

INSTRUCCIÓN DE FORMATO:
${instruccionFormato}

TONO DEL USUARIO (solo para estilo, NO para censura):
${tono || 'neutro'}

${reglaAuto}

${moduloCatalogo}
${guiaModo}

REGLAS DE NATURALIDAD:
1) Puedes reescribir por completo la traducción base si suena rígida o antinatural.
2) Mantén el significado, tono e intensidad del ORIGINAL.
3) Devuelve SOLO la traducción final, sin explicaciones.
4) Estilo español latino natural y fluido, NO literal.
5) Reformula frases para que suenen como habla real, no como traducción robótica.
6) Mantén las relaciones de poder/cortesía del original (amo/esclavo, señor/subordinado, etc.).
7) Para pronombres como わたくし (watakushi = yo formal/humilde), usa "yo" con contexto apropiado.
8) Para 様 (sama), usa "señor/señora" o el nombre + título según fluya mejor.
9) Para これで (kore de = con esto/ahora), elige la opción que suene más natural en contexto.

EJEMPLOS DE ESTILO NATURAL:
- "Soy el esclavo de Tyler" → "Yo soy la esclava de usted, señor Tyler"
- "Esto es bueno" → "¡Qué bien!"
- "¿Qué estás haciendo?" → "¿Qué haces?"
- "Ahora voy" → "Ya voy"

CONTEXTO:
${contexto ? contexto : 'Obra narrativa con registros variados.'}

ORIGINAL (${nombreIdioma}):
${textoOriginal}

TRADUCCIÓN BASE (puede tener errores o suavizado):
${traduccionBase}

INSTRUCCIÓN FINAL:
Devuelve SOLO la traducción final.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let traduccion = response.text().trim();

        // Limpieza por si mete introducciones
        traduccion = traduccion
            .replace(/^.*?aquí tienes.*?:/gi, '')
            .replace(/^.*?versión mejorada.*?:/gi, '')
            .replace(/^.*?traducción.*?:/gi, '')
            .trim();

        return traduccion;
    } catch (error) {
        console.error('❌ Error con Gemini:', error);
        return null;
    }
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
        .replace(/Blaak\s*&\s*Co\.?/gi, 'compañía Black')
        .replace(/Blaak\s+comercio/gi, 'compañía Black')
        .replace(/Blaak\s+Company/gi, 'compañía Black')
        .replace(/Sociedad\s+Blaak/gi, 'compañía Black')
        .replace(/Welrod/gi, 'Welrood')
        .replace(/\bPadre\b/g, 'Padre');

    resultado = resultado
        .replace(
            /^[-–—]?\s*¡?Esto es un fraude[^¡!]*padre[^¡!]*[!！]*$/gim,
            '-¡Estafa! ¡¡Padre, esto es una estafa!!'
        )
        .replace(/quedarme de brazos cruzados[^.!?]*$/gi, '¡No hay manera de que me quede callado frente a esto!');

    resultado = resultado
        .replace(/¿Será que ([^?]+)\?/gi, '¿$1?')
        .replace(/¿Será que/gi, '¿')
        .replace(/antigua plegaria/gi, 'oraciones')
        .replace(/\bplegaria\b/gi, 'oraciones')
        .replace(/\bsúplica\b/gi, 'oraciones')
        .replace(/^Mmm[…\.]*$/gim, 'Bueno…')
        .replace(/^Uhm[…\.]*$/gim, 'Bueno…')
        .replace(/^Hmm[…\.]*$/gim, 'Bueno…')
        .replace(/por favor,?\s+muéstrame/gi, 'muéstrame')
        .replace(/por favor,?\s+dime/gi, 'dime')
        .replace(/por favor,?\s+dame/gi, 'dame')
        .replace(/\bplata\b/gi, 'dinero')
        .replace(/Escuchame/gi, 'Escúchame');

    let lineas = resultado.split('\n');

    lineas = lineas
        .map((l) => l.trimEnd())
        .filter((l) => {
            if (/Así que esto es lo que realmente significaba/i.test(l)) return false;
            if (/de la manera más descarada/i.test(l)) return false;
            return true;
        })
        .map((linea) => {
            const lineaTrim = linea.trim();
            if (!lineaTrim) return linea;

            const esDialogo =
                /^[¡¿]/.test(lineaTrim) ||
                /[!?]$/.test(lineaTrim) ||
                /^(Jajaja|Oye|Escucha|Una|Entiendo|Por favor)/i.test(lineaTrim) ||
                /\bno\s+(hay|puede|puedo)/i.test(lineaTrim) ||
                /(Padre|Isaac)/i.test(lineaTrim);

            if (esDialogo && !lineaTrim.startsWith('-') && !lineaTrim.startsWith('[')) {
                return '-' + lineaTrim;
            }

            return linea;
        });

    resultado = lineas.join('\n');

    resultado = resultado
        .replace(/\s\s+/g, ' ')
        .replace(/\s\./g, '.')
        .replace(/\s,/g, ',')
        .replace(/\s!/g, '!')
        .replace(/\s\?/g, '?')
        .trimEnd();

    return resultado;
}

async function traducirTexto(texto: string, idiomaOrigen: string, contexto: string, tono: string, modo: ModoLinea) {
    const traduccionBase = await traducirConGoogleTranslate(texto, idiomaOrigen);
    const traduccionRefinada = await refinarConGemini(traduccionBase, idiomaOrigen, contexto, texto, modo, tono);
    const traduccionFinal = traduccionRefinada || traduccionBase;
    const traduccionMejorada = mejorarNaturalidad(traduccionFinal);
    return traduccionMejorada;
}

async function procesarLineas(textoOriginal: string, idioma: string, contexto: string, tono: string) {
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
