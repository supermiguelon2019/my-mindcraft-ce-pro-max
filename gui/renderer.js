import ZeroMd from '../node_modules/zero-md/src/lib/zero-md.js';

customElements.define('zero-md', ZeroMd);

import { EditorView, basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { jsonSchema } from 'codemirror-json-schema';
import { oneDark } from '@codemirror/theme-one-dark';

const schema = {
    type: 'object',
    properties: {
        cooldown: { type: 'number', title: 'Cooldown (seconds)' },
        conversing: { type: 'string', title: 'Conversing' },
        coding: { type: 'string', title: 'Coding' },
        saving_memory: { type: 'string', title: 'Saving Memory' },
        bot_responder: { type: 'string', title: 'Bot Responder' },
        image_analysis: { type: 'string', title: 'Image Analysis' },
        speak_model: { type: 'string', title: 'Speak Model' },
        modes: { 
        type: 'object', 
        title: 'Modes',
        properties: {
            self_preservation: { type: 'boolean' },
            unstuck: { type: 'boolean' },
            cowardice: { type: 'boolean' },
            self_defense: { type: 'boolean' },
            hunting: { type: 'boolean' },
            item_collecting: { type: 'boolean' },
            torch_placing: { type: 'boolean' },
            elbow_room: { type: 'boolean' },
            idle_staring: { type: 'boolean' },
            cheat: { type: 'boolean' }
        },
        required: []
        }
    },
    required: []
    };

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

    window.electronAPI.getAvailablePresets().then(presets => {
        const presetSelect = document.getElementById('presets');
        presets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.relativePath;
            option.textContent = preset.name;
            presetSelect.appendChild(option);
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
            .catch(error => showStatus('Error saving settings: ' + error.message, 'error'));
    };

    // Auto-save settings on any change
    document.querySelectorAll('input, select').forEach(element => {
        element.addEventListener('change', saveSettings);
    });
});

async function checkServerAndLoad() {
    try {
    const res = await fetch('http://127.0.0.1:3000', {
        method: 'HEAD',
        mode: 'no-cors' // Avoids blocking, even if CORS fails
    });

    // If we get here, assume server is up
    document.getElementById('loading').style.display = 'none';
    const iframe = document.getElementById('View');
    iframe.src = 'http://127.0.0.1:3000';
    iframe.style.display = 'block';
    } catch (err) {
    // Try again later
    setTimeout(checkServerAndLoad, 1000);
    }
}



// Reset settings
document.getElementById('resetButton').addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all settings to their default values?')) {
        window.electronAPI.getSettingsJS()
            .then(settingsJS => {
                Object.entries(settingsJS).forEach(([key, value]) => {
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
                showStatus('Settings reset to defaults', 'success');
            })
            .catch(error => showStatus('Error resetting settings: ' + error.message, 'error'));
    }
});

document.getElementById('saveButton').addEventListener('click', () => {
    document.getElementById('promptContainer').style.display = 'block';
});



document.getElementById('confirmPrompt').addEventListener('click', () => {
    const name = document.getElementById('presetName').value;
    document.getElementById('promptContainer').style.display = 'none';
    
    console.log("User entered preset name:", name);
    window.electronAPI.saveSettingsAs({name}).then(() => {
        window.electronAPI.getAvailablePresets().then(presets => {
        const presetSelect = document.getElementById('presets');
        presets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.relativePath;
            option.textContent = preset.name;
            presetSelect.appendChild(option);
        });
    });
    });
});

document.getElementById('cancelPrompt').addEventListener('click', () => {
    document.getElementById('promptContainer').style.display = 'none';
});


document.getElementById('loadButton').addEventListener('click', () => {
    document.getElementById('presetPromptContainer').style.display = 'block';
});

document.getElementById('loadConfirmPrompt').addEventListener('click', () => {
    document.getElementById('presetPromptContainer').style.display = 'none';
    

    window.electronAPI.loadSettings(document.getElementById("presets").value).then(()=>{
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
    });
});

document.getElementById('loadCancelPrompt').addEventListener('click', () => {
    document.getElementById('presetPromptContainer').style.display = 'none';
});


// Start server
document.getElementById('startButton').addEventListener('click', async () => {
    const startButton = document.getElementById('startButton');
    startButton.disabled = true;
    
    window.electronAPI.startMain()
        .then(success => {
            if (!success) {
                showStatus('Failed to start server', 'error');
                startButton.disabled = false;
            }
        })
        .catch(error => {
            console.error('Start error:', error);
            showStatus('Error starting server: ' + error.message, 'error');
            startButton.disabled = false;
        });
    await checkServerAndLoad();
});

// Stop server
document.getElementById('stopButton').addEventListener('click', () => {
    const stopButton = document.getElementById('stopButton');
    stopButton.disabled = true;
    
    window.electronAPI.stopMain()
        .then(success => {
            if (success) {
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
    
        document.getElementById("View").style.display = "none";
        document.getElementById("loading").style.display = "block";
    
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
let editor;
// Profile management functions
function openProfileEditor(profilePath = null) {
    const modal = document.getElementById('profileModal');
    const form = document.getElementById('profileForm');
    const title = document.getElementById('profileModalTitle');
    
    // Helper to set model section fields
    function setModelSectionFields(prefix, data) {
        if (typeof(data) == "object") {
            document.getElementById(prefix + 'Api').value = data?.api || '';
            document.getElementById(prefix + 'Model').value = data?.model || '';
            document.getElementById(prefix + 'Url').value = data?.url || '';
        } else {
            document.getElementById(prefix + 'Model').value = data || '';
        }
    }

    if (profilePath) {
        title.textContent = 'Edit Profile';
        window.electronAPI.getProfileContent(profilePath).then(profile => {

            const { name, model, code_model, vision_model, embedding, speak_model, ...extras } = profile;
            form.reset();
            document.getElementById('profileName').value = profile.name || '';
            setModelSectionFields('profileModel', model);
            setModelSectionFields('profileCodeModel', code_model);
            setModelSectionFields('profileVisionModel', vision_model);
            setModelSectionFields('profileEmbedding', embedding);
            setModelSectionFields('profileSpeakModel', speak_model);
            console.log(extras);
            editor = new EditorView({
                doc: JSON.stringify(extras, false, '\t'),
                extensions: [
                    basicSetup,
                    json(),
                    jsonSchema(schema),
                    //hideLineNumbers,
                    oneDark
                ],
                parent: document.getElementById('json-editor')
                });

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
        editor = new EditorView({
                doc: '{\n\t\n}',
                extensions: [
                    basicSetup,
                    json(),
                    jsonSchema(schema),
                    //hideLineNumbers,
                    oneDark
                ],
                parent: document.getElementById('json-editor')
                });
    }

    modal.style.display = 'block';
}



function saveProfile() {
    editor.destroy();
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

    try {
        const editorText = editor.state.doc.toString().trim();
        if (editorText) {
            const extraFields = JSON.parse(
                editorText.startsWith('{') ? editorText : `{${editorText}}`
            );
            Object.assign(profile, extraFields);
        }
    } catch (e) {
        showStatus('Invalid JSON in editor area', 'error');
        throw e;
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

import Chart from 'chart.js/auto';
import StreamingPlugin from 'chartjs-plugin-streaming';
import 'chartjs-adapter-luxon';
Chart.register(StreamingPlugin);

let currentCpu;
let currentRam;
let currentGpu;
let currentVRAM;

const ctx = document.getElementById('statsChart').getContext('2d');

const chart = new Chart(ctx, {
  type: 'line',
  data: {
    datasets: [
      {
        label: 'CPU',
        borderColor: 'blue',
        backgroundColor: 'rgba(0,0,255,0.1)',
        data: [],
        tension: 0.3,
        radius:0.1,
        cubicInterpolationMode: 'monotone'
      },
      {
        label: 'RAM',
        borderColor: 'green',
        backgroundColor: 'rgba(0,255,0,0.1)',
        data: [],
        tension: 0.3,
        radius:0.1,
        cubicInterpolationMode: 'monotone'
      },
      {
        label: 'GPU',
        borderColor: 'red',
        data: [],
        tension: 0.3,
        radius:0.1,
        cubicInterpolationMode: 'monotone'
      },
      {
        label: 'VRAM',
        borderColor: 'orange',
        data: [],
        tension: 0.3,
        radius:0.1,
        cubicInterpolationMode: 'monotone'
      }
    ]
  },
  options: {
    layout: {
        autoPadding: false
    },
    scales: {
      x: {
        display:false,
        type: 'realtime',
        realtime: {
          duration: 30000,     // display last 30s
          refresh: 1000,        // fetch new data every second
          delay: 1000,          // delay to allow smooth rendering :contentReference[oaicite:4]{index=4}
          onRefresh: chart => {
            const now = Date.now();
            chart.data.datasets[0].data.push({ x: now, y: currentCpu });
            chart.data.datasets[1].data.push({ x: now, y: currentRam });
            chart.data.datasets[2].data.push({ x: now, y: currentGpu });
            chart.data.datasets[3].data.push({ x: now, y: currentVRAM });
          }
        }
      },
      y: {
        display: false,
        suggestedMin: 0,
        suggestedMax: 100
      }
    },
    plugins: {
      legend: { 
          labels: {
            usePointStyle: true, // circle/dot instead of square
            pointStyle: 'circle', // circle, rectRounded, etc.
          }
       },
      title: { display: true, text: 'Performance' }
    },
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
  }
});


window.electronAPI.onStats(({ cpu, memory, gpu, vram }) => {
  currentCpu = cpu;
  currentRam = memory;
  currentGpu = gpu;
  currentVRAM = vram;
});


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
        editor.destroy();
        document.getElementById('profileModal').style.display = 'none';
    });
    const mdViewer = document.querySelector('zero-md');
    mdViewer.src = "../README.md";
    // --- Canvas Smoke Effect ---
    const canvas = document.getElementById('stolen-smoke-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        let particleCount = 75;
        let animationFrameId;

        function setCanvasSize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        class Particle {
            constructor() {
                this.reset();
                this.x = Math.random() * canvas.width;
            }

            reset() {
                this.x = canvas.width + Math.random() * 100;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 50 + 20;
                this.speedX = -Math.random() * 0.8 - 0.2;
                this.speedY = (Math.random() - 0.5) * 0.4;
                this.opacity = Math.random() * 0.1 + 0.02;
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                if (this.x < -this.size) {
                    this.reset();
                }
            }

            draw() {
                ctx.beginPath();
                const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
                gradient.addColorStop(0, `rgba(40, 90, 160, ${this.opacity})`);
                gradient.addColorStop(1, `rgba(40, 90, 160, 0)`);
                ctx.fillStyle = gradient;
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function initParticles() {
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();
            }
            animationFrameId = requestAnimationFrame(animate);
        }
        
        function startAnimation() {
            setCanvasSize();
            initParticles();
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            animate();
        }

        startAnimation();
        window.addEventListener('resize', startAnimation);
    }
});

// Real-time console output
window.electronAPI.onConsoleOutput((data) => {
    const consoleOutput = document.getElementById('consoleOutput');
    const homeConsoleOutput = document.getElementById('homeConsoleOutput');

    const appendAndScroll = (container) => {
        const isAtBottom =
            container.scrollHeight - container.scrollTop <= container.clientHeight + 5;

        const out = document.createElement('div');
        out.textContent = data;
        out.style.color = '#b0ffb0';
        out.style.whiteSpace = 'pre-wrap';

        container.appendChild(out);

        if (isAtBottom) {
            container.scrollTop = container.scrollHeight;
        }
    };

    if (consoleOutput) appendAndScroll(consoleOutput);
    if (homeConsoleOutput) appendAndScroll(homeConsoleOutput);
});

window.electronAPI.onStatus((data) => {
    const text_display = document.getElementById('status-text');
    const text_tip = document.getElementById('status-tip');
    if (data.error) {
        document.documentElement.style.setProperty('--circle-color', 'red');
        text_display.textContent = "no server detected";
        text_tip.textContent = "make sure the port and ip are correct";
        return;
    }
    if (data.modsRequired) {
        document.documentElement.style.setProperty('--circle-color', 'red');
        text_display.textContent = "the server is modded";
        text_tip.textContent = "the bot cant join to modded servers";
        return;
    }
    if (!data.canFit) {
        document.documentElement.style.setProperty('--circle-color', 'orange');
        text_display.textContent = "the server is full";
        text_tip.textContent = "the bot cant join";
        return;
    }
    if (data.ChatReports) {
        document.documentElement.style.setProperty('--circle-color', 'yellow');
        text_display.textContent = "No chat reports is installed";
        text_tip.textContent = "the bot cant see messages";
        return;
    }
    document.documentElement.style.setProperty('--circle-color', 'green');
    text_display.textContent = "the bot ready!";
    text_tip.textContent = "";
});

window.electronAPI.onNewPort((data) => {
    const port = document.getElementById("port");
    const home_port = document.getElementById("home_port");
    port.value = data.port;
    home_port.value = data.port;
    console.log(data);
});