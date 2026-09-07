#include <Arduino.h>
#include <Wire.h>
#include <NimBLEDevice.h>
#include "MAX30105.h"
#include "heartRate.h"

// Firmware compacto: Bluetooth BLE + MPU6050 + MAX30102.
// O app recebe os dados pelo GitHub Pages em HTTPS.
static const char *ANIMAL_ID = "VB-219";
static const char *BLE_NAME = "VitalBov-VB-219";
static const char *BLE_SERVICE_UUID = "7b219000-9f52-4f1c-9b45-000000000001";
static const char *BLE_CHARACTERISTIC_UUID = "7b219001-9f52-4f1c-9b45-000000000002";

static const uint8_t MPU_SDA = 21;
static const uint8_t MPU_SCL = 22;
static const uint8_t MAX_SDA = 2;
static const uint8_t MAX_SCL = 4;
static const uint8_t MPU_ADDR = 0x68;
static const uint32_t BLE_INTERVAL = 3000;
static const uint32_t MOTION_INTERVAL = 50;
static const uint32_t VITAL_INTERVAL = 20;

TwoWire maxWire(1);
MAX30105 maxSensor;
NimBLEServer *bleServer = nullptr;
NimBLECharacteristic *bleTelemetry = nullptr;

bool mpuReady = false;
bool maxReady = false;
uint32_t lastMotion = 0;
uint32_t lastVital = 0;
uint32_t lastBle = 0;
uint32_t lastBeat = 0;

float ax = 0, ay = 0, az = 0;
float gx = 0, gy = 0, gz = 0;
float movement = 0, sway = 0, heat = 0;
float bpm = 0, spo2 = 0;
float oldAccel = 1, oldGyroZ = 0;
long ir = 0, red = 0;
bool heatDetected = false;

void writeMpu(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

uint8_t readMpu(uint8_t reg) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return 0;
  Wire.requestFrom(MPU_ADDR, (uint8_t)1);
  return Wire.available() ? Wire.read() : 0;
}

void setupMpu() {
  writeMpu(0x6B, 0x00);
  writeMpu(0x1C, 0x00);
  writeMpu(0x1B, 0x00);
  writeMpu(0x1A, 0x03);
  uint8_t id = readMpu(0x75);
  mpuReady = id == 0x68 || id == 0x70;
}

void setupMax() {
  maxReady = maxSensor.begin(maxWire, I2C_SPEED_FAST);
  if (!maxReady) return;
  maxSensor.setup(42, 4, 2, 100, 411, 4096);
  maxSensor.setPulseAmplitudeRed(42);
  maxSensor.setPulseAmplitudeIR(42);
  maxSensor.setPulseAmplitudeGreen(0);
  maxSensor.enableDIETEMPRDY();
}

void setupSensors() {
  Wire.begin(MPU_SDA, MPU_SCL);
  Wire.setClock(400000);
  maxWire.begin(MAX_SDA, MAX_SCL);
  maxWire.setClock(400000);
  setupMpu();
  setupMax();
}

void readMotion() {
  if (!mpuReady || millis() - lastMotion < MOTION_INTERVAL) return;
  lastMotion = millis();
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) { mpuReady = false; return; }
  Wire.requestFrom(MPU_ADDR, (uint8_t)14);
  if (Wire.available() < 14) { mpuReady = false; return; }

  int16_t rawAx = (Wire.read() << 8) | Wire.read();
  int16_t rawAy = (Wire.read() << 8) | Wire.read();
  int16_t rawAz = (Wire.read() << 8) | Wire.read();
  Wire.read(); Wire.read();
  int16_t rawGx = (Wire.read() << 8) | Wire.read();
  int16_t rawGy = (Wire.read() << 8) | Wire.read();
  int16_t rawGz = (Wire.read() << 8) | Wire.read();

  ax = rawAx / 16384.0f; ay = rawAy / 16384.0f; az = rawAz / 16384.0f;
  gx = rawGx / 131.0f; gy = rawGy / 131.0f; gz = rawGz / 131.0f;
  float accel = sqrt(ax * ax + ay * ay + az * az);
  float gyro = sqrt(gx * gx + gy * gy + gz * gz);
  float accelChange = fabs(accel - oldAccel);
  float swayChange = fabs(gz - oldGyroZ);
  oldAccel = accel;
  oldGyroZ = gz;

  float nextMovement = constrain(accelChange * 180.0f + gyro * 0.18f, 0.0f, 100.0f);
  float nextSway = constrain(swayChange * 0.8f, 0.0f, 100.0f);
  movement = movement * 0.82f + nextMovement * 0.18f;
  sway = sway * 0.80f + nextSway * 0.20f;
  heat = constrain(movement * 0.45f + sway * 0.55f, 0.0f, 100.0f);
  heatDetected = movement >= 58.0f && sway >= 62.0f;
}

void readVitals() {
  if (!maxReady || millis() - lastVital < VITAL_INTERVAL) return;
  lastVital = millis();
  ir = maxSensor.getIR();
  red = maxSensor.getRed();
  if (checkForBeat(ir)) {
    uint32_t now = millis();
    uint32_t delta = now - lastBeat;
    lastBeat = now;
    if (delta > 300 && delta < 2000) {
      float nextBpm = 60000.0f / delta;
      if (nextBpm > 30 && nextBpm < 220) bpm = bpm < 1 ? nextBpm : bpm * 0.85f + nextBpm * 0.15f;
    }
  }
  if (red > 0 && ir > 0) spo2 = constrain(110.0f - 25.0f * ((float)red / ir), 70.0f, 100.0f);
}

void notifyTelemetry() {
  if (!bleServer || bleServer->getConnectedCount() == 0 || !bleTelemetry) return;
  String json = "{\"a\":\"" + String(ANIMAL_ID) + "\",\"h\":" + String(bpm, 0);
  json += ",\"o\":" + String(spo2, 0) + ",\"m\":" + String(movement, 0);
  json += ",\"s\":" + String(sway, 0) + ",\"p\":" + String(heat, 0);
  json += ",\"c\":" + String(heatDetected ? 1 : 0);
  json += ",\"q\":" + String(mpuReady && maxReady ? 1 : 0) + "}\n";

  // Fragmentos de 18 bytes funcionam mesmo sem negociar MTU maior.
  for (size_t i = 0; i < json.length(); i += 18) {
    std::string part = json.substring(i, i + 18).c_str();
    bleTelemetry->setValue(part);
    bleTelemetry->notify();
    delay(8);
  }
}

void setupBluetooth() {
  NimBLEDevice::init(BLE_NAME);
  bleServer = NimBLEDevice::createServer();
  NimBLEService *service = bleServer->createService(BLE_SERVICE_UUID);
  bleTelemetry = service->createCharacteristic(
    BLE_CHARACTERISTIC_UUID,
    NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
  );
  bleTelemetry->setValue("{\"a\":\"VB-219\",\"q\":0}\n");
  service->start();
  NimBLEAdvertising *advertising = NimBLEDevice::getAdvertising();
  advertising->addServiceUUID(BLE_SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->start();
}

void setup() {
  Serial.begin(115200);
  delay(200);
  setupSensors();
  setupBluetooth();
  Serial.println("VitalBov BLE pronto: VitalBov-VB-219");
  Serial.println(mpuReady ? "MPU6050 OK" : "MPU6050 ausente");
  Serial.println(maxReady ? "MAX30102 OK" : "MAX30102 ausente");
}

void loop() {
  if (!mpuReady || !maxReady) {
    setupSensors();
    delay(200);
  }
  readMotion();
  readVitals();
  if (millis() - lastBle >= BLE_INTERVAL) {
    lastBle = millis();
    notifyTelemetry();
  }
}
