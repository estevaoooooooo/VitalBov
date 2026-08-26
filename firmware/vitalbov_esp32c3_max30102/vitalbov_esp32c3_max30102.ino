#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <WebServer.h>
#include "MAX30105.h"
#include "heartRate.h"

// Prototipo habilitado somente para o primeiro animal cadastrado no app.
static const char *ANIMAL_ID = "VB-219";
static const char *DEVICE_ID = "VitalBov-C3-MAX30102-001";

static const char *AP_SSID = "VitalBov-VB-219";
static const char *AP_PASSWORD = "vitalbov219";

static const uint8_t I2C_SDA_PIN = 8;
static const uint8_t I2C_SCL_PIN = 9;
static const uint32_t SAMPLE_INTERVAL_MS = 20;

MAX30105 particleSensor;
WebServer server(80);

float bpm = 0.0f;
float bpmAverage = 0.0f;
float spo2Estimate = 0.0f;
float sensorTemperature = 0.0f;
uint32_t lastBeat = 0;
uint32_t lastSample = 0;
uint32_t samples = 0;
long lastIr = 0;
long lastRed = 0;
bool sensorReady = false;

void sendCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Access-Control-Allow-Private-Network", "true");
}

String telemetryJson() {
  String signal = lastIr > 50000 ? "Estavel" : "Fraco";
  String json = "{";
  json += "\"animalId\":\"" + String(ANIMAL_ID) + "\",";
  json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  json += "\"sensor\":\"MAX30102\",";
  json += "\"board\":\"ESP32-C3\",";
  json += "\"heartRate\":" + String(bpmAverage, 1) + ",";
  json += "\"spo2\":" + String(spo2Estimate, 1) + ",";
  json += "\"sensorTemperature\":" + String(sensorTemperature, 1) + ",";
  json += "\"ir\":" + String(lastIr) + ",";
  json += "\"red\":" + String(lastRed) + ",";
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
  json += sensorReady ? "true" : "false";
  json += ",\"animalId\":\"" + String(ANIMAL_ID) + "\"}";
  server.send(200, "application/json", json);
}

void handleOptions() {
  sendCorsHeaders();
  server.send(204);
}

void setupSensor() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    sensorReady = false;
    return;
  }

  byte ledBrightness = 0x2A;
  byte sampleAverage = 4;
  byte ledMode = 2;
  int sampleRate = 100;
  int pulseWidth = 411;
  int adcRange = 4096;

  particleSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
  particleSensor.setPulseAmplitudeRed(0x2A);
  particleSensor.setPulseAmplitudeIR(0x2A);
  particleSensor.setPulseAmplitudeGreen(0);
  particleSensor.enableDIETEMPRDY();
  sensorReady = true;
}

void setupServer() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);

  server.on("/telemetry", HTTP_GET, handleTelemetry);
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/telemetry", HTTP_OPTIONS, handleOptions);
  server.on("/health", HTTP_OPTIONS, handleOptions);
  server.begin();
}

void updateSpo2Estimate(long red, long ir) {
  if (red <= 0 || ir <= 0) return;
  float ratio = (float)red / (float)ir;
  float nextSpo2 = 110.0f - (25.0f * ratio);
  spo2Estimate = constrain(nextSpo2, 70.0f, 100.0f);
}

void readSensor() {
  if (!sensorReady || millis() - lastSample < SAMPLE_INTERVAL_MS) return;
  lastSample = millis();

  lastIr = particleSensor.getIR();
  lastRed = particleSensor.getRed();
  samples++;

  if (checkForBeat(lastIr)) {
    uint32_t now = millis();
    uint32_t delta = now - lastBeat;
    lastBeat = now;

    if (delta > 300 && delta < 2000) {
      bpm = 60000.0f / (float)delta;
      if (bpm > 30.0f && bpm < 220.0f) {
        bpmAverage = bpmAverage <= 0.1f ? bpm : (bpmAverage * 0.85f) + (bpm * 0.15f);
      }
    }
  }

  updateSpo2Estimate(lastRed, lastIr);

  if (samples % 250 == 0) {
    sensorTemperature = particleSensor.readTemperature();
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  setupSensor();
  setupServer();

  Serial.println();
  Serial.println("VitalBov ESP32-C3 + MAX30102");
  Serial.print("Animal vinculado: ");
  Serial.println(ANIMAL_ID);
  Serial.print("Wi-Fi AP: ");
  Serial.println(AP_SSID);
  Serial.println("Endpoint: http://192.168.4.1/telemetry");
}

void loop() {
  readSensor();
  server.handleClient();
}
