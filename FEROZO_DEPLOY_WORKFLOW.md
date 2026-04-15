# Flujo de Despliegue para Ferozo vía GitHub

Este proyecto ("Aura CRM") está configurado con una estructura invertida para que la raíz del repositorio funcione como el directorio `public_html` de Ferozo. 

Todo el código fuente y el entorno de desarrollo de React están contenidos en la carpeta `_source/`. 

## 📌 ¿Cómo hacer un deploy?

Siempre que hagamos cambios en el código (estando dentro de `_source`), debemos seguir este procedimiento exacto para compilar los cambios y empujarlos a GitHub para que Ferozo los tome:

1. **Entrar al directorio de desarrollo:**
   Abre una terminal y colócate siempre en la carpeta fuente.
   ```bash
   cd _source
   ```

2. **Validar e instalar dependencias (opcional):**
   ```bash
   npm install
   ```

3. **Compilar el código fuente:**
   Ejecuta el script de compilación (nuestro `vite.config.ts` está modificado para escupir la compilación en la carpeta raíz `../`).
   ```bash
   npm run build
   ```
   *Esto va a reemplazar los archivos `/index.html` y los contenidos en la subcarpeta `/assets/` en la raíz del repositorio principal.*

4. **Sincronizar a GitHub:**
   Vuelve a la raíz del proyecto para comitear los cambios. Al sumar todos (`.`), Git subirá no solo tus cambios de código de `_source` sino también los archivos compilados estáticos listos para que Ferozo los lea.
   ```bash
   cd ..
   git add .
   git commit -m "chore: deploy update"
   git push origin main
   ```

## 🌐 Configuración de Servidor Web (Apache)

El repositorio incluye un archivo `.htaccess` en su raíz. Ferozo suele utilizar Apache como servidor Web. Dado que la web funciona mediante un router del lado del cliente (Single Page Application de React), el `.htaccess` re-escribe todas las rutas virtuales (`/dashboard`, `/clientes`, etc) al `index.html` estático, evitando errores `404 Not Found`.

**¡NUNCA borres el archivo `.htaccess`, de lo contrario las páginas arrojarán un error 404 bajo recargas!**

---
*Nota generada por Assistant para garantizar coherencia en futuras sesiones de código.*
