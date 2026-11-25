# Astro.Studio

Estudio de edición fotográfica, gradación de color, curvas tonales, inspección EXIF, marcas de agua, exportación multiformato y procesamiento por lotes en ZIP — ejecutado 100% en el navegador.

Todo funciona de forma local en tu navegador sin subir archivos a servidores externos.

---

## Características principales

- **Más de 50 presets de película y monocromo**: Ajustes instantáneos con mezcla de intensidad (`0%–100%`) y guardado de presets personalizados.
- **Edición manual completa**: Brillo, contraste, altas luces, sombras, blancos, negros, exposición, saturación, intensidad, calidez, tinte, desvanecimiento mate, grano de película, viñeta, nitidez, claridad y **curvas tonales interactivas (RGB / Rojo / Verde / Azul)**.
- **Comparación Antes / Después**: Vista dividida arrastrable, vista lado a lado, comparación al mantener pulsado e historial de deshacer/rehacer.
- **Inspector EXIF y recetas de edición**: Lectura de metadatos de cámara, lente y exposición mediante `exifr`, además de detección automática de recetas de `Astro.Studio` incrustadas en archivos PNG/JPEG exportados.
- **Estudio de marcas de agua**: Modos de texto, insignia, cuadrícula repetida y logotipo personalizado (PNG/SVG) con tipografías, rotación, márgenes, sombra y contorno.
- **Exportación multiformato y lote ZIP**: Tamaños predefinidos para redes sociales, dimensiones personalizadas, formatos JPEG/PNG/WebP y exportación masiva en ZIP.

---

## Tecnologías

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4**
- **Motion** (`motion/react`) y **Lucide Icons**
- **exifr** y **JSZip**

---

## Desarrollo local

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

## Despliegue en GitHub Pages (GitHub Actions)

Este repositorio incluye el flujo de trabajo [deploy.yml](.github/workflows/deploy.yml) y la configuración de rutas relativas en [vite.config.ts](vite.config.ts) para publicar automáticamente en GitHub Pages:

1. Sube el proyecto a GitHub en la rama `main`.
2. En el repositorio, ve a **Settings → Pages** y en **Source** selecciona **GitHub Actions**.
3. Cada `push` a `main` ejecutará `npm ci`, `npm run lint`, `npm run build` y publicará la carpeta `dist/` en `https://<usuario>.github.io/<repositorio>/`.
