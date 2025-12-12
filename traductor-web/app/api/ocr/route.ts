import { NextRequest, NextResponse } from 'next/server';

// Hugging Face Space: hysts/Manga-OCR
// Gradio API endpoint
const HF_SPACE_URL = 'https://hysts-manga-ocr.hf.space/api/predict';

export async function POST(request: NextRequest) {
    try {
        const { imageBase64 } = await request.json();

        if (!imageBase64) {
            return NextResponse.json({ success: false, error: 'Imagen requerida' }, { status: 400 });
        }

        // Gradio API expects the image as base64 with data URI prefix
        const imageData = imageBase64.startsWith('data:')
            ? imageBase64
            : `data:image/png;base64,${imageBase64}`;

        // Call Hugging Face Space Gradio API
        const response = await fetch(HF_SPACE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data: [imageData]
            })
        });

        if (!response.ok) {
            console.error('HF Space error:', response.status, response.statusText);
            return NextResponse.json({
                success: false,
                error: `Error del servidor Hugging Face: ${response.status}`
            }, { status: 500 });
        }

        const result = await response.json();

        // Gradio returns { data: [text_output] }
        const texto = result?.data?.[0] || '';

        if (!texto || texto.trim().length === 0) {
            return NextResponse.json({ success: false, error: 'No se detectó texto' });
        }

        return NextResponse.json({
            success: true,
            texto: texto.trim(),
            metodo: 'Manga-OCR (HuggingFace)'
        });

    } catch (error) {
        console.error('Error en Manga-OCR:', error);
        return NextResponse.json({
            success: false,
            error: 'Error al procesar imagen con Manga-OCR'
        }, { status: 500 });
    }
}
