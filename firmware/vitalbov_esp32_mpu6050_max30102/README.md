# Firmware VitalBov ESP32 + MPU6050 + MAX30102

Versao compacta do prototipo. Usa Bluetooth BLE para enviar os dados do MPU6050 e do MAX30102 ao app.

## Pinos

```text
ESP32 3V3 -> MPU6050 VCC/VIN
ESP32 GND -> MPU6050 GND
ESP32 GPIO 21 -> MPU6050 SDA
ESP32 GPIO 22 -> MPU6050 SCL

ESP32 3V3 -> MAX30102 VIN/VCC
ESP32 GND -> MAX30102 GND
ESP32 GPIO 2 / D2 -> MAX30102 SDA
ESP32 GPIO 4 / D4 -> MAX30102 SCL
```

O MPU6050 usa `Wire` e o MAX30102 usa `Wire1`. Os pinos `INT` nao sao usados.

## Bibliotecas

Instale na Arduino IDE:

```text
SparkFun MAX3010x Pulse and Proximity Sensor Library
NimBLE-Arduino
```

`Wire` ja vem com o pacote ESP32. Esta versao nao usa Wi-Fi, servidor web ou pagina HTML no ESP32, reduzindo bastante o uso de memoria.

## Gravar

Abra `vitalbov_esp32_mpu6050_max30102.ino`, selecione `ESP32 Dev Module`, escolha a porta COM e clique em Upload.

## Bluetooth BLE

```text
Nome: VitalBov-VB-219
Servico: 7b219000-9f52-4f1c-9b45-000000000001
Telemetria: 7b219001-9f52-4f1c-9b45-000000000002
```

No app HTTPS, abra `VB-219 - Estrela`, toque em `Conectar Bluetooth` e selecione `VitalBov-VB-219`. Use Chrome ou Edge com Web Bluetooth. Esta versao compacta nao cria mais a rede `192.168.4.1`.
