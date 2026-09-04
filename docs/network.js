class NetworkManager {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.socket = null;
        this.selfId = null;
        this.currentWorldId = null;
        this.currentUser = null;

        // Event callbacks
        this.onConnected = null;
        this.onConnectError = null;
        this.onAuthSuccess = null;
        this.onAuthError = null;
        this.onWorldList = null;
        this.onWorldJoined = null;
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
            console.warn('[Network] Connection error:', err.message);
            if (this.onConnectError) this.onConnectError(err);
        });

        this.socket.on('authSuccess', (data) => {
            console.log('[Network] Auth success:', data.user);
            this.currentUser = data.user;
            if (this.onAuthSuccess) this.onAuthSuccess(data.user);
        });

        this.socket.on('authError', (msg) => {
            console.warn('[Network] Auth error:', msg);
            if (this.onAuthError) this.onAuthError(msg);
        });

        this.socket.on('worldList', (worlds) => {
            if (this.onWorldList) this.onWorldList(worlds);
        });

        this.socket.on('worldJoined', (data) => {
            console.log('[Network] World joined:', data);
            this.selfId = data.selfId;
            this.currentWorldId = data.worldId;
            this.currentUser = data.user;
            if (this.onWorldJoined) this.onWorldJoined(data);
        });

        this.socket.on('playerJoined', (player) => {
            console.log('[Network] Player joined world:', player);
            if (this.onPlayerJoined) this.onPlayerJoined(player);
        });

        this.socket.on('playerMoved', (data) => {
            if (this.onPlayerMoved) this.onPlayerMoved(data);
        });

        this.socket.on('playerMouse', (data) => {
            if (this.onPlayerMouse) this.onPlayerMouse(data);
        });

        this.socket.on('playerLeft', (id) => {
            console.log('[Network] Player left world:', id);
            if (this.onPlayerLeft) this.onPlayerLeft(id);
        });

        this.socket.on('errorMsg', (msg) => {
            console.error('[Network] Server error:', msg);
            if (this.onError) this.onError(msg);
        });
    }

    register(username, password) {
        if (!this.socket || !this.socket.connected) {
            alert('Server is waking up (takes ~30s on free hosting). Please wait a moment and try again.');
            return;
        }
        this.socket.emit('register', { username, password });
    }

    login(username, password) {
        if (!this.socket || !this.socket.connected) {
            alert('Server is waking up (takes ~30s on free hosting). Please wait a moment and try again.');
            return;
        }
        this.socket.emit('login', { username, password });
    }

    joinWorld(worldId) {
        if (!this.socket || !this.socket.connected) {
            alert('Server is waking up. Please wait a moment and try again.');
            return;
        }
        this.socket.emit('joinWorld', { worldId });
    }

    leaveWorld() {
        if (this.socket && this.socket.connected) {
            this.socket.emit('leaveWorld');
        }
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
