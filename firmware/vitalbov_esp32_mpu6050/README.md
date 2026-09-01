# Firmware VitalBov ESP32 + MPU6050

Este e o firmware novo para o prototipo com ESP32 normal e sensor de movimento MPU6050.

Animal vinculado:

```text
VB-219 - Estrela
```

O app usa os dados de movimento e balanceio para indicar possivel cio.

## Pecas

- ESP32 DevKit comum
- Sensor MPU6050, que possui acelerometro e giroscopio
- Cabos jumper

## Ligacao dos pinos

Use I2C:

```text
MPU6050 VCC -> ESP32 3V3
MPU6050 GND -> ESP32 GND
MPU6050 SDA -> ESP32 GPIO 21
MPU6050 SCL -> ESP32 GPIO 22
```

Na maioria das placas ESP32 DevKit, `GPIO 21` e `GPIO 22` sao os pinos padrao do I2C.

O pino `INT` do MPU6050 nao precisa ser conectado para este firmware.

## Codigo para gravar

Abra este arquivo na Arduino IDE:

```text
firmware\vitalbov_esp32_mpu6050\vitalbov_esp32_mpu6050.ino
```

Bibliotecas usadas:

- `Wire`
- `WiFi`
- `WebServer`

Essas bibliotecas ja vem com o pacote ESP32 da Arduino IDE. Nao precisa instalar biblioteca extra do MPU6050, porque o firmware le os registradores do sensor diretamente.

## Wi-Fi criado pela placa

Depois de gravar, o ESP32 cria:

```text
SSID: VitalBov-VB-219
Senha: vitalbov219
IP: 192.168.4.1
```

Endpoints:

```text
GET http://192.168.4.1/telemetry
GET http://192.168.4.1/health
```

## Como usar no app

1. Grave o firmware no ESP32.
2. Conecte o celular no Wi-Fi `VitalBov-VB-219`.
3. Abra o app VitalBov.
4. Entre no animal `VB-219 - Estrela`.
5. O app atualiza movimento, balanceio e probabilidade de cio a cada 3 segundos.

## Ajuste de sensibilidade

No arquivo `.ino`, estes valores controlam a deteccao:

```cpp
static const float SWAY_HEAT_THRESHOLD = 62.0f;
static const float MOVEMENT_HEAT_THRESHOLD = 58.0f;
```

Se estiver detectando cio sem necessidade, aumente os valores. Se estiver pouco sensivel, diminua um pouco.
