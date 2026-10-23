/**
 * PokeMule Trainer Card & GBA Save Inspector
 * - Inspeciona saves .SRM/.SAV de Pokémon (GBA Gen 3: FireRed, Emerald, Ruby, etc.)
 * - Gera o icônico Cartão de Treinador GBA em HTML5 Canvas exportável em PNG!
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TrainerCardGenerator = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Ordem das 4 subestruturas de 12 bytes no Gen 3 baseadas em Personality % 24
  const SUBSTRUCTURE_ORDERS = [
    [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 2, 3, 1], [0, 3, 1, 2], [0, 3, 2, 1],
    [1, 0, 2, 3], [1, 0, 3, 2], [1, 2, 0, 3], [1, 2, 3, 0], [1, 3, 0, 2], [1, 3, 2, 0],
    [2, 0, 1, 3], [2, 0, 3, 1], [2, 1, 0, 3], [2, 1, 3, 0], [2, 3, 0, 1], [2, 3, 1, 0],
    [3, 0, 1, 2], [3, 0, 2, 1], [3, 1, 0, 2], [3, 1, 2, 0], [3, 2, 0, 1], [3, 2, 1, 0]
  ];

  // Nomes dos 386 Pokémon clássicos do GBA para consulta rápida
  const GEN3_NAMES = [
    '', 'Bulbasaur', 'Ivysaur', 'Venusaur', 'Charmander', 'Charmeleon', 'Charizard',
    'Squirtle', 'Wartortle', 'Blastoise', 'Caterpie', 'Metapod', 'Butterfree',
    'Weedle', 'Kakuna', 'Beedrill', 'Pidgey', 'Pidgeotto', 'Pidgeot',
    'Rattata', 'Raticate', 'Spearow', 'Fearow', 'Ekans', 'Arbok',
    'Pikachu', 'Raichu', 'Sandshrew', 'Sandslash', 'Nidoran♀', 'Nidorina',
    'Nidoqueen', 'Nidoran♂', 'Nidorino', 'Nidoking', 'Clefairy', 'Clefable',
    'Vulpix', 'Ninetales', 'Jigglypuff', 'Wigglytuff', 'Zubat', 'Golbat',
    'Oddish', 'Gloom', 'Vileplume', 'Paras', 'Parasect', 'Venonat', 'Venomoth',
    'Diglett', 'Dugtrio', 'Meowth', 'Persian', 'Psyduck', 'Golduck',
    'Mankey', 'Primeape', 'Growlithe', 'Arcanine', 'Poliwag', 'Poliwhirl',
    'Poliwrath', 'Abra', 'Kadabra', 'Alakazam', 'Machop', 'Machoke',
    'Machamp', 'Bellsprout', 'Weepinbell', 'Victreebel', 'Tentacool', 'Tentacruel',
    'Geodude', 'Graveler', 'Golem', 'Ponyta', 'Rapidash', 'Slowpoke',
    'Slowbro', 'Magnemite', 'Magneton', "Farfetch'd", 'Doduo', 'Dodrio',
    'Seel', 'Dewgong', 'Grimer', 'Muk', 'Shellder', 'Cloyster',
    'Gastly', 'Haunter', 'Gengar', 'Onix', 'Drowzee', 'Hypno',
    'Krabby', 'Kingler', 'Voltorb', 'Electrode', 'Exeggcute', 'Exeggutor',
    'Cubone', 'Marowak', 'Hitmonlee', 'Hitmonchan', 'Lickitung', 'Koffing',
    'Weezing', 'Rhyhorn', 'Rhydon', 'Chansey', 'Tangela', 'Kangaskhan',
    'Horsea', 'Seadra', 'Goldeen', 'Seaking', 'Staryu', 'Starmie',
    'Mr. Mime', 'Scyther', 'Jynx', 'Electabuzz', 'Magmar', 'Pinsir',
    'Tauros', 'Magikarp', 'Gyarados', 'Lapras', 'Ditto', 'Eevee',
    'Vaporeon', 'Jolteon', 'Flareon', 'Porygon', 'Omanyte', 'Omastar',
    'Kabuto', 'Kabutops', 'Aerodactyl', 'Snorlax', 'Articuno', 'Zapdos',
    'Moltres', 'Dratini', 'Dragonair', 'Dragonite', 'Mewtwo', 'Mew',
    'Chikorita', 'Bayleef', 'Meganium', 'Cyndaquil', 'Quilava', 'Typhlosion',
    'Totodile', 'Croconaw', 'Feraligatr', 'Sentret', 'Furret', 'Hoothoot',
    'Noctowl', 'Ledyba', 'Ledian', 'Spinarak', 'Ariados', 'Crobat',
    'Chinchou', 'Lanturn', 'Pichu', 'Cleffa', 'Igglybuff', 'Togepi',
    'Togetic', 'Natu', 'Xatu', 'Mareep', 'Flaaffy', 'Ampharos',
    'Bellossom', 'Marill', 'Azumarill', 'Sudowoodo', 'Politoed', 'Hoppip',
    'Skiploom', 'Jumpluff', 'Aipom', 'Sunkern', 'Sunflora', 'Yanma',
    'Wooper', 'Quagsire', 'Espeon', 'Umbreon', 'Murkrow', 'Slowking',
    'Misdreavus', 'Unown', 'Wobbuffet', 'Girafarig', 'Pineco', 'Forretress',
    'Dunsparce', 'Gligar', 'Steelix', 'Snubbull', 'Granbull', 'Qwilfish',
    'Scizor', 'Shuckle', 'Heracross', 'Sneasel', 'Teddiursa', 'Ursaring',
    'Slugma', 'Magcargo', 'Swinub', 'Piloswine', 'Corsola', 'Remoraid',
    'Octillery', 'Delibird', 'Mantine', 'Skarmory', 'Houndour', 'Houndoom',
    'Kingdra', 'Phanpy', 'Donphan', 'Porygon2', 'Stantler', 'Smeargle',
    'Tyrogue', 'Hitmontop', 'Smoochum', 'Elekid', 'Magby', 'Miltank',
    'Blissey', 'Raikou', 'Entei', 'Suicune', 'Larvitar', 'Pupitar',
    'Tyranitar', 'Lugia', 'Ho-Oh', 'Celebi',
    'Treecko', 'Grovyle', 'Sceptile', 'Torchic', 'Combusken', 'Blaziken',
    'Mudkip', 'Marshtomp', 'Swampert', 'Poochyena', 'Mightyena', 'Zigzagoon',
    'Linoone', 'Wurmple', 'Silcoon', 'Beautifly', 'Cascoon', 'Dustox',
    'Lotad', 'Lombre', 'Ludicolo', 'Seedot', 'Nuzleaf', 'Shiftry',
    'Taillow', 'Swellow', 'Wingull', 'Pelipper', 'Ralts', 'Kirlia',
    'Gardevoir', 'Surskit', 'Masquerain', 'Shroomish', 'Breloom', 'Slakoth',
    'Vigoroth', 'Slaking', 'Nincada', 'Ninjask', 'Shedinja', 'Whismur',
    'Loudred', 'Exploud', 'Makuhita', 'Hariyama', 'Azurill', 'Nosepass',
    'Skitty', 'Delcatty', 'Sableye', 'Mawile', 'Aron', 'Lairon',
    'Aggron', 'Meditite', 'Medicham', 'Electrike', 'Manectric', 'Plusle',
    'Minun', 'Volbeat', 'Illumise', 'Roselia', 'Gulpin', 'Swalot',
    'Carvanha', 'Sharpedo', 'Wailmer', 'Wailord', 'Numel', 'Camerupt',
    'Torkoal', 'Spoink', 'Grumpig', 'Spinda', 'Trapinch', 'Vibrava',
    'Flygon', 'Cacnea', 'Cacturne', 'Swablu', 'Altaria', 'Zangoose',
    'Seviper', 'Lunatone', 'Solrock', 'Barboach', 'Whiscash', 'Corphish',
    'Crawdaunt', 'Baltoy', 'Claydol', 'Lileep', 'Cradily', 'Anorith',
    'Armaldo', 'Feebas', 'Milotic', 'Castform', 'Kecleon', 'Shuppet',
    'Banette', 'Duskull', 'Dusclops', 'Tropius', 'Chimecho', 'Absol',
    'Wynaut', 'Snorunt', 'Glalie', 'Spheal', 'Sealeo', 'Walrein',
    'Clamperl', 'Huntail', 'Gorebyss', 'Relicanth', 'Luvdisc', 'Bagon',
    'Shelgon', 'Salamence', 'Beldum', 'Metang', 'Metagross', 'Regirock',
    'Regice', 'Registeel', 'Latias', 'Latios', 'Kyogre', 'Groudon',
    'Rayquaza', 'Jirachi', 'Deoxys'
  ];

  /**
   * Decodifica 1 Pokémon Gen 3 (100 bytes) da party
   */
  function parseGen3PartyPokemon(view, offset) {
    try {
      const pid = view.getUint32(offset, true);
      const otid = view.getUint32(offset + 4, true);
      const key = (pid ^ otid) >>> 0;

      const orderIndex = pid % 24;
      const order = SUBSTRUCTURE_ORDERS[orderIndex];

      // Decripta os 4 blocos de 12 bytes
      const decryptedBlocks = [];
      for (let b = 0; b < 4; b++) {
        const blkOffset = offset + 32 + (b * 12);
        const w0 = (view.getUint32(blkOffset, true) ^ key) >>> 0;
        const w1 = (view.getUint32(blkOffset + 4, true) ^ key) >>> 0;
        const w2 = (view.getUint32(blkOffset + 8, true) ^ key) >>> 0;
        decryptedBlocks[b] = { w0, w1, w2 };
      }

      // O bloco 0 ("Growth") contém o ID da espécie nos primeiros 16 bits
      const growthBlockIndex = order.indexOf(0);
      const growthBlock = decryptedBlocks[growthBlockIndex];
      const speciesId = growthBlock.w0 & 0xffff;

      // Nível está no offset 0x54 (ou 0x54 + 4 = 0x58)
      const level = view.getUint8(offset + 0x58) || 50;

      if (speciesId > 0 && speciesId <= 898) {
        return {
          id: speciesId,
          name: GEN3_NAMES[speciesId] || `Pokémon #${speciesId}`,
          level: Math.min(100, Math.max(1, level)),
          spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${speciesId}.png`
        };
      }
    } catch (_) {}
    return null;
  }

  /**
   * Tenta inspecionar o arquivo .SRM para extrair o time de até 6 Pokémon
   */
  function inspectSrmParty(uint8Bytes) {
    if (!uint8Bytes || uint8Bytes.length < 4096) return [];
    const view = new DataView(uint8Bytes.buffer, uint8Bytes.byteOffset, uint8Bytes.byteLength);

    // No GBA (Emerald, FireRed, Ruby), o save tem 14 seções de 4096 bytes cada.
    // Procuramos a Seção 1 (ID 1 no rodapé da seção, offset + 4084 ou 4086)
    for (let sec = 0; sec < 14; sec++) {
      const secOffset = sec * 4096;
      if (secOffset + 4096 > uint8Bytes.length) break;

      const secId = view.getUint16(secOffset + 4084, true);
      // Se for a Seção 1 (Team & Items)
      if (secId === 1) {
        // Testa offsets comuns da party no Emerald / FRLG / Ruby
        const candidateOffsets = [0x0234, 0x0034, 0x0238, 0x0038];
        for (const cOff of candidateOffsets) {
          const teamCount = view.getUint32(secOffset + cOff, true);
          if (teamCount >= 1 && teamCount <= 6) {
            const team = [];
            for (let p = 0; p < teamCount; p++) {
              const pOffset = secOffset + cOff + 4 + (p * 100);
              if (pOffset + 100 <= secOffset + 4096) {
                const mon = parseGen3PartyPokemon(view, pOffset);
                if (mon) team.push(mon);
              }
            }
            if (team.length > 0) return team;
          }
        }
      }
    }

    // Se a ROM for um Romhack com layout customizado ou outro console,
    // retorna vazio para permitir que o usuário use o seletor visual interativo!
    return [];
  }

  /**
   * Gera o Cartão de Treinador em um HTML5 Canvas e desenha pixel-art estilo GBA
   */
  async function renderTrainerCardToCanvas({
    canvas,
    trainerName = 'ASH',
    trainerId = '54321',
    money = '$999,999',
    pokedex = '151',
    time = '42:15',
    theme = 'emerald', // emerald, firered, ruby, sapphire, indigo
    team = []
  }) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = 600;
    const height = 380;
    canvas.width = width * 2;
    canvas.height = height * 2;
    ctx.scale(2, 2);

    // Cores de Tema
    const THEMES = {
      emerald: { bgGrad: ['#064e3b', '#022c22'], border: '#10b981', header: '#059669', title: 'TRAINER CARD' },
      firered: { bgGrad: ['#7c2d12', '#431407'], border: '#f97316', header: '#ea580c', title: 'TRAINER CARD' },
      ruby:    { bgGrad: ['#881337', '#4c0519'], border: '#f43f5e', header: '#e11d48', title: 'TRAINER CARD' },
      sapphire:{ bgGrad: ['#0c4a6e', '#082f49'], border: '#38bdf8', header: '#0284c7', title: 'TRAINER CARD' },
      indigo:  { bgGrad: ['#1e1b4b', '#0f172a'], border: '#818cf8', header: '#6366f1', title: 'TRAINER CARD' }
    };
    const currentTheme = THEMES[theme] || THEMES.emerald;

    // Fundo Principal do Cartão
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, width, height);

    // Borda Metálica Chanfrada
    const cardX = 14;
    const cardY = 14;
    const cardW = width - 28;
    const cardH = height - 28;
    const radius = 16;

    // Gradiente de Fundo do Cartão
    const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    cardGrad.addColorStop(0, currentTheme.bgGrad[0]);
    cardGrad.addColorStop(1, currentTheme.bgGrad[1]);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.fillStyle = cardGrad;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = currentTheme.border;
    ctx.stroke();
    ctx.clip();

    // Textura Retrô de Linhas Sutis
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let y = cardY; y < cardY + cardH; y += 4) {
      ctx.fillRect(cardX, y, cardW, 2);
    }

    // Barra Superior: "TRAINER CARD" + PokeMule
    const headerH = 46;
    ctx.fillStyle = currentTheme.header;
    ctx.fillRect(cardX, cardY, cardW, headerH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Fredoka", "Nunito", sans-serif';
    ctx.fillText('TRAINER CARD', cardX + 18, cardY + 30);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = 'bold 12px "Nunito", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('PokeMule • Web Edition', cardX + cardW - 18, cardY + 29);
    ctx.textAlign = 'left';

    // Linha divisória brilhante
    ctx.fillStyle = currentTheme.border;
    ctx.fillRect(cardX, cardY + headerH, cardW, 2);

    // COLUNA ESQUERDA: Dados do Treinador
    const leftColX = cardX + 22;
    const leftColY = cardY + headerH + 26;

    function drawInfoRow(label, value, y) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.font = 'bold 12px "Nunito", sans-serif';
      ctx.fillText(label, leftColX, y);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px "Nunito", sans-serif';
      ctx.fillText(value, leftColX + 90, y);
    }

    drawInfoRow('NAME:', (trainerName || 'RED').toUpperCase(), leftColY);
    drawInfoRow('IDNo.', trainerId || '04215', leftColY + 28);
    drawInfoRow('MONEY:', money || '$999,999', leftColY + 56);
    drawInfoRow('POKÉDEX:', pokedex || '151', leftColY + 84);
    drawInfoRow('TIME:', time || '38:45', leftColY + 112);

    // ÁREA DIREITA: Grid dos 6 Pokémon
    const teamBoxX = cardX + 220;
    const teamBoxY = cardY + headerH + 16;
    const teamBoxW = cardW - 238;
    const teamBoxH = 175;

    // Fundo do Box da Equipe
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.roundRect(teamBoxX, teamBoxY, teamBoxW, teamBoxH, 10);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.stroke();

    // 6 Slots em 2 linhas x 3 colunas
    const slotW = (teamBoxW - 24) / 3;
    const slotH = 74;

    const defaultTeam = [
      { id: 6, name: 'Charizard', level: 68 },
      { id: 9, name: 'Blastoise', level: 66 },
      { id: 3, name: 'Venusaur', level: 65 },
      { id: 25, name: 'Pikachu', level: 72 },
      { id: 143, name: 'Snorlax', level: 64 },
      { id: 149, name: 'Dragonite', level: 70 }
    ];

    const party = (team && team.length > 0) ? team.slice(0, 6) : defaultTeam;

    // Carrega imagens dos sprites em paralelo
    const spritePromises = party.map(mon => {
      return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = mon.spriteUrl || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${mon.id}.png`;
        img.onload = () => resolve({ img, mon });
        img.onerror = () => resolve({ img: null, mon });
      });
    });

    const loadedSprites = await Promise.all(spritePromises);

    loadedSprites.forEach((item, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const sx = teamBoxX + 6 + (col * (slotW + 6));
      const sy = teamBoxY + 8 + (row * (slotH + 8));

      // Mini Box de cada Pokémon
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(sx, sy, slotW, slotH, 8);
      ctx.fill();

      if (item.img) {
        ctx.drawImage(item.img, sx + (slotW / 2) - 24, sy + 2, 48, 48);
      }

      // Nome & Nível
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px "Nunito", sans-serif';
      ctx.textAlign = 'center';
      const monName = item.mon.name ? item.mon.name.slice(0, 10) : 'Pokémon';
      ctx.fillText(monName, sx + (slotW / 2), sy + 58);

      ctx.fillStyle = currentTheme.border;
      ctx.font = 'bold 9px "Nunito", sans-serif';
      ctx.fillText(`Lv. ${item.mon.level || 50}`, sx + (slotW / 2), sy + 69);
      ctx.textAlign = 'left';
    });

    // ÁREA INFERIOR: 8 Insígnias de Ginásio (Gym Badges)
    const badgesY = cardY + cardH - 64;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.roundRect(cardX + 16, badgesY, cardW - 32, 50, 10);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.stroke();

    const BADGE_COLORS = [
      '#94a3b8', // Cinza Rocha
      '#38bdf8', // Azul Cascata
      '#fbbf24', // Amarelo Trovão
      '#4ade80', // Verde Arco-íris
      '#c084fc', // Roxo Alma
      '#fb7185', // Rosa Pântano
      '#f97316', // Laranja Vulcão
      '#eab308'  // Dourado Terra
    ];

    const badgeStartX = cardX + 36;
    const badgeSpacing = (cardW - 72) / 8;

    BADGE_COLORS.forEach((color, i) => {
      const bx = badgeStartX + (i * badgeSpacing) + 12;
      const by = badgesY + 25;

      // Círculo com brilho metálico
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, 14, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Reflexo metálico
      ctx.beginPath();
      ctx.arc(bx - 4, by - 4, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fill();
      ctx.restore();
    });

    ctx.restore();
  }

  function downloadCanvasAsPng(canvas, filename = 'trainer-card.png') {
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }

  return {
    inspectSrmParty,
    renderTrainerCardToCanvas,
    downloadCanvasAsPng,
    GEN3_NAMES
  };
});
