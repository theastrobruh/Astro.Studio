<div align="center">

<!-- Animated SVG logo — cosmic aperture & lens core -->
<a href="https://theastrobruh.github.io/Astro.Studio/">
  <img src="public/assets/readme/astro-studio-logo.svg" alt="Astro.Studio — Browser-Native Photo & Color Grading Studio" width="460"/>
</a>

<br/>

> **Estudio de edición fotográfica, gradación de color, curvas tonales, inspección EXIF, marcas de agua, exportación multiformato y procesamiento por lotes en ZIP. Cero instalaciones, 100% local en tu navegador.**

[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)](https://github.com/theastrobruh/Astro.Studio/actions)
[![GitHub Pages](https://img.shields.io/badge/Live%20on-GitHub%20Pages-222?logo=github&logoColor=white)](https://theastrobruh.github.io/Astro.Studio/)
[![React 19](https://img.shields.io/badge/React%2019-v19.0.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-v8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Version](https://img.shields.io/badge/Version-v1.0.0-00E5FF)](#)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Ko-fi](https://img.shields.io/badge/Support-Ko--fi-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/theastrobruh)

<br/>

[**🎨 Open Astro.Studio**](https://theastrobruh.github.io/Astro.Studio/) · [**🚀 the.astro.os**](https://theastrobruh.github.io/the.astro.os/) · [**🎴 CardGram**](https://theastrobruh.github.io/CardGram/) · [**🖨️ Inkra**](https://theastrobruh.github.io/Inkra/) · [**☕ Support the Project**](https://ko-fi.com/theastrobruh)

</div>

---

## ✨ Un Ecosistema: theAstroBruh Universe

**Astro.Studio** forma parte del ecosistema creativo desarrollado por **[theAstroBruh](https://github.com/theastrobruh)**, compartiendo la misma filosofía de ingeniería web: herramientas creativas rápidas, privadas y ejecutadas directamente en el navegador sin dependencias pesadas ni servidores externos.

```
                          ┌───────────────────────────┐
                          │   theAstroBruh Universe   │
                          └─────────────┬─────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
  the.astro.os                    Astro.Studio                      CardGram
  Web Desktop OS              Photo & Color Studio               3D Card Showcase
```

---

## 🛠️ Características principales

| | Módulo | Detalles |
|---|---|---|
| 🎞️ | **50+ Presets de Película** | Estilos monocromo, analógico, moody, retrato y minimalista con mezcla de intensidad (`0%–100%`) y guardado de presets propios. |
| 🎛️ | **Edición Manual Completa** | Brillo, contraste, altas luces, sombras, blancos, negros, exposición, saturación, intensidad, calidez, tinte, grano, viñeta, nitidez, claridad y **curvas tonales RGB**. |
| ⚖️ | **Antes / Después** | Comparación dividida arrastrable, vista lado a lado, comparación al mantener pulsado e historial de deshacer/rehacer. |
| 📷 | **Inspector EXIF & Recetas** | Lectura de cámara, lente y exposición con `exifr`, más detección automática de recetas de `Astro.Studio` incrustadas en PNG/JPEG. |
| 💧 | **Estudio de Marcas de Agua** | Texto, insignia, cuadrícula repetida y logotipo personalizado (PNG/SVG) con tipografías, rotación, márgenes, sombra y contorno. |
| 📦 | **Exportación & Lote ZIP** | Formatos JPEG/PNG/WebP, tamaños predefinidos para redes sociales y procesamiento masivo en ZIP con `JSZip`. |

---

## 💻 Desarrollo local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (http://localhost:3000)
npm run dev

# Verificar tipos y compilar para producción
npm run lint
npm run build
```

---

## 🚀 Despliegue en GitHub Pages

Este repositorio incluye el flujo de trabajo [deploy.yml](.github/workflows/deploy.yml) y la configuración de rutas relativas en [vite.config.ts](vite.config.ts):

1. Sube el proyecto a GitHub en la rama `main`.
2. En **Settings → Pages**, selecciona **Source: GitHub Actions**.
3. Cada `push` a `main` ejecutará `npm ci`, `npm run lint`, `npm run build` y publicará `dist/` en `https://<usuario>.github.io/Astro.Studio/`.
