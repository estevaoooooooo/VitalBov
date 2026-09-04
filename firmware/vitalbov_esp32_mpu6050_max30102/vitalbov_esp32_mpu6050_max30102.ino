#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <WebServer.h>
#include "MAX30105.h"
#include "heartRate.h"

// Prototipo habilitado somente para o primeiro animal cadastrado no app.
static const char *ANIMAL_ID = "VB-219";
static const char *DEVICE_ID = "VitalBov-ESP32-MPU6050-MAX30102-001";

static const char *AP_SSID = "VitalBov-VB-219";
static const char *AP_PASSWORD = "vitalbov219";

static const uint8_t MPU_SDA_PIN = 21;
static const uint8_t MPU_SCL_PIN = 22;
static const uint8_t MAX_SDA_PIN = 2;
static const uint8_t MAX_SCL_PIN = 4;
static const uint8_t MPU6050_ADDR = 0x68;

static const uint32_t MOTION_SAMPLE_INTERVAL_MS = 50;
static const uint32_t VITAL_SAMPLE_INTERVAL_MS = 20;
static const float SWAY_HEAT_THRESHOLD = 62.0f;
static const float MOVEMENT_HEAT_THRESHOLD = 58.0f;

WebServer server(80);
TwoWire maxWire = TwoWire(1);
MAX30105 maxSensor;

bool mpuReady = false;
bool maxReady = false;
uint32_t lastMotionSample = 0;
uint32_t lastVitalSample = 0;
uint32_t samples = 0;
uint32_t lastBeat = 0;

float accelX = 0.0f;
float accelY = 0.0f;
float accelZ = 0.0f;
float gyroX = 0.0f;
float gyroY = 0.0f;
float gyroZ = 0.0f;
float motionTemperature = 0.0f;
float movementScore = 0.0f;
float swayScore = 0.0f;
float heatProbability = 0.0f;
bool heatDetected = false;

float heartRate = 0.0f;
float spo2Estimate = 0.0f;
float vitalTemperature = 0.0f;
long lastIr = 0;
long lastRed = 0;

float lastAccelMagnitude = 1.0f;
float lastGyroZ = 0.0f;

void writeRegister(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

uint8_t readRegister(uint8_t reg) {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return 0;
  Wire.requestFrom(MPU6050_ADDR, (uint8_t)1);
  if (Wire.available() < 1) return 0;
  return Wire.read();
}

bool readMpu6050() {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) return false;

  Wire.requestFrom(MPU6050_ADDR, (uint8_t)14);
  if (Wire.available() < 14) return false;

  int16_t rawAx = (int16_t)((Wire.read() << 8) | Wire.read());
  int16_t rawAy = (int16_t)((Wire.read() << 8) | Wire.read());
  int16_t rawAz = (int16_t)((Wire.read() << 8) | Wire.read());
  int16_t rawTemp = (int16_t)((Wire.read() << 8) | Wire.read());
  int16_t rawGx = (int16_t)((Wire.read() << 8) | Wire.read());
  int16_t rawGy = (int16_t)((Wire.read() << 8) | Wire.read());
  int16_t rawGz = (int16_t)((Wire.read() << 8) | Wire.read());

  accelX = rawAx / 16384.0f;
  accelY = rawAy / 16384.0f;
  accelZ = rawAz / 16384.0f;
  gyroX = rawGx / 131.0f;
  gyroY = rawGy / 131.0f;
  gyroZ = rawGz / 131.0f;
  motionTemperature = (rawTemp / 340.0f) + 36.53f;

  return true;
}

void updateBehaviorScores() {
  float accelMagnitude = sqrt((accelX * accelX) + (accelY * accelY) + (accelZ * accelZ));
  float gyroMagnitude = sqrt((gyroX * gyroX) + (gyroY * gyroY) + (gyroZ * gyroZ));
  float accelChange = fabs(accelMagnitude - lastAccelMagnitude);
  float swayChange = fabs(gyroZ - lastGyroZ);

  lastAccelMagnitude = accelMagnitude;
  lastGyroZ = gyroZ;

  float nextMovement = constrain((accelChange * 180.0f) + (gyroMagnitude * 0.18f), 0.0f, 100.0f);
  float nextSway = constrain(swayChange * 0.8f, 0.0f, 100.0f);

  movementScore = (movementScore * 0.82f) + (nextMovement * 0.18f);
  swayScore = (swayScore * 0.80f) + (nextSway * 0.20f);

  heatProbability = constrain((movementScore * 0.45f) + (swayScore * 0.55f), 0.0f, 100.0f);
  heatDetected = swayScore >= SWAY_HEAT_THRESHOLD && movementScore >= MOVEMENT_HEAT_THRESHOLD;
}

void updateSpo2Estimate(long red, long ir) {
  if (red <= 0 || ir <= 0) return;
  float ratio = (float)red / (float)ir;
  spo2Estimate = constrain(110.0f - (25.0f * ratio), 70.0f, 100.0f);
}

void readMotionSensor() {
  if (!mpuReady || millis() - lastMotionSample < MOTION_SAMPLE_INTERVAL_MS) return;
  lastMotionSample = millis();

  if (readMpu6050()) {
    samples++;
    updateBehaviorScores();
  } else {
    mpuReady = false;
  }
}

void readVitalSensor() {
  if (!maxReady || millis() - lastVitalSample < VITAL_SAMPLE_INTERVAL_MS) return;
  lastVitalSample = millis();

  lastIr = maxSensor.getIR();
  lastRed = maxSensor.getRed();

  if (checkForBeat(lastIr)) {
    uint32_t now = millis();
    uint32_t delta = now - lastBeat;
    lastBeat = now;

    if (delta > 300 && delta < 2000) {
      float bpm = 60000.0f / (float)delta;
      if (bpm > 30.0f && bpm < 220.0f) {
        heartRate = heartRate <= 0.1f ? bpm : (heartRate * 0.85f) + (bpm * 0.15f);
      }
    }
  }

  updateSpo2Estimate(lastRed, lastIr);

  if (samples % 250 == 0) {
    vitalTemperature = maxSensor.readTemperature();
  }
}

void sendCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Access-Control-Allow-Private-Network", "true");
}

String localDashboardHtml() {
  String html = "<!doctype html><html lang=\"pt-BR\"><head>";
  html += "<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">";
  html += "<title>VitalBov Chip</title>";
  html += "<style>";
  html += "body{margin:0;font-family:Arial,sans-serif;background:#eef4e7;color:#24301d}";
  html += "main{max-width:520px;margin:0 auto;padding:18px}";
  html += "h1{font-size:24px;margin:8px 0 4px;color:#315d18}";
  html += ".card{background:#fff;border:1px solid #d9e4cf;border-radius:12px;padding:14px;margin:12px 0;box-shadow:0 8px 24px #20300018}";
  html += ".grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}";
  html += ".metric{background:#f8fbf4;border:1px solid #dfe8d5;border-radius:10px;padding:10px}";
  html += ".metric span{display:block;color:#65745b;font-size:12px;font-weight:700}";
  html += ".metric strong{display:block;font-size:22px;margin-top:4px}";
  html += ".status{font-weight:800}.ok{color:#3d771d}.bad{color:#b5372d}";
  html += "button{width:100%;border:0;border-radius:10px;background:#577627;color:white;font-size:16px;font-weight:800;padding:12px}";
  html += "small{color:#65745b;font-weight:700}";
  html += "</style></head><body><main>";
  html += "<h1>VitalBov Chip</h1><small>Animal VB-219 - Estrela</small>";
  html += "<section class=\"card\"><div class=\"status\" id=\"status\">Lendo sensores...</div></section>";
  html += "<section class=\"card grid\">";
  html += "<div class=\"metric\"><span>Batimentos</span><strong id=\"heartRate\">--</strong></div>";
  html += "<div class=\"metric\"><span>Oxigenacao</span><strong id=\"spo2\">--</strong></div>";
  html += "<div class=\"metric\"><span>Movimento</span><strong id=\"movement\">--</strong></div>";
  html += "<div class=\"metric\"><span>Balanceio</span><strong id=\"sway\">--</strong></div>";
  html += "<div class=\"metric\"><span>Prob. de cio</span><strong id=\"heat\">--</strong></div>";
  html += "<div class=\"metric\"><span>Status cio</span><strong id=\"heatStatus\">--</strong></div>";
  html += "</section>";
  html += "<section class=\"card\"><button onclick=\"readTelemetry()\">Atualizar agora</button><p><small>Atualiza automaticamente a cada 3 segundos. Esta pagina funciona sem internet.</small></p></section>";
  html += "<script>";
  html += "async function readTelemetry(){try{const r=await fetch('/telemetry',{cache:'no-store'});const d=await r.json();";
  html += "document.getElementById('status').textContent='Conectado: '+d.signal+' | '+d.sensor;";
  html += "document.getElementById('status').className='status ok';";
  html += "document.getElementById('heartRate').textContent=Math.round(d.heartRate||0)+' bpm';";
  html += "document.getElementById('spo2').textContent=Math.round(d.spo2||0)+'%';";
  html += "document.getElementById('movement').textContent=Math.round(d.movementScore||0);";
  html += "document.getElementById('sway').textContent=Math.round(d.swayScore||0);";
  html += "document.getElementById('heat').textContent=Math.round(d.heatProbability||0)+'%';";
  html += "document.getElementById('heatStatus').textContent=d.heatDetected?'Possivel cio':'Normal';";
  html += "}catch(e){document.getElementById('status').textContent='Sem resposta do ESP32';document.getElementById('status').className='status bad';}}";
  html += "readTelemetry();setInterval(readTelemetry,3000);";
  html += "</script></main></body></html>";
  return html;
}

void handleRoot() {
  sendCorsHeaders();
  server.send(200, "text/html", localDashboardHtml());
}

String telemetryJson() {
  String signal = mpuReady && maxReady ? "Estavel" : (mpuReady || maxReady ? "Parcial" : "Sensores ausentes");
  String json = "{";
  json += "\"animalId\":\"" + String(ANIMAL_ID) + "\",";
  json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  json += "\"sensor\":\"MPU6050 + MAX30102\",";
  json += "\"board\":\"ESP32\",";
  json += "\"movementScore\":" + String(movementScore, 1) + ",";
  json += "\"swayScore\":" + String(swayScore, 1) + ",";
  json += "\"heatProbability\":" + String(heatProbability, 1) + ",";
  json += "\"heatDetected\":";
  json += heatDetected ? "true," : "false,";
  json += "\"heartRate\":" + String(heartRate, 1) + ",";
  json += "\"spo2\":" + String(spo2Estimate, 1) + ",";
  json += "\"accelX\":" + String(accelX, 3) + ",";
  json += "\"accelY\":" + String(accelY, 3) + ",";
  json += "\"accelZ\":" + String(accelZ, 3) + ",";
  json += "\"gyroX\":" + String(gyroX, 2) + ",";
  json += "\"gyroY\":" + String(gyroY, 2) + ",";
  json += "\"gyroZ\":" + String(gyroZ, 2) + ",";
  json += "\"ir\":" + String(lastIr) + ",";
  json += "\"red\":" + String(lastRed) + ",";
  json += "\"motionTemperature\":" + String(motionTemperature, 1) + ",";
  json += "\"vitalTemperature\":" + String(vitalTemperature, 1) + ",";
  json += "\"mpuReady\":";
  json += mpuReady ? "true," : "false,";
  json += "\"maxReady\":";
  json += maxReady ? "true," : "false,";
  json += "\"signal\":\"" + signal + "\",";
  json += "\"samples\":" + String(samples) + ",";
  json += "\"uptimeMs\":" + String(millis()) + ",";
  json += "\"enabled\":true";
  json += "}";
  return json;
}

void handleTelemetry() {
  sendCorsHeaders();
  server.send(200, "application/json", telemetryJson());
}

void handleHealth() {
  sendCorsHeaders();
  String json = "{\"ok\":";
  json += (mpuReady && maxReady) ? "true" : "false";
  json += ",\"animalId\":\"" + String(ANIMAL_ID) + "\",";
  json += "\"mpuReady\":";
  json += mpuReady ? "true," : "false,";
  json += "\"maxReady\":";
  json += maxReady ? "true" : "false";
  json += "}";
  server.send(200, "application/json", json);
}

void handleOptions() {
  sendCorsHeaders();
  server.send(204);
}

void setupMpu6050() {
  writeRegister(0x6B, 0x00);
  delay(100);
  writeRegister(0x1C, 0x00);
  writeRegister(0x1B, 0x00);
  writeRegister(0x1A, 0x03);

  uint8_t whoAmI = readRegister(0x75);
  mpuReady = whoAmI == 0x68 || whoAmI == 0x70;
}

void setupMax30102() {
  maxReady = maxSensor.begin(maxWire, I2C_SPEED_FAST);
  if (!maxReady) return;

  byte ledBrightness = 0x2A;
  byte sampleAverage = 4;
  byte ledMode = 2;
  int sampleRate = 100;
  int pulseWidth = 411;
  int adcRange = 4096;

  maxSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
  maxSensor.setPulseAmplitudeRed(0x2A);
  maxSensor.setPulseAmplitudeIR(0x2A);
  maxSensor.setPulseAmplitudeGreen(0);
  maxSensor.enableDIETEMPRDY();
}

void setupSensors() {
  Wire.begin(MPU_SDA_PIN, MPU_SCL_PIN);
  Wire.setClock(400000);
  maxWire.begin(MAX_SDA_PIN, MAX_SCL_PIN);
  maxWire.setClock(400000);
  setupMpu6050();
  setupMax30102();
}

void setupServer() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);

  server.on("/", HTTP_GET, handleRoot);
  server.on("/telemetry", HTTP_GET, handleTelemetry);
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/telemetry", HTTP_OPTIONS, handleOptions);
  server.on("/health", HTTP_OPTIONS, handleOptions);
  server.begin();
}

void setup() {
  Serial.begin(115200);
  delay(300);
  setupSensors();
  setupServer();

  Serial.println();
  Serial.println("VitalBov ESP32 + MPU6050 + MAX30102");
  Serial.print("Animal vinculado: ");
  Serial.println(ANIMAL_ID);
  Serial.print("Wi-Fi AP: ");
  Serial.println(AP_SSID);
  Serial.println("Endpoint: http://192.168.4.1/telemetry");
}

void loop() {
  if (!mpuReady || !maxReady) {
    setupSensors();
    delay(250);
  }
  readMotionSensor();
  readVitalSensor();
  server.handleClient();
}
