# Traductor de Manga LATAM - Web

Aplicación web para traducir manga a español latinoamericano coloquial.

## 🚀 Características

- ✅ Traducción con **Gemini AI** (gratis) para lenguaje natural y coloquial
- ✅ Fallback a Google Translate con post-procesamiento avanzado
- ✅ Soporta japonés, inglés, chino, coreano, tailandés y portugués
- ✅ Corrección automática de nombres de personajes
- ✅ Español LATAM casual e informal
- ✅ 100% gratis
- ✅ Accesible desde cualquier dispositivo

## 🛠️ Tecnologías

- **Next.js 16** - Framework React
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos
- **Gemini AI** - Motor de traducción principal (API gratuita)
- **Google Translate** - Fallback con mejoras
- **Vercel** - Hosting gratuito

## 📦 Instalación Local

```bash
# Instalar dependencias
npm install

# Configurar API key de Gemini (opcional pero recomendado)
# Crear archivo .env.local con:
# GEMINI_API_KEY=tu_api_key_aqui
# Obtén tu API key gratis en: https://makersuite.google.com/app/apikey

# Ejecutar en desarrollo
npm run dev

# Abrir http://localhost:3000
```

## 🔑 Configuración de Gemini AI (Opcional)

Para obtener traducciones de mejor calidad:

1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Obtén una API key gratuita
3. Crea un archivo `.env.local` en la raíz del proyecto
4. Agrega: `GEMINI_API_KEY=tu_api_key_aqui`

Si no configuras Gemini, el traductor seguirá funcionando con Google Translate mejorado.

## 🌐 Desplegar en Vercel

### Opción 1: Desde GitHub

1. Sube el proyecto a GitHub
2. Ve a [vercel.com](https://vercel.com)
3. Haz clic en "New Project"
4. Importa tu repositorio
5. Agrega la variable de entorno `GEMINI_API_KEY` en Settings → Environment Variables
6. ¡Listo! Vercel desplegará automáticamente

### Opción 2: Desde CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Desplegar
vercel

# Configurar variable de entorno
vercel env add GEMINI_API_KEY
```

## 📝 Uso

1. **Contexto** (opcional): Agrega nombres de personajes o mapeos
   - Ejemplo: `Kazria -> Kazuya`
   
2. **Idioma**: Selecciona el idioma de origen

3. **Texto**: Pega el texto a traducir

4. **Traducir**: Haz clic y obtén el resultado en español LATAM coloquial

## 💡 Tips

- Para corregir nombres mal traducidos, usa el formato: `NombreMal -> NombreCorrecto` en el contexto
- El traductor detecta automáticamente variaciones de nombres (ej: Kazria, Kazuria → Kazuya)
- Puedes traducir múltiples líneas a la vez
- Con Gemini AI, las traducciones son más naturales y coloquiales

## ⚠️ Cómo Escribir Contexto Efectivo (Importante)

El traductor usa Gemini AI para mejorar la naturalidad, pero **si mencionas "contenido explícito" o "adulto" en el contexto, Gemini puede autocensurar la traducción**.

### ❌ EVITA (Activa filtros de seguridad):
```
"Contenido explícito para adultos"
"Escenas sexuales"
"Contenido +18"
"Material sensible"
```

### ✅ USA (No activa filtros):
```
"Obra narrativa de fantasía con diversos registros lingüísticos"
"Historia con tono directo y sin filtros"
"Narrativa que mantiene el estilo crudo del autor original"
"Obra con lenguaje intenso y emocional"
```

### 📋 Ejemplo de Contexto Bien Escrito:
```
Obra narrativa isekai de fantasía protagonizada por Lee Seon-woong, único hombre en un mundo de mujeres. 
La historia mantiene un tono directo y sin filtros, con situaciones cómicas, tensas y emotivas.
Personajes: Diosa (invocadora), Slime Girl, Elfas, Aldeanas, Goblins femeninas.
El autor usa lenguaje directo para situaciones incómodas, sorpresa y choque cultural.
```

**Ver archivos `GUIA_CONTEXTO.md` y `CONTEXTO_MANHWA.md` para más detalles.**

## 🎯 Ejemplos

**Entrada (Japonés):**
```
隣の老婦人が妊娠し、教皇はアメリカへ行った
```

**Salida (con Gemini):**
```
la vieja de al lado quedó preñada y el papa se fue a los estados unidos
```

## 📄 Licencia

MIT

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Abre un issue o pull request.
