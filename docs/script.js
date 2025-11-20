let peer = null;
let dataConnection = null;
let mediaConnection = null;
let localStream = null; // ローカルのメディアストリームを保持

// =============================
// DOM 要素の取得
// =============================
const logOutput = document.getElementById('log-output');
const statusMessage = document.getElementById('status');
const peerSection = document.getElementById('peer-section');

const iceTableBody = document.querySelector('#ice-table tbody');
const addIceEntryButton = document.getElementById('add-ice-entry');

// メディア要素
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const mediaSourceSelect = document.getElementById('media-source');

// メディアボタン
const startScreenShareButton = document.getElementById('start-screen-share');
const connectMediaButton = document.getElementById('connect-media');


// =============================
// 定数
// =============================
const LOCAL_STORAGE_KEY = 'peerjsTesterConfig';
const DEFAULT_ICE_SERVERS = [
    { type: 'stun', url: 'stun.l.google.com:19302', username: '', password: '' }
];


// =============================
// デバッグログ関数
// =============================

/**
 * ログエリアにメッセージを出力
 * @param {string} level ログレベル (INFO, WARN, ERROR)
 * @param {*} message 出力メッセージ (文字列またはオブジェクト)
 */
function outputLog(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    let msg = '';

    if (typeof message === 'object') {
        try {
            msg = JSON.stringify(message, null, 2);
        } catch (e) {
            msg = message.toString();
        }
    } else {
        msg = String(message);
    }
    
    // ログを先頭に追加
    logOutput.innerHTML = `[${timestamp} | ${level}] ${msg}\n` + logOutput.innerHTML;
}

function logInfo(message) { outputLog('INFO', message); }
function logError(message) { outputLog('ERROR', message); }
function logWarn(message) { outputLog('WARN', message); }

// =============================
// ローカルストレージ管理関数
// =============================

function getCurrentConfig() {
    const iceServers = getIceServersConfig(false); 

    return {
        peerjs: {
            host: document.getElementById('peerjs-host').value,
            port: document.getElementById('peerjs-port').value,
            path: document.getElementById('peerjs-path').value,
            secure: document.getElementById('peerjs-secure').checked,
        },
        iceServers: iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS,
        mediaSource: mediaSourceSelect.value 
    };
}

function saveConfig() {
    const config = getCurrentConfig();
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
        console.error('LocalStorage save failed', e);
    }
}

function loadConfig() {
    try {
        const storedConfigJson = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!storedConfigJson) {
            populateIceTable(DEFAULT_ICE_SERVERS);
            mediaSourceSelect.value = 'monitor';
            return;
        }

        const config = JSON.parse(storedConfigJson);

        document.getElementById('peerjs-host').value = config.peerjs.host || '0.peerjs.com';
        document.getElementById('peerjs-port').value = config.peerjs.port || '443';
        document.getElementById('peerjs-path').value = config.peerjs.path || '/';
        document.getElementById('peerjs-secure').checked = config.peerjs.secure !== false;

        populateIceTable(config.iceServers || DEFAULT_ICE_SERVERS);
        mediaSourceSelect.value = config.mediaSource || 'monitor';

    } catch (e) {
        populateIceTable(DEFAULT_ICE_SERVERS);
        mediaSourceSelect.value = 'monitor';
    }
}

function populateIceTable(servers) {
    iceTableBody.innerHTML = '';
    if (servers.length === 0) servers = DEFAULT_ICE_SERVERS;

    servers.forEach(server => {
        const newRow = createIceEntryRow(
            server.type,
            server.url,
            server.username,
            server.password
        );
        iceTableBody.appendChild(newRow);
    });
    saveConfig();
}


// =============================
// ICEサーバー設定の管理関数
// =============================

function getPlaceholder(type) {
    switch(type) {
        case 'stun': return '例: stun.l.google.com:19302'; 
        case 'turn': return '例: turn.example.com:3478';
        case 'turns': return '例: turn.mattuu.com:5349';
        default: return 'ホスト:ポート形式 (例: server.com:3478)';
    }
}

function createIceEntryRow(type = 'turn', url = '', username = '', password = '') {
    const isStunSelected = type === 'stun' ? 'selected' : '';
    const isTurnSelected = type === 'turn' ? 'selected' : '';
    const isTurnsSelected = type === 'turns' ? 'selected' : '';

    const placeholder = getPlaceholder(type); 
    
    const row = document.createElement('tr');
    row.classList.add('ice-entry');
    row.innerHTML = `
        <td>
            <select class="ice-type">
                <option value="stun" ${isStunSelected}>stun</option>
                <option value="turn" ${isTurnSelected}>turn</option>
                <option value="turns" ${isTurnsSelected}>turns</option>
            </select>
        </td>
        <td><input type="text" class="ice-url" value="${url}" placeholder="${placeholder}"></td>
        <td><input type="text" class="ice-username" value="${username}" placeholder="ユーザー名 (TURN/TURNSの場合)"></td>
        <td><input type="password" class="ice-password" value="${password}" placeholder="パスワード (TURN/TURNSの場合)"></td>
        <td><button type="button" class="remove-ice-entry">×</button></td>
    `;
    
    row.querySelectorAll('input, select').forEach(element => {
        if (element.classList.contains('ice-type')) {
            element.addEventListener('change', (e) => {
                const newType = e.target.value;
                const urlInput = row.querySelector('.ice-url');
                urlInput.placeholder = getPlaceholder(newType);
                saveConfig(); 
            });
        } else {
            element.addEventListener('change', saveConfig);
        }
    });
    
    const removeButton = row.querySelector('.remove-ice-entry');
    removeButton.addEventListener('click', (e) => {
        if (iceTableBody.querySelectorAll('.ice-entry').length > 1) {
            e.target.closest('.ice-entry').remove();
            saveConfig();
        } else {
            alert('ICEサーバー設定は最低1つ必要です。');
        }
    });
    return row;
}

addIceEntryButton.addEventListener('click', () => {
    const newRow = createIceEntryRow('turn', '', '', ''); 
    iceTableBody.appendChild(newRow);
    saveConfig();
});


function getIceServersConfig(forPeerJSConfig = true) {
    const servers = [];
    const rows = iceTableBody.querySelectorAll('.ice-entry');
    
    rows.forEach(row => {
        const type = row.querySelector('.ice-type').value.trim().toLowerCase(); 
        let url = row.querySelector('.ice-url').value.trim();
        const username = row.querySelector('.ice-username').value.trim();
        const password = row.querySelector('.ice-password').value.trim();

        if (url) { 
            if (forPeerJSConfig) {
                // URLにタイプスキームを付与
                url = `${type}:${url}`;
                const server = { url: url }; 
                if ((type === 'turn' || type === 'turns') && username && password) {
                    server.username = username; 
                    server.credential = password;
                }
                servers.push(server);
            } else {
                servers.push({ type, url, username, password });
            }
        }
    });

    if (servers.length === 0 && forPeerJSConfig) {
        return [{ url: 'stun:stun.l.google.com:19302' }]; 
    }
    return servers;
}

// =============================
// PeerJS 初期化
// =============================

document.getElementById('connect-peerjs').addEventListener('click', () => {
    saveConfig(); 
    
    if (peer && !peer.destroyed) {
        peer.destroy();
        peer = null;
        logWarn('既存のPeerJS接続を切断しました。');
    }

    const currentConfig = getCurrentConfig();
    const { host, port, path, secure } = currentConfig.peerjs;
    
    const iceServers = getIceServersConfig(true); 

    const config = {
        host: host,
        port: parseInt(port, 10),
        path: path,
        secure: secure,
        config: {
            iceServers: iceServers
        },
        debug: 3
    };

    logInfo(['PeerJS接続設定:', config]);
    statusMessage.textContent = '接続中...';

    try {
        peer = new Peer(config); 
    } catch (e) {
        logError('PeerJSインスタンスの生成に失敗しました: ' + e.message);
        statusMessage.textContent = '初期化エラー';
        return;
    }

    peer.on('open', (id) => {
        logInfo('PeerJSサーバーに接続し、IDを取得しました: ' + id);
        document.getElementById('my-id').value = id;
        statusMessage.textContent = `接続済み (ID: ${id})`;
        peerSection.style.display = 'block';
        connectMediaButton.disabled = false;
    });

    peer.on('error', (err) => {
        logError(['PeerJSエラー:', err]);
        statusMessage.textContent = '接続エラー';
    });

    peer.on('close', () => {
        logWarn('PeerJS接続が閉じられました。');
        statusMessage.textContent = '切断済み';
        document.getElementById('my-id').value = '';
        peerSection.style.display = 'none';
        connectMediaButton.disabled = true;
    });

    // ==========================================
    // データ接続の受信 (修正: 着信時もハンドルする)
    // ==========================================
    peer.on('connection', (conn) => {
        logInfo(`新しいDataConnection接続リクエストを受信しました (PeerID: ${conn.peer})`);
        handleDataConnection(conn);
    });

    // ==========================================
    // メディア接続の受信 (修正: 自動応答)
    // ==========================================
    peer.on('call', (call) => {
        logInfo(`新しいMediaConnection接続リクエストを受信しました (PeerID: ${call.peer})`);
        
        // ローカルストリームがなくても応答する (受信専用モードになる場合がある)
        // ストリームがあれば送る、なければ undefined を渡して受信のみ行う
        call.answer(localStream || undefined);
        
        logInfo('自動応答しました (受信モード)。相手のストリームを待ちます...');
        handleMediaConnection(call);
    });
});


// =============================
// メディアストリーム処理
// =============================

startScreenShareButton.addEventListener('click', async () => {
    const source = mediaSourceSelect.value;
    logInfo(`メディアストリーム取得中... ソース: ${source}`);
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        localVideo.srcObject = null;
    }

    try {
        if (source === 'monitor') {
            localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        } else if (source === 'camera') {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        }

        localVideo.srcObject = localStream;
        logInfo(`ローカルストリームを取得しました (Tracks: ${localStream.getTracks().length})`);

        localStream.getVideoTracks()[0].onended = () => {
            logWarn('ローカルのメディアストリームが停止されました。');
            localStream = null;
            localVideo.srcObject = null;
        };

    } catch (err) {
        logError(['メディアストリームの取得に失敗:', err.name]);
    }
});


connectMediaButton.addEventListener('click', () => {
    if (!peer || peer.destroyed) return;
    if (!localStream) {
        logWarn('ローカルストリームがありませんが、受信専用で接続を試みます。');
    }
    
    const targetId = document.getElementById('target-id').value;
    if (!targetId) return;

    logInfo(`MediaConnectionを試行中... 接続先: ${targetId}`);
    
    const call = peer.call(targetId, localStream);
    handleMediaConnection(call);
});


function handleMediaConnection(call) {
    if (mediaConnection) {
        mediaConnection.close();
    }
    mediaConnection = call;

    call.on('stream', (remoteStream) => {
        logInfo(`🎥 リモート映像を受信しました (相手: ${call.peer})`);
        // 自動的に映像をセットして再生
        remoteVideo.srcObject = remoteStream;
        remoteVideo.play().catch(e => console.error('自動再生エラー:', e));
    });

    call.on('close', () => {
        logWarn(`MediaConnectionが終了しました (相手: ${call.peer})`);
        remoteVideo.srcObject = null;
    });

    call.on('error', (err) => {
        logError(['MediaConnectionエラー:', err]);
    });
}


// =============================
// データ接続処理 (修正: ログ表示の強化)
// =============================

document.getElementById('connect-data').addEventListener('click', () => {
    if (!peer || peer.destroyed) return;
    const targetId = document.getElementById('target-id').value;
    if (!targetId) return;

    if (dataConnection) {
        dataConnection.close();
    }

    logInfo(`DataConnectionを試行中... 接続先: ${targetId}`);
    dataConnection = peer.connect(targetId);
    handleDataConnection(dataConnection);
});

function handleDataConnection(conn) {
    conn.on('open', () => {
        dataConnection = conn;
        logInfo(`DataConnection確立成功 ✅ (相手: ${conn.peer})`);
        document.getElementById('send-message').disabled = false;
    });

    // ★修正: データ受信時のログ出力を確実に ★
    conn.on('data', (data) => {
        let displayData = data;
        // オブジェクトの場合は文字列化して表示
        if (typeof data === 'object') {
            try {
                displayData = JSON.stringify(data);
            } catch(e) {
                displayData = data.toString();
            }
        }
        logInfo(`📩 データ受信 (from ${conn.peer}): ${displayData}`);
    });

    conn.on('close', () => {
        logWarn(`DataConnection切断 (相手: ${conn.peer})`);
        if (dataConnection === conn) {
            dataConnection = null;
            document.getElementById('send-message').disabled = true;
        }
    });

    conn.on('error', (err) => {
        logError(['DataConnectionエラー:', err]);
    });
}

document.getElementById('send-message').addEventListener('click', () => {
    if (!dataConnection) return;
    const data = document.getElementById('send-data').value;
    logInfo(`📤 データ送信 (to ${dataConnection.peer}): ${data}`);
    dataConnection.send(data);
});


// =============================
// その他
// =============================

document.getElementById('clear-log').addEventListener('click', () => {
    logOutput.innerHTML = '';
});

window.addEventListener('load', () => {
    loadConfig();
    
    document.getElementById('peerjs-host').addEventListener('change', saveConfig);
    document.getElementById('peerjs-port').addEventListener('change', saveConfig);
    document.getElementById('peerjs-path').addEventListener('change', saveConfig);
    document.getElementById('peerjs-secure').addEventListener('change', saveConfig);
    mediaSourceSelect.addEventListener('change', saveConfig);
});