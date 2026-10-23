/**
 * PokeMule Pokémon Wiki & Type Chart
 * - Calculadora de Eficácia de Tipos (Gen 6-9, incluindo Fada) com suporte a Tipos Duplos
 * - Guia Prático de Evoluções por Troca em Romhacks & Jogos Clássicos
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PokemonWiki = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const TYPE_NAMES_PT = {
    normal: 'Normal',
    fire: 'Fogo',
    water: 'Água',
    grass: 'Grama',
    electric: 'Elétrico',
    ice: 'Gelo',
    fighting: 'Lutador',
    poison: 'Veneno',
    ground: 'Terra',
    flying: 'Voador',
    psychic: 'Psíquico',
    bug: 'Inseto',
    rock: 'Pedra',
    ghost: 'Fantasma',
    dragon: 'Dragão',
    steel: 'Aço',
    dark: 'Noturno',
    fairy: 'Fada'
  };

  const TYPE_COLORS = {
    normal: '#9ca3af',
    fire: '#f97316',
    water: '#38bdf8',
    grass: '#22c55e',
    electric: '#eab308',
    ice: '#7dd3fc',
    fighting: '#b91c1c',
    poison: '#a855f7',
    ground: '#ca8a04',
    flying: '#818cf8',
    psychic: '#ec4899',
    bug: '#84cc16',
    rock: '#a16207',
    ghost: '#6366f1',
    dragon: '#7c3aed',
    steel: '#94a3b8',
    dark: '#475569',
    fairy: '#f472b6'
  };

  // Matriz de Dano Gen 6+: atacante -> defensor -> multiplicador
  // 2 = super efetivo, 0.5 = não muito efetivo, 0 = sem efeito, 1 = normal (padrão)
  const ATTACK_CHART = {
    normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
    fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
    water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
    grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
    electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
    ice:      { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
    fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
    poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
    ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
    flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
    psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
    bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
    rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
    ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
    dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
    steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
    dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
    fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
  };

  const ALL_TYPES = Object.keys(TYPE_NAMES_PT);

  /**
   * Calcula as defesas e fraquezas de um Pokémon com 1 ou 2 tipos
   */
  function computeDefenses(type1, type2 = null) {
    const multipliers = {};
    ALL_TYPES.forEach(t => { multipliers[t] = 1; });

    ALL_TYPES.forEach(atk => {
      const vs1 = (ATTACK_CHART[atk] && ATTACK_CHART[atk][type1] !== undefined) ? ATTACK_CHART[atk][type1] : 1;
      let vs2 = 1;
      if (type2 && type2 !== type1) {
        vs2 = (ATTACK_CHART[atk] && ATTACK_CHART[atk][type2] !== undefined) ? ATTACK_CHART[atk][type2] : 1;
      }
      multipliers[atk] = vs1 * vs2;
    });

    const weaknesses4x = [];
    const weaknesses2x = [];
    const neutral1x = [];
    const resistances05x = [];
    const resistances025x = [];
    const immunities0x = [];

    ALL_TYPES.forEach(t => {
      const val = multipliers[t];
      if (val === 4) weaknesses4x.push(t);
      else if (val === 2) weaknesses2x.push(t);
      else if (val === 1) neutral1x.push(t);
      else if (val === 0.5) resistances05x.push(t);
      else if (val === 0.25) resistances025x.push(t);
      else if (val === 0) immunities0x.push(t);
    });

    return {
      weaknesses4x,
      weaknesses2x,
      neutral1x,
      resistances05x,
      resistances025x,
      immunities0x,
      multipliers
    };
  }

  // Guia de Evoluções por Troca com métodos adaptados para Romhacks
  const TRADE_EVOLUTIONS = [
    {
      from: 'Kadabra',
      to: 'Alakazam',
      fromId: 64,
      toId: 65,
      methodRomhack: 'Link Stone (Cabo de Ligação) ou Nível 37',
      methodOriginal: 'Troca simples'
    },
    {
      from: 'Machoke',
      to: 'Machamp',
      fromId: 67,
      toId: 68,
      methodRomhack: 'Link Stone ou Nível 37',
      methodOriginal: 'Troca simples'
    },
    {
      from: 'Graveler',
      to: 'Golem',
      fromId: 75,
      toId: 76,
      methodRomhack: 'Link Stone ou Nível 37',
      methodOriginal: 'Troca simples'
    },
    {
      from: 'Haunter',
      to: 'Gengar',
      fromId: 93,
      toId: 94,
      methodRomhack: 'Link Stone ou Nível 37 / Pedra da Noite',
      methodOriginal: 'Troca simples'
    },
    {
      from: 'Onix',
      to: 'Steelix',
      fromId: 95,
      toId: 208,
      methodRomhack: 'Usar Metal Coat (ou subir de nível segurando)',
      methodOriginal: 'Troca segurando Metal Coat'
    },
    {
      from: 'Scyther',
      to: 'Scizor',
      fromId: 123,
      toId: 212,
      methodRomhack: 'Usar Metal Coat (ou subir de nível segurando)',
      methodOriginal: 'Troca segurando Metal Coat'
    },
    {
      from: 'Poliwhirl',
      to: 'Politoed',
      fromId: 61,
      toId: 186,
      methodRomhack: 'Usar King\'s Rock (ou Pedra da Água/Lua)',
      methodOriginal: 'Troca segurando King\'s Rock'
    },
    {
      from: 'Slowpoke',
      to: 'Slowking',
      fromId: 79,
      toId: 199,
      methodRomhack: 'Usar King\'s Rock',
      methodOriginal: 'Troca segurando King\'s Rock'
    },
    {
      from: 'Seadra',
      to: 'Kingdra',
      fromId: 117,
      toId: 230,
      methodRomhack: 'Usar Dragon Scale (ou Nível 40)',
      methodOriginal: 'Troca segurando Dragon Scale'
    },
    {
      from: 'Porygon',
      to: 'Porygon2',
      fromId: 137,
      toId: 233,
      methodRomhack: 'Usar Up-Grade',
      methodOriginal: 'Troca segurando Up-Grade'
    },
    {
      from: 'Porygon2',
      to: 'Porygon-Z',
      fromId: 233,
      toId: 474,
      methodRomhack: 'Usar Dubious Disc',
      methodOriginal: 'Troca segurando Dubious Disc'
    },
    {
      from: 'Feebas',
      to: 'Milotic',
      fromId: 349,
      toId: 350,
      methodRomhack: 'Usar Prism Scale / Pedra da Água ou Beleza Máx.',
      methodOriginal: 'Troca segurando Prism Scale ou Beleza Alta'
    },
    {
      from: 'Clamperl',
      to: 'Huntail / Gorebyss',
      fromId: 366,
      toId: 367,
      methodRomhack: 'Usar Deep Sea Tooth (Huntail) / Deep Sea Scale (Gorebyss)',
      methodOriginal: 'Troca segurando dente/escama'
    },
    {
      from: 'Electabuzz',
      to: 'Electivire',
      fromId: 125,
      toId: 466,
      methodRomhack: 'Usar Electirizer / Nível 45',
      methodOriginal: 'Troca segurando Electirizer'
    },
    {
      from: 'Magmar',
      to: 'Magmortar',
      fromId: 126,
      toId: 467,
      methodRomhack: 'Usar Magmarizer / Nível 45',
      methodOriginal: 'Troca segurando Magmarizer'
    },
    {
      from: 'Rhydon',
      to: 'Rhyperior',
      fromId: 112,
      toId: 464,
      methodRomhack: 'Usar Protector / Nível 45',
      methodOriginal: 'Troca segurando Protector'
    },
    {
      from: 'Dusclops',
      to: 'Dusknoir',
      fromId: 356,
      toId: 477,
      methodRomhack: 'Usar Reaper Cloth / Pedra da Noite',
      methodOriginal: 'Troca segurando Reaper Cloth'
    },
    {
      from: 'Boldore',
      to: 'Gigalith',
      fromId: 525,
      toId: 526,
      methodRomhack: 'Link Stone ou Nível 38',
      methodOriginal: 'Troca simples'
    },
    {
      from: 'Gurdurr',
      to: 'Conkeldurr',
      fromId: 533,
      toId: 534,
      methodRomhack: 'Link Stone ou Nível 38',
      methodOriginal: 'Troca simples'
    },
    {
      from: 'Phantump',
      to: 'Trevenant',
      fromId: 708,
      toId: 709,
      methodRomhack: 'Link Stone ou Pedra da Folha / Nível 36',
      methodOriginal: 'Troca simples'
    }
  ];

  return {
    TYPE_NAMES_PT,
    TYPE_COLORS,
    ALL_TYPES,
    computeDefenses,
    TRADE_EVOLUTIONS
  };
});
