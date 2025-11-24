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

    // Nombres dentro de paréntesis: (Kazuya)
    const matchParentesis = contexto.matchAll(/\(([A-Za-z]+(?:\s+[A-Za-z]+)?)\)/g);
    for (const match of matchParentesis) {
        const partes = match[1].split(/\s+/);
        partes.forEach((parte) => {
            if (parte.length >= 3) {
                nombres[parte.toLowerCase()] = parte;
            }
        });
    }

    // Reglas tipo: Kazuya -> Kaz
    const lineas = contexto.split('\n');
    for (const linea of lineas) {
        const match = linea.match(/([A-Za-z]+)\s*[-=>]+\s*([A-Za-z]+)/);
        if (match) {
            nombres[match[1].toLowerCase()] = match[2];
        }
    }

    // Casos especiales
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
        const resultado = await translate(texto, {
            from: codigoIdioma,
            to: 'es',
        });
        return resultado.text;
    } catch (error) {
        throw new Error('Error al traducir');
    }
}

/**
 * Refinar con Gemini SIN agregar contenido nuevo.
 * Solo mejora la naturalidad de la traducción base.
 */
async function refinarConGemini(
    traduccionBase: string,
    idiomaOrigen: string,
    contexto: string,
    textoOriginal: string
): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return null;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);

        // ⚠️ CAMBIA ESTE NOMBRE POR EL MODELO QUE TENGAS DISPONIBLE
        // Ejemplos: "gemini-2.0-flash", "gemini-1.5-pro", etc.
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const nombreIdioma = nombresIdioma[idiomaOrigen] || idiomaOrigen;

        let prompt = `Eres un traductor profesional de manga/anime. Tu tarea es reescribir la TRADUCCIÓN BASE para que suene NATURAL y FLUIDA en español latinoamericano, sin ser demasiado literal.

MUY IMPORTANTE:
- NO agregues frases completamente nuevas que no estén en la base.
- Puedes REORGANIZAR y MEJORAR la gramática para que suene más natural.
- Evita traducciones LITERALES palabra por palabra.
- Mantén el MISMO significado general, pero hazlo sonar como hablaría un hispanohablante nativo.
- Si la base tiene una estructura rara o literal, MEJÓRALA para que fluya naturalmente.

EJEMPLOS DE MEJORAS GRAMATICALES:

❌ LITERAL (MAL):
"¿Será que Anderka respondió a mi antigua plegaria?"
"Mmm… Entonces, por favor, ¡muéstrame la respuesta!"

✅ NATURAL (BIEN):
"¿La diosa Andercia ha respondido a mis oraciones?"
"Bueno… Entonces, muéstrame la respuesta…"

OBSERVA:
- "Será que" → "ha respondido" (más natural)
- "antigua plegaria" → "oraciones" (más común)
- "Mmm" → "Bueno" (más natural en español)
- "por favor, ¡muéstrame!" → "muéstrame…" (menos redundante)

ESTILO:
- Natural, fluido y claro en español latino NEUTRAL.
- NO uses lenguaje demasiado coloquial o agresivo.
- Evita palabras como: "mocoso", "largo", "qué va", "sabelotodo".
- Prefiere: "niño", "sal de aquí", "no me importa", "como si supieras".
- Usa "dinero" en lugar de "plata".
- Mejora la gramática: "¿Será que X?" → "¿X ha...?" cuando suene mejor.
- Simplifica redundancias: "por favor, muéstrame" → "muéstrame" si ya es cortés.
- Mantén un tono RESPETUOSO y NEUTRAL.

TÉRMINOS COMUNES EN MANGA/ANIME:
- Si ves nombres que parecen de dioses/diosas (terminan en -ka, -cia, etc.), mantenlos como nombres propios.
- "plegaria/súplica" → "oraciones" (más natural)
- "gema/joya mágica" → mantén el contexto mágico
- Honoríficos japoneses (-sama, -san, -kun) → manténlos si están en la base

ORIGINAL (${nombreIdioma}):
${textoOriginal}

TRADUCCIÓN BASE (mejora la gramática y naturalidad):
${traduccionBase}

REESCRIBE la TRADUCCIÓN BASE de forma NATURAL y FLUIDA en español latinoamericano,
mejorando la gramática y evitando traducciones literales.

Devuelve SOLO la traducción mejorada, sin comentarios ni explicaciones.`;

        if (contexto && contexto.trim()) {
            prompt += `\n\nCONTEXTO ADICIONAL: ${contexto}`;
        }

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let traduccion = response.text().trim();

        // Por si el modelo aún mete introducciones tipo "Aquí tienes la traducción:"
        traduccion = traduccion
            .replace(/^.*?aquí tienes.*?:/gi, '')
            .replace(/^.*?versión mejorada.*?:/gi, '')
            .replace(/^.*?siguiendo.*?instrucciones.*?:/gi, '')
            .replace(/^.*?mejora.*?:/gi, '')
            .replace(/^.*?traducción.*?:/gi, '')
            .trim();

        return traduccion;
    } catch (error) {
        console.error('Error con Gemini:', error);
        return null;
    }
}

/**
 * Post-procesado para fijar estilo (latino / manga)
 * y corregir ciertas frases que quieres que salgan SIEMPRE de una forma.
 */
function mejorarNaturalidad(texto: string) {
    let resultado = texto;

    // Limpieza básica de signos japoneses
    resultado = resultado
        .replace(/．+/g, '')
        .replace(/。/g, '')
        .replace(/、/g, ',')
        .replace(/！/g, '!')
        .replace(/？/g, '?')
        .replace(/　/g, ' ');

    // Nombres / términos específicos
    resultado = resultado
        .replace(/Blaak\s*&\s*Co\.?/gi, 'compañía Black')
        .replace(/Blaak\s+comercio/gi, 'compañía Black')
        .replace(/Blaak\s+Company/gi, 'compañía Black')
        .replace(/Sociedad\s+Blaak/gi, 'compañía Black')
        .replace(/Welrod/gi, 'Welrood')
        .replace(/\bPadre\b/g, 'Padre');

    // Estilo deseado para "estafa / fraude"
    resultado = resultado
        // "Esto es un fraude, padre..." → tu versión fija
        .replace(
            /^[-–—]?\s*¡?Esto es un fraude[^¡!]*padre[^¡!]*[!！]*$/gim,
            '-¡Estafa! ¡¡Padre, esto es una estafa!!'
        )
        // frase de "quedarme de brazos cruzados" → tu frase fija
        .replace(
            /quedarme de brazos cruzados[^.!?]*$/gi,
            '¡No hay manera de que me quede callado frente a esto!'
        );

    // MEJORAS GRAMATICALES AUTOMÁTICAS (menos literal, más natural)
    resultado = resultado
        // Construcciones con "Será que" → más natural
        .replace(/¿Será que ([^?]+)\?/gi, '¿$1?')
        .replace(/¿Será que/gi, '¿')

        // "antigua plegaria/súplica" → "oraciones"
        .replace(/antigua plegaria/gi, 'oraciones')
        .replace(/\bplegaria\b/gi, 'oraciones')
        .replace(/\bsúplica\b/gi, 'oraciones')

        // Interjecciones más naturales
        .replace(/^Mmm[…\.]*$/gim, 'Bueno…')
        .replace(/^Uhm[…\.]*$/gim, 'Bueno…')
        .replace(/^Hmm[…\.]*$/gim, 'Bueno…')

        // Redundancias comunes
        .replace(/por favor,?\s+muéstrame/gi, 'muéstrame')
        .replace(/por favor,?\s+dime/gi, 'dime')
        .replace(/por favor,?\s+dame/gi, 'dame')

        // Otras preferencias de vocabulario
        .replace(/\bplata\b/gi, 'dinero')
        .replace(/Escuchame/gi, 'Escúchame');

    // Puntos suspensivos
    resultado = resultado
        .replace(/\s*\.\s*\.\s*\.\s*/g, '…')
        .replace(/\.{2,}/g, '…');

    // Procesar por líneas para diálogos y filtrar frases que Gemini suele inventar
    let lineas = resultado.split('\n');

    lineas = lineas
        .map((l) => l.trimEnd())
        .filter((l) => {
            // Filtramos líneas muy "explicativas" que suelen ser inventadas
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

            // Líneas que parecen diálogo, pero no tienen "-" ni empiezan por "["
            if (esDialogo && !lineaTrim.startsWith('-') && !lineaTrim.startsWith('[')) {
                return '-' + lineaTrim;
            }

            return linea;
        });

    resultado = lineas.join('\n');

    // Limpieza final de espacios
    resultado = resultado
        .replace(/\s\s+/g, ' ')
        .replace(/\s\./g, '.')
        .replace(/\s,/g, ',')
        .replace(/\s!/g, '!')
        .replace(/\s\?/g, '?')
        .trimEnd();

    return resultado;
}

async function traducirTexto(texto: string, idiomaOrigen: string, contexto: string) {
    const traduccionBase = await traducirConGoogleTranslate(texto, idiomaOrigen);
    const traduccionRefinada = await refinarConGemini(traduccionBase, idiomaOrigen, contexto, texto);
    const traduccionFinal = traduccionRefinada || traduccionBase;
    const traduccionMejorada = mejorarNaturalidad(traduccionFinal);

    return traduccionMejorada;
}

async function procesarLineas(textoOriginal: string, idioma: string, contexto: string) {
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

        let traducido = await traducirTexto(linea, idioma, contexto);
        traducido = aplicarNombresDelContexto(traducido, nombresContexto);

        lineasProcesadas.push(traducido);
    }

    return lineasProcesadas.join('\n');
}

export async function POST(request: NextRequest) {
    try {
        const { contexto, idioma, tono, textoOriginal } = await request.json();

        if (!textoOriginal) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Texto original requerido',
                },
                { status: 400 }
            );
        }

        const resultado = await procesarLineas(textoOriginal, idioma, contexto);

        return NextResponse.json({
            success: true,
            resultado,
        });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Error al traducir',
            },
            { status: 500 }
        );
    }
}
