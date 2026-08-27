# 🌐 GUÍA DE DESPLIEGUE EN LA NUBE GRATUITO (GANTZ WEB)

Esta versión de **Gantz Room** funciona 100% en la nube sin necesidad de tener un servidor propio ni Node.js. Utiliza **WebRTC (PeerJS)** para conectar la PC y la Tablet/Celular con latencia instantánea desde cualquier lugar del mundo.

---

## 🚀 Opción 1: Netlify Drop (La más rápida - 10 segundos)

1. Entra en tu navegador a [https://app.netlify.com/drop](https://app.netlify.com/drop) (puedes crearte una cuenta gratuita con Google o GitHub).
2. **Arrastra y suelta la carpeta entera `gantz-web`** directamente en el recuadro que dice *"Drag & drop your site folder here"*.
3. En 5 segundos tendrás tu enlace público listo, por ejemplo:
   `https://gantz-room.netlify.app`
4. ¡Listo! Abre esa URL en tu PC/TV, y con tu tablet o celular escanea el código QR en pantalla.

---

## ⚡ Opción 2: Vercel

1. Entra a [https://vercel.com/new](https://vercel.com/new).
2. Sube o importa el repositorio de GitHub con la carpeta `gantz-web`.
3. Haz clic en **Deploy**.
4. Obtendrás un dominio súper rápido como `https://gantz-app.vercel.app`.

---

## 🐙 Opción 3: GitHub Pages

1. Sube el contenido de `gantz-web` a un repositorio público en tu GitHub (ej. `gantz-room`).
2. En GitHub, ve a **Settings > Pages**.
3. En **Branch**, selecciona `main` (o la raíz `/root`) y dale a **Save**.
4. En 1 minuto tendrás tu enlace activo: `https://tu-usuario.github.io/gantz-room/`.

---

## 💡 Cómo funciona la conexión en vivo:
1. Al abrir la web en tu PC (`/index.html`), se generará un código de sala único (ej. `GANTZ-8931`) y un **Código QR**.
2. Al escanear el QR con tu tablet o celular, se abrirá `/remote.html?room=gantz-8931` y se vincularán **al instante**.
3. Si prefieres no escanear, simplemente abre `/remote.html` en la tablet e ingresa el código PIN de 4 letras.
