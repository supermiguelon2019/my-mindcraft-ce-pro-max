// Import modules
import process from 'node:process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { app, BrowserWindow, ipcMain, Tray, Menu } from 'electron';
import Store from 'electron-store';
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import defaultSettings from '../settings.js';
import { table } from 'node:console';

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

async function createWindow() {    mainWindow = new BrowserWindow({
        width: 800,
        height: 800,
        center: true,  // Add this to center window
        frame: false,
        resizable: true,
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

// Save settings
ipcMain.handle('save-settings', (event, newSettings) => {
    try {
        // Filter out UI-specific properties and only keep known settings
        const validSettings = {};
        const knownSettings = [
            'minecraft_version', 'host', 'port', 'auth',
            'host_mindserver', 'mindserver_host', 'mindserver_port',
            'base_profile', 'profiles', 'plugins', 'load_memory',
            'init_message', 'only_chat_with', 'language',
            'show_bot_views', 'allow_insecure_coding', 'allow_vision',
            'vision_mode', 'blocked_actions', 'code_timeout_mins',
            'relevant_docs_count', 'max_messages', 'num_examples',
            'max_commands', 'verbose_commands', 'narrate_behavior',
            'chat_bot_messages', 'speak', 'stt_transcription',
            'stt_provider', 'stt_username', 'stt_agent_name',
            'stt_rms_threshold', 'stt_silence_duration',
            'stt_min_audio_duration', 'stt_max_audio_duration',
            'stt_debug_audio', 'stt_cooldown_ms',
            'stt_speech_threshold_ratio', 'stt_consecutive_speech_samples',
            'log_normal_data', 'log_reasoning_data', 'log_vision_data'
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
});

// Start main process
ipcMain.handle('start-main', async () => {      
    try {
        const mainPath = join(__dirname, 'main-wrapper.js');
        console.log('Starting wrapped main process:', mainPath);
        
        const { fork } = await import('child_process');
        mainProcess = fork(mainPath, [], {
            stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
            env: {
                ...process.env,
                NODE_OPTIONS: '--experimental-modules --es-module-specifier-resolution=node'
            }
        });
        
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
            });
            
            mainProcess.on('exit', (code) => {
                console.log('Main process exited with code:', code);
                clearTimeout(startupTimeout);
                if (code !== 0) {
                    const errorMsg = `Process exited with code ${code}`;
                    mainWindow.webContents.send('main-exit', errorMsg);
                    reject(new Error(errorMsg));
                }
            });            startupTimeout = setTimeout(() => {
                if (mainProcess.connected) {
                    console.log('Main process started successfully');
                    mainWindow.webContents.send('startup-status', 'Main process started successfully');
                    
                    
                    // Set up window behavior
                    mainWindow.on('close', (event) => {
                        if (!app.isQuitting) {
                            event.preventDefault();
                            mainWindow.hide();
                        }
                        // else: let the app quit normally
                    });

                    // Show window initially
                    mainWindow.show();
                    resolve(true);
                } else {
                    const error = new Error('Main process failed to start within timeout');
                    mainWindow.webContents.send('main-error', error.message);
                    reject(error);
                }
            }, 5000); // Increased timeout to 5 seconds
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
        const fullPath = join(rootDir, path.replace(/^\.\//, ''));
        if (existsSync(fullPath)) {
            const content = readFileSync(fullPath, 'utf8');
            return JSON.parse(content);
        }
        return null;
    } catch (error) {
        console.error('Error reading profile:', error);
        throw error;
    }
});