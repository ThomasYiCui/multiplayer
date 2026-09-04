class NetworkManager {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.socket = null;
        this.selfId = null;
        this.roomCode = null;

        // Event callbacks
        this.onRoomJoined = null;
        this.onPlayerJoined = null;
        this.onPlayerMoved = null;
        this.onPlayerLeft = null;
        this.onError = null;
    }

    connect() {
        this.socket = io(this.serverUrl);

        this.socket.on('roomJoined', (data) => {
            this.selfId = data.selfId;
            this.roomCode = data.roomCode;
            if (this.onRoomJoined) this.onRoomJoined(data);
        });

        this.socket.on('playerJoined', (player) => {
            if (this.onPlayerJoined) this.onPlayerJoined(player);
        });

        this.socket.on('playerMoved', (data) => {
            if (this.onPlayerMoved) this.onPlayerMoved(data);
        });

        this.socket.on('playerLeft', (id) => {
            if (this.onPlayerLeft) this.onPlayerLeft(id);
        });

        this.socket.on('errorMsg', (msg) => {
            if (this.onError) this.onError(msg);
        });
    }

    createRoom(playerName) {
        this.socket.emit('createRoom', { playerName });
    }

    joinRoom(roomCode, playerName) {
        this.socket.emit('joinRoom', { roomCode, playerName });
    }

    sendMove(x, y) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('playerMove', { x, y });
        }
    }
}
