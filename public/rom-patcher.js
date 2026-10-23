/**
 * PokeMule ROM Patcher (IPS & BPS)
 * 100% Executado no navegador do usuário (Client-Side).
 * Nenhuma ROM é enviada para o servidor.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RomPatcher = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // CRC32 Table
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  // Decodifica Variable-Length Integer (VLI) do BPS
  function readBpsVli(bytes, cursor) {
    let result = 0;
    let shift = 1;
    while (true) {
      if (cursor.pos >= bytes.length) throw new Error('Fim inesperado ao ler dados do patch BPS.');
      const b = bytes[cursor.pos++];
      result += (b & 0x7f) * shift;
      if (b & 0x80) break;
      shift <<= 7;
      result += shift;
    }
    return result;
  }

  function applyIps(romBytes, patchBytes) {
    if (patchBytes.length < 8) throw new Error('Arquivo IPS inválido (muito pequeno).');
    const header = String.fromCharCode(...patchBytes.subarray(0, 5));
    if (header !== 'PATCH') throw new Error('Assinatura IPS inválida (esperava "PATCH").');

    let out = new Uint8Array(romBytes);
    let pos = 5;

    while (pos < patchBytes.length) {
      if (pos + 3 <= patchBytes.length) {
        const eofCheck = String.fromCharCode(...patchBytes.subarray(pos, pos + 3));
        if (eofCheck === 'EOF') {
          pos += 3;
          // Opcional: Truncation offset (3 bytes)
          if (pos + 3 <= patchBytes.length) {
            const truncLen = (patchBytes[pos] << 16) | (patchBytes[pos + 1] << 8) | patchBytes[pos + 2];
            if (truncLen < out.length) {
              out = out.subarray(0, truncLen);
            }
          }
          break;
        }
      }

      if (pos + 5 > patchBytes.length) break;

      const offset = (patchBytes[pos] << 16) | (patchBytes[pos + 1] << 8) | patchBytes[pos + 2];
      const length = (patchBytes[pos + 3] << 8) | patchBytes[pos + 4];
      pos += 5;

      if (length > 0) {
        // Registro Normal
        if (pos + length > patchBytes.length) throw new Error('Registro IPS corrompido.');
        const targetEnd = offset + length;
        if (targetEnd > out.length) {
          const expanded = new Uint8Array(targetEnd);
          expanded.set(out);
          out = expanded;
        }
        out.set(patchBytes.subarray(pos, pos + length), offset);
        pos += length;
      } else {
        // Registro RLE
        if (pos + 3 > patchBytes.length) throw new Error('Registro RLE IPS corrompido.');
        const rleLength = (patchBytes[pos] << 8) | patchBytes[pos + 1];
        const val = patchBytes[pos + 2];
        pos += 3;

        const targetEnd = offset + rleLength;
        if (targetEnd > out.length) {
          const expanded = new Uint8Array(targetEnd);
          expanded.set(out);
          out = expanded;
        }
        out.fill(val, offset, targetEnd);
      }
    }

    return out;
  }

  function applyBps(romBytes, patchBytes) {
    if (patchBytes.length < 16) throw new Error('Arquivo BPS inválido (muito pequeno).');
    const header = String.fromCharCode(...patchBytes.subarray(0, 4));
    if (header !== 'BPS1') throw new Error('Assinatura BPS inválida (esperava "BPS1").');

    const cursor = { pos: 4 };
    const srcSize = readBpsVli(patchBytes, cursor);
    const tgtSize = readBpsVli(patchBytes, cursor);
    const metaSize = readBpsVli(patchBytes, cursor);

    // Pula metadados se existirem
    cursor.pos += metaSize;

    const out = new Uint8Array(tgtSize);
    let srcOffset = 0;
    let tgtOffset = 0;
    const maxPatchPos = patchBytes.length - 12; // 12 bytes do rodapé (CRCs)

    while (cursor.pos < maxPatchPos) {
      const data = readBpsVli(patchBytes, cursor);
      const action = data & 3;
      const length = (data >> 2) + 1;

      if (action === 0) {
        // SourceRead: Copia da ROM original na posição alvo
        out.set(romBytes.subarray(tgtOffset, tgtOffset + length), tgtOffset);
        tgtOffset += length;
      } else if (action === 1) {
        // TargetRead: Lê direto dos bytes do patch
        out.set(patchBytes.subarray(cursor.pos, cursor.pos + length), tgtOffset);
        cursor.pos += length;
        tgtOffset += length;
      } else if (action === 2) {
        // SourceCopy: Copia da ROM original com deslocamento
        const d = readBpsVli(patchBytes, cursor);
        srcOffset += (d & 1) ? -(d >> 1) : (d >> 1);
        out.set(romBytes.subarray(srcOffset, srcOffset + length), tgtOffset);
        srcOffset += length;
        tgtOffset += length;
      } else if (action === 3) {
        // TargetCopy: Copia de dados já gerados no arquivo final
        const d = readBpsVli(patchBytes, cursor);
        let tgtSrc = tgtOffset + ((d & 1) ? -(d >> 1) : (d >> 1));
        for (let i = 0; i < length; i++) {
          out[tgtOffset++] = out[tgtSrc++];
        }
      }
    }

    return out;
  }

  async function patchRom(romFile, patchFile) {
    const romBuffer = await romFile.arrayBuffer();
    const patchBuffer = await patchFile.arrayBuffer();
    const romBytes = new Uint8Array(romBuffer);
    const patchBytes = new Uint8Array(patchBuffer);

    const patchName = patchFile.name.toLowerCase();
    let patchedBytes;

    if (patchName.endsWith('.bps') || (patchBytes[0] === 0x42 && patchBytes[1] === 0x50 && patchBytes[2] === 0x53 && patchBytes[3] === 0x31)) {
      patchedBytes = applyBps(romBytes, patchBytes);
    } else if (patchName.endsWith('.ips') || (patchBytes[0] === 0x50 && patchBytes[1] === 0x41 && patchBytes[2] === 0x54 && patchBytes[3] === 0x43 && patchBytes[4] === 0x48)) {
      patchedBytes = applyIps(romBytes, patchBytes);
    } else {
      throw new Error('Formato de patch não suportado. Use arquivos .bps ou .ips');
    }

    const cleanBaseName = romFile.name.replace(/\.[a-zA-Z0-9]+$/i, '');
    const cleanPatchName = patchFile.name.replace(/\.[a-zA-Z0-9]+$/i, '');
    const ext = romFile.name.split('.').pop() || 'gba';
    const finalName = `${cleanPatchName} [${cleanBaseName}].${ext}`;
    const blob = new Blob([patchedBytes], { type: 'application/octet-stream' });

    return {
      blob,
      name: finalName,
      bytes: patchedBytes,
      sizeMB: (patchedBytes.length / 1024 / 1024).toFixed(2)
    };
  }

  return {
    applyIps,
    applyBps,
    patchRom,
    crc32
  };
});
