# Memoria do Projeto VitalBov

Este arquivo guarda o contexto principal do projeto VitalBov neste computador.

## Pasta do projeto

```text
C:\Users\Estevaoooooo\OneDrive\Documentos\VitalBov
```

## Repositorio GitHub

```text
https://github.com/estevaoooooooo/VitalBov
```

Site publicado:

```text
https://estevaoooooooo.github.io/VitalBov/
```

Quando o site parecer antigo por causa de cache, abrir com parametro de versao:

```text
https://estevaoooooooo.github.io/VitalBov/?v=72621bb
```

## O que o app faz

VitalBov e um app web mobile-first para monitoramento bio-comportamental de bovinos com Smart Ear Tag.

O app usa:

- `index.html`: estrutura das telas.
- `assets/css/styles.css`: visual e responsividade.
- `assets/js/data.js`: dados iniciais da fazenda, animais, loja e graficos.
- `assets/js/app.js`: navegacao, IndexedDB/localStorage, mapa, animais, carrinho, relatorios, notificacoes e telemetria.
- `sw.js`: service worker/PWA e cache offline.
- `manifest.webmanifest`: configuracao de instalacao PWA.
- `dev-server.cjs`: servidor local simples.

Para rodar localmente:

```bash
node dev-server.cjs
```

Depois abrir:

```text
http://127.0.0.1:4173
```

## Prototipo atual: ESP32 + MPU6050 + MAX30102

O projeto foi alterado para usar:

- Placa: ESP32 normal / ESP32 DevKit
- Sensor: MPU6050, com acelerometro e giroscopio
- Sensor: MAX30102, para batimentos e oxigenacao
- Animal vinculado: `VB-219 - Estrela`

O objetivo agora e juntar:

- movimento e balanceio para indicar possivel cio;
- batimentos e oxigenacao para sinais vitais.

Importante: o chip continua configurado para funcionar somente no primeiro animal do app, `VB-219`.

Arquivos do firmware atual:

```text
firmware\vitalbov_esp32_mpu6050_max30102\README.md
firmware\vitalbov_esp32_mpu6050_max30102\vitalbov_esp32_mpu6050_max30102.ino
```

A pasta antiga `firmware\vitalbov_esp32c3_max30102` ficou como historico da primeira versao. A versao intermediaria so com MPU6050 foi removida para evitar confusao.

## Ligacao dos pinos

Conectar os dois sensores em portas I2C diferentes no ESP32:

```text
MPU6050 VCC/VIN -> ESP32 3V3
MPU6050 GND     -> ESP32 GND
MPU6050 SDA     -> ESP32 GPIO 21
MPU6050 SCL     -> ESP32 GPIO 22

MAX30102 VIN/VCC -> ESP32 3V3
MAX30102 GND     -> ESP32 GND
MAX30102 SDA     -> ESP32 D2 / GPIO 2
MAX30102 SCL     -> ESP32 D4 / GPIO 4
```

Os pinos `INT` dos sensores nao sao necessarios para o firmware atual.

No codigo:

```cpp
static const uint8_t MPU_SDA_PIN = 21;
static const uint8_t MPU_SCL_PIN = 22;
static const uint8_t MAX_SDA_PIN = 2;
static const uint8_t MAX_SCL_PIN = 4;
```

## Codigo que precisa gravar na placa

Sim, precisa gravar codigo no ESP32.

Arquivo correto para abrir na Arduino IDE:

```text
C:\Users\Estevaoooooo\OneDrive\Documentos\VitalBov\firmware\vitalbov_esp32_mpu6050_max30102\vitalbov_esp32_mpu6050_max30102.ino
```

Bibliotecas usadas:

```text
Wire
WiFi
WebServer
SparkFun MAX3010x Pulse and Proximity Sensor Library
```

`Wire`, `WiFi` e `WebServer` vem com o pacote ESP32 da Arduino IDE. A biblioteca SparkFun e necessaria para o MAX30102.

## Rede criada pelo ESP32

Depois de gravar o firmware, o ESP32 cria uma rede Wi-Fi propria:

```text
SSID: VitalBov-VB-219
Senha: vitalbov219
IP: 192.168.4.1
```

Endpoints:

```text
GET http://192.168.4.1/
GET http://192.168.4.1/telemetry
GET http://192.168.4.1/health
```

Ao conectar no Wi-Fi `VitalBov-VB-219`, e normal o celular/computador ficar sem internet. Para testar os sensores sem depender do GitHub Pages, abrir `http://192.168.4.1/`. Essa pagina e servida pelo proprio ESP32 e mostra os dados em tempo real.

O JSON de `/telemetry` sempre envia:

```json
{
  "animalId": "VB-219",
  "deviceId": "VitalBov-ESP32-MPU6050-MAX30102-001",
  "sensor": "MPU6050 + MAX30102",
  "board": "ESP32",
  "heartRate": 72.0,
  "spo2": 97.0,
  "movementScore": 42.0,
  "swayScore": 28.0,
  "heatProbability": 18.0,
  "heatDetected": false
}
```

## Tempo real no app

Ao abrir o animal `VB-219 - Estrela`, o app observa o chip em tempo real.

Comportamento:

- O painel do chip aparece somente no animal `VB-219`.
- O app tenta ler `http://192.168.4.1/telemetry`.
- A leitura automatica acontece a cada 3 segundos enquanto o detalhe do animal estiver aberto.
- O botao `Ler chip agora` faz uma leitura manual.
- Se receber dados de outro `animalId`, o app ignora.
- O app mostra batimentos, oxigenacao, movimento, balanceio, probabilidade de cio e status do cio.

## Commits importantes

```text
de8b20c Add ESP32-C3 MAX30102 prototype firmware
bf35096 Refresh service worker cache strategy
f4c5abd Show active chip status on dashboard
b79c108 Add realtime chip telemetry polling
72621bb Allow browser access to chip telemetry
```

## Observacoes importantes

- O app salva dados no navegador usando IndexedDB/localStorage.
- Se o site parecer antigo, pode ser cache do PWA.
- O `sw.js` foi atualizado para buscar primeiro da rede e manter cache offline como fallback.
- Arquivo `aniversario_julia_2.html` existe na pasta, mas nao faz parte do VitalBov e foi deixado fora dos commits anteriores.

## Proximos passos provaveis

1. Conectar o ESP32 no computador via USB.
2. Abrir o `.ino` na Arduino IDE.
3. Selecionar placa ESP32 Dev Module e porta COM.
4. Gravar o firmware.
5. Conectar o celular no Wi-Fi `VitalBov-VB-219`.
6. Abrir o app e entrar no animal `VB-219 - Estrela`.
7. Conferir movimento, balanceio e probabilidade de cio em tempo real.
