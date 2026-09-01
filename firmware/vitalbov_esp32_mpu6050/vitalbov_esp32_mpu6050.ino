#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <WebServer.h>

// Prototipo habilitado somente para o primeiro animal cadastrado no app.
static const char *ANIMAL_ID = "VB-219";
static const char *DEVICE_ID = "VitalBov-ESP32-MPU6050-001";

static const char *AP_SSID = "VitalBov-VB-219";
static const char *AP_PASSWORD = "vitalbov219";

static const uint8_t I2C_SDA_PIN = 21;
static const uint8_t I2C_SCL_PIN = 22;
static const uint8_t MPU6050_ADDR = 0x68;

static const uint32_t SAMPLE_INTERVAL_MS = 50;
static const float SWAY_HEAT_THRESHOLD = 62.0f;
static const float MOVEMENT_HEAT_THRESHOLD = 58.0f;

WebServer server(80);

bool sensorReady = false;
uint32_t lastSample = 0;
uint32_t samples = 0;

float accelX = 0.0f;
float accelY = 0.0f;
float accelZ = 0.0f;
float gyroX = 0.0f;
float gyroY = 0.0f;
float gyroZ = 0.0f;
float sensorTemperature = 0.0f;
float movementScore = 0.0f;
float swayScore = 0.0f;
float heatProbability = 0.0f;
bool heatDetected = false;

float lastAccelMagnitude = 1.0f;
float lastGyroZ = 0.0f;

void writeRegister(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

int16_t readWord(uint8_t reg) {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU6050_ADDR, (uint8_t)2);

  if (Wire.available() < 2) return 0;
  return (int16_t)((Wire.read() << 8) | Wire.read());
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
  sensorTemperature = (rawTemp / 340.0f) + 36.53f;

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

  float movementPart = movementScore * 0.45f;
  float swayPart = swayScore * 0.55f;
  heatProbability = constrain(movementPart + swayPart, 0.0f, 100.0f);
  heatDetected = swayScore >= SWAY_HEAT_THRESHOLD && movementScore >= MOVEMENT_HEAT_THRESHOLD;
}

void readSensor() {
  if (!sensorReady || millis() - lastSample < SAMPLE_INTERVAL_MS) return;
  lastSample = millis();

  if (readMpu6050()) {
    samples++;
    updateBehaviorScores();
  } else {
    sensorReady = false;
  }
}

void sendCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Access-Control-Allow-Private-Network", "true");
}

String telemetryJson() {
  String signal = sensorReady ? "Estavel" : "Sensor ausente";
  String json = "{";
  json += "\"animalId\":\"" + String(ANIMAL_ID) + "\",";
  json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  json += "\"sensor\":\"MPU6050\",";
  json += "\"board\":\"ESP32\",";
  json += "\"movementScore\":" + String(movementScore, 1) + ",";
  json += "\"swayScore\":" + String(swayScore, 1) + ",";
  json += "\"heatProbability\":" + String(heatProbability, 1) + ",";
  json += "\"heatDetected\":";
  json += heatDetected ? "true," : "false,";
  json += "\"accelX\":" + String(accelX, 3) + ",";
  json += "\"accelY\":" + String(accelY, 3) + ",";
  json += "\"accelZ\":" + String(accelZ, 3) + ",";
  json += "\"gyroX\":" + String(gyroX, 2) + ",";
  json += "\"gyroY\":" + String(gyroY, 2) + ",";
  json += "\"gyroZ\":" + String(gyroZ, 2) + ",";
  json += "\"sensorTemperature\":" + String(sensorTemperature, 1) + ",";
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
  Wire.setClock(400000);

  writeRegister(0x6B, 0x00); // Wake up MPU6050.
  delay(100);
  writeRegister(0x1C, 0x00); // Accelerometer +/- 2g.
  writeRegister(0x1B, 0x00); // Gyroscope +/- 250 deg/s.
  writeRegister(0x1A, 0x03); // Low-pass filter.

  uint8_t whoAmI = readRegister(0x75);
  sensorReady = whoAmI == 0x68 || whoAmI == 0x70;
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

void setup() {
  Serial.begin(115200);
  delay(300);
  setupSensor();
  setupServer();

  Serial.println();
  Serial.println("VitalBov ESP32 + MPU6050");
  Serial.print("Animal vinculado: ");
  Serial.println(ANIMAL_ID);
  Serial.print("Wi-Fi AP: ");
  Serial.println(AP_SSID);
  Serial.println("Endpoint: http://192.168.4.1/telemetry");
}

void loop() {
  if (!sensorReady) {
    setupSensor();
    delay(250);
  }
  readSensor();
  server.handleClient();
}
