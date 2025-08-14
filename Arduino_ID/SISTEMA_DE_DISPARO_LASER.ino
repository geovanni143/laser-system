#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// -------- CONFIGURA ESTO --------
const char* WIFI_SSID    = "Lab/L-ELEANA";
const char* WIFI_PASS    = "$lab/Ele/25";
const char* BACKEND_HOST = "http://10.0.16.98:3001";
// --------------------------------

LiquidCrystal_I2C lcd(0x27, 16, 2);

// Pines (XD)
const int PIN_IR1 = D5;  // GPIO14
const int PIN_IR2 = D6;  // GPIO12
const int PIN_IR3 = D0;  // GPIO16 (sin pull-up)
const int LED_AZUL1 = D7;// GPIO13
const int LED_AZUL2 = 1; // GPIO1/TX
const int LED_AZUL3 = D3;// GPIO0
const int LED_ROJO  = D4;// GPIO2
const int PIN_OK    = D8;// GPIO15

// Lógica
unsigned long VENTANA_MS = 3000;
bool CFG_PAUSED = false;

bool online = false;
unsigned long lastCfgPoll = 0;

inline void setPin(int pin, bool low, bool on){ pinMode(pin, OUTPUT); digitalWrite(pin, low ? (on?LOW:HIGH):(on?HIGH:LOW)); }
inline void az1_on(){ digitalWrite(LED_AZUL1, HIGH); }
inline void az1_off(){ digitalWrite(LED_AZUL1, LOW); }
inline void az2_on(){ digitalWrite(LED_AZUL2, HIGH); }
inline void az2_off(){ digitalWrite(LED_AZUL2, LOW); }
inline void az3_on(){ digitalWrite(LED_AZUL3, HIGH); }
inline void az3_off(){ digitalWrite(LED_AZUL3, LOW); }
inline void setAzulOff(){ az1_off(); az2_off(); az3_off(); }
inline void okOn(){  digitalWrite(PIN_OK, HIGH); }
inline void okOff(){ digitalWrite(PIN_OK, LOW); }
inline void failOn(){  digitalWrite(LED_ROJO, HIGH); }
inline void failOff(){ digitalWrite(LED_ROJO, LOW); }

void lcdMsg(const char* a, const char* b=""){ lcd.clear(); lcd.setCursor(0,0); lcd.print(a); lcd.setCursor(0,1); lcd.print(b); }

// ------- UI: spinner “Conectando…” -------
const char spinnerChars[4] = {'|','/','-','\\'};
void showSpinner(const char* title, uint8_t step){
  lcd.setCursor(0,0); lcd.print("Conectando...   ");
  lcd.setCursor(0,1); lcd.print(title); lcd.print("  ");
  lcd.setCursor(15,0); lcd.print(spinnerChars[step%4]);
}

// ------- BLOQUEA HASTA TENER WIFI -------
void connectWifiBlocking(){
  uint16_t intentos = 0;
  WiFi.mode(WIFI_STA);
  WiFi.hostname("laser-esp8266");
  while (WiFi.status()!=WL_CONNECTED){
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    unsigned long t0=millis(); uint8_t step=0;
    while (WiFi.status()!=WL_CONNECTED && millis()-t0<6000){
      showSpinner("WiFi", step++); delay(120); yield();
    }
    if (WiFi.status()==WL_CONNECTED) break;
    intentos++;
    if (intentos%5==0) { // cada 5 fallos, reinicia (obliga)
      lcdMsg("WiFi fallando","Reiniciando...");
      delay(700);
      ESP.restart();
    }
  }
  lcdMsg("WiFi OK", WiFi.localIP().toString().c_str());
  delay(400);
  online = true;
}

// ------- BLOQUEA HASTA QUE EL BACKEND RESPONDA /config -------
void connectBackendBlocking(){
  HTTPClient http; WiFiClient client;
  uint16_t intentos = 0;
  while (true){
    String url = String(BACKEND_HOST) + "/config";
    if (http.begin(client, url)){
      http.setTimeout(3000);
      int code = http.GET();
      if (code==200){
        String payload = http.getString(); http.end();
        StaticJsonDocument<384> doc;
        if (!deserializeJson(doc, payload)){
          if (doc["window_ms"].is<unsigned long>()) VENTANA_MS = doc["window_ms"].as<unsigned long>();
          if (doc["paused"].is<bool>())             CFG_PAUSED  = doc["paused"].as<bool>();
          lcdMsg("Backend OK", "Config leida");
          delay(400);
          return;
        }
      }
      http.end();
    }
    // Mostrar spinner y reintentar
    uint8_t step=0; unsigned long t0=millis();
    while (millis()-t0<1200){ showSpinner("Web/API", step++); delay(120); yield(); }
    intentos++;
    if (intentos%10==0){ // 10 fallos seguidos → reinicia
      lcdMsg("API no responde","Reiniciando...");
      delay(700);
      ESP.restart();
    }
  }
}

// ------- POST evento (usa POST(body)) -------
bool postEvent(const char* kind, int targetId, unsigned long ts, unsigned long win){
  if (WiFi.status()!=WL_CONNECTED) return false;
  HTTPClient http; WiFiClient client;
  String url = String(BACKEND_HOST) + "/event";
  if (!http.begin(client, url)) return false;
  http.addHeader("Content-Type","application/json");
  http.setTimeout(3000);

  StaticJsonDocument<220> d;
  d["type"]      = kind;
  d["ts"]        = ts;
  d["window_ms"] = win;
  d["targetId"]  = targetId;

  String body; serializeJson(d, body);
  int code = http.POST(body);
  http.end();
  return (code==200 || code==201);
}

// ===== SETUP =====
void setup(){
  // pines
  pinMode(PIN_IR1, INPUT_PULLUP);
  pinMode(PIN_IR2, INPUT_PULLUP);
  pinMode(PIN_IR3, INPUT);
  pinMode(LED_AZUL1, OUTPUT); pinMode(LED_AZUL2, OUTPUT); pinMode(LED_AZUL3, OUTPUT);
  pinMode(LED_ROJO, OUTPUT);  pinMode(PIN_OK, OUTPUT);
  setAzulOff(); failOff(); okOff();

  // LCD
  Wire.begin(D2, D1);
  lcd.init(); lcd.backlight();
  lcdMsg("Iniciando...", "");

  // FORZAR CONEXIÓN
  connectWifiBlocking();       // no sigue hasta tener WiFi
  connectBackendBlocking();    // no sigue hasta leer /config

  randomSeed(analogRead(A0));
}

// ===== LOOP =====
bool irActivoEsLOW[3] = {true,true,true};
int irPinByIdx(int i){ return (i==0)?PIN_IR1:(i==1)?PIN_IR2:PIN_IR3; }
int readIRraw(int pin){ int acc=0; for(int i=0;i<6;i++){ acc+=digitalRead(pin); delayMicroseconds(200);} return (acc>=3)?HIGH:LOW; }
void calibrarPolaridad(int idx){
  int ones=0, zeros=0, pin=irPinByIdx(idx);
  for(int i=0;i<60;i++){ (readIRraw(pin)==HIGH)?ones++:zeros++; delayMicroseconds(150); }
  irActivoEsLOW[idx]=(ones>zeros);
}
bool irActivo(int idx){ int v=readIRraw(irPinByIdx(idx)); return irActivoEsLOW[idx]?(v==LOW):(v==HIGH); }
bool hitRobusto(int idx, int consecutivas=3, unsigned ventana_us=12000){
  int ok=0; unsigned long t0=micros();
  while (micros()-t0<ventana_us){ if (irActivo(idx)){ if(++ok>=consecutivas) return true; } else ok=0; delayMicroseconds(500); yield(); }
  return false;
}

void ensureOnline(){
  // Si se cayó el WiFi o la API, volvemos a bloquear hasta reconectar
  if (WiFi.status()!=WL_CONNECTED){ lcdMsg("WiFi caido","Reconectando"); connectWifiBlocking(); }
  // refresca config de vez en cuando
  if (millis()-lastCfgPoll>1000){
    lastCfgPoll=millis();
    HTTPClient http; WiFiClient client;
    String url = String(BACKEND_HOST) + "/config";
    if (http.begin(client,url)){ http.setTimeout(1500); int code=http.GET(); if(code==200){
      StaticJsonDocument<256> d; if(!deserializeJson(d, http.getString())){ 
        if (d["window_ms"].is<unsigned long>()) VENTANA_MS = d["window_ms"].as<unsigned long>();
        if (d["paused"].is<bool>())             CFG_PAUSED  = d["paused"].as<bool>();
      }
    } http.end(); } else { connectBackendBlocking(); }
  }
  if (CFG_PAUSED){ lcdMsg("PAUSADO","Esperando orden"); while (CFG_PAUSED){ ensureOnline(); delay(100); } lcdMsg("Reanudando",""); delay(150); }
}

void loop(){
  ensureOnline(); // mantiene conexión “sí o sí”

  // Ronda
  int objetivo = random(3);
  setAzulOff();
  if      (objetivo==0) az1_on();
  else if (objetivo==1) az2_on();
  else                  az3_on();

  calibrarPolaridad(objetivo);
  lcdMsg("Ventana ACTIVA", (String("Obj: ")+String(objetivo+1)).c_str());

  unsigned long t0=millis(); bool acierto=false;
  while (millis()-t0<VENTANA_MS){
    ensureOnline();                // si se cae, se queda reconectando
    if (hitRobusto(objetivo)) { acierto=true; break; }
    delay(2);
  }
  setAzulOff();

  if (acierto){ okOn();  postEvent("hit",  objetivo, millis(), VENTANA_MS); delay(90);  okOff();  lcdMsg("ACIERTA!",""); }
  else        { failOn(); postEvent("miss", objetivo, millis(), VENTANA_MS); delay(90);  failOff(); lcdMsg("FALLO",""); }

  delay(250);
}
