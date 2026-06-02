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
- `assets/js/data.js`: dados iniciais de rebanho, loja, alertas e graficos.
- `assets/js/app.js`: IndexedDB, estado persistente, navegacao, Leaflet, filtros, cadastro, CSV, carrinho, pedidos, graficos e offline simulado.
- `manifest.webmanifest` e `sw.js`: base para PWA e cache offline.
- `dev-server.cjs`: servidor local simples sem dependencias externas.

## Banco de dados

O app usa IndexedDB como banco local no navegador, com fallback para `localStorage`. Isso permite funcionar no celular pelo GitHub Pages, inclusive offline, salvando animais, fotos dos animais, fazenda, notificacoes, carrinho, pedidos e eventos de auditoria.

Para um banco remoto compartilhado entre varios celulares/usuarios, conecte a camada de persistencia em `assets/js/app.js` a um backend como Firebase, Supabase ou uma API propria. GitHub Pages hospeda apenas arquivos estaticos, entao nao executa banco de dados de servidor.

## Mapa

O mapa usa Leaflet 1.9.4 via CDN e centraliza os animais nas coordenadas da fazenda em Colatina. Se a biblioteca nao carregar, o app mostra um fallback local com os mesmos animais e status.
