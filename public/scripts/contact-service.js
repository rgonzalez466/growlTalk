'use strict';

function ContactService(properties) {
    Object.assign(this, properties);
}

ContactService.prototype.on = function(name, callback) {
    if (name === 'connected') {
        this.onConnected = callback;
    }
    else if (name === 'disconnected') {
        this.onDisconnected = callback;
    }
    else if (name === 'peerConnected') {
        this.onPeerConnected = callback;
    }
    else if (name === 'peerDisconnected') {
        this.onPeerDisconnected = callback;
    }
    else if (name === 'message') {
        this.onMessage = callback;
    }
}

function waitMessage() {
    return fetch(`${this.protocol}://${this.address}:${this.port}${this.prefix}/wait?peer_id=${this.id}`, { signal: this.controller.signal })
        .then(handleResponse.bind(this))
        .catch(e => {
            if (!this.id) {
                delete this.retry;
                throw e;
            }

            if (this.retry == null) {
                this.retry = 1;
            }
            else if (this.retry < 3) {
                ++this.retry;
            }
            else {
                delete this.retry;
                throw e;
            }
        })
        .then(waitMessage.bind(this));
}

function handleResponse(response) {
    if (!response.ok) {
        throw Error(`(${response.status}) ${response.statusText}`);
    }

    const from = response.headers.get('Pragma');
    if (!from) {
        throw Error('no pragma header');
    }

    delete this.retry;

    if (!this.id) {
        this.id = from;
        if (this.onConnected != null) this.onConnected(from);
    }

    return response.text()
        .then(body => {
            if (this.id === from) {
                const lines = body.split('\n');
                for (const line of lines) {
                    const [name, id, status] = line.split(',');
                    if (name == null || id == null || status == null) continue;
            
                    if (status != 0) {
                        const contact = this.contacts.find(contact => contact.id === id);
                        if (contact != null) {
                            contact.name = name;
                        }
                        else {
                            if (this.id !== id) {
                                this.contacts.push({id, name});
                                if (this.onPeerConnected != null) this.onPeerConnected(id, name);
                            }
                        }
                    }
                    else {
                        const index = this.contacts.findIndex(contact => contact.id === id);
                        if (index >= 0) {
                            this.contacts.splice(index, 1);
                        }

                        if (this.id !== id) {
                            if (this.onPeerDisconnected != null) this.onPeerDisconnected(id, name);
                        }
                        else {
                            delete this.id;
                        }
                    }
                }
            
                if (!this.id) {
                    throw Error('logout');
                }
            }
            else {
                if (this.onMessage != null) this.onMessage(from, body);
            }
        });
}

ContactService.prototype.login = async function(args) {
    this.logout();
    while (this.controller != null) {
        // wait until last session done
        await new Promise(r => setTimeout(r, 1000));
    }

    this.protocol = args.protocol != null ? args.protocol : 'http';
    this.address = args.address;
    this.port = args.port;
    this.prefix = args.prefix != null ? args.prefix : '';

    this.contacts = [];
    this.controller = new AbortController();

    return fetch(`${this.protocol}://${this.address}:${this.port}${this.prefix}/sign_in?${args.name}`, { signal: this.controller.signal })
        .then(handleResponse.bind(this))
        .then(waitMessage.bind(this))
        .catch(async e => {
            delete this.contacts;
            delete this.controller;

            this.logout();
        
            if (this.onDisconnected != null) this.onDisconnected(e.name === 'AbortError' ? 'logout' : e.message);
        });
}

ContactService.prototype.logout = async function() {
    if (!this.id) return;

    const id = this.id;
    delete this.id;
    await fetch(`${this.protocol}://${this.address}:${this.port}${this.prefix}/sign_out?peer_id=${id}`)
        .catch(e => {
            // ignore error
        });

    if (this.controller != null) {
        this.controller.abort();
    }
}

ContactService.prototype.send = async function(to, message) {
    if (!this.id) return;

    try {
        const response = await fetch(`${this.protocol}://${this.address}:${this.port}${this.prefix}/message?peer_id=${this.id}&to=${to}`, {
            method: 'POST',
            body: message
        });
        console.log(`/message?peer_id=${this.id}&to=${to}`);
        console.log(response.message);
        if (!response.ok) {
            // This includes 500 responses
            const text = await response.text(); // Read the error body, if any
            showToast(`Server error: ${response.status} ${text || 'Internal Server Error'}`, 'error');
            console.error(`Server responded with ${response.status}: ${text}`);
       //     throw new Error(`Server responded with status ${response.status}`);
        }

    } catch (e) {
        // Handles network errors, timeouts, and fetch rejections
        console.error("Send failed:", e);
        showToast(`Network error: ${e.message}`, 'error');
        throw e;
    }
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
