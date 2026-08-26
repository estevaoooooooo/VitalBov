# Firmware VitalBov ESP32-C3 + MAX30102

Este firmware vincula o prototipo somente ao primeiro animal do app:

```text
VB-219 - Estrela
```

## Hardware

- ESP32-C3
- Sensor MAX30102 via I2C
- SDA no GPIO 8
- SCL no GPIO 9
- Alimentacao do MAX30102 em 3V3
- GND comum

Se sua placa ESP32-C3 usar outros pinos I2C, altere `I2C_SDA_PIN` e `I2C_SCL_PIN` no arquivo `.ino`.

## Bibliotecas da Arduino IDE

Instale:

- `SparkFun MAX3010x Pulse and Proximity Sensor Library`
- `WiFi`, `WebServer` e `Wire` ja vem com o core ESP32

Selecione uma placa ESP32-C3 na Arduino IDE e grave `vitalbov_esp32c3_max30102.ino`.

## Gravar na placa

Sim, precisa passar codigo para a placa. O arquivo que deve ser gravado no ESP32-C3 e:

```text
firmware/vitalbov_esp32c3_max30102/vitalbov_esp32c3_max30102.ino
```

Passos:

1. Abra a Arduino IDE.
2. Instale o pacote de placas ESP32.
3. Instale a biblioteca `SparkFun MAX3010x Pulse and Proximity Sensor Library`.
4. Abra `vitalbov_esp32c3_max30102.ino`.
5. Selecione sua placa ESP32-C3 e a porta USB.
6. Clique em upload/gravar.

## Wi-Fi

Por padrao o chip cria uma rede propria:

```text
SSID: VitalBov-VB-219
Senha: vitalbov219
IP: 192.168.4.1
```

Endpoints:

```text
GET /telemetry
GET /health
```

O JSON de `/telemetry` sempre envia `animalId: "VB-219"`, impedindo que o prototipo seja associado aos outros animais do app.
