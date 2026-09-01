# Firmware VitalBov ESP32 + MPU6050 + MAX30102

Este e o firmware atual do prototipo.

Ele usa os dois sensores:

- `MPU6050`: movimento, balanceio e deteccao de possivel cio.
- `MAX30102`: batimentos e oxigenacao.

Animal vinculado:

```text
VB-219 - Estrela
```

## Ligacao dos pinos

Os sensores usam barramentos I2C separados no ESP32:

```text
ESP32 3V3  -> MPU6050 VCC/VIN
ESP32 GND  -> MPU6050 GND
ESP32 GPIO 21 -> MPU6050 SDA
ESP32 GPIO 22 -> MPU6050 SCL

ESP32 3V3  -> MAX30102 VIN/VCC
ESP32 GND  -> MAX30102 GND
ESP32 D2 / GPIO 2 -> MAX30102 SDA
ESP32 D4 / GPIO 4 -> MAX30102 SCL
```

No firmware, o MPU6050 usa `Wire` e o MAX30102 usa `Wire1`, por isso cada sensor fica em portas diferentes.

Se a sua placa nao tiver os nomes `D2` e `D4` impressos, use os pinos `GPIO 2` e `GPIO 4`.

Nao precisa ligar o pino `INT` de nenhum sensor neste firmware.

## Bibliotecas

Na Arduino IDE, instale:

```text
SparkFun MAX3010x Pulse and Proximity Sensor Library
```

As bibliotecas `Wire`, `WiFi` e `WebServer` ja vem com o pacote ESP32.

## Gravar na placa

Abra este arquivo na Arduino IDE:

```text
firmware\vitalbov_esp32_mpu6050_max30102\vitalbov_esp32_mpu6050_max30102.ino
```

Selecione uma placa ESP32 normal, por exemplo:

```text
ESP32 Dev Module
```

Depois selecione a porta COM e clique em upload/gravar.

## Wi-Fi criado pela placa

Depois de gravar, o ESP32 cria:

```text
SSID: VitalBov-VB-219
Senha: vitalbov219
IP: 192.168.4.1
```

O app le:

```text
GET http://192.168.4.1/telemetry
```

Ao abrir o animal `VB-219 - Estrela`, o app atualiza os dados a cada 3 segundos.
