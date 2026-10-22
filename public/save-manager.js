/**
 * PokeBat & HackDex - Gerenciador de Saves 100% Client-Side (IndexedDB + Google Drive do Usuário)
 * - Nenhum save fica armazenado no PC do host/servidor.
 * - Cada visitante tem seu Cofre no próprio navegador (IndexedDB) + Sync opcional direto no seu Google Drive pessoal.
 */

const DB_NAME = 'PokeBatUserVaultDB';
const DB_VERSION = 1;
const STORE_SAVES = 'saves';
const GDRIVE_FOLDER_NAME = 'PokeBat_Emulator_Saves';
const GDRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile';
window.DEFAULT_GOOGLE_CLIENT_ID = '387974378779-jfl0kd70i9b1giuqhkipholr557ueomv.apps.googleusercontent.com';

class UserSaveManager {
  constructor() {
    this.dbPromise = this._initDB();
    this.accessToken = sessionStorage.getItem('gdrive_access_token') || '';
    this.userProfile = JSON.parse(sessionStorage.getItem('gdrive_user_profile') || 'null');
    this.folderId = sessionStorage.getItem('gdrive_folder_id') || '';
    this.tokenClient = null;
  }

  _initDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_SAVES)) {
          db.createObjectStore(STORE_SAVES, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getRecord(gameId) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SAVES, 'readonly');
      const req = tx.objectStore(STORE_SAVES).get(gameId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async putRecord(record) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SAVES, 'readwrite');
      const req = tx.objectStore(STORE_SAVES).put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  }

  async listAllSaves() {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SAVES, 'readonly');
      const req = tx.objectStore(STORE_SAVES).getAll();
      req.onsuccess = () => {
        const list = (req.result || []).map(r => ({
          id: r.id,
          title: r.title || r.id,
          console: r.console || 'GBA',
          downloadPageUrl: r.downloadPageUrl || '',
          cover: r.cover || '',
          updatedAt: r.updatedAt || new Date().toISOString(),
          hasSrm: !!(r.srmBytes && r.srmBytes.byteLength > 0),
          srmSize: r.srmBytes ? r.srmBytes.byteLength : 0,
          hasState: !!(r.stateBytes && r.stateBytes.byteLength > 0),
          stateSize: r.stateBytes ? r.stateBytes.byteLength : 0,
          syncedDrive: !!r.syncedDrive
        }));
        list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async saveGameData({ id, type, bytes, title, console: sys, url, cover }) {
    const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const existing = (await this.getRecord(id)) || {
      id,
      title: title || id,
      console: sys || 'GBA',
      downloadPageUrl: url || '',
      cover: cover || ''
    };

    existing.title = title || existing.title;
    existing.console = sys || existing.console;
    if (url) existing.downloadPageUrl = url;
    if (cover) existing.cover = cover;
    existing.updatedAt = new Date().toISOString();

    if (type === 'srm') {
      existing.srmBytes = uint8.slice().buffer;
    } else if (type === 'state') {
      existing.stateBytes = uint8.slice().buffer;
    }

    // Se estiver logado no Google Drive, sincroniza na nuvem do próprio usuário
    if (this.isLoggedIn()) {
      try {
        await this._uploadToGoogleDrive(existing, type, uint8);
        existing.syncedDrive = true;
      } catch (err) {
        console.warn('[Google Drive Sync Warning]', err);
      }
    }

    await this.putRecord(existing);
    return existing;
  }

  async getSaveBytes(gameId, type = 'srm') {
    let record = await this.getRecord(gameId);

    // Se não tiver localmente mas estiver logado no Google Drive, tenta puxar do Drive
    if ((!record || (type === 'srm' && !record.srmBytes) || (type === 'state' && !record.stateBytes)) && this.isLoggedIn()) {
      try {
        await this.pullFromGoogleDrive();
        record = await this.getRecord(gameId);
      } catch (_) {}
    }

    if (!record) return null;
    const buf = type === 'srm' ? record.srmBytes : record.stateBytes;
    return buf ? new Uint8Array(buf) : null;
  }

  async deleteSave(gameId) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SAVES, 'readwrite');
      const req = tx.objectStore(STORE_SAVES).delete(gameId);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // ==================== GOOGLE DRIVE PERSONAL SYNC ====================

  isLoggedIn() {
    return !!this.accessToken;
  }

  getClientId() {
    return localStorage.getItem('pokebat_google_client_id') || window.DEFAULT_GOOGLE_CLIENT_ID || '';
  }

  setClientId(clientId) {
    localStorage.setItem('pokebat_google_client_id', clientId.trim());
  }

  async loginWithGoogle(customClientId = '') {
    if (customClientId) this.setClientId(customClientId);
    const clientId = this.getClientId();
    if (!clientId) {
      throw new Error('MISSING_CLIENT_ID');
    }

    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.onload = resolve;
        s.onerror = () => reject(new Error('Falha ao carregar SDK do Google Identity'));
        document.head.appendChild(s);
      });
    }

    return new Promise((resolve, reject) => {
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GDRIVE_SCOPE,
        callback: async (resp) => {
          if (resp.error) {
            return reject(new Error(resp.error_description || resp.error));
          }
          this.accessToken = resp.access_token;
          sessionStorage.setItem('gdrive_access_token', this.accessToken);

          try {
            const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${this.accessToken}` }
            });
            if (uRes.ok) {
              this.userProfile = await uRes.json();
              sessionStorage.setItem('gdrive_user_profile', JSON.stringify(this.userProfile));
            }
          } catch (_) {}

          // Sincroniza saves do Google Drive com o navegador atual
          try {
            await this.pullFromGoogleDrive();
            await this.pushAllLocalToGoogleDrive();
          } catch (syncErr) {
            console.warn('[Drive Initial Sync]', syncErr);
          }

          resolve(this.userProfile);
        }
      });

      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  logoutGoogle() {
    this.accessToken = '';
    this.userProfile = null;
    this.folderId = '';
    sessionStorage.removeItem('gdrive_access_token');
    sessionStorage.removeItem('gdrive_user_profile');
    sessionStorage.removeItem('gdrive_folder_id');
  }

  async _ensureDriveFolder() {
    if (this.folderId) return this.folderId;

    const q = encodeURIComponent(`name = '${GDRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });

    if (searchRes.status === 401) {
      this.logoutGoogle();
      throw new Error('Sessão do Google expirada. Faça login novamente.');
    }

    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      this.folderId = searchData.files[0].id;
      sessionStorage.setItem('gdrive_folder_id', this.folderId);
      return this.folderId;
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: GDRIVE_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });
    const created = await createRes.json();
    this.folderId = created.id;
    sessionStorage.setItem('gdrive_folder_id', this.folderId);
    return this.folderId;
  }

  async _uploadToGoogleDrive(record, type, uint8) {
    const folderId = await this._ensureDriveFolder();
    const fileName = `${record.id}.${type}`;

    // Verifica se o arquivo já existe na pasta do usuário
    const q = encodeURIComponent(`name = '${fileName}' and '${folderId}' in parents and trashed = false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    const searchData = await searchRes.json();
    const existingFileId = searchData.files?.[0]?.id;

    const metadata = {
      name: fileName,
      description: JSON.stringify({
        id: record.id,
        title: record.title,
        console: record.console,
        downloadPageUrl: record.downloadPageUrl,
        cover: record.cover,
        updatedAt: record.updatedAt
      })
    };
    if (!existingFileId) {
      metadata.parents = [folderId];
    }

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([uint8], { type: 'application/octet-stream' }));

    const uploadUrl = existingFileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const upRes = await fetch(uploadUrl, {
      method: existingFileId ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: form
    });

    if (!upRes.ok) {
      throw new Error(`Erro ao enviar ${fileName} ao Google Drive (${upRes.status})`);
    }
  }

  async pushAllLocalToGoogleDrive() {
    if (!this.isLoggedIn()) return;
    const db = await this.dbPromise;
    const allRecords = await new Promise((resolve) => {
      const tx = db.transaction(STORE_SAVES, 'readonly');
      const req = tx.objectStore(STORE_SAVES).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    for (const r of allRecords) {
      if (r.srmBytes && !r.syncedDrive) {
        await this._uploadToGoogleDrive(r, 'srm', new Uint8Array(r.srmBytes));
        r.syncedDrive = true;
        await this.putRecord(r);
      }
      if (r.stateBytes && !r.syncedDrive) {
        await this._uploadToGoogleDrive(r, 'state', new Uint8Array(r.stateBytes));
        r.syncedDrive = true;
        await this.putRecord(r);
      }
    }
  }

  async pullFromGoogleDrive() {
    if (!this.isLoggedIn()) return 0;
    const folderId = await this._ensureDriveFolder();
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,description,modifiedTime,size)`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    if (!listRes.ok) return 0;
    const data = await listRes.json();
    const files = data.files || [];
    let count = 0;

    for (const f of files) {
      const match = f.name.match(/^(.+)\.(srm|state)$/i);
      if (!match) continue;
      const gameId = match[1];
      const type = match[2].toLowerCase();

      let meta = {};
      try {
        meta = JSON.parse(f.description || '{}');
      } catch (_) {}

      const existing = (await this.getRecord(gameId)) || {
        id: gameId,
        title: meta.title || gameId,
        console: meta.console || 'GBA',
        downloadPageUrl: meta.downloadPageUrl || '',
        cover: meta.cover || '',
        updatedAt: meta.updatedAt || f.modifiedTime || new Date().toISOString(),
        syncedDrive: true
      };

      const binRes = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      if (!binRes.ok) continue;
      const arrayBuf = await binRes.arrayBuffer();

      if (type === 'srm') existing.srmBytes = arrayBuf;
      if (type === 'state') existing.stateBytes = arrayBuf;
      existing.syncedDrive = true;

      await this.putRecord(existing);
      count++;
    }
    return count;
  }
}

window.userSaveManager = new UserSaveManager();
