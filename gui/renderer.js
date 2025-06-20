// Persist details open/closed state
document.addEventListener('DOMContentLoaded', () => {
    // Load saved states
    const savedStates = JSON.parse(localStorage.getItem('settingGroupStates') || '{}');
    document.querySelectorAll('.setting-group').forEach(group => {
        const summary = group.querySelector('summary');
        if (summary) {
            const key = summary.textContent;
            if (savedStates[key] !== undefined) {
                group.open = savedStates[key];
            }
        }
    });

    // Save states when changed
    document.querySelectorAll('.setting-group').forEach(group => {
        group.addEventListener('toggle', () => {
            const states = {};
            document.querySelectorAll('.setting-group').forEach(g => {
                const s = g.querySelector('summary');
                if (s) {
                    states[s.textContent] = g.open;
                }
            });
            localStorage.setItem('settingGroupStates', JSON.stringify(states));
        });
    });

    // Window controls
    document.getElementById('minimize-button')?.addEventListener('click', () => {
        window.electronAPI.minimizeWindow();
    });

    document.getElementById('maximize-button')?.addEventListener('click', () => {
        window.electronAPI.maximizeWindow();
    });

    document.getElementById('close-button')?.addEventListener('click', () => {
        window.electronAPI.closeWindow();
    });

    // Load profiles for the select element
    window.electronAPI.getAvailableProfiles().then(profiles => {
        const profileSelect = document.getElementById('profiles');
        profiles.forEach(profile => {
            const option = document.createElement('option');
            option.value = profile;
            option.textContent = profile.replace(/^\.\//, '').replace('.json', '');
            profileSelect.appendChild(option);
        });
    });

    // Load settings and populate form
    window.electronAPI.getSettings().then(settings => {
        console.log('Received settings:', settings);
        Object.entries(settings).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (element) {
                try {
                    if (element.type === 'checkbox') {
                        element.checked = !!value;
                    } else if (element.multiple) {
                        // Handle multiple select
                        const values = Array.isArray(value) ? value : [value];
                        Array.from(element.options).forEach(option => {
                            option.selected = values.includes(option.value);
                        });
                    } else if (['blocked_actions', 'plugins', 'only_chat_with'].includes(element.id)) {
                        // Handle array inputs
                        element.value = Array.isArray(value) ? value.join(', ') : value;
                    } else {
                        element.value = value;
                    }
                } catch (error) {
                    console.error(`Error setting value for ${key}:`, error);
                }
            }
        });
    }).catch(error => {
        console.error('Error loading settings:', error);
    });

    // Function to collect current settings
    const collectSettings = () => {
        const settings = {};
        document.querySelectorAll('[id]').forEach(element => {
            if (element.id && !['titlebar', 'title', 'window-controls', 'status', 'startButton', 'stopButton', 'resetButton'].includes(element.id)) {
                if (element.type === 'checkbox') {
                    settings[element.id] = element.checked;
                } else if (element.multiple) {
                    // Handle multiple select
                    settings[element.id] = Array.from(element.selectedOptions).map(option => option.value);
                } else if (['blocked_actions', 'plugins', 'only_chat_with'].includes(element.id)) {
                    // Handle array inputs
                    settings[element.id] = element.value.split(',').map(item => item.trim()).filter(Boolean);
                } else if (element.type === 'number') {
                    settings[element.id] = Number(element.value);
                } else {
                    settings[element.id] = element.value;
                }
            }
        });
        return settings;
    };

    // Save settings handler
    const saveSettings = () => {
        const settings = collectSettings();
        return window.electronAPI.saveSettings(settings)
            .then(() => showStatus('Settings saved successfully!', 'success'))
            .catch(error => showStatus('Error saving settings: ' + error.message, 'error'));
    };

    // Auto-save settings on any change
    document.querySelectorAll('input, select').forEach(element => {
        element.addEventListener('change', saveSettings);
    });
});

// Reset settings
document.getElementById('resetButton').addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all settings to their default values?')) {
        window.electronAPI.getSettings()
            .then(settings => {
                Object.entries(settings).forEach(([key, value]) => {
                    const element = document.getElementById(key);
                    if (element) {
                        if (element.type === 'checkbox') {
                            element.checked = value;
                        } else if (element.multiple) {
                            Array.from(element.options).forEach(option => {
                                option.selected = value.includes(option.value);
                            });
                        } else if (Array.isArray(value)) {
                            element.value = value.join(', ');
                        } else {
                            element.value = value;
                        }
                    }
                });
                showStatus('Settings reset to defaults', 'success');
            })
            .catch(error => showStatus('Error resetting settings: ' + error.message, 'error'));
    }
});    // Start server
document.getElementById('startButton').addEventListener('click', () => {
    const startButton = document.getElementById('startButton');
    startButton.disabled = true;
    showStatus('Starting server...', 'info');
    
    window.electronAPI.startMain()
        .then(success => {
            if (success) {
                showStatus('Server started successfully!', 'success');
            } else {
                showStatus('Failed to start server', 'error');
                startButton.disabled = false;
            }
        })
        .catch(error => {
            console.error('Start error:', error);
            showStatus('Error starting server: ' + error.message, 'error');
            startButton.disabled = false;
        });
});

// Stop server
document.getElementById('stopButton').addEventListener('click', () => {
    const stopButton = document.getElementById('stopButton');
    stopButton.disabled = true;
    showStatus('Stopping server...', 'info');
    
    window.electronAPI.stopMain()
        .then(success => {
            if (success) {
                showStatus('Server stopped successfully!', 'success');
                document.getElementById('startButton').disabled = false;
            } else {
                showStatus('Failed to stop server', 'error');
            }
            stopButton.disabled = false;
        })
        .catch(error => {
            console.error('Stop error:', error);
            showStatus('Error stopping server: ' + error.message, 'error');
            stopButton.disabled = false;
        });
});

// Show status message
function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status ' + type;
    status.style.display = 'block';
    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
}

// Profile management functions
function openProfileEditor(profilePath = null) {
    const modal = document.getElementById('profileModal');
    const form = document.getElementById('profileForm');
    const title = document.getElementById('profileModalTitle');
    
    if (profilePath) {
        title.textContent = 'Edit Profile';
        window.electronAPI.getProfileContent(profilePath).then(profile => {
            document.getElementById('profileName').value = profile.name || '';
            document.getElementById('profileModel').value = profile.model || '';
            document.getElementById('profileEmbedding').value = profile.embedding || '';
            form.dataset.path = profilePath;
        });
    } else {
        title.textContent = 'New Profile';
        form.reset();
        delete form.dataset.path;
    }
    
    modal.style.display = 'block';
}

function saveProfile() {
    const form = document.getElementById('profileForm');
    const profile = {
        name: document.getElementById('profileName').value,
        model: document.getElementById('profileModel').value,
        embedding: document.getElementById('profileEmbedding').value
    };
    
    const path = form.dataset.path || `./profiles/${profile.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    
    window.electronAPI.saveProfile({ path, content: profile })
        .then(() => {
            document.getElementById('profileModal').style.display = 'none';
            window.location.reload(); // Refresh profile list
        })
        .catch(error => showStatus('Error saving profile: ' + error.message, 'error'));
}

function deleteProfile() {
    // Get profiles from settings.json
    const selectedProfiles = window.electronAPI.getSettings().then(settings => {
        return settings['profiles'];
    });
    selectedProfiles.then(profiles => {
        if (profiles && Array.isArray(profiles)) {
            profiles.forEach((profile) => {
                console.log('Deleting profile:', profile);
                window.electronAPI.deleteProfile(profile);
                window.location.reload(); // Refresh profile list
            });
        } else {
            showStatus('No profiles to delete', 'error');
        }
    });
}



// Add event listeners for profile management
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('addProfile').addEventListener('click', () => openProfileEditor());
    document.getElementById('saveProfile').addEventListener('click', saveProfile);
    document.getElementById('deleteProfile').addEventListener('click', deleteProfile);
    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('profileModal').style.display = 'none';
    });
});
