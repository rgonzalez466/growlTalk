'use strict';

function PeerConnection(properties) {
    Object.assign(this, properties);

    const contactService = new ContactService();

    contactService.onConnected = id => {
        if (this.onConnected != null) this.onConnected(id);
    };

    contactService.onDisconnected = reason => {
        closeConnection.call(this);
        if (this.onDisconnected != null) this.onDisconnected(reason);
    };

    contactService.onPeerConnected = (id, name) => {
        if (this.onPeerConnected != null) this.onPeerConnected(id, name);
    };

    contactService.onPeerDisonnected = (id, name) => {
        if (this.peerId === id) {
            closeConnection.call(this);
        }

        if (this.onPeerDisonnected != null) this.onPeerDisonnected(id, name);
    };

    contactService.onMessage = onMessage.bind(this);

    this.contactService = contactService;
}

PeerConnection.prototype.on = function(name, callback) {
    if (name === 'connected') {
        this.onConnected = callback;
    }
    else if (name === 'disconnected') {
        this.onDisconnected = callback;
    }
    else if (name === 'peerConnected') {
        this.onPeerConnected = callback;
    }
    else if (name === 'peerDisonnected') {
        this.onPeerDisonnected = callback;
    }
    else if (name === 'peerCall') {
        this.onPeerCall = callback;
    }
    else if (name === 'sessionConnected') {
        this.onSessionConnected = callback;
    }
    else if (name === 'sessionDisonnected') {
        this.onSessionDisonnected = callback;
    }
};

function openConnection() {
    const peerConnection = new RTCPeerConnection();

    peerConnection.onicecandidate = event => {
        this.contactService.send(this.peerId, JSON.stringify(event.candidate));
    };

    peerConnection.ontrack = event => {
        for (const stream of event.streams) {
            if (stream.id === 'screen_id') {
                if (this.remoteScreen != null) this.remoteScreen.srcObject = stream;
            }
            else {
                if (this.remoteVideo != null) this.remoteVideo.srcObject = stream;
            }
        }
    };

    this.peerConnection = peerConnection;
}

function closeVideo(elem) {
    try {
        elem.srcObject.getTracks().forEach(track => track.stop());
        elem.removeAttribute('src');
        elem.load();
    }
    catch (e) {
        // ignore error
    }
}

function closeConnection() {
    if (!this.peerId) return;

    delete this.lastContactIndex;
    delete this.peerId;

    if (this.peerConnection != null) {
        this.peerConnection.close();
        delete this.peerConnection;

        closeVideo(this.remoteVideo);
        closeVideo(this.remoteScreen);
        closeVideo(this.localVideo);
    }

    if (this.onSessionDisonnected != null) this.onSessionDisonnected();
}

async function onMessage(from, message) {
    //console.log(message);
    if (message === 'BYE') {
        if (this.peerId === from) {
            closeConnection.call(this);
        }
    }
    else if (message === 'HELLO') {
        if (this.peerId) {
            this.contactService.send(from, 'REFUSE');
            return;
        }

        const contact = this.contactService.contacts.find(contact => contact.id === from);
        const name = contact != null ? contact.name : undefined;

        if (this.onPeerCall != null) {
            if (!this.onPeerCall(from, name)) {
                this.contactService.send(from, 'REFUSE');
                return;                                                                                                                                                                                                                                                                                                   
            }
        }

        openConnection.call(this);
        this.peerId = from;

        if (this.onSessionConnected != null) this.onSessionConnected(from, name);

        await getMedia.call(this)
            .then(() => {
                return this.peerConnection.createOffer();
            })
            .then(sdp => {
                return this.peerConnection.setLocalDescription(sdp);
            })
            .then(() => {
                this.contactService.send(this.peerId, JSON.stringify(this.peerConnection.localDescription));
            })
            .catch(e => {
                alert('Acquire camera/ microphone failed, please check wire and browser setting');
                this.contactService.send(this.peerId, 'BYE');
                closeConnection.call(this);
                throw e;
            });
    }
    else if (message === 'REFUSE') {
        if (this.peerId !== from) return;

        if (this.lastContactIndex != null) {
            for (; this.lastContactIndex < this.contactService.contacts.length; ++this.lastContactIndex) {
                const contact = this.contactService.contacts[this.lastContactIndex];
                if (contact.id === this.peerId) continue;
                if (contact.name.length <= 0 || contact.name[0] === '!') continue;
    
                this.peerId = contact.id;
                this.contactService.send(this.peerId, 'HELLO');
                return;
            }
        }
        
        closeConnection.call(this);
    }
    else {
        if (this.peerId != from || this.peerConnection == null) return;

        const m = JSON.parse(message);
        if (m.sdp != null) {
            await this.peerConnection.setRemoteDescription(m)
                .then(() => {
                    if (this.peerConnection.remoteDescription.type === 'offer') {
                        if (this.onSessionConnected != null) {
                            const contact = this.contactService.contacts.find(contact => contact.id === from);
                            const name = contact != null ? contact.name : undefined;
                    
                            this.onSessionConnected(from, name);
                        }
            
                        return getMedia.call(this)
                            .then(() => {
                                return this.peerConnection.createAnswer();
                            })
                            .then(sdp => {
                                return this.peerConnection.setLocalDescription(sdp);
                            })
                            .then(() => {
                                this.contactService.send(this.peerId, JSON.stringify(this.peerConnection.localDescription));
                            })
                            .catch(e => {
                                alert('Acquire camera/ micphone failed, please check wire and browser setting');
                                this.contactService.send(this.peerId, 'BYE');
                                closeConnection.call(this);
                                throw e;
                            });
                        }
                });
        }
        else if (m.candidate != null) {
            await this.peerConnection.addIceCandidate(m);
        }
    }
}

function getMedia() {
    return navigator.mediaDevices.getUserMedia(this.constraints)
        .then(stream => {
            const localStream = new MediaStream();

            for (const track of stream.getTracks()) {
                if (track.kind === 'video') {
                    localStream.addTrack(track);
                }

                this.peerConnection.addTrack(track, stream);
            }

            if (this.localVideo != null) this.localVideo.srcObject = localStream;
        });
}

PeerConnection.prototype.login = function(args) {
    this.contactService.login(args);
};

PeerConnection.prototype.logout = function() {
    closeConnection.call(this);
    this.contactService.logout();
};

PeerConnection.prototype.callToPeer = function(to) {
    if (this.peerId) return;

    openConnection.call(this);
    this.peerId = to;
    this.contactService.send(this.peerId, 'HELLO');
};

PeerConnection.prototype.callAnyPeer = function() {
    if (this.peerId) return;
    
    openConnection.call(this);
    for (this.lastContactIndex = 0; this.lastContactIndex < this.contactService.contacts.length; ++this.lastContactIndex) {
        const contact = this.contactService.contacts[this.lastContactIndex];
        if (contact.name.length <= 0 || contact.name[0] === '!') continue;

        this.peerId = contact.id;
        this.contactService.send(this.peerId, 'HELLO');
        return;
    }

    closeConnection.call(this);
};

PeerConnection.prototype.hangUp = function() {
    if (!this.peerId) return;

    this.contactService.send(this.peerId, 'BYE');
    closeConnection.call(this);
};
