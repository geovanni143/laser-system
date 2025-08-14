# Sistema de Disparo Láser

Este proyecto consiste en un sistema de disparo láser controlado por un **microcontrolador ESP8266** (o similar) que utiliza **sensores IR** para detectar los impactos. Además, cuenta con una **interfaz web** para visualizar el puntaje en tiempo real.

## Estructura del Proyecto

El proyecto está dividido en tres partes:

### 1. **Carpeta `Arduino_ID`**
   - Contiene el código fuente para el **microcontrolador** (ESP8266).
   - El archivo principal es `SISTEMA_DE_DISPARO_LASER.ino`, que maneja la lógica del disparo y la detección de impactos con los sensores IR.
   - **Conexiones de hardware**:
     - Sensores IR conectados a los pines definidos en el código.
     - LEDs para mostrar aciertos y fallos.
     - Pantalla LCD para mostrar información al usuario.

### 2. **Carpeta `backend`**
   - Contiene la **lógica del servidor** que maneja la comunicación entre el microcontrolador y la interfaz web.
   - Usa **Node.js** para el backend.
   - **`server.js`**: El archivo principal que configura el servidor.
   - **`package.json`**: Incluye las dependencias necesarias (por ejemplo, Express para gestionar el servidor web).

### 3. **Carpeta `frontend`**
   - Contiene los archivos de la **interfaz web**.
   - **`index.html`**: La estructura básica de la página.
   - **`script.js`**: Lógica para manejar la interacción con el servidor backend (por ejemplo, visualización de puntajes).
   - **`styles.css`**: Estilos para la página.
   - **`assets/`**: Carpeta para imágenes y otros recursos.

## Instalación

### Requisitos:
- **Hardware**: Un microcontrolador ESP8266 (o Arduino), sensores IR, LEDs y buzzer.
- **Software**: 
  - **Arduino IDE**: Para cargar el código al microcontrolador.
  - **Node.js**: Para ejecutar el servidor del backend.
  - **Editor de código**: Para editar los archivos frontend (Visual Studio Code, Sublime Text, etc.).

### Paso a paso para instalar el proyecto:

1. **Instalar dependencias para el backend**:
   - Navega a la carpeta `backend` y ejecuta:
     ```bash
     npm install
     ```

2. **Subir el código al ESP8266**:
   - Conecta el ESP8266 a tu computadora y abre el archivo `SISTEMA_DE_DISPARO_LASER.ino` en el Arduino IDE.
   - Selecciona el puerto y la placa adecuada, luego sube el código.

3. **Iniciar el servidor del backend**:
   - En la carpeta `backend`, ejecuta:
     ```bash
     node server.js
     ```

4. **Acceder al frontend**:
   - Abre el archivo `index.html` en tu navegador para ver la interfaz web.

## Contribución

Si deseas contribuir al proyecto, por favor abre un **issue** o envía un **pull request** con las mejoras.

## Licencia

Este proyecto está bajo la **Licencia MIT**. Consulta el archivo `LICENSE` para más detalles.
