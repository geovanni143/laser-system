# Conexiones del Proyecto de Disparo Láser con Arduino/ESP8266

Este archivo explica cómo realizar las conexiones necesarias para que el sistema de disparo láser funcione correctamente.

## Sensores IR (Receptores)
- **IR1**: Conectar a **D5 (GPIO14)**
- **IR2**: Conectar a **D6 (GPIO12)**
- **IR3**: Conectar a **D0 (GPIO16)**

## LEDs Azules (Objetivos)
- **LED Azul 1**: Conectar a **D7 (GPIO13)**
- **LED Azul 2**: Conectar a **TX (GPIO1)**
- **LED Azul 3**: Conectar a **D3 (GPIO0)**

## LED Rojo (Fallo)
- **LED Rojo**: Conectar a **D4 (GPIO2)**

## Buzzer OK (Acierto)
- **Buzzer OK**: Conectar a **D8 (GPIO15)**

## Pantalla LCD 16x2 con I2C
- **SDA**: Conectar a **D2 (GPIO4)**
- **SCL**: Conectar a **D1 (GPIO5)**
- **VCC**: Conectar a **3V3**
- **GND**: Conectar a **GND**

## Instrucciones de Conexión:
1. Conecta los sensores IR a los pines **D5, D6 y D0**.
2. Conecta los LEDs a los pines correspondientes (**D7, GPIO1, D3**).
3. Conecta el buzzer y el LED rojo a **D8** y **D4** respectivamente.
4. Conecta la pantalla LCD al bus **I2C** usando los pines **D2** y **D1**.

Sigue estos pasos para realizar todas las conexiones de hardware correctamente.
