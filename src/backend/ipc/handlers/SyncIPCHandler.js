import { ipcMain } from 'electron';
import { SyncService } from '../../../services/sync/SyncService.js';

const syncService = SyncService.getInstance();

export function registerSyncHandlers() {
  console.log('[SyncIPCHandler] Registering sync handlers...');

  ipcMain.handle('sync:getConfig', async () => {
    try {
      const cfg = await syncService.getConfig();
      // Never return apiKey in plain text to renderer logs by accident.
      return { success: true, data: { ...cfg, apiKey: cfg.apiKey ? '********' : '' }, hasApiKey: !!cfg.apiKey };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to get sync config' };
    }
  });

  ipcMain.handle('sync:setConfig', async (_evt, partial) => {
    try {
      // renderer may send apiKey; store it
      await syncService.setConfig(partial || {});
      return { success: true };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to set sync config' };
    }
  });

  ipcMain.handle('sync:getStatus', async () => {
    try {
      const status = await syncService.getStatus();
      return { success: true, data: status };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to get sync status' };
    }
  });

  ipcMain.handle('sync:verify', async () => {
    try {
      const res = await syncService.verifyEntitlement();
      return res;
    } catch (e) {
      return { success: false, message: e?.message || 'Verification failed' };
    }
  });

  ipcMain.handle('sync:estimate', async () => {
    try {
      return await syncService.getEstimate();
    } catch (e) {
      return { success: false, message: e?.message || 'Estimate failed' };
    }
  });

  ipcMain.handle('sync:push', async () => {
    return await syncService.pushSnapshot();
  });

  ipcMain.handle('sync:pull', async (_evt, options = {}) => {
    return await syncService.pullLatest({ restore: !!options.restore });
  });

  console.log('[SyncIPCHandler] ✅ Sync handlers registered');
}

