class NetworkManager {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.socket = null;
        this.selfId = null;
        this.roomCode = null;

        // Event callbacks
        this.onConnected = null;
        this.onConnectError = null;
        this.onRoomJoined = null;
        this.onPlayerJoined = null;
        this.onPlayerMoved = null;
        this.onPlayerMouse = null;
        this.onPlayerLeft = null;
        this.onError = null;
    }

    connect() {
        console.log('[Network] Connecting to server at:', this.serverUrl);
        this.socket = io(this.serverUrl, {
            transports: ['websocket', 'polling'],
            timeout: 20000
        });

        this.socket.on('connect', () => {
            console.log('[Network] Connected successfully! Socket ID:', this.socket.id);
            if (this.onConnected) this.onConnected();
        });

        this.socket.on('connect_error', (err) => {
            console.warn('[Network] Connection error (server may be waking up):', err.message);
            if (this.onConnectError) this.onConnectError(err);
        });

        this.socket.on('roomJoined', (data) => {
            console.log('[Network] Room joined:', data);
            this.selfId = data.selfId;
            this.roomCode = data.roomCode;
            if (this.onRoomJoined) this.onRoomJoined(data);
        });

        this.socket.on('playerJoined', (player) => {
            console.log('[Network] New player joined room:', player);
            if (this.onPlayerJoined) this.onPlayerJoined(player);
        });

        this.socket.on('playerMoved', (data) => {
            if (this.onPlayerMoved) this.onPlayerMoved(data);
        });

        this.socket.on('playerMouse', (data) => {
            if (this.onPlayerMouse) this.onPlayerMouse(data);
        });

        this.socket.on('playerLeft', (id) => {
            console.log('[Network] Player left room:', id);
            if (this.onPlayerLeft) this.onPlayerLeft(id);
        });

        this.socket.on('errorMsg', (msg) => {
            console.error('[Network] Server returned error:', msg);
            if (this.onError) this.onError(msg);
        });
    }

    createRoom(playerName) {
        if (!this.socket || !this.socket.connected) {
            console.warn('[Network] Socket not connected yet. Waiting for server...');
            alert('Server is waking up (takes ~30s on free hosting). Please wait a moment and try again!');
            return;
        }
        console.log('[Network] Emitting createRoom with name:', playerName);
        this.socket.emit('createRoom', { playerName });
    }

    joinRoom(roomCode, playerName) {
        if (!this.socket || !this.socket.connected) {
            alert('Server is waking up (takes ~30s on free hosting). Please wait a moment and try again!');
            return;
        }
        console.log('[Network] Emitting joinRoom:', roomCode, playerName);
        this.socket.emit('joinRoom', { roomCode, playerName });
    }

    sendMove(x, y) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('playerMove', { x, y });
        }
    }

    sendMouse(mouseX, mouseY, r, clicked, dragged) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('playerMouse', { mouseX, mouseY, r, clicked, dragged });
        }
    }
}

