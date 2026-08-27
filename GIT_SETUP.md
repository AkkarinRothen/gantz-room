# 🚀 GUÍA DE VINCULACIÓN CON GITHUB & DESPLIEGUE AUTOMÁTICO

Esta carpeta ya tiene su repositorio Git inicializado en la rama `main`. Sigue estos sencillos pasos para conectarlo a tu GitHub y tener actualizaciones automáticas con cada cambio.

---

## 📌 Paso 1: Crear el repositorio en GitHub

1. Entra a tu cuenta en [GitHub: Nuevo Repositorio](https://github.com/new).
2. Ponle un nombre (por ejemplo: `gantz-room` o `gantz-shadowdark`).
3. Déjalo en **Público** (o Privado) y **NO marques** las casillas de *"Add a README"*, *"Add .gitignore"* ni *"license"*.
4. Haz clic en **Create repository**.

---

## 📌 Paso 2: Conectar y subir tu código (Solo se hace 1 vez)

Abre la terminal en la carpeta `gantz-web` (o pídeme que lo ejecute) y corre estos 2 comandos:

```bash
git remote add origin https://github.com/TU_USUARIO/gantz-room.git
git push -u origin main
```
*(Reemplaza `TU_USUARIO` y `gantz-room` por los de tu enlace).*

---

## 📌 Paso 3: Conectar GitHub a Netlify o Vercel (Para Auto-Deploy)

### En Netlify:
1. Entra a [app.netlify.com](https://app.netlify.com/) y haz clic en **Add new site > Import an existing project**.
2. Selecciona **GitHub** y elige tu repositorio `gantz-room`.
3. En *Publish directory*, déjalo en blanco o pon `.` y dale a **Deploy site**.
4. ¡Listo! A partir de este momento, **cada vez que hagamos un cambio y se haga `git push`, Netlify actualizará tu página web automáticamente en 5 segundos**.

### O en GitHub Pages:
1. En tu repositorio de GitHub, ve a **Settings > Pages**.
2. En **Branch**, selecciona `main` y carpeta `/(root)`. Dale a **Save**.
3. Tu web estará disponible en `https://TU_USUARIO.github.io/gantz-room/`.

---

## 🔄 Cómo es el flujo de trabajo diario a partir de ahora:

1. **Haz cambios aquí** (puedes pedirme modificar colores, agregar nuevos monstruos, reglas o sonidos).
2. **Previsualiza en local:** Haz doble clic en [`preview.bat`](file:///g:/Mi%20unidad/4.Juegos%20de%20Rol/0.Sesiones%20de%20Rol/Shadowdark/Gantz/gantz-web/preview.bat) para probar la pantalla y el control remoto sincronizados en tu navegador.
3. **Publica los cambios:** Ejecuta:
   ```bash
   git add .
   git commit -m "Nuevos monstruos y ajustes de audio"
   git push
   ```
   *(O simplemente dime "guarda y sube los cambios a GitHub" y yo lo haré por ti).*
4. ¡Netlify/Vercel desplegará los cambios inmediatamente en tu tablet y en la web!
