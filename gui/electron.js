// Import modules
import process from 'node:process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { app, BrowserWindow, ipcMain, Tray, Menu } from 'electron';
import Store from 'electron-store';
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import defaultSettings from '../settings.js';

// Set up paths FIRST
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = dirname(__dirname);
const settingsPath = join(rootDir, 'gui', 'settings.json');
process.env.SETTINGS_PATH = settingsPath;  // Set early before any imports

// Improved settings loading
let settings;
if (existsSync(settingsPath)) {
    try {
        const rawSettings = readFileSync(settingsPath, 'utf8');
        const userSettings = JSON.parse(rawSettings);
        console.log('Loaded user settings:', userSettings);
        settings = { ...defaultSettings, ...userSettings };
        writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8'); // Write merged settings
    } catch (error) {
        console.error('Error loading user settings, using defaults:', error);
        settings = { ...defaultSettings };
        writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    }
} else {
    settings = { ...defaultSettings };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log('Created new settings file with defaults');
}

// Initialize store
const store = new Store();
let mainWindow;
let mainProcess = null; // Add this declaration

// Window control handlers
ipcMain.on('minimize-window', () => {
    mainWindow?.minimize();
});

ipcMain.on('maximize-window', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});

ipcMain.on('close-window', () => {
    app.isQuitting = true;
    app.quit();
});

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 765,
        height: 800,
        center: true,  // Add this to center window
        frame: false,
        resizable: true,
        icon: join(__dirname, 'icon.ico'), // Set app icon
        minHeight: 0,
        minWidth: 765,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            enableRemoteModule: true,
            preload: join(__dirname, 'preload.cjs')
        }
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    await mainWindow.loadFile(join(__dirname, 'index.html'));
    mainWindow.webContents.send('console-output', "this is a console");
}

// Initialize app when ready
const init = async () => {
    await app.whenReady();
    try {
        await createWindow();
    } catch (err) {
        console.error('Error creating window:', err);
    }
};

init();

// Handle proper app quitting
app.on('before-quit', () => {
    app.isQuitting = true;
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow().catch((err) => {
            console.error('Error creating window:', err);
        });
    }
});

// IPC handlers for settings management
ipcMain.handle('get-settings', () => {
    try {
        if (!settings.profiles) {
            settings.profiles = [];
        }
        return settings;
    } catch (error) {
        console.error('Error reading settings:', error);
        throw error;
    }
});

ipcMain.handle('save-settings-as', (event, data) => {
    const newPath = join(rootDir, 'gui', 'presets', data.name+'.json');
    fs.copyFile(settingsPath, newPath, (err) => {
    if (err) {
        console.error('Error copying file:', err);
    } else {
        console.log('File copied and renamed successfully!', data);
    }
    });
});

ipcMain.handle('load-settings', (event, data) => {
    const newPath = join(rootDir, data);
    fs.copyFile(newPath, settingsPath, (err) => {
    if (err) {
        console.error('Error copying file:', err);
    } else {
        console.log('File copied and renamed successfully!', data);
    }
    });
    if (existsSync(settingsPath)) {
        try {
            const rawSettings = readFileSync(settingsPath, 'utf8');
            const userSettings = JSON.parse(rawSettings);
            console.log('Loaded user settings:', userSettings);
            settings = { ...defaultSettings, ...userSettings };
            writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8'); // Write merged settings
        } catch (error) {
            console.error('Error loading user settings, using defaults:', error);
            settings = { ...defaultSettings };
            writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
        }
    } else {
        settings = { ...defaultSettings };
        writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
        console.log('Created new settings file with defaults');
    }
});

ipcMain.handle('get-available-presets', () => {
    try {
        const presetsDir = join(rootDir, 'gui', 'presets');
        console.log('Looking for presets in:', presetsDir);

        let allPresets = [];
        // Get profiles in profiles/ recursively
        if (existsSync(presetsDir)) {
            console.log("getting presets");
            allPresets = getPresetsRecursively(presetsDir, rootDir);
            console.log("got presets: ", allPresets);
        } else {
            console.error('Presets directory not found:', presetsDir);
        }

        // Merge and sort
        return allPresets;
    } catch (error) {
        console.error('Error reading presets:', error);
        return [];
    }
});

function getPresetsRecursively(dir, baseDir) {
    const presets = [];
    const items = readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
        const fullPath = join(dir, item.name);
        const relativePath = './' + join(fullPath.replace(baseDir, '')).replace(/\\/g, '/');

        if (
            item.isFile() && 
            item.name.endsWith('.json')
        ) {
            console.log('Added preset:', item.name);
            presets.push({relativePath, name: item.name.replace(dir, '').replace('.json', '')});
        }
    }

    return presets;
}

import settingsJS from '../settings.js';

// IPC handlers for settings management
ipcMain.handle('get-settings-js', () => {
    console.log(settingsJS);
    return settingsJS;
});

// Get available profiles
ipcMain.handle('get-available-profiles', () => {
    try {
        const rootDir = dirname(__dirname);
        const profilesDir = join(rootDir, 'profiles');
        console.log('Looking for profiles in:', profilesDir, 'and', rootDir);

        let allProfiles = [];
        // Get profiles in profiles/ recursively
        if (existsSync(profilesDir)) {
            allProfiles = getProfilesRecursively(profilesDir, rootDir);
        } else {
            console.error('Profiles directory not found:', profilesDir);
        }

        // Also check all .json files in the base dir (rootDir)
        const baseDirProfiles = [];
        const baseItems = readdirSync(rootDir, { withFileTypes: true });
        for (const item of baseItems) {
            if (item.isFile() && item.name.endsWith('.json')) {
                const fullPath = join(rootDir, item.name);
                try {
                    const content = readFileSync(fullPath, 'utf8');
                    const profile = JSON.parse(content);
                    if (profile.name && profile.model) {
                        // Use relative path from rootDir
                        baseDirProfiles.push('./' + item.name);
                    }
                } catch (err) {
                    console.warn(`Skipping invalid base profile ${item.name}:`, err.message);
                }
            }
        }

        // Merge and sort
        return [...allProfiles, ...baseDirProfiles].sort((a, b) => a.localeCompare(b));
    } catch (error) {
        console.error('Error reading profiles:', error);
        return [];
    }
});

function getProfilesRecursively(dir, baseDir) {
    const profiles = [];
    const items = readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
        const fullPath = join(dir, item.name);
        const relativePath = './' + join(fullPath.replace(baseDir, '')).replace(/\\/g, '/');

        if (item.isDirectory()) {
            if (item.name !== 'defaults' && item.name !== 'tasks') {
                profiles.push(...getProfilesRecursively(fullPath, baseDir));
            }
        } else if (
            item.isFile() && 
            item.name.endsWith('.json') && 
            !item.name.startsWith('_')
        ) {
            try {
                const content = readFileSync(fullPath, 'utf8');
                const profile = JSON.parse(content);
                if (profile.model) {
                    console.log('Added profile:', item.name);
                    profiles.push(relativePath);
                }
            } catch (err) {
                console.warn(`Skipping invalid profile ${item.name}:`, err.message);
            }
        }
    }

    return profiles.sort((a, b) => a.localeCompare(b));
}

function saveSettings(newSettings) {
    try {
        // Filter out UI-specific properties and only keep known settings
        const validSettings = {};
        const knownSettings = [
            "minecraft_version","host","port","auth","host_mindserver","mindserver_host","mindserver_port",
            "base_profile","profiles","plugins","load_memory","init_message","only_chat_with","language",
            "show_bot_views","allow_insecure_coding","allow_vision","vision_mode","blocked_actions",
            "code_timeout_mins","relevant_docs_count","max_messages","num_examples","max_commands",
            "verbose_commands","narrate_behavior","chat_bot_messages","auto_idle_trigger","speak",
            "stt_transcription","stt_provider","stt_username","stt_agent_name","stt_rms_threshold",
            "stt_silence_duration","stt_min_audio_duration","stt_max_audio_duration","stt_debug_audio",
            "stt_cooldown_ms","stt_speech_threshold_ratio","stt_consecutive_speech_samples","log_normal_data",
            "log_reasoning_data","log_vision_data","external_logging"
        ];

        // Only copy known settings properties
        for (const key of knownSettings) {
            if (key in newSettings) {
                validSettings[key] = newSettings[key];
            }
        }

        // Update in-memory settings with only valid properties
        Object.assign(settings, validSettings);
        
        // Save to JSON file
        writeFileSync(process.env.SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
        
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        throw error;
    }
}

// Save settings
ipcMain.handle('save-settings', (event, newSettings) => {
    saveSettings(newSettings);
});

import nou from 'node-os-utils';
import { exec } from 'node:child_process';
import util from 'util';
const execAsync = util.promisify(exec);
import fs from 'node:fs';

async function detectGpuVendor() {
  try {
    await execAsync('nvidia-smi -L');
    return 'nvidia';
  } catch {/* nothing here */}

  try {
    await execAsync('rocm-smi --showproductname');
    return 'amd-rocm';
  } catch {/* nothing above */}

  try {
    await execAsync('radeon-smi -d');
    return 'amd';
  } catch {/* something below */}

  return 'unknown';
}

async function getGpuUsage() {
  const vendor = await detectGpuVendor();

  try {
    if (vendor === 'nvidia') {
      const { stdout } = await execAsync('nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits');
      const lines = stdout.trim().split('\n');

      let totalGpuUtil = 0;
      let totalMemUsed = 0;
      let totalMem = 0;

      for (const line of lines) {
        const [gpuUtil, memUsed, memTotal] = line.split(',').map(v => parseFloat(v.trim()));
        totalGpuUtil += gpuUtil;
        totalMemUsed += memUsed;
        totalMem += memTotal;
      }

      return {
        gpuVendor: 'nvidia',
        gpuUsage: (totalGpuUtil / lines.length).toFixed(2),
        vramUsage: ((totalMemUsed / totalMem) * 100).toFixed(2)
      };
    }

    if (vendor === 'amd-rocm') {
      const { stdout } = await execAsync('rocm-smi --showuse --json');
      const data = JSON.parse(stdout);

      let totalGpuUtil = 0;
      let totalMemUsed = 0;
      let totalMem = 0;
      let count = 0;

      for (const key of Object.keys(data)) {
        const g = data[key];
        if (!g['GPU use (%)']) continue;

        totalGpuUtil += parseFloat(g['GPU use (%)']);
        totalMemUsed += parseFloat(g['VRAM Used (MiB)']);
        totalMem += parseFloat(g['VRAM Total (MiB)']);
        count++;
      }

      return {
        gpuVendor: 'amd-rocm',
        gpuUsage: (totalGpuUtil / count).toFixed(2),
        vramUsage: ((totalMemUsed / totalMem) * 100).toFixed(2)
      };
    }

    if (vendor === 'amd') {
      const { stdout } = await execAsync('radeon-smi --showuse --json');
      const data = JSON.parse(stdout);

      let totalGpuUtil = 0;
      let totalMemUsed = 0;
      let totalMem = 0;
      let count = 0;

      for (const g of data) {
        if (!g['GPU use (%)']) continue;

        totalGpuUtil += parseFloat(g['GPU use (%)']);
        totalMemUsed += parseFloat(g['VRAM Used (MiB)']);
        totalMem += parseFloat(g['VRAM Total (MiB)']);
        count++;
      }

      return {
        gpuVendor: 'amd',
        gpuUsage: (totalGpuUtil / count).toFixed(2),
        vramUsage: ((totalMemUsed / totalMem) * 100).toFixed(2)
      };
    }

    return {
      gpuVendor: 'unknown',
      gpuUsage: null,
      vramUsage: null
    };
  } catch (err) {
    console.error(`Error reading GPU stats for ${vendor}:`, err.message);
    return {
      gpuVendor: vendor,
      gpuUsage: null,
      vramUsage: null
    };
  }
}

setInterval(async () => {
    
    const cpu = await nou.cpu.usage();
    const memory = await (await nou.mem.info()).usedMemPercentage;

    const gpu = await getGpuUsage();
    const gpuUsage = Number(gpu.gpuUsage);
    const VRAM = Number(gpu.vramUsage);

    mainWindow.webContents.send('system-stats', {
        cpu: cpu,
        memory: memory,
        gpu: gpuUsage,
        vram: VRAM
    });
    console.log('Sent system stats:', {
        cpu: cpu,
        memory: memory,
        gpuUsage: gpuUsage,
        VRAM: VRAM
    });
  }, 1000);


  import mc from 'minecraftstatuspinger';

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

function extractLatestVersion(versionString) {
  const matches = versionString.match(/\d+\.\d+(\.\d+)*/g);
  if (!matches || matches.length === 0) return versionString;
  let latest = matches[0];
  for (const v of matches) {
    if (compareVersions(v, latest) > 0) {
      latest = v;
    }
  }
  return latest;
}

async function checkServer(host = '127.0.0.1', port = -1, botCount = 1) {
  try {


    const res = await (port !== ""
      ? mc.lookup({ host, port, ping: false, throwOnParseError: false, SRVLookup: false, JSONParse: true })
      : mc.lookup({ host, ping: false, throwOnParseError: false, SRVLookup: true, JSONParse: true })
    );

    const online = res.status.players.online;
    const max = res.status.players.max;

    let version = extractLatestVersion(res.status.version.name);

    const MAX = '1.21.4';
        if (compareVersions(version, MAX) > 0) {
        version = MAX;
    }

    const available = max - online;
    const mods = res.status.isModded;
    const chatRestrict = res.status.preventsChatReports;

    return {
      version,
      online,
      max,
      available,
      canFit: available >= botCount,
      modsRequired: !!mods,
      ChatReports: !!chatRestrict
    };
  } catch(err) {
    return { canFit: false, error: 'Server unreachable or offline, '+err };
  }
}

async function serverIntervalFunc() {

    const server_stats = await checkServer(settings.host, settings.port, settings.profiles.length );
    
    mainWindow.webContents.send('server-stats', server_stats );

    if (!server_stats.error) {
        saveSettings({minecraft_version: server_stats.version});
        console.log(server_stats);
    } else {
        console.log(server_stats.error);
    }

}

let serverInterval = setInterval(serverIntervalFunc, 1000);
let serverIntervalOn = true;

ipcMain.handle('start-main', async () => {      
    try {
        const mainPath = join(__dirname, '../main.js');
        console.log('Starting wrapped main process:', mainPath);
        
        const { fork } = await import('child_process');
        mainProcess = fork(mainPath, [], {
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'], // Use pipes for stdout/stderr
            windowsHide: true, // Hide console window on Windows
            detached: false,
            env: {
                ...process.env,
            }
        });

        clearInterval(serverInterval);
        serverIntervalOn = false;

        // Forward stdout to renderer
        if (mainProcess.stdout) {
            mainProcess.stdout.on('data', (data) => {
                mainWindow.webContents.send('console-output', data.toString());
            });
        }
        // Forward stderr to renderer
        if (mainProcess.stderr) {
            mainProcess.stderr.on('data', (data) => {
                mainWindow.webContents.send('console-output', data.toString());
            });
        }
        
        return new Promise((resolve, reject) => {
            let startupTimeout;
            
            mainProcess.on('message', (msg) => {
                if (msg.type === 'status') {
                    mainWindow.webContents.send('startup-status', msg.message);
                }
            });

            mainProcess.on('error', (err) => {
                console.error('Main process error:', err);
                clearTimeout(startupTimeout);
                mainWindow.webContents.send('main-error', err.message);
                reject(err);
                if (!serverIntervalOn){
                    serverInterval = setInterval(serverIntervalFunc, 1000);
                }
            });
            
            mainProcess.on('exit', (code) => {
                console.log('Main process exited with code:', code);
                clearTimeout(startupTimeout);
                if (code !== 0) {
                    const errorMsg = `Process exited with code ${code}`;
                    mainWindow.webContents.send('main-exit', errorMsg);
                    reject(new Error(errorMsg));
                }
                if (!serverIntervalOn){
                    serverInterval = setInterval(serverIntervalFunc, 1000);
                }
            });            
            startupTimeout = setTimeout(() => {
                if (mainProcess.connected) {
                    console.log('Main process started successfully');
                    mainWindow.webContents.send('startup-status', 'Main process started successfully');
                    
                    

                    // Show window initially
                    mainWindow.show();
                    resolve(true);
                } else {
                    const error = new Error('Main process failed to start within timeout');
                    mainWindow.webContents.send('main-error', error.message);
                    reject(error);
                }
            }, 5000); 
        });
    } catch (error) {
        console.error('Error starting main.js:', error);
        mainWindow.webContents.send('main-error', error.message);
        return false;
    }
});

// Add stop-main handler
ipcMain.handle('stop-main', () => {
    if (mainProcess && !mainProcess.killed) {
        mainProcess.kill();
        mainProcess = null;
        return true;
    }
    return false;
});

// Save profile handler
ipcMain.handle('save-profile', (event, { path, content }) => {
    try {
        const fullPath = join(rootDir, path.replace(/^\.\//, ''));
        writeFileSync(fullPath, JSON.stringify(content, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving profile:', error);
        throw error;
    }
});

// Delete profile handler
ipcMain.handle('delete-profile', (event, profile) => {
    console.log(event); // This will log the event object
    try {
        const fullPath = join(rootDir, profile);
        if (existsSync(fullPath)) {
            unlinkSync(fullPath);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting profile:', error);
        throw error;
    }
});

// Get profile content handler
ipcMain.handle('get-profile-content', (event, path) => {
    try {
        const fullPath = join(rootDir, path);
        console.log(fullPath);
        if (existsSync(fullPath)) {
            console.log("☺");
            const content = readFileSync(fullPath, 'utf8');
            console.log(content);
            const parsed = JSON.parse(content);
            console.log(parsed);
            return parsed;
        }
        return null;
    } catch (error) {
        console.error('Error reading profile:', error);
        throw error;
    }
});