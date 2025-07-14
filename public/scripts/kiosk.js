'use strict';

    const logPanel = document.getElementById('logPanel');
    const logToggleBtn = document.getElementById('logToggleBtn');
    const hideLogBtn = document.getElementById('hideLogBtn');

    // Global variable to store the peer connection
    let peerConnection;

/////////////////////////////////////////////////////////////////
// GIVE THE KIOSK A RANDOM NAME
/////////////////////////////////////////////////////////////////
    const bearNames = [
        'GrizzlyBear', 'FormosanBear', 'PolarBear', 'Panda', 'BlackBear',
        'SunBear', 'SpectacledBear', 'SlothBear', 'SpiritBear', 'MoonBear'
        ];

    const bear = bearNames[Math.floor(Math.random() * bearNames.length)];
    const username = `${bear}-kiosk`

    localStorage.setItem('growltalk_name', username);

/////////////////////////////////////////////////////////////////
// LOG VIDEO CALL SERVER EVENTS
/////////////////////////////////////////////////////////////////
function output(message) {
    const c = document.getElementById('console');
    
    c.value += message;
    c.value += '\n';
    c.scrollTop = c.scrollHeight;
}

/////////////////////////////////////////////////////////////////
// CHECK IF THE KIOSK HAS ANY AUDIO DEVICES
/////////////////////////////////////////////////////////////////

async function checkAudioDevices() {
    try {
        // Check if MediaDevices API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            output('MediaDevices API not supported - audio disabled');
            return false;
        }
        
        // Check for audio devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => 
            device.kind === 'audioinput' && device.deviceId !== 'default'
        );
        
        if (audioInputs.length > 0) {
            // Test actual audio access
            try {
                const testStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: true, 
                    video: false 
                });
                testStream.getTracks().forEach(track => track.stop());
                output('Audio enabled: microphone available and accessible');
                return true;
            } catch (audioError) {
                output(`Audio devices found but not accessible: ${audioError.message}`);
                return false;
            }
        } else {
            output('No audio input devices found - video only mode');
            return false;
        }
        
    } catch (error) {
        output(`Error checking audio availability: ${error.message}`);
        return false;
    }
}

/////////////////////////////////////////////////////////////////
// INITIALIZE PEER CONNECTION
/////////////////////////////////////////////////////////////////
async function initializePeerConnection() {

    const hasAudio = await checkAudioDevices(); // Conditionally enable audio
    
    peerConnection = new PeerConnection({
        constraints: {
            audio: hasAudio, 
            video: true,
            width: { ideal: 320 },
            height: { ideal: 240 },
            frameRate: { max: 30 }
        },
        remoteVideo: document.getElementById('remoteVideo'),
        remoteScreen: document.getElementById('remoteScreen'),
        localVideo: document.getElementById('localVideo')
    });

    // Set up all event listeners
    setupPeerConnectionEvents();
    
    if (hasAudio) {
        output('🎤 Audio and video call ready');
    } else {
        output('📹 Video-only call mode (no microphone)');
    }
}

///////////////////////////////////////////////////////////////////////////
// SHOW / HIDE STICKY NOTE WITH USERNAME 
///////////////////////////////////////////////////////////////////////////
function showStickyNote(message) {
    const sticky = document.getElementById('sticky-note');
    const header = document.querySelector('.header');
    sticky.textContent = message;
    sticky.style.display = 'block';
    if (header) header.classList.add('with-sticky-note');
}

function hideStickyNote() {
    const sticky = document.getElementById('sticky-note');
    const header = document.querySelector('.header');
    sticky.style.display = 'none';
    if (header) header.classList.remove('with-sticky-note');
}

//////////////////////////////////////////////////////////////////////
// Setup all peer connection event listeners
///////////////////////////////////////////////////////////////////////
function setupPeerConnectionEvents() {
    peerConnection.on('connected', function (id ) {
        let name = document.getElementById('name').value || '';
        const msg = `Connected: my id is ${id} - ${name}`;
        output(msg);
        //showToast(msg, 'success');
        showStickyNote(msg)
    });

    peerConnection.on('disconnected', function (reason) {
        output(`disconnected: ${reason}`);
        showToast('Disconnected', 'error');
        hideStickyNote();
        const ul = document.getElementById('contactsList');
        ul.innerHTML = '';
    });

    peerConnection.on('peerConnected', function (id, name) {
        if (checkPersona(name) === "operator") {
            output(`new user [${id}]${name} enter`);        
            showToast(`${name} entered`, 'success');

            let li = document.getElementById(`contactsListItem-${id}`);
            if (li == null) {
                li = document.createElement('li');
                li.id = `contactsListItem-${id}`;

                const ul = document.getElementById('contactsList');
                ul.appendChild(li);
            }

            li.textContent = `[${id}] ${name}`;            

        }
    });

    peerConnection.on('peerDisconnected', function (id, name) {
        if (checkPersona(name) === "operator") {
        output(`user [${id}]${name} leave`);
        showToast(`${name} left`, 'error');
        const li = document.getElementById(`contactsListItem-${id}`);
            if (li != null) {
                const ul = document.getElementById('contactsList');
                ul.removeChild(li);
            }        
        }
    });

    peerConnection.on('peerCall', function(id, name) {
        return confirm(`user [${id}] ${name} wants to call you`);
    });

    peerConnection.on('sessionConnected', function(id, name) {
        output(`open session with user [${id}]${name}`);
         showToast(`Session with user ${name}`, 'success');
    });

    peerConnection.on('sessionDisconnected', function() {
        output('close session');
        showToast(`Disconnected`, 'error');
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    // Handle stored name from localStorage
    const storedName = localStorage.getItem('growltalk_name');
    if (storedName) {
        const nameInput = document.getElementById('name');
        if (nameInput) {
            nameInput.value = storedName;
        }
        localStorage.removeItem('growltalk_name');
    }

    // Handle stored connection settings
    const ip = localStorage.getItem('growltalk_ip');
    const port = localStorage.getItem('growltalk_port');

    if (ip) document.getElementById('address').value = ip;
    if (port) document.getElementById('port').value = port;

    // Initialize PeerConnection with conditional audio
    await initializePeerConnection();
});

// Button event listeners
    logToggleBtn.addEventListener('click', () => {
      logPanel.classList.add('show');
    });

    hideLogBtn.addEventListener('click', () => {
      logPanel.classList.remove('show');
    });

// Also bind the button click
document.getElementById('login').addEventListener('click', handleLoginClick);

document.getElementById('logout').addEventListener('click', () => {
    const btn = document.getElementById('logout');
    btn.disabled = true;
    setTimeout(() => { btn.disabled = false; }, 3000);

    peerConnection.logout();
});

window.addEventListener('beforeunload', () => {
    peerConnection.logout();
});

document.getElementById('call').addEventListener('click', () => {
    const btn = document.getElementById('call');
    btn.disabled = true;
    setTimeout(() => { btn.disabled = false; }, 3000);

    const to = document.getElementById('to').value;
    peerConnection.callToPeer(to);
});

document.getElementById('callAny').addEventListener('click', () => {

    const btn = document.getElementById('callAny');
    btn.disabled = true;
    setTimeout(() => { btn.disabled = false; }, 3000);

    peerConnection.callAnyPeer();
});

document.getElementById('hangUp').addEventListener('click', () => {
    const btn = document.getElementById('hangUp');
    btn.disabled = true;
    setTimeout(() => { btn.disabled = false; }, 3000);  
    peerConnection.hangUp();
});

// Optional: Add a function to manually refresh audio detection
window.refreshAudioDetection = async function() {
    output('Refreshing audio device detection...');
    await initializePeerConnection();
};

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    // Hide after 2s
    setTimeout(() => {
        toast.className = 'toast';
    }, 2000);
}

////////////////////////////////////////////////////////////////////////////////////////
// CHECK WHETHER THE RECEIVED LOGIN / LOGOUT EVENT IS FROM A KIOSK OR AN OPERATOR
////////////////////////////////////////////////////////////////////////////////////////
function checkPersona (username){
    if (username.startsWith("!"))
        { return "operator" }
    else   
        { return "kiosk" }
}

////////////////////////////////////////////////////////////////////////////////////////
// LOGIN TO VIDEO CALL SERVER (ON CLICK OR ON LOAD PAGE)
////////////////////////////////////////////////////////////////////////////////////////
function handleLoginClick() {
    const btn = document.getElementById('login');
    btn.disabled = true;
    setTimeout(() => { btn.disabled = false; }, 3000);

    const args = {
        protocol: 'https',
        address: document.getElementById('address').value,
        port: document.getElementById('port').value,
        name: document.getElementById('name').value
    };

     if (args.address && args.port && args.name) {
        peerConnection.login(args);
     }
     else
     { showToast('Missing Connection Paramers', 'error'); }
}

/////////////////////////////////////////////////////////////////////////////////
// AUTO LOGIN TO VIDEO CALL SERVER ON PAGE LOAD
/////////////////////////////////////////////////////////////////////////////////
    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
                handleLoginClick();
        }, 100); // wait 100 ms
    });