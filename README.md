# VitalBov

Aplicativo web mobile-first para monitoramento bio-comportamental de bovinos com Smart Ear Tag, criado para demonstracao da startup VitalBov em Colatina, Espirito Santo.

## Como executar

Abra `index.html` diretamente no navegador para visualizar o app estatico, ou rode o servidor local para habilitar service worker/PWA:

```bash
node dev-server.cjs
```

Depois acesse:

```text
http://127.0.0.1:4173
```

## Publicar no GitHub Pages

1. Crie um repositorio vazio no GitHub chamado `VitalBov`.
2. No terminal desta pasta, execute:

```bash
git remote add origin https://github.com/SEU_USUARIO/VitalBov.git
git branch -M main
git push -u origin main
```

3. No GitHub, abra `Settings > Pages`, escolha `Deploy from a branch`, selecione `main` e a pasta `/root`.
4. O app ficara acessivel no celular pelo link do GitHub Pages, normalmente:

```text
https://SEU_USUARIO.github.io/VitalBov/
```

## Estrutura

- `index.html`: telas, navegacao e estrutura semantica.
- `assets/css/styles.css`: identidade visual rural-tech, responsividade e modo escuro.
- `assets/js/data.js`: dados simulados de rebanho, loja, alertas e graficos.
- `assets/js/app.js`: estado persistente, onboarding, navegacao, Leaflet, filtros, cadastro, CSV, carrinho, graficos e offline simulado.
- `manifest.webmanifest` e `sw.js`: base para PWA e cache offline.
- `dev-server.cjs`: servidor local simples sem dependencias externas.

## Mapa

O mapa usa Leaflet 1.9.4 via CDN e centraliza os animais nas coordenadas da fazenda em Colatina. Se a biblioteca nao carregar, o app mostra um fallback local com os mesmos animais e status.
