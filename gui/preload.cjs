// eslint-disable-next-line no-undef
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    
    // Settings management
    getSettings: () => {
        return ipcRenderer.invoke('get-settings')
            .catch(error => {
                console.error('Error getting settings:', error);
                return {};
            });
    },

    loadSettings: (data) => {
        return ipcRenderer.invoke('load-settings', data)
            .catch(error => {
                console.error('Error loading settings:', error);
                return {};
            });
    },

    saveSettingsAs: (data) => {
        return ipcRenderer.invoke('save-settings-as', data)
            .catch(error => {
                console.error('Error saving settings:', error);
                return {};
            });
    },

    getSettingsJS: () => {
        return ipcRenderer.invoke('get-settings-js')
            .catch(error => {
                console.error('Error getting settings:', error);
                return {};
            });
    },

    saveSettings: (settings) => {
        return ipcRenderer.invoke('save-settings', settings)
            .catch(error => {
                console.error('Error saving settings:', error);
                throw error;
            });
    },

    getAvailablePresets: () => {
        console.log('Requesting presets...');
        return ipcRenderer.invoke('get-available-presets')
            .then(profiles => {
                console.log('Received presets:', profiles);
                return profiles;
            })
            .catch(error => {
                console.error('Error getting presets:', error);
                return [];
            });
    },
    
    // Profile management
    getAvailableProfiles: () => {
        console.log('Requesting profiles...');
        return ipcRenderer.invoke('get-available-profiles')
            .then(profiles => {
                console.log('Received profiles:', profiles);
                return profiles;
            })
            .catch(error => {
                console.error('Error getting profiles:', error);
                return [];
            });
    },
    saveProfile: (data) => ipcRenderer.invoke('save-profile', data),
    deleteProfile: (profile) => ipcRenderer.invoke('delete-profile', profile),
    getProfileContent: (path) => ipcRenderer.invoke('get-profile-content', path),
    
    // Application control
    startMain: () => {
        return ipcRenderer.invoke('start-main')
            .catch(error => {
                console.error('Error starting main process:', error);
                throw error;
            });
    },
    stopMain: () => {
        return ipcRenderer.invoke('stop-main')
            .catch(error => {
                console.error('Error stopping main process:', error);
                throw error;
            });
    },
    
    // Event listeners
    onMainError: (callback) => ipcRenderer.on('main-error', (_, error) => {
        console.error('Main process error:', error);
        callback(_, error);
    }),
    onMainExit: (callback) => ipcRenderer.on('main-exit', (_, code) => {
        console.log('Main process exited with code:', code);
        callback(_, code);
    }),
    onConsoleOutput: (callback) => ipcRenderer.on('console-output', (_, data) => callback(data)),
    onStats: (callback) => ipcRenderer.on('system-stats', (_, data) => callback(data)),
    onStatus: (callback) => ipcRenderer.on('server-stats', (_, data) => callback(data)),
    onNewPort: (callback) => ipcRenderer.on('new-port-and-host', (_, data) => callback(data))
});
