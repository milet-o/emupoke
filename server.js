const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFile, spawn } = require('child_process');
const { URL } = require('url');

let ngrok;
try {
  ngrok = require('@ngrok/ngrok');
} catch (_) {}

const PORT = process.env.PORT || 3000;
const NGROK_AUTHTOKEN = process.env.NGROK_AUTHTOKEN || '3IscPmrJGEr1JvCKtkQWo0RW6bl_3K6qCGtyEMbVhmMcLdd4h';
const NGROK_DOMAIN = process.env.NGROK_DOMAIN || 'tribute-gents-devotion.ngrok-free.dev';
let activeNgrokUrl = `https://${NGROK_DOMAIN}`;

const CACHE_DIR = path.join(__dirname, 'rom_cache');
const SAVES_DIR = path.join(__dirname, 'saves');
const BASE_ROMS_DIR = path.join(__dirname, 'base_roms');
const SAVES_META_FILE = path.join(SAVES_DIR, 'metadata.json');

for (const dir of [CACHE_DIR, SAVES_DIR, BASE_ROMS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Configurações da API Oficial do HackDex.app (Supabase + Covers CDN)
const HACKDEX_SUPABASE_URL = 'https://scfxbqapigdjfebqwmoj.supabase.co';
const HACKDEX_SUPABASE_KEY = 'sb_publishable_AifbMDlFZnQ8Enf9uBvGaQ_1IiSAfuY';
const HACKDEX_COVERS_CDN = 'https://images.hackdex.app';
const HACKDEX_NEXT_ACTION_SIGNED_URL = '60aab9bfeffdf7c6f7198dc098ad61f5f058b9d400';

// Mirrors verificados por SHA-1 no Archive.org para baixar as ROMs Base limpas automaticamente no 1º uso do Auto-Patcher do HackDex
const BASE_ROM_AUTO_MIRRORS = {
  poke_emerald: {
    name: 'Pokémon Emerald (USA, Europe)',
    ext: '.gba',
    console: 'GBA',
    url: 'https://archive.org/download/pokemon-emerald-version-u_202303/Pokemon%20-%20Emerald%20Version%20%28U%29.gba'
  },
  poke_firered: {
    name: 'Pokémon FireRed (Rev 0 - Squirrels)',
    ext: '.gba',
    console: 'GBA',
    url: 'https://archive.org/download/1636-pokemon-fire-red-u-squirrels_202209/1636%20-%20Pokemon%20Fire%20Red%20(U)(Squirrels).gba'
  },
  poke_firered_rev1: {
    name: 'Pokémon FireRed (Rev 1)',
    ext: '.gba',
    console: 'GBA',
    url: 'https://archive.org/download/pokemon-fire-red-version-usa-europe-rev-1_202601/Pokemon%20-%20FireRed%20Version%20(USA%2C%20Europe)%20(Rev%201).gba'
  },
  poke_crystal: {
    name: 'Pokémon Crystal (Rev 0)',
    ext: '.gbc',
    console: 'GBC',
    url: 'https://archive.org/download/pokemon-crystal-usa-europe/Pokemon%20Crystal%20(USA%2C%20Europe).gbc'
  },
  poke_crystal_rev1: {
    name: 'Pokémon Crystal (Rev 1)',
    ext: '.gbc',
    console: 'GBC',
    url: 'https://archive.org/download/pokemon-red-blue-yellow-usa-europe-game-boy/Pokemon%20-%20Crystal%20Version%20(USA%2C%20Europe)%20(Rev%201).gbc'
  },
  poke_gold: {
    name: 'Pokémon Gold (USA, Europe)',
    ext: '.gbc',
    console: 'GBC',
    url: 'https://archive.org/download/pokemon-red-blue-yellow-usa-europe-game-boy/Pokemon%20-%20Gold%20Version%20(USA%2C%20Europe)%20(SGB%20Enhanced).gbc'
  },
  poke_silver: {
    name: 'Pokémon Silver (USA, Europe)',
    ext: '.gbc',
    console: 'GBC',
    url: 'https://archive.org/download/pokemon-red-blue-yellow-usa-europe-game-boy/Pokemon%20-%20Silver%20Version%20(USA%2C%20Europe)%20(SGB%20Enhanced).gbc'
  },
  poke_red: {
    name: 'Pokémon Red (USA, Europe)',
    ext: '.gb',
    console: 'GBC',
    url: 'https://archive.org/download/pokemon-red-blue-yellow-usa-europe-game-boy/Pokemon%20-%20Red%20Version%20(USA%2C%20Europe)%20(SGB%20Enhanced).gb'
  },
  poke_blue: {
    name: 'Pokémon Blue (USA, Europe)',
    ext: '.gb',
    console: 'GBC',
    url: 'https://archive.org/download/pokemon-red-blue-yellow-usa-europe-game-boy/Pokemon%20-%20Blue%20Version%20(USA%2C%20Europe)%20(SGB%20Enhanced).gb'
  },
  poke_yellow: {
    name: 'Pokémon Yellow (USA, Europe)',
    ext: '.gbc',
    console: 'GBC',
    url: 'https://archive.org/download/pokemon-red-blue-yellow-usa-europe-game-boy/Pokemon%20-%20Yellow%20Version%20-%20Special%20Pikachu%20Edition%20(USA%2C%20Europe)%20(CGB%2BSGB%20Enhanced).gbc'
  }
};

// Cache em memória das páginas de API (PokeBat e HackDex)
const apiPageCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

// Catálogo base de destaques do PokeBat.net (PT-BR & Inglês, GBA & NDS)
const FEATURED_GAMES = [
  {
    id: 'firered-ptbr-2026',
    title: 'Pokémon FireRed (PT-BR v1.1 - Sem Bugs)',
    subtitle: 'Tradução 100% Completa 2026 (Breno)',
    console: 'GBA',
    language: 'PT-BR',
    baseRom: 'firered',
    cover: 'https://pokebat.net/wp-content/uploads/2026/05/wmremove-transformed-816x455.jpg',
    postUrl: 'https://pokebat.net/2026/05/gba-pokemon-firered-leafgreen-traducao-portugues-pt-br-2026-sem-bugs.html',
    downloadPageUrl: 'https://tinyurl.com/4z87xyy8',
    description: 'Tradução de Pokémon Vermelho-Fogo revisada, com acentos, gênero feminino completo e Bilhetes Aurora/Místico liberados.'
  },
  {
    id: 'leafgreen-ptbr-2026',
    title: 'Pokémon LeafGreen (PT-BR v1.1 - Sem Bugs)',
    subtitle: 'Tradução 100% Completa 2026 (Breno)',
    console: 'GBA',
    language: 'PT-BR',
    baseRom: 'firered',
    cover: 'https://pokebat.net/wp-content/uploads/2021/10/220px-Pokemon_LeafGreen_box.jpg',
    postUrl: 'https://pokebat.net/2026/05/gba-pokemon-firered-leafgreen-traducao-portugues-pt-br-2026-sem-bugs.html',
    downloadPageUrl: 'https://tinyurl.com/mv73jrk4',
    description: 'Tradução de Pokémon Verde-Folha 100% completa, revisada e sem bugs.'
  },
  {
    id: 'emerald-seaglass-ptbr',
    title: 'Pokémon Emerald Seaglass v3.0 [PT-BR]',
    subtitle: 'Emerald com gráficos estilo GBC + 1ª a 3ª Gen',
    console: 'GBA',
    language: 'PT-BR',
    baseRom: 'emerald',
    cover: 'https://pokebat.net/wp-content/uploads/2026/10/Pokemon-Emerald-Seaglass-Portugues-PT-BR-cover-gba-816x816.jpg',
    postUrl: 'https://pokebat.net/2026/10/pokemon-emerald-seaglass-portugues-pt-br.html',
    downloadPageUrl: 'https://tinyurl.com/2vfzf6pk',
    description: 'Revisão visual completa do Pokémon Emerald com Pokémon seguindo o jogador, sistema de batalha moderno e tradução PT-BR.'
  },
  {
    id: 'pokemon-unbound-en',
    title: 'Pokémon Unbound v2.1.1.1 [Completo]',
    subtitle: 'A Hack ROM mais famosa de GBA (1ª a 8ª Gen)',
    console: 'GBA',
    language: 'Inglês',
    baseRom: 'firered',
    cover: 'https://pokebat.net/wp-content/uploads/2021/12/unbound-2022.jpg',
    postUrl: 'https://pokebat.net/2022/11/pokemon-unbound-1131-completo.html',
    downloadPageUrl: 'https://tinyurl.com/2tz2arh7',
    description: 'Explore a Região de Borrius com gráficos customizados, missões, Mega Evolução, Pokémon até a 8ª Geração e trilha sonora própria.'
  },
  {
    id: 'pokemon-quetzal-en',
    title: 'Pokémon Quetzal Alpha 0.9.0 (Att 2026)',
    subtitle: 'Emerald com Following Pokémon, 1ª a 9ª Gen & Mega/Z-Move',
    console: 'GBA',
    language: 'Inglês',
    baseRom: 'emerald',
    cover: 'https://pokebat.net/wp-content/uploads/2022/07/EMERALD-MULTI-quetzal-816x544.jpg',
    postUrl: 'https://pokebat.net/2026/10/pokemon-quetzal-multiplayer.html',
    downloadPageUrl: 'https://tinyurl.com/c3whb538',
    description: 'Mod de Pokémon Emerald com Pokémon seguindo você no mapa, formas Alola/Galar/Hisui/Paldea, Shinies visíveis e Mega Evolução.'
  },
  {
    id: 'pokemon-azoth-mercury-en',
    title: 'Pokémon Azoth / Mercury v1.3.3 [English]',
    subtitle: 'Remake de Johto (HGSS) no GBA com gráficos estilo NDS',
    console: 'GBA',
    language: 'Inglês',
    baseRom: 'emerald',
    cover: 'https://pokebat.net/wp-content/uploads/2026/10/Gemini_Generated_Image_d1c8ujd1c8ujd1c8a-816x816.jpg',
    postUrl: 'https://pokebat.net/2026/10/pokemon-azoth-english-translation.html',
    downloadPageUrl: 'https://tinyurl.com/48p47pz5',
    description: 'Aclamado romhack que recria Johto com gráficos estilo DS, 97 sidequests, Pokémon até a 9ª Gen, Mega Evolução e Dynamax.'
  },
  {
    id: 'pokemon-memories-ptbr',
    title: 'Pokémon Memories (Tradução PT-BR)',
    subtitle: 'Base FireRed com Pokémon até 9ª Geração',
    console: 'GBA',
    language: 'PT-BR',
    baseRom: 'firered',
    cover: 'https://pokebat.net/wp-content/uploads/2026/10/Gemini_Generated_Image_7ja2s77ja2s77ja2a-816x816.jpg',
    postUrl: 'https://pokebat.net/2026/10/pokemon-memories-traducao-portugues-pt-br.html',
    downloadPageUrl: 'https://tinyurl.com/mr2ppumj',
    description: 'Hack ROM baseada em Fire Red com Pokémon até a 9ª Geração, 377 novos golpes e tradução PT-BR completa.'
  },
  {
    id: 'dark-worship-ptbr',
    title: 'Pokémon Super Dark Worship v3.0 [PT-BR]',
    subtitle: 'História Nova + Mega Evolução, Z-Moves e Dynamax',
    console: 'GBA',
    language: 'PT-BR',
    baseRom: 'firered',
    cover: 'https://pokebat.net/wp-content/uploads/2024/05/super-DARKWORKSHIP-new-2024-816x459.jpg',
    postUrl: 'https://pokebat.net/2024/05/pokemon-darkworship-version.html',
    downloadPageUrl: 'https://tinyurl.com/33m3m4su',
    description: 'Uma das Hack ROMs brasileiras mais jogadas do PokeBat. Nova região de Seafood, Pokémon até Hisui, Puzzles e Mega Evolução.'
  },
  {
    id: 'blue-stars-4-ptbr',
    title: 'Pokémon Blue Stars 4 [PT-BR]',
    subtitle: 'Região de Shinstar + 1ª a 8ª Gen + Hisui',
    console: 'GBA',
    language: 'PT-BR',
    baseRom: 'firered',
    cover: 'https://pokebat.net/wp-content/uploads/2024/03/blue-stars-4-cover-pokemona.jpg',
    postUrl: 'https://pokebat.net/2024/03/pokemon-blue-stars-4-pt-br.html',
    downloadPageUrl: 'https://tinyurl.com/5dp3zcrz',
    description: 'Explore a Região de Shinstar com novos gráficos, iniciais Chikorita, Fennekin e Oshawott, Dynamax e Mega Evolução.'
  },
  {
    id: 'azul-agua-ptbr',
    title: 'Pokémon Azul Água (WaterBlue) [PT-BR]',
    subtitle: 'Remasterização de Kanto com Novos Eventos',
    console: 'GBA',
    language: 'PT-BR',
    baseRom: 'firered',
    cover: 'https://pokebat.net/wp-content/uploads/2026/04/Gemini_Generated_Image_cre6u5cre6u5cre6.jpg',
    postUrl: 'https://pokebat.net/2026/04/pokemon-azul-agua.html',
    downloadPageUrl: 'https://tinyurl.com/3ssujabk',
    description: 'Bela remasterização que reinterpreta Kanto com nova atmosfera, cenários atualizados e Pokémon de Kanto e Johto.'
  },
  {
    id: 'origin-heartgold-nds',
    title: 'Pokémon Origin HeartGold [NDS]',
    subtitle: 'Nintendo DS • 777 Pokémon até 9ª Gen + Mega Evolução',
    console: 'NDS',
    language: 'Inglês',
    baseRom: 'hgss',
    cover: 'https://pokebat.net/wp-content/uploads/2026/09/english-translation-for-pokemon-origin-heartgold-Phill_408.webp',
    postUrl: 'https://pokebat.net/2026/09/pokemon-origin-heartgold-nds.html',
    downloadPageUrl: 'https://tinyurl.com/2w5z6nxk',
    description: 'Hack ROM ambiciosa de Nintendo DS baseada em HeartGold com história inspirada no mangá, Pokémon no Overworld e 9ª Geração.'
  }
];

// Banco de Cheats curados (GameShark / CodeBreaker / Action Replay)
const CHEATS_DB = {
  firered: {
    baseName: 'Pokémon FireRed / LeafGreen & Hacks Base FireRed (GBA)',
    cheats: [
      {
        title: '🍬 Rare Candy Infinito (No PC do Jogador)',
        type: 'CodeBreaker / GameShark',
        code: '82025840 0044',
        note: 'Ative o código, vá ao seu PC no Centro Pokémon -> Retirar Item -> Retire quantos Rare Candies quiser.'
      },
      {
        title: '🟣 Master Ball no PC',
        type: 'CodeBreaker',
        code: '82025840 0001',
        note: 'Retire pelo PC do Jogador (Item Storage -> Withdraw Item).'
      },
      {
        title: '👻 Atravessar Paredes (Walk Through Walls)',
        type: 'GameShark v3',
        code: '509197D3 542975F4\n78DA95DF 44018CB4',
        note: 'Desative antes de salvar o jogo para evitar ficar preso em paredes.'
      },
      {
        title: '💰 Dinheiro Infinito / Compras Grátis no PokéMart',
        type: 'CodeBreaker',
        code: '82003884 0000',
        note: 'Todos os itens no PokéMart custam $0 enquanto ativo.'
      },
      {
        title: '✨ Encontrar Pokémon Shiny (Selvagens)',
        type: 'GameShark v3',
        code: '1670047D 04815C68\n18452A7D DDE55BCC',
        note: 'Pode alterar o nome/natureza em algumas Hack ROMs modificadas (CFRU).'
      },
      {
        title: '⚡ XP Rápido em Batalha (5000 EXP)',
        type: 'CodeBreaker',
        code: '74000130 027D\n82023D50 1388',
        note: 'Segure L + R ao derrotar um Pokémon.'
      }
    ]
  },
  emerald: {
    baseName: 'Pokémon Emerald & Hacks Base Emerald (GBA)',
    cheats: [
      {
        title: '🍬 Rare Candy Infinito (No PC do Jogador)',
        type: 'GameShark / CodeBreaker',
        code: 'BFF956FA 2F9EC50D',
        note: 'Retire pelo PC do Jogador no quarto inicial ou Centro Pokémon.'
      },
      {
        title: '🟣 Master Ball no PokéMart / PC',
        type: 'GameShark',
        code: '128898B6 EDA43037',
        note: 'Disponibiliza Master Ball para retirada no PC.'
      },
      {
        title: '👻 Atravessar Paredes (Walk Through Walls)',
        type: 'GameShark v3',
        code: '7881A409 E2026E0C\n8E883EFF 92E9660D',
        note: 'Permite caminhar sobre obstáculos, árvores e água.'
      },
      {
        title: '💰 Dinheiro Máximo ($999.999)',
        type: 'CodeBreaker',
        code: 'C84AB3C0 F798A2B5\nE12402B9 C4D8E055',
        note: 'Maximiza o dinheiro do treinador.'
      },
      {
        title: '✨ Pokémon Selvagens Shiny',
        type: 'GameShark',
        code: 'F3A9A86D 4E2629B4\n18452A7D DDE55BCC',
        note: 'Todos os encontros selvagens brilham como Shiny.'
      }
    ]
  },
  nds: {
    baseName: 'Pokémon Nintendo DS (HeartGold/SoulSilver, Platinum, Black/White 2)',
    cheats: [
      {
        title: '🍬 900x Rare Candies + Todos os Remédios (HG/SS)',
        type: 'Action Replay DS',
        code: '94000130 FCFF0000\n62111880 00000000\nB2111880 00000000\nD5000000 03840011\nC0000000 00000026\nD6000000 00000B74\nD4000000 00000001\nD2000000 00000000',
        note: 'Pressione L + R no jogo para preencher a bolsa de remédios.'
      },
      {
        title: '🟣 900x Todas as Pokébolas / Master Ball (HG/SS)',
        type: 'Action Replay DS',
        code: '94000130 FCFF0000\n62111880 00000000\nB2111880 00000000\nD5000000 03840001\nC0000000 0000000F\nD6000000 00000D14\nD4000000 00000001\nD2000000 00000000',
        note: 'Pressione L + R durante o jogo.'
      },
      {
        title: '👻 Atravessar Paredes (Segure R ao andar - HG/SS)',
        type: 'Action Replay DS',
        code: '94000130 FEFF0000\n1205DAA2 00000200\nD2000000 00000000\n94000130 FEFF0100\n1205DAA2 00001C20\nD2000000 00000000',
        note: 'Mantenha o botão R pressionado enquanto anda para atravessar obstáculos.'
      },
      {
        title: '⚡ Multiplicador de EXP 16x (Black 2 / White 2)',
        type: 'Action Replay DS',
        code: '521CB54C 59C8437E\n023AE800 59C8437E\n023AE804 01000000\n023AE808 47700000\n021CB54C F9F3F1E3\nD2000000 00000000',
        note: 'Multiplica toda a experiência ganha em batalhas por 16x.'
      }
    ]
  }
};

function stripHtml(html) {
  return (html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&#8211;/g, '–')
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Gerenciamento de Metadados do Cofre de Saves Local (saves/metadata.json)
 */
function loadSavesMetadata() {
  try {
    if (fs.existsSync(SAVES_META_FILE)) {
      return JSON.parse(fs.readFileSync(SAVES_META_FILE, 'utf-8'));
    }
  } catch (_) {}
  return {};
}

function saveSavesMetadata(meta) {
  try {
    fs.writeFileSync(SAVES_META_FILE, JSON.stringify(meta, null, 2), 'utf-8');
  } catch (e) {
    console.error('[SAVES META ERROR]', e.message);
  }
}

function getGameSaveInfo(gameId) {
  const safeId = (gameId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) return { hasSrm: false, hasState: false };
  const srmPath = path.join(SAVES_DIR, `${safeId}.srm`);
  const statePath = path.join(SAVES_DIR, `${safeId}.state`);
  const hasSrm = fs.existsSync(srmPath);
  const hasState = fs.existsSync(statePath);
  let updatedAt = null;
  if (hasSrm) updatedAt = fs.statSync(srmPath).mtime.toISOString();
  else if (hasState) updatedAt = fs.statSync(statePath).mtime.toISOString();
  return { hasSrm, hasState, updatedAt };
}

/**
 * Aplicador nativo de patches .BPS (Beat Patching System) em Node.js puro
 * Usado para transformar instantaneamente os arquivos .bps do HackDex.app em ROMs .gba / .gbc prontas para rodar!
 */
function applyBpsPatchBuffer(source, patch) {
  if (patch.slice(0, 4).toString('ascii') !== 'BPS1') {
    throw new Error('O arquivo baixado não possui cabeçalho BPS1 válido.');
  }

  let ptr = 4;
  function readVLV() {
    let data = 0;
    let shift = 1;
    while (true) {
      const x = patch[ptr++];
      data += (x & 0x7f) * shift;
      if (x & 0x80) break;
      shift *= 128;
      data += shift;
    }
    return data;
  }

  const sourceSize = readVLV();
  const targetSize = readVLV();
  const metadataSize = readVLV();
  ptr += metadataSize;

  const target = Buffer.alloc(targetSize);
  let outputOffset = 0;
  let sourceRelativeOffset = 0;
  let targetRelativeOffset = 0;
  const endOffset = patch.length - 12;

  while (ptr < endOffset) {
    const action = readVLV();
    const length = Math.floor(action / 4) + 1;
    const mode = action & 3;

    if (mode === 0) {
      source.copy(target, outputOffset, outputOffset, outputOffset + length);
      outputOffset += length;
    } else if (mode === 1) {
      patch.copy(target, outputOffset, ptr, ptr + length);
      ptr += length;
      outputOffset += length;
    } else if (mode === 2) {
      const offset = readVLV();
      const relative = (offset & 1 ? -1 : 1) * Math.floor(offset / 2);
      sourceRelativeOffset += relative;
      source.copy(target, outputOffset, sourceRelativeOffset, sourceRelativeOffset + length);
      sourceRelativeOffset += length;
      outputOffset += length;
    } else if (mode === 3) {
      const offset = readVLV();
      const relative = (offset & 1 ? -1 : 1) * Math.floor(offset / 2);
      targetRelativeOffset += relative;
      for (let i = 0; i < length; i++) {
        target[outputOffset++] = target[targetRelativeOffset++];
      }
    }
  }

  return target;
}

/**
 * Garante que a ROM Base limpa (ex: poke_emerald, poke_firered, poke_crystal) esteja na pasta base_roms/
 */
async function ensureCleanBaseRom(baseRomId) {
  const mirror = BASE_ROM_AUTO_MIRRORS[baseRomId] || BASE_ROM_AUTO_MIRRORS.poke_firered;
  const ext = mirror ? mirror.ext : '.gba';
  const localPath = path.join(BASE_ROMS_DIR, `${baseRomId}${ext}`);

  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 100000) {
    return { buffer: fs.readFileSync(localPath), ext, console: mirror?.console || 'GBA' };
  }

  if (!mirror) {
    throw new Error(`A ROM Base "${baseRomId}" ainda não está na pasta base_roms/.`);
  }

  console.log(`[BASE ROM] Baixando ROM Base limpa "${mirror.name}" para auto-patcher...`);
  const res = await fetch(mirror.url, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow'
  });
  if (!res.ok) {
    throw new Error(`Falha ao baixar ROM Base limpa (${res.status})`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(localPath, buf);
  console.log(`[BASE ROM] Salva em: ${localPath} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
  return { buffer: buf, ext: mirror.ext, console: mirror.console };
}

/**
 * Obtém a URL assinada do arquivo .bps no HackDex.app usando Chrome/Edge Headless local (para passar pelo Vercel Security Checkpoint)
 */
async function getHackdexSignedPatchUrl(slug, patchId) {
  const browserCandidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ];
  const browserPath = browserCandidates.find(p => fs.existsSync(p));
  if (!browserPath) {
    throw new Error('Navegador Chrome/Edge não encontrado para autenticar token no HackDex.');
  }

  const debugPort = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${debugPort}`,
    '--remote-allow-origins=*',
    `https://www.hackdex.app/hack/${slug}`
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 300));
      try {
        const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
        const list = await listRes.json();
        const page = list.find(p => p.type === 'page' && p.url.includes('hackdex.app'));
        if (page && page.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch (_) {}
    }

    if (!wsUrl) throw new Error('Timeout ao iniciar sessão de token do HackDex');
    await new Promise(r => setTimeout(r, 1100));

    const actionRaw = await new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error('Timeout na resposta da Action do HackDex'));
      }, 10000);

      ws.onopen = () => {
        const argsJson = patchId ? JSON.stringify([slug, { patchId: Number(patchId) }]) : JSON.stringify([slug]);
        const expr = `
          fetch(window.location.pathname, {
            method: 'POST',
            headers: {
              'Accept': 'text/x-component',
              'Content-Type': 'text/plain;charset=UTF-8',
              'Next-Action': '${HACKDEX_NEXT_ACTION_SIGNED_URL}'
            },
            body: ${JSON.stringify(argsJson)}
          }).then(r => r.text())
        `;
        ws.send(
          JSON.stringify({
            id: 1,
            method: 'Runtime.evaluate',
            params: { expression: expr, awaitPromise: true, returnByValue: true }
          })
        );
      };
      ws.onmessage = ev => {
        const msg = JSON.parse(ev.data);
        if (msg.id === 1) {
          clearTimeout(timer);
          ws.close();
          resolve(msg.result?.result?.value || '');
        }
      };
      ws.onerror = err => {
        clearTimeout(timer);
        reject(err);
      };
    });

    const urlMatch = actionRaw.match(/https:\/\/patches\.hackdex\.app\/[^"\\]+/);
    const formatMatch = actionRaw.match(/"format":"([^"]+)"/);
    if (!urlMatch) {
      throw new Error('Não foi possível obter o link assinado do patch no HackDex.');
    }

    return {
      signedUrl: urlMatch[0],
      format: formatMatch ? formatMatch[1] : 'bps'
    };
  } finally {
    try {
      proc.kill();
    } catch (_) {}
  }
}

/**
 * Converte base_rom do HackDex para console ('GBA', 'GBC', 'NDS') e nome amigável
 */
function parseHackdexBaseRom(baseRomId = '') {
  if (/platinum|diamond|pearl|heartgold|soulsilver|black|white|md_eos|conquest/i.test(baseRomId)) {
    return { consoleType: 'NDS', baseLabel: baseRomId.replace('poke_', '').toUpperCase(), cheatKey: 'nds' };
  }
  if (/crystal|gold|silver|red$|blue$|yellow|tcg/i.test(baseRomId)) {
    return { consoleType: 'GBC', baseLabel: baseRomId.replace('poke_', '').toUpperCase(), cheatKey: 'firered' };
  }
  const isEmerald = /emerald/i.test(baseRomId);
  return {
    consoleType: 'GBA',
    baseLabel: baseRomId.replace('poke_', '').replace('_', ' ').toUpperCase(),
    cheatKey: isEmerald ? 'emerald' : 'firered'
  };
}

/**
 * Busca o catálogo do HackDex.app sob demanda (via API REST oficial do Supabase do HackDex)
 */
async function scrapeHackdexCatalog({ searchQuery = '', categoryFilter = 'all', page = 1 } = {}) {
  const cacheKey = `hackdex__${categoryFilter}__${searchQuery}__${page}`;
  const cached = apiPageCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const perPage = 36;
    const offset = (page - 1) * perPage;

    let filterQuery = '&approved=eq.true&is_archive=eq.false&deleted_at=is.null';
    if (searchQuery) {
      filterQuery += `&title=ilike.*${encodeURIComponent(searchQuery)}*`;
    }

    if (categoryFilter === 'gba') {
      filterQuery += '&base_rom=in.(poke_emerald,poke_firered,poke_firered_rev1,poke_leafgreen,poke_leafgreen_rev1,poke_ruby,poke_ruby_rev1,poke_ruby_rev2,poke_sapphire,poke_sapphire_rev1,poke_sapphire_rev2,poke_md_rrt)';
    } else if (categoryFilter === 'nds') {
      filterQuery += '&base_rom=in.(poke_platinum,poke_platinum_rev0,poke_diamond_rev5,poke_pearl_rev5,poke_heartgold,poke_soulsilver,poke_black,poke_white,poke_black_2,poke_white_2,poke_md_eos,poke_conquest)';
    } else if (categoryFilter === 'gbc') {
      filterQuery += '&base_rom=in.(poke_crystal,poke_crystal_rev1,poke_gold,poke_silver,poke_red,poke_blue,poke_yellow,poke_tcg)';
    }

    const selectCols =
      'slug,title,summary,base_rom,downloads,original_author,box_art,completion_status,language,current_patch,hack_covers(url,position),patches!hacks_current_patch_fkey(id,version,filename,format)';

    const url = `${HACKDEX_SUPABASE_URL}/rest/v1/hacks?select=${encodeURIComponent(selectCols)}${filterQuery}&order=downloads.desc.nullslast&limit=${perPage}&offset=${offset}`;

    const res = await fetch(url, {
      headers: {
        apikey: HACKDEX_SUPABASE_KEY,
        Authorization: `Bearer ${HACKDEX_SUPABASE_KEY}`,
        Prefer: 'count=exact'
      }
    });

    if (!res.ok) {
      throw new Error(`Erro HTTP HackDex Supabase: ${res.status}`);
    }

    const contentRange = res.headers.get('content-range') || '0-0/36';
    const totalCount = parseInt(contentRange.split('/')[1] || '36', 10);
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

    const rows = await res.json();
    const games = rows.map(row => {
      const { consoleType, baseLabel, cheatKey } = parseHackdexBaseRom(row.base_rom);
      const covers = (row.hack_covers || [])
        .sort((a, b) => (a.position || 0) - (b.position || 0))
        .map(c => `${HACKDEX_COVERS_CDN}/${c.url}`);

      const cover = row.box_art || covers[0] || 'https://www.hackdex.app/logo.png';
      const patchObj = Array.isArray(row.patches) ? row.patches[0] : row.patches;
      const version = patchObj?.version || 'v1.0';
      const format = (patchObj?.format || 'bps').toUpperCase();
      const statusBadge = row.completion_status ? ` • ${row.completion_status}` : '';

      return {
        id: `hd-${row.slug}`,
        slug: row.slug,
        source: 'hackdex',
        title: `${row.title} (${version})`,
        subtitle: `Base: ${baseLabel} • ${(row.downloads || 0).toLocaleString('pt-BR')} downloads${statusBadge}`,
        console: consoleType,
        language: row.language === 'Portuguese' ? 'PT-BR' : 'Inglês',
        baseRom: cheatKey,
        baseRomId: row.base_rom,
        patchId: patchObj?.id || row.current_patch || '',
        patchFormat: format,
        completionStatus: row.completion_status || 'Release',
        downloads: row.downloads || 0,
        cover,
        screenshots: covers,
        postUrl: `https://www.hackdex.app/hack/${row.slug}`,
        downloadPageUrl: `hackdex://${row.slug}?baseRom=${encodeURIComponent(row.base_rom || 'poke_firered')}&patchId=${encodeURIComponent(patchObj?.id || row.current_patch || '')}`,
        description: row.summary || 'Hack ROM oficial do catálogo HackDex.app.'
      };
    });

    const result = { games, totalPages, totalCount };
    apiPageCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  } catch (err) {
    console.error('[HACKDEX SCRAPE ERROR]', err.message);
    return { games: [], totalPages: 1, totalCount: 0 };
  }
}

/**
 * Busca os detalhes completos de uma Hack ROM específica no HackDex.app
 */
async function scrapeHackdexSingleDetails(slugOrUrl) {
  let slug = slugOrUrl;
  if (slugOrUrl.includes('hackdex.app/hack/')) {
    slug = slugOrUrl.split('hackdex.app/hack/')[1].split(/[/?#]/)[0];
  }
  slug = slug.replace(/^hd-/, '');

  const selectCols =
    'slug,title,summary,description,base_rom,downloads,original_author,box_art,completion_status,language,current_patch,hack_covers(url,position),patches!patches_parent_hack_fkey(id,version,filename,format,published,archived,changelog)';

  const url = `${HACKDEX_SUPABASE_URL}/rest/v1/hacks?select=${encodeURIComponent(selectCols)}&slug=eq.${encodeURIComponent(slug)}&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: HACKDEX_SUPABASE_KEY,
      Authorization: `Bearer ${HACKDEX_SUPABASE_KEY}`
    }
  });
  if (!res.ok) throw new Error(`Falha ao consultar HackDex (${res.status})`);
  const rows = await res.json();
  const row = rows[0];
  if (!row) throw new Error('Hack ROM não encontrada no HackDex.app');

  const images = (row.hack_covers || [])
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map(c => `${HACKDEX_COVERS_CDN}/${c.url}`);

  const publishedPatches = (row.patches || []).filter(p => p.published && !p.archived);
  const { consoleType, baseLabel } = parseHackdexBaseRom(row.base_rom);

  const paragraphs = (row.description || row.summary || '')
    .split(/\r?\n\r?\n/)
    .map(p => p.replace(/^[#*-]+\s*/gm, '').trim())
    .filter(p => p.length > 10);

  const links = publishedPatches.map(p => ({
    href: `hackdex://${row.slug}?baseRom=${encodeURIComponent(row.base_rom)}&patchId=${p.id}`,
    label: `Auto-Patcher ${p.version || 'Oficial'} (.${(p.format || 'bps').toUpperCase()} sob ${baseLabel})`,
    direct: true,
    console: consoleType
  }));

  if (links.length === 0) {
    links.push({
      href: `hackdex://${row.slug}?baseRom=${encodeURIComponent(row.base_rom)}`,
      label: `Auto-Patcher Oficial (${baseLabel})`,
      direct: true,
      console: consoleType
    });
  }

  return {
    title: row.title,
    postUrl: `https://www.hackdex.app/hack/${row.slug}`,
    images,
    features: [
      `ROM Base Oficial: ${baseLabel} (${consoleType})`,
      `Downloads no HackDex: ${(row.downloads || 0).toLocaleString('pt-BR')}`,
      `Status: ${row.completion_status || 'Publicada'}`,
      `Idioma: ${row.language || 'English'}`
    ],
    paragraphs: paragraphs.slice(0, 12),
    links
  };
}

/**
 * Leitor e Extrator nativo de arquivos .ZIP (usando Buffer + zlib built-in do Node.js)
 */
function inspectZipBuffer(buffer) {
  const entries = [];
  let eocdOffset = -1;
  const maxSearch = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= maxSearch; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) return entries;

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  let ptr = cdOffset;
  for (let i = 0; i < totalEntries && ptr + 46 <= buffer.length; i++) {
    if (buffer.readUInt32LE(ptr) !== 0x02014b50) break;

    const compressionMethod = buffer.readUInt16LE(ptr + 10);
    const compressedSize = buffer.readUInt32LE(ptr + 20);
    const uncompressedSize = buffer.readUInt32LE(ptr + 24);
    const fileNameLen = buffer.readUInt16LE(ptr + 28);
    const extraLen = buffer.readUInt16LE(ptr + 30);
    const commentLen = buffer.readUInt16LE(ptr + 32);
    const localHeaderOffset = buffer.readUInt32LE(ptr + 42);

    const fileName = buffer.slice(ptr + 46, ptr + 46 + fileNameLen).toString('utf8');
    ptr += 46 + fileNameLen + extraLen + commentLen;

    if (!fileName.endsWith('/')) {
      entries.push({
        fileName,
        baseName: path.basename(fileName),
        compressionMethod,
        compressedSize,
        uncompressedSize,
        localHeaderOffset,
        isRom: /\.(gba|nds|gbc|gb|sfc|smc|bin)$/i.test(fileName),
        isDoc: /\.(txt|pdf|doc|md)$/i.test(fileName)
      });
    }
  }
  return entries;
}

function extractEntryFromZipBuffer(buffer, entry) {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error('Cabeçalho ZIP local inválido');
  }
  const fileNameLen = buffer.readUInt16LE(offset + 26);
  const extraLen = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + fileNameLen + extraLen;
  const compressedSlice = buffer.slice(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return compressedSlice;
  } else if (entry.compressionMethod === 8) {
    return zlib.inflateRawSync(compressedSlice);
  } else {
    throw new Error(`Método de compressão ZIP (${entry.compressionMethod}) não suportado diretamente.`);
  }
}

function extractArchiveWithWindowsTar(archivePath, outputDir) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    execFile('tar.exe', ['-xf', archivePath, '-C', outputDir], err => {
      if (err) return reject(err);
      const results = [];
      function walk(dir) {
        for (const item of fs.readdirSync(dir)) {
          const full = path.join(dir, item);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) walk(full);
          else results.push({ fullPath: full, baseName: item, size: stat.size });
        }
      }
      walk(outputDir);
      resolve(results);
    });
  });
}

function classifyPostMetadata(post, rawTitle, contentHtml) {
  const cats = post.categories || [];
  const classes = (post.class_list || []).join(' ');
  const combinedText = `${rawTitle} ${contentHtml.slice(0, 1800)}`;

  let consoleType = 'GBA';
  if (
    cats.some(c => [32, 40, 49, 76, 77, 78, 79, 82].includes(c)) ||
    /category-nds|category-roms-ds|category-ds-hacks|\[NDS\]|\(NDS\)|nintendo ds/i.test(classes + ' ' + rawTitle)
  ) {
    consoleType = 'NDS';
  } else if (
    cats.some(c => [11, 19, 23, 24, 39, 45].includes(c)) ||
    /category-gbc|category-gb-hacks|\[GBC\]|\(GBC\)|game boy color/i.test(classes + ' ' + rawTitle)
  ) {
    consoleType = 'GBC';
  }

  let language = 'Inglês';
  if (
    cats.includes(37) ||
    /portugu[eê]s|pt-br|traduzido|tradu[cç][aã]o/i.test(combinedText)
  ) {
    language = 'PT-BR';
  } else if (cats.includes(16) || /espanhol|espa[ñn]ol/i.test(rawTitle)) {
    language = 'Espanhol';
  }

  let baseRom = consoleType === 'NDS' ? 'nds' : 'firered';
  if (/emerald|esmeralda|hoenn|quetzal|seaglass|inclement|rogue|imperium/i.test(combinedText)) {
    baseRom = 'emerald';
  } else if (consoleType === 'NDS') {
    baseRom = 'nds';
  }

  return { consoleType, language, baseRom };
}

function findBestDownloadLinksInHtml(contentHtml) {
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const directLinks = [];
  const shortenerLinks = [];
  let match;

  while ((match = linkRegex.exec(contentHtml)) !== null) {
    const href = match[1].trim();
    const label = stripHtml(match[2]) || 'Download';

    if (/pokebat\.net|wordpress\.com|youtube\.com|youtu\.be|discord\.gg|facebook\.com|twitter\.com|serebii\.net|pokecommunity\.com|reddit\.com|github\.com|ko-fi\.com|romhacking\.net|pastebin\.com|addtoany\.com/i.test(href)) {
      continue;
    }

    if (/mediafire\.com\/file|tinyurl\.com\/|drive\.google\.com\/file|drive\.usercontent\.google\.com/i.test(href)) {
      directLinks.push({ href, label, direct: true });
    } else if (/seulink\.net|fir3\.net|ouo\.io|pegal\.ink|link-hub\.net|mega\.nz|shycmedi\.com/i.test(href)) {
      shortenerLinks.push({ href, label, direct: false });
    }
  }

  return { directLinks, shortenerLinks };
}

async function scrapeFullPostDetails(postUrl) {
  if (postUrl.includes('hackdex.app')) {
    return scrapeHackdexSingleDetails(postUrl);
  }

  const res = await fetch(postUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Falha ao acessar post do PokeBat (${res.status})`);
  const html = await res.text();

  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? stripHtml(titleMatch[1]) : 'Jogo do PokeBat';

  const contentMatch =
    html.match(/<div class="post-content[\s\S]*?<div class="post-author">/i) ||
    html.match(/<div class="entry-content[\s\S]*?<\/article>/i);
  const contentHtml = contentMatch ? contentMatch[0] : html;

  const imgRegex = /<img[^>]+src=["'](https?:\/\/[^"']+\.(?:png|jpg|jpeg|webp|gif))["'][^>]*>/gi;
  const images = [];
  let imgMatch;
  while ((imgMatch = imgRegex.exec(contentHtml)) !== null) {
    const src = imgMatch[1];
    if (!/avatar|emoji|icon|logo|banner-ads/i.test(src) && !images.includes(src)) {
      images.push(src);
    }
  }

  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  const features = [];
  let liMatch;
  while ((liMatch = liRegex.exec(contentHtml)) !== null) {
    const text = stripHtml(liMatch[1]);
    if (text.length > 4 && text.length < 180 && !/home|gba|nds|gbc|contato|pol[ií]tica/i.test(text)) {
      features.push(text);
    }
  }

  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const paragraphs = [];
  let pMatch;
  while ((pMatch = pRegex.exec(contentHtml)) !== null) {
    const text = stripHtml(pMatch[1]);
    if (text.length > 25 && !/clique aqui|reportar link|deixe um coment/i.test(text)) {
      paragraphs.push(text);
    }
  }

  const { directLinks, shortenerLinks } = findBestDownloadLinksInHtml(contentHtml);

  return {
    title,
    postUrl,
    images: images.slice(0, 12),
    features: features.slice(0, 20),
    paragraphs: paragraphs.slice(0, 8),
    links: [...directLinks, ...shortenerLinks]
  };
}

async function resolveMediaFireDirectUrl(pageUrl) {
  const res = await fetch(pageUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    redirect: 'follow'
  });

  if (!res.ok) {
    throw new Error(`Erro ao abrir página de download (${res.status})`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return { directUrl: res.url, response: res };
  }

  const html = await res.text();

  const dlBtnMatch =
    html.match(/id=["']downloadButton["'][^>]*href=["'](https?:\/\/download[^"']+)["']/i) ||
    html.match(/href=["'](https?:\/\/download\d*\.mediafire\.com\/[^"']+)["']/i);

  if (dlBtnMatch && dlBtnMatch[1]) {
    return { directUrl: dlBtnMatch[1], response: null };
  }

  if (res.url.includes('drive.google.com') || res.url.includes('drive.usercontent.google.com')) {
    const idMatch = res.url.match(/\/d\/([a-zA-Z0-9_-]+)/) || res.url.match(/id=([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      const driveId = idMatch[1];
      const uuidMatch = html.match(/name=["']uuid["']\s+value=["']([^"']+)["']/i);
      const uuidParam = uuidMatch ? `&uuid=${uuidMatch[1]}` : '';
      return {
        directUrl: `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t${uuidParam}`,
        response: null
      };
    }
  }

  throw new Error('Este link usa um protetor externo com Captcha. Abra a "ℹ Ficha / Links" do jogo para testar o Link 2 ou baixe manualmente e use "📂 Abrir ROM Local".');
}

/**
 * Processa e aplica o Auto-Patcher de um jogo do HackDex.app (ou faz fallback inteligente no PokeBat se for xdelta/NDS)
 */
async function buildPatchedHackdexRom(gameId, hackdexUri, gameTitle = '') {
  const safeId = (gameId || 'hackdex').replace(/[^a-zA-Z0-9_-]/g, '');
  const existingCache = fs.readdirSync(CACHE_DIR).find(
    f => f.startsWith(safeId + '__') && !f.endsWith('.tmp') && !fs.statSync(path.join(CACHE_DIR, f)).isDirectory()
  );
  if (existingCache) {
    const cachedPath = path.join(CACHE_DIR, existingCache);
    const originalName = existingCache.split('__').slice(1).join('__');
    return { cachedPath, originalName };
  }

  const parsed = new URL(hackdexUri.replace(/^hackdex:\/\//, 'http://hackdex.local/'));
  const slug = parsed.pathname.replace(/^\/+/, '');
  const baseRomId = parsed.searchParams.get('baseRom') || 'poke_firered';
  const patchId = parsed.searchParams.get('patchId') || '';

  console.log(`[HACKDEX PATCHER] Preparando "${slug}" (Base: ${baseRomId}, PatchId: ${patchId})...`);

  try {
    // 1. Obtém link assinado do patch (.bps / .xdelta) no HackDex
    const { signedUrl, format } = await getHackdexSignedPatchUrl(slug, patchId);
    console.log(`[HACKDEX PATCHER] Baixando patch (${format}): ${signedUrl.slice(0, 80)}...`);

    const patchRes = await fetch(signedUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!patchRes.ok) {
      throw new Error(`Falha ao baixar patch do HackDex (${patchRes.status})`);
    }
    const patchBuffer = Buffer.from(await patchRes.arrayBuffer());

    if (format === 'bps' || patchBuffer.slice(0, 4).toString('ascii') === 'BPS1') {
      const { buffer: baseRomBuffer, ext } = await ensureCleanBaseRom(baseRomId);
      console.log(`[HACKDEX PATCHER] Aplicando patch BPS (${(patchBuffer.length / 1024).toFixed(1)} KB) sobre ${baseRomId}...`);
      const patchedRomBuffer = applyBpsPatchBuffer(baseRomBuffer, patchBuffer);

      const fileName = `${slug}${ext}`;
      const cacheFilePath = path.join(CACHE_DIR, `${safeId}__${fileName}`);
      fs.writeFileSync(cacheFilePath, patchedRomBuffer);
      console.log(`[HACKDEX PATCHER] Sucesso! ROM gerada: ${cacheFilePath} (${(patchedRomBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
      return { cachedPath: cacheFilePath, originalName: fileName };
    }
  } catch (patchErr) {
    console.warn(`[HACKDEX PATCHER] Aviso no patcher direto (${patchErr.message}). Tentando fallback automático no PokeBat...`);
  }

  // Fallback Inteligente: procura a mesma Hack ROM pré-patcheada na API do PokeBat.net!
  const cleanSearch = (gameTitle || slug.replace(/-/g, ' ')).replace(/\([^)]*\)/g, '').trim();
  const { games: pbMatches } = await scrapePokebatLiveCatalog({ searchQuery: cleanSearch, page: 1 });
  const bestPb = pbMatches.find(g => g.isDirect) || pbMatches[0];
  if (bestPb && bestPb.downloadPageUrl) {
    console.log(`[HACKDEX -> POKEBAT FALLBACK] Encontrado "${bestPb.title}" no PokeBat! Baixando...`);
    return ensureRomCached(safeId, bestPb.downloadPageUrl);
  }

  throw new Error(
    `Este jogo do HackDex usa formato xdelta ou uma ROM Base que não pôde ser patcheada automaticamente. Você pode baixar o patch na ficha do jogo.`
  );
}

async function ensureRomCached(gameId, targetPageUrl, gameTitle = '') {
  if (targetPageUrl && targetPageUrl.startsWith('hackdex://')) {
    return buildPatchedHackdexRom(gameId, targetPageUrl, gameTitle);
  }

  const safeId = (gameId || 'custom').replace(/[^a-zA-Z0-9_-]/g, '');
  const existingCache = fs.readdirSync(CACHE_DIR).find(
    f => f.startsWith(safeId + '__') && !f.endsWith('.tmp') && !fs.statSync(path.join(CACHE_DIR, f)).isDirectory()
  );

  if (existingCache && safeId !== 'custom') {
    const cachedPath = path.join(CACHE_DIR, existingCache);
    const originalName = existingCache.split('__').slice(1).join('__');
    return { cachedPath, originalName, fromCache: true };
  }

  console.log(`[SCRAPER] Resolvendo link de download: ${targetPageUrl}`);
  const { directUrl } = await resolveMediaFireDirectUrl(targetPageUrl);
  console.log(`[DOWNLOAD] Baixando ROM de: ${directUrl}`);

  const romRes = await fetch(directUrl, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow'
  });

  if (!romRes.ok) {
    throw new Error(`Falha ao baixar arquivo da fonte (${romRes.status})`);
  }

  const urlObj = new URL(romRes.url || directUrl);
  let fileName = decodeURIComponent(path.basename(urlObj.pathname)) || `${safeId}.zip`;
  fileName = fileName.replace(/[^a-zA-Z0-9._\-[\]() ]/g, '_');
  if (!/\.(zip|gba|nds|gbc|gb|7z|rar)$/i.test(fileName)) {
    fileName += '.zip';
  }

  const cacheFilePath = path.join(CACHE_DIR, `${safeId}__${fileName}`);
  const tempFilePath = cacheFilePath + '.tmp';

  const arrayBuffer = await romRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(tempFilePath, buffer);
  fs.renameSync(tempFilePath, cacheFilePath);

  console.log(`[CACHE SAVED] ROM armazenada em: ${cacheFilePath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
  return { cachedPath: cacheFilePath, originalName: fileName, fromCache: false };
}

async function scrapePokebatLiveCatalog({ searchQuery = '', categoryFilter = 'all', page = 1 } = {}) {
  const cacheKey = `pokebat__${categoryFilter}__${searchQuery}__${page}`;
  const cached = apiPageCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    let categoryParam = '';
    if (categoryFilter === 'ptbr') categoryParam = '&categories=37';
    else if (categoryFilter === 'gba') categoryParam = '&categories=20,21';
    else if (categoryFilter === 'nds') categoryParam = '&categories=32,40,49';
    else if (categoryFilter === 'gbc') categoryParam = '&categories=23,24,19';
    else {
      categoryParam = '&categories_exclude=15,33,38,44';
    }

    let apiUrl = `https://pokebat.net/wp-json/wp/v2/posts?per_page=36&page=${page}${categoryParam}&_embed`;
    if (searchQuery) {
      apiUrl = `https://pokebat.net/wp-json/wp/v2/posts?search=${encodeURIComponent(searchQuery)}&per_page=36&page=${page}&_embed`;
    }

    const res = await fetch(apiUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return { games: [], totalPages: 1 };

    const totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10);
    const posts = await res.json();

    const scrapedGames = [];
    for (const post of posts) {
      const rawTitle = stripHtml(post.title?.rendered || '');
      const contentHtml = post.content?.rendered || '';

      if (/RPG XP|PC GAME|PC FAN-GAME|PC TORRENT|TOP 10 |COMO BAIXAR|EMULADOR/i.test(rawTitle)) continue;

      const { directLinks, shortenerLinks } = findBestDownloadLinksInHtml(contentHtml);
      const bestLink = directLinks[0] || shortenerLinks[0];
      if (!bestLink) continue;

      const { consoleType, language, baseRom } = classifyPostMetadata(post, rawTitle, contentHtml);

      let cover = 'https://pokebat.net/wp-content/uploads/2023/01/default.png';
      const embeddedMedia = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
      if (embeddedMedia) {
        cover = embeddedMedia;
      } else {
        const imgMatch = contentHtml.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
        if (imgMatch) cover = imgMatch[1];
      }

      const allLinks = [...directLinks, ...shortenerLinks];
      scrapedGames.push({
        id: `wp-${post.id}`,
        source: 'pokebat',
        title: rawTitle,
        subtitle: bestLink.direct
          ? `Link Direto Automático • ${consoleType}${allLinks.length > 1 ? ` (${allLinks.length} links)` : ''}`
          : `Via Mirror Externo • ${consoleType}`,
        console: consoleType,
        language,
        baseRom,
        isDirect: bestLink.direct,
        cover,
        postUrl: post.link,
        downloadPageUrl: bestLink.href,
        allLinks,
        description: stripHtml(post.excerpt?.rendered || '').slice(0, 180) + '...'
      });
    }

    const result = { games: scrapedGames, totalPages };
    apiPageCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  } catch (err) {
    console.error('Erro no live scrape do PokeBat:', err.message);
    return { games: [], totalPages: 1 };
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');
  res.setHeader('ngrok-skip-browser-warning', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // API: Status e URL do Túnel ngrok
  if (pathname === '/api/tunnel') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ active: !!activeNgrokUrl, url: activeNgrokUrl }));
  }

  // 1. API: Listar Jogos sob demanda por Fonte (`source=pokebat` ou `source=hackdex`)
  if (pathname === '/api/games') {
    try {
      const source = (parsedUrl.searchParams.get('source') || 'pokebat').toLowerCase();
      const search = parsedUrl.searchParams.get('q') || '';
      const category = parsedUrl.searchParams.get('cat') || 'all';
      const langFilter = parsedUrl.searchParams.get('lang') || 'all';
      const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
      const cachedFilesList = fs.readdirSync(CACHE_DIR);

      // SE A ABA SELECIONADA FOR HACKDEX.APP, BUSCA APENAS DO HACKDEX
      if (source === 'hackdex') {
        const { games: hdGames, totalPages, totalCount } = await scrapeHackdexCatalog({
          searchQuery: search,
          categoryFilter: category,
          page
        });

        const enriched = hdGames.map(g => {
          const isCached = cachedFilesList.some(f => f.startsWith(g.id + '__') && !f.endsWith('.tmp'));
          const saveInfo = getGameSaveInfo(g.id);
          return { ...g, cached: isCached, saveInfo };
        });

        const finalGames =
          langFilter === 'all'
            ? enriched
            : enriched.filter(g =>
                langFilter === 'ptbr' ? g.language === 'PT-BR' : g.language === 'Inglês'
              );

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ source: 'hackdex', games: finalGames, page, totalPages, totalCount }));
      }

      // CASO CONTRÁRIO, BUSCA APENAS DO POKEBAT.NET
      const { games: liveGames, totalPages } = await scrapePokebatLiveCatalog({
        searchQuery: search,
        categoryFilter: category,
        page
      });

      const seenPosts = new Set();
      const combined = [];

      if (page === 1) {
        let featuredFiltered = FEATURED_GAMES;
        if (search) {
          featuredFiltered = featuredFiltered.filter(g =>
            g.title.toLowerCase().includes(search.toLowerCase())
          );
        }
        if (category === 'ptbr') {
          featuredFiltered = featuredFiltered.filter(g => g.language === 'PT-BR');
        } else if (category === 'gba') {
          featuredFiltered = featuredFiltered.filter(g => g.console === 'GBA');
        } else if (category === 'nds') {
          featuredFiltered = featuredFiltered.filter(g => g.console === 'NDS');
        } else if (category === 'gbc') {
          featuredFiltered = featuredFiltered.filter(g => g.console === 'GBC');
        }

        for (const g of featuredFiltered) {
          seenPosts.add(g.postUrl);
          const isCached = cachedFilesList.some(f => f.startsWith(g.id + '__') && !f.endsWith('.tmp'));
          const saveInfo = getGameSaveInfo(g.id);
          combined.push({ ...g, source: 'pokebat', isDirect: true, cached: isCached, saveInfo });
        }
      }

      for (const lg of liveGames) {
        if (!seenPosts.has(lg.postUrl)) {
          seenPosts.add(lg.postUrl);
          const isCached = cachedFilesList.some(f => f.startsWith(lg.id + '__') && !f.endsWith('.tmp'));
          const saveInfo = getGameSaveInfo(lg.id);
          combined.push({ ...lg, source: 'pokebat', cached: isCached, saveInfo });
        }
      }

      const finalGames =
        langFilter === 'all'
          ? combined
          : combined.filter(g =>
              langFilter === 'ptbr' ? g.language === 'PT-BR' : g.language === 'Inglês'
            );

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ source: 'pokebat', games: finalGames, page, totalPages }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 2. API: Detalhes Completos do Post (PokeBat.net ou HackDex.app)
  if (pathname === '/api/post-details' || pathname === '/api/scrape-post') {
    const postUrl = parsedUrl.searchParams.get('url') || '';
    if (!postUrl || (!postUrl.includes('pokebat.net') && !postUrl.includes('hackdex.app'))) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'Informe uma URL válida do pokebat.net ou hackdex.app' }));
    }
    try {
      const details = await scrapeFullPostDetails(postUrl);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(details));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 3. API: Cheats Integrados (GameShark / CodeBreaker / Action Replay)
  if (pathname === '/api/cheats') {
    const base = (parsedUrl.searchParams.get('base') || '').toLowerCase();
    const sys = (parsedUrl.searchParams.get('console') || 'GBA').toUpperCase();
    const title = (parsedUrl.searchParams.get('title') || '').toLowerCase();

    let key = 'firered';
    if (sys === 'NDS' || base === 'nds' || /heartgold|soulsilver|platinum|diamond|pearl|black|white/i.test(title)) {
      key = 'nds';
    } else if (base === 'emerald' || /emerald|esmeralda|quetzal|seaglass|azoth|mercury|hoenn|rogue|rowe/i.test(title)) {
      key = 'emerald';
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(CHEATS_DB[key] || CHEATS_DB.firered));
  }

  // 4. API: Cofre de Saves Local
  if (pathname === '/api/saves') {
    if (req.method === 'GET') {
      const meta = loadSavesMetadata();
      const files = fs.readdirSync(SAVES_DIR);
      const gamesMap = new Map();

      for (const f of files) {
        if (f === 'metadata.json') continue;
        const ext = path.extname(f).toLowerCase();
        if (ext !== '.srm' && ext !== '.state') continue;

        const id = path.basename(f, ext);
        const stat = fs.statSync(path.join(SAVES_DIR, f));
        const current = gamesMap.get(id) || {
          id,
          title: meta[id]?.title || id,
          console: meta[id]?.console || 'GBA',
          downloadPageUrl: meta[id]?.downloadPageUrl || '',
          cover: meta[id]?.cover || 'https://pokebat.net/wp-content/uploads/2023/01/default.png',
          hasSrm: false,
          srmSize: 0,
          hasState: false,
          stateSize: 0,
          updatedAt: stat.mtime.toISOString()
        };

        if (ext === '.srm') {
          current.hasSrm = true;
          current.srmSize = stat.size;
        } else if (ext === '.state') {
          current.hasState = true;
          current.stateSize = stat.size;
        }
        if (stat.mtime > new Date(current.updatedAt)) {
          current.updatedAt = stat.mtime.toISOString();
        }
        gamesMap.set(id, current);
      }

      const savesList = Array.from(gamesMap.values()).sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      );
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ saves: savesList, savesDir: SAVES_DIR }));
    }

    if (req.method === 'POST') {
      const gameId = (parsedUrl.searchParams.get('id') || 'custom').replace(/[^a-zA-Z0-9_-]/g, '');
      const saveType = parsedUrl.searchParams.get('type') === 'state' ? 'state' : 'srm';
      const title = parsedUrl.searchParams.get('title') || gameId;
      const consoleType = parsedUrl.searchParams.get('console') || 'GBA';
      const downloadPageUrl = parsedUrl.searchParams.get('url') || '';
      const cover = parsedUrl.searchParams.get('cover') || '';

      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          if (buffer.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ error: 'Arquivo de save vazio' }));
          }

          const filePath = path.join(SAVES_DIR, `${gameId}.${saveType}`);
          fs.writeFileSync(filePath, buffer);

          const meta = loadSavesMetadata();
          meta[gameId] = {
            id: gameId,
            title,
            console: consoleType,
            downloadPageUrl: downloadPageUrl || meta[gameId]?.downloadPageUrl || '',
            cover: cover || meta[gameId]?.cover || '',
            updatedAt: new Date().toISOString()
          };
          saveSavesMetadata(meta);

          console.log(`[SAVE VAULT] Salvo ${filePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: true, filePath, size: buffer.length }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  if (pathname === '/api/saves/file') {
    const gameId = (parsedUrl.searchParams.get('id') || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const saveType = parsedUrl.searchParams.get('type') === 'state' ? 'state' : 'srm';
    const filePath = path.join(SAVES_DIR, `${gameId}.${saveType}`);

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'Save não encontrado no disco' }));
    }

    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${gameId}.${saveType}"`
    });
    return fs.createReadStream(filePath).pipe(res);
  }

  if (pathname === '/api/saves/open-folder' && req.method === 'POST') {
    execFile('explorer.exe', [SAVES_DIR], () => {});
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, path: SAVES_DIR }));
  }

  // 5. API: Inspecionar Pacote de ROM
  if (pathname === '/api/rom-inspect') {
    const gameId = parsedUrl.searchParams.get('id') || 'custom';
    const targetPageUrl = parsedUrl.searchParams.get('url');

    if (!targetPageUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'Parâmetro url ausente' }));
    }

    try {
      const { cachedPath, originalName } = await ensureRomCached(gameId, targetPageUrl);
      const buffer = fs.readFileSync(cachedPath);

      if (buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50) {
        const entries = inspectZipBuffer(buffer);
        const romEntries = entries.filter(e => e.isRom);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(
          JSON.stringify({
            archiveName: originalName,
            isArchive: true,
            romEntries: romEntries.map((e, idx) => ({
              index: idx,
              fileName: e.fileName,
              baseName: e.baseName,
              sizeMB: (e.uncompressedSize / 1024 / 1024).toFixed(2)
            }))
          })
        );
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(
        JSON.stringify({
          archiveName: originalName,
          isArchive: false,
          romEntries: [{ index: 0, fileName: originalName, baseName: originalName }]
        })
      );
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 6. API: Baixar / Compilar / Fazer Stream da ROM (PokeBat.net + HackDex Auto-Patcher .BPS)
  if (pathname === '/api/rom') {
    const gameId = parsedUrl.searchParams.get('id') || 'custom';
    const targetPageUrl = parsedUrl.searchParams.get('url');
    const selectedEntryName = parsedUrl.searchParams.get('entry') || '';
    const gameTitle = parsedUrl.searchParams.get('title') || '';

    if (!targetPageUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'Parâmetro url ausente' }));
    }

    try {
      // Se for uma ROM do HackDex (hackdex://slug?baseRom=...), compila e envia direto para a memória do navegador!
      if (targetPageUrl.startsWith('hackdex://')) {
        const { cachedPath, originalName } = await buildPatchedHackdexRom(gameId, targetPageUrl, gameTitle);
        const buf = fs.readFileSync(cachedPath);
        try { fs.unlinkSync(cachedPath); } catch (_) {}
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': buf.length,
          'X-Rom-Filename': encodeURIComponent(originalName),
          'Content-Disposition': `attachment; filename="${encodeURIComponent(originalName)}"`
        });
        return res.end(buf);
      }

      const safeId = gameId.replace(/[^a-zA-Z0-9_-]/g, '');

      console.log(`[SCRAPER] Resolvendo link de download direto (Zero-Disk Cache): ${targetPageUrl}`);
      const { directUrl } = await resolveMediaFireDirectUrl(targetPageUrl);
      console.log(`[STREAM] Fazendo stream direto da ROM para o navegador do jogador: ${directUrl}`);

      const romRes = await fetch(directUrl, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow'
      });

      if (!romRes.ok) {
        throw new Error(`Falha ao baixar arquivo da fonte (${romRes.status})`);
      }

      const urlObj = new URL(romRes.url || directUrl);
      let fileName = decodeURIComponent(path.basename(urlObj.pathname)) || `${safeId}.zip`;
      fileName = fileName.replace(/[^a-zA-Z0-9._\-[\]() ]/g, '_');
      if (!/\.(zip|gba|nds|gbc|gb|7z|rar)$/i.test(fileName)) {
        fileName += '.zip';
      }

      // Se o usuário escolheu uma versão específica dentro de um pacote Multi-ROM (.zip), extrai em RAM
      if (selectedEntryName) {
        const arrayBuf = await romRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        if (buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50) {
          const entries = inspectZipBuffer(buffer).filter(e => e.isRom);
          const chosen = entries.find(e => e.fileName === selectedEntryName || e.baseName === selectedEntryName) || entries[0];
          if (chosen) {
            const extractedRom = extractEntryFromZipBuffer(buffer, chosen);
            res.writeHead(200, {
              'Content-Type': 'application/octet-stream',
              'Content-Length': extractedRom.length,
              'X-Rom-Filename': encodeURIComponent(chosen.baseName),
              'Content-Disposition': `attachment; filename="${encodeURIComponent(chosen.baseName)}"`
            });
            return res.end(extractedRom);
          }
        }
      }

      const contentLength = romRes.headers.get('content-length');
      const headers = {
        'Content-Type': 'application/octet-stream',
        'X-Rom-Filename': encodeURIComponent(fileName),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`
      };
      if (contentLength) headers['Content-Length'] = contentLength;

      res.writeHead(200, headers);

      // Stream puro da internet direto para a memória do navegador do usuário (sem gravar nada no HD do servidor!)
      const reader = romRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }

      res.end();
      return;
    } catch (err) {
      console.error('[ERRO ROM]', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: err.message }));
      }
      return res.end();
    }
  }

  // 7. Arquivos Estáticos (public/)
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    return fs.createReadStream(filePath).pipe(res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 - Não encontrado');
});

server.listen(PORT, async () => {
  console.log(`\n======================================================`);
  console.log(`🎮 PokeBat & HackDex Web Hub rodando em: http://localhost:${PORT}`);
  console.log(`💾 Cofre de Saves Local: ${SAVES_DIR}`);
  console.log(`📦 Cache de ROMs Local: ${CACHE_DIR}`);
  console.log(`🧬 ROMs Base (Auto-Patcher HackDex): ${BASE_ROMS_DIR}`);

  if (ngrok) {
    try {
      console.log(`🔄 Conectando túnel ngrok em https://${NGROK_DOMAIN}...`);
      const session = await ngrok.forward({
        addr: PORT,
        authtoken: NGROK_AUTHTOKEN,
        domain: NGROK_DOMAIN
      });
      activeNgrokUrl = session.url();
      console.log(`🚀 TÚNEL NGROK ONLINE: ${activeNgrokUrl}`);
      console.log(`Compartilhe este link com quem quiser para jogar online!`);
    } catch (err) {
      console.warn(`[NGROK] Aviso: ${err.message}`);
    }
  }

  console.log(`======================================================\n`);
});
