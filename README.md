<div align="center">

# 🎮 PokeMule Web Player (v2.0)

**Pokédex Interativa & Emulador Web Retrô de Alta Fidelidade**  
*Jogue Romhacks e clássicos de Game Boy Advance, Nintendo DS e Game Boy Color direto no navegador, sem instalar nada.*

[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Instal%C3%A1vel-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![EmulatorJS](https://img.shields.io/badge/Core-EmulatorJS%20RetroArch-ff5460)](https://emulatorjs.org/)
[![Cloud Sync](https://img.shields.io/badge/Google%20Drive-Sync%20Ativo-4285F4?logo=googledrive&logoColor=white)](https://developers.google.com/drive)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Recursos](#-recursos-principais) • [Início Rápido](#-in%C3%ADcio-r%C3%A1pido) • [Google Drive Sync](#-sincroniza%C3%A7%C3%A3o-com-google-drive) • [Wiki & Patcher](#-wiki--ferramentas) • [Aviso Legal](#-aviso-legal)

</div>

---

## 🌟 O que é o PokeMule?

O **PokeMule** é um emulador web progressivo (PWA) moderno e elegante, projetado com a estética nostálgica do **Game Boy Advance Índigo** e cartuchos físicos em relevo. 

Ele integra catálogos públicos de preservação digital e romhacks (**PokeBat.net** e **HackDex.app**), permitindo carregar, jogar, salvar e sincronizar o progresso entre múltiplos dispositivos (PC, iPhone/iOS e Android) com facilidade.

---

## ✨ Recursos Principais

### 🕹️ Emulação Multi-Sistema no Navegador
- **Game Boy Advance (GBA):** Núcleo de alta precisão via mGBA/VBA com suporte a som estéreo e cheats GameShark/CodeBreaker.
- **Nintendo DS (NDS):** Seletor de núcleo integrado entre **DeSmuME 2015** (leve, veloz, sem travamentos de CPU ou picotes de áudio) e **MelonDS** (alta precisão e toque virtual).
- **Game Boy / Game Boy Color (GB/GBC):** Núcleo estável com paletas de cores clássicas.
- **Layouts Customizáveis:** Telas NDS lado a lado, cima/baixo, modo moldura compacta ou tela cheia imersiva (100% da tela no celular).
- **Controle de Velocidade:** Slider de aceleração suave de **1x até 10x** (sempre iniciando travado em 1x e 60 FPS com áudio sincronizado).

### 📱 Experiência Mobile & Áudio iOS Perfeito
- **Instalável como App (PWA):** Instale direto na tela de início do iOS (Safari) ou Android (Chrome) para jogar sem barras de navegação.
- **Fix de Áudio no iOS/Safari:** Mecanismo exclusivo de bridge de áudio que contorna a limitação do Safari e a chave física de silenciador do iPhone, garantindo som contínuo e cristalino.
- **Touch Controls Nativos:** Controles virtuais na tela adaptados para telas touch e suporte automático a controles Bluetooth / USB (Xbox, PlayStation, 8BitDo).

### 💾 Saves 100% Client-Side + Nuvem Pessoal
- **Zero armazenamento no servidor:** Todos os seus dados ficam salvos com segurança no seu próprio navegador via **IndexedDB**.
- **Auto-Save de Bateria (.SRM / .SAV):** Salve direto no menu do jogo (`START` ➔ `SALVAR`) e o PokeMule detecta e grava automaticamente.
- **Save States com 4 Slots:** Congele o momento exato do jogo em até 4 slots por título.
- **☁️ Sincronização com Google Drive:** Conecte sua conta do Google Drive pessoal para fazer backup automático e continuar seu jogo em qualquer aparelho.

### 📚 Wiki Pokémon & Calculadora de Tipos (In-Game & Navbar)
- **Calculadora de Eficácia:** Matriz completa com os 18 tipos (incluindo Fada) e suporte a **Tipos Duplos**.
- **Indicadores Visuais:** 🔴 4x Fraqueza Extrema, 🟠 2x Fraqueza, ⚪ 1x Normal, 🟢 0.5x Resistência, 🔵 0.25x Super Resistência e ⛔ 0x Imunidade.
- **Guia de Evoluções por Troca:** Guia com sprites animados explicando como evoluir Pokémon como Kadabra, Haunter, Machoke, Scizor e Steelix em romhacks (*Link Stone / Cabo de Ligação*, itens ou nível).

### 🎴 Inspecionador de Saves & Cartão de Treinador GBA
- **Leitor de Bateria (.SRM):** Decodifica a equipe de 6 Pokémon de jogos de GBA (Gen 3) direto do save.
- **Canvas Retrô em Alta Resolução:** Gera um autêntico Cartão de Treinador clássico estilo GBA com 8 insígnias de ginásio, nomes, ID e sprites oficiais da PokeAPI.
- **Download em PNG:** Baixe seu cartão com 1 clique para compartilhar com amigos no Discord ou redes sociais!

### 🛠️ Patcher de ROMs no Próprio Navegador
- Aplique patches de romhack nos formatos **`.bps`** e **`.ips`** sem instalar programas externos.
- Processamento **100% local na memória RAM** — nenhuma ROM ou patch é enviado para servidores externos.
- Jogue instantaneamente na memória ou baixe a ROM patchada pronta.

---

## 🚀 Início Rápido

### Pré-requisitos
- [Node.js](https://nodejs.org/) versão 18.x ou superior
- [npm](https://www.npmjs.com/) (já incluso com o Node)

### 1. Clonar o repositório
```bash
git clone https://github.com/SEU-USUARIO/pokemule.git
cd pokemule
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Iniciar o servidor
```bash
npm start
```

Abra seu navegador em: **`http://localhost:3000`**

---

## ☁️ Sincronização com Google Drive

O PokeMule utiliza o fluxo oficial do **Google Identity Services (OAuth 2.0)** para que cada jogador sincronize saves na sua própria conta do Google Drive:

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um projeto (ex: *PokeMule Saves*).
3. Ative a **Google Drive API** na seção **APIs e Serviços**.
4. Crie uma credencial de **ID do Cliente OAuth** do tipo **Aplicativo da Web**.
5. Em **Origens JavaScript autorizadas**, adicione a URL onde seu PokeMule estiver rodando (ex: `http://localhost:3000` ou `https://seu-app.onrender.com`).
6. No PokeMule, clique em **☁️ Google Drive** e insira seu Client ID!

---

## 📂 Estrutura do Projeto

```plaintext
pokemule/
├── public/
│   ├── icon-192.png          # Ícone PWA (192x192)
│   ├── icon-512.png          # Ícone PWA (512x512)
│   ├── icon.svg              # Logo vetorial PokeMule
│   ├── index.html            # Interface principal, catálogo, estantes e modais
│   ├── manifest.json         # Manifesto PWA para instalação mobile
│   ├── player.html           # Frame do emulador com EmulatorJS e áudio iOS
│   ├── pokemon-wiki.js       # Calculadora de tipos 18x18 e guia de evoluções
│   ├── privacy.html          # Política de privacidade client-side
│   ├── rom-patcher.js        # Motor de patch .bps e .ips client-side
│   ├── save-manager.js       # Banco IndexedDB e sync com Google Drive
│   ├── sw.js                 # Service Worker PWA com cache offline
│   └── trainer-card.js       # Decodificador de save .SRM e canvas de Trainer Card
├── base_roms/                # Diretório opcional de ROMs base para patches
├── rom_cache/                # Cache temporário em disco no servidor
├── saves/                    # Backup local de saves (opcional)
├── package.json              # Configurações do projeto e dependências
├── server.js                 # Servidor Node.js (Proxy de catálogo e extração de ROMs)
└── README.md                 # Este documento
```

---

## 🌐 Deploy em Produção (Render, Railway, VPS)

O PokeMule foi desenvolvido para rodar com baixíssimo consumo de memória e é compatível com qualquer serviço Node.js moderno:

### Deploy no Render
1. Conecte seu repositório no [Render.com](https://render.com/).
2. Crie um novo **Web Service**.
3. Configure:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. Defina a variável de ambiente (opcional):
   - `PORT = 3000`

---

## 🛡️ Aviso Legal & Direitos Autorais

- **Não hospedamos ROMs:** Este projeto **NÃO** distribui, comercializa ou hospeda arquivos proprietários da Nintendo ou The Pokémon Company em seus repositórios. 
- Todo o catálogo é alimentado por APIs públicas de bibliotecas de preservação digital e arquivos fornecidos diretamente pelo próprio usuário.
- Pokémon e Game Boy são marcas registradas da **Nintendo Co., Ltd.**, **Creatures Inc.** e **GAME FREAK inc.**
- Este software é um projeto de código aberto sem fins lucrativos, criado com finalidade de estudo, preservação cultural e entretenimento entre amigos.

---

<div align="center">

Feito com paixão retrô por **Felipe** & comunidade Pokémon ⚡

</div>
