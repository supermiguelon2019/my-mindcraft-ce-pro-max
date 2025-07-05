import ZeroMd from '../node_modules/zero-md/src/lib/zero-md.js';

customElements.define('zero-md', ZeroMd);

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
            // Handle auto_idle_trigger as a nested object
            if (key === 'auto_idle_trigger' && typeof value === 'object' && value !== null) {
                const enabled = document.getElementById('auto_idle_trigger_enabled');
                const timeout = document.getElementById('auto_idle_trigger_timeout_secs');
                const message = document.getElementById('auto_idle_trigger_message');
                if (enabled) enabled.checked = !!value.enabled;
                if (timeout) timeout.value = value.timeout_secs ?? '';
                if (message) message.value = value.message ?? '';
                return;
            }
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
            // Also set home_ fields if they exist for this key
            const homeElement = document.getElementById('home_' + key);
            if (homeElement) {
                try {
                    homeElement.value = value;
                } catch (error) {
                    console.error(`Error setting value for home_${key}:`, error);
                }
            }
        });
    }).catch(error => {
        console.error('Error loading settings:', error);
    });

    // Function to collect current settings
    const collectSettings = () => {
        const settings = {};
        // Handle auto_idle_trigger as a nested object
        const idleEnabled = document.getElementById('auto_idle_trigger_enabled');
        const idleTimeout = document.getElementById('auto_idle_trigger_timeout_secs');
        const idleMessage = document.getElementById('auto_idle_trigger_message');
        if (idleEnabled || idleTimeout || idleMessage) {
            settings.auto_idle_trigger = {
                enabled: idleEnabled ? idleEnabled.checked : false,
                timeout_secs: idleTimeout && idleTimeout.value !== '' ? Number(idleTimeout.value) : 0,
                message: idleMessage ? idleMessage.value : ''
            };
        }
        document.querySelectorAll('[id]').forEach(element => {
            if (element.id && !['titlebar', 'title', 'window-controls', 'status', 'startButton', 'stopButton', 'resetButton',
                'auto_idle_trigger_enabled', 'auto_idle_trigger_timeout_secs', 'auto_idle_trigger_message'].includes(element.id)) {
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

    // Helper to set model section fields
    function setModelSectionFields(prefix, data) {
        document.getElementById(prefix + 'Api').value = data?.api || '';
        document.getElementById(prefix + 'Model').value = data?.model || '';
        document.getElementById(prefix + 'Url').value = data?.url || '';
        document.getElementById(prefix + 'Params').value = data?.params ? JSON.stringify(data.params, null, 2) : '';
    }

    if (profilePath) {
        title.textContent = 'Edit Profile';
        window.electronAPI.getProfileContent(profilePath).then(profile => {
            document.getElementById('profileName').value = profile.name || '';
            setModelSectionFields('profileModel', profile.model);
            setModelSectionFields('profileCodeModel', profile.code_model);
            setModelSectionFields('profileVisionModel', profile.vision_model);
            setModelSectionFields('profileEmbedding', profile.embedding);
            setModelSectionFields('profileSpeakModel', profile.speak_model);
            form.dataset.path = profilePath;
        });
    } else {
        title.textContent = 'New Profile';
        form.reset();
        // Also clear all model section fields
        ['profileModel','profileCodeModel','profileVisionModel','profileEmbedding','profileSpeakModel'].forEach(prefix => {
            setModelSectionFields(prefix, {});
        });
        delete form.dataset.path;
    }

    modal.style.display = 'block';
}

function saveProfile() {
    const form = document.getElementById('profileForm');
    // Helper to get model section fields as object or string
    function getModelSectionFields(prefix) {
        const model = document.getElementById(prefix + 'Model').value.trim();
        const api = document.getElementById(prefix + 'Api')?.value.trim();
        const url = document.getElementById(prefix + 'Url')?.value.trim();
        const paramsRaw = document.getElementById(prefix + 'Params')?.value.trim();
        let params = undefined;
        if (paramsRaw) {
            try {
                params = JSON.parse(paramsRaw);
            } catch (e) {
                showStatus('Invalid JSON in ' + prefix + ' Params', 'error');
                throw e;
            }
        }
        // If only model is filled, return as string
        if (model && !api && !url && !paramsRaw) return model;
        // If nothing is filled, return undefined
        if (!model && !api && !url && !paramsRaw) return undefined;
        // Otherwise, build object with only non-empty fields
        const obj = {};
        if (api) obj.api = api;
        if (model) obj.model = model;
        if (url) obj.url = url;
        if (params !== undefined) obj.params = params;
        return Object.keys(obj).length > 0 ? obj : undefined;
    }
    const profile = {
        name: document.getElementById('profileName').value.trim()
    };
    const modelFields = [
        ['model', 'profileModel'],
        ['code_model', 'profileCodeModel'],
        ['vision_model', 'profileVisionModel'],
        ['embedding', 'profileEmbedding'],
        ['speak_model', 'profileSpeakModel']
    ];
    for (const [key, prefix] of modelFields) {
        const val = getModelSectionFields(prefix);
        if (val !== undefined && val !== '') profile[key] = val;
    }
    const path = form.dataset.path || `./profiles/${profile.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    window.electronAPI.saveProfile({ path, content: profile })
        .then(() => {
            document.getElementById('profileModal').style.display = 'none';
            window.electronAPI.getAvailableProfiles().then(profiles => {
                const profileSelect = document.getElementById('profiles');
                profileSelect.innerHTML = '';
                profiles.forEach(profile => {
                    const option = document.createElement('option');
                    option.value = profile;
                    option.textContent = profile.replace(/^\.\//, '').replace('.json', '');
                    profileSelect.appendChild(option);
                });
            });
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
                //window.location.reload(); // Refresh profile list
                window.electronAPI.getAvailableProfiles().then(profiles => {
                    const profileSelect = document.getElementById('profiles');
                    profileSelect.innerHTML = ''; // Clear existing options
                    profiles.forEach(profile => {
                        const option = document.createElement('option');
                        option.value = profile;
                        option.textContent = profile.replace(/^\.\//, '').replace('.json', '');
                        profileSelect.appendChild(option);
                    });
                });
            });
        } else {
            showStatus('No profiles to delete', 'error');
        }
    });
}



// Add event listeners for profile management
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('addProfile').addEventListener('click', () => openProfileEditor());
    document.getElementById('editProfile').addEventListener('click', () => {
        const select = document.getElementById('profiles');
        if (select && select.value) {
            openProfileEditor(select.value);
        } else {
            showStatus('Select a profile to edit.', 'error');
        }
    });
    document.getElementById('saveProfile').addEventListener('click', saveProfile);
    document.getElementById('deleteProfile').addEventListener('click', deleteProfile);
    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('profileModal').style.display = 'none';
    });
    const mdViewer = document.querySelector('zero-md');
    mdViewer.src = "../README.md";
});

// Real-time console output
window.electronAPI.onConsoleOutput((data) => {
    const consoleOutput = document.getElementById('consoleOutput');
    if (consoleOutput) {
        const out = document.createElement('div');
        out.textContent = data;
        out.style.color = '#b0ffb0';
        out.style.whiteSpace = 'pre-wrap';
        consoleOutput.appendChild(out);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
});
