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
    { type: 'stun', url: 'stun:stun.l.google.com:19302', username: '', password: '' }
];


// =============================
// デバッグログ関数
// =============================
// ... (outputLog, logInfo, logError, logWarn 関数は変更なし) ...

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

/**
 * 現在のPeerJSとICEサーバー設定をオブジェクトとして取得する
 */
function getCurrentConfig() {
    const iceServers = getIceServersConfig(false); // 生のICE設定を取得

    return {
        peerjs: {
            host: document.getElementById('peerjs-host').value,
            port: document.getElementById('peerjs-port').value,
            path: document.getElementById('peerjs-path').value,
            secure: document.getElementById('peerjs-secure').checked,
        },
        iceServers: iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS,
        // メディアソース選択の保存を追加
        mediaSource: mediaSourceSelect.value 
    };
}

/**
 * 設定をローカルストレージに保存する
 */
function saveConfig() {
    const config = getCurrentConfig();
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
        logInfo('設定をローカルストレージに保存しました。');
    } catch (e) {
        logError('ローカルストレージへの保存に失敗しました。');
    }
}

/**
 * ローカルストレージから設定を読み込み、フォームに反映する
 */
function loadConfig() {
    try {
        const storedConfigJson = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!storedConfigJson) {
            logInfo('保存された設定はありません。デフォルト設定を使用します。');
            populateIceTable(DEFAULT_ICE_SERVERS);
            mediaSourceSelect.value = 'monitor'; // デフォルト設定
            return;
        }

        const config = JSON.parse(storedConfigJson);
        logInfo('ローカルストレージから設定を読み込みました。');

        // PeerJS設定の反映
        document.getElementById('peerjs-host').value = config.peerjs.host || '0.peerjs.com';
        document.getElementById('peerjs-port').value = config.peerjs.port || '443';
        document.getElementById('peerjs-path').value = config.peerjs.path || '/';
        document.getElementById('peerjs-secure').checked = config.peerjs.secure !== false;

        // ICEサーバー設定の反映
        populateIceTable(config.iceServers || DEFAULT_ICE_SERVERS);
        
        // メディアソース設定の反映
        mediaSourceSelect.value = config.mediaSource || 'monitor';

    } catch (e) {
        logError('ローカルストレージ設定の読み込み/解析に失敗しました。デフォルト設定を使用します。');
        populateIceTable(DEFAULT_ICE_SERVERS);
        mediaSourceSelect.value = 'monitor';
    }
}

/**
 * ICE設定配列に基づいてテーブルを再構築する
 * @param {Array<object>} servers - [{type, url, username, password}, ...] 形式のサーバーリスト
 */
function populateIceTable(servers) {
    // 既存の行をクリア
    iceTableBody.innerHTML = '';
    
    if (servers.length === 0) {
        servers = DEFAULT_ICE_SERVERS;
    }

    servers.forEach(server => {
        const newRow = createIceEntryRow(
            server.type,
            server.url,
            server.username,
            server.password
        );
        iceTableBody.appendChild(newRow);
    });
    // テーブル変更時に保存を試みる
    saveConfig();
}


// =============================
// ICEサーバー設定の管理関数
// =============================

/**
 * テーブルの行テンプレート
 */
function createIceEntryRow(type = 'turn', url = '', username = '', password = '') {
    const isStunSelected = type === 'stun' ? 'selected' : '';
    const isTurnSelected = type === 'turn' ? 'selected' : '';
    const isTurnsSelected = type === 'turns' ? 'selected' : '';
    
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
        <td><input type="text" class="ice-url" value="${url}" placeholder="例: turns:example.com:443?transport=tcp"></td>
        <td><input type="text" class="ice-username" value="${username}" placeholder="ユーザー名 (TURN/TURNSの場合)"></td>
        <td><input type="password" class="ice-password" value="${password}" placeholder="パスワード (TURN/TURNSの場合)"></td>
        <td><button type="button" class="remove-ice-entry">×</button></td>
    `;
    
    // イベントリスナーを設定
    row.querySelectorAll('input, select').forEach(element => {
        element.addEventListener('change', saveConfig); // 変更時に保存
    });
    
    const removeButton = row.querySelector('.remove-ice-entry');
    removeButton.addEventListener('click', (e) => {
        // 最後の1行は削除できないようにする
        if (iceTableBody.querySelectorAll('.ice-entry').length > 1) {
            e.target.closest('.ice-entry').remove();
            logInfo('ICEサーバー設定を1つ削除しました。');
            saveConfig(); // 削除後に保存
        } else {
            logWarn('ICEサーバー設定は最低1つ（デフォルトのSTUN）が必要です。');
        }
    });
    return row;
}

/**
 * 「ICEサーバーを追加」ボタンのクリックイベント
 */
addIceEntryButton.addEventListener('click', () => {
    // 新規追加はTURNをデフォルトに
    const newRow = createIceEntryRow('turn', '', '', ''); 
    iceTableBody.appendChild(newRow);
    logInfo('新しいICEサーバー設定の行を追加しました。');
    saveConfig(); // 追加後に保存
});


/**
 * ICEサーバー設定テーブルからPeerJS用のconfigオブジェクトを生成する
 * @param {boolean} forPeerJSConfig - PeerJSのconfig形式 (urls, username, credential)で返すか、
 * ローカルストレージ保存用の生形式 (type, url, username, password)で返すか
 * @returns {Array<object>} 
 */
function getIceServersConfig(forPeerJSConfig = true) {
    const servers = [];
    const rows = iceTableBody.querySelectorAll('.ice-entry');
    
    rows.forEach(row => {
        const type = row.querySelector('.ice-type').value.trim().toLowerCase(); 
        const url = row.querySelector('.ice-url').value.trim();
        const username = row.querySelector('.ice-username').value.trim();
        const password = row.querySelector('.ice-password').value.trim();

        if (url) { // URLがある行のみ処理
            if (forPeerJSConfig) {
                // PeerJSのconfig形式
                const server = { urls: url };
                if ((type === 'turn' || type === 'turns') && username && password) {
                    server.username = username;
                    server.credential = password;
                }
                servers.push(server);
            } else {
                // ローカルストレージ保存用の生形式
                servers.push({ type, url, username, password });
            }
        }
    });

    if (servers.length === 0 && forPeerJSConfig) {
        logWarn('ICEサーバーが設定されていません。接続が失敗する可能性があります。');
        return [{ urls: 'stun:stun.l.google.com:19302' }]; 
    }
    
    return servers;
}

// =============================
// PeerJS 初期化
// =============================
// ... (PeerJS接続ロジックは変更なし。saveConfig()を呼び出す点のみ変更なし) ...

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
        connectMediaButton.disabled = false; // Peer接続時にメディア接続ボタンを有効化

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

    // メディア接続の受信イベントハンドラ (追加)
    peer.on('call', (call) => {
        logInfo(`新しいMediaConnection接続リクエストを受信しました (PeerID: ${call.peer})`);
        
        // すでにローカルストリームが取得されているか確認
        if (!localStream) {
            logError('ローカルストリームが取得されていません。画面共有を開始してから応答してください。');
            return;
        }

        // 応答し、ローカルストリームを送信
        call.answer(localStream);
        handleMediaConnection(call);
    });
});


// =============================
// メディアストリーム処理 (追加)
// =============================

/**
 * 画面またはカメラのストリームを取得し、ローカル映像に表示する
 */
startScreenShareButton.addEventListener('click', async () => {
    const source = mediaSourceSelect.value;
    logInfo(`メディアストリーム取得中... ソース: ${source}`);
    
    // 既存のストリームがあれば停止
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        localVideo.srcObject = null;
        logWarn('既存のローカルストリームを停止しました。');
    }

    const constraints = {};
    try {
        if (source === 'monitor') {
            // 画面共有 (getDisplayMedia)
            localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        } else if (source === 'camera') {
            // カメラ/マイク (getUserMedia)
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } else {
            logError('無効なメディアソースが選択されました。');
            return;
        }

        localVideo.srcObject = localStream;
        logInfo(`ローカルストリームを取得しました (Tracks: Video=${localStream.getVideoTracks().length}, Audio=${localStream.getAudioTracks().length})`);

        // ストリーム終了イベントを監視
        localStream.getVideoTracks()[0].onended = () => {
            logWarn('ローカルのメディアストリームがユーザーによって停止されました。');
            localStream = null;
            localVideo.srcObject = null;
        };

    } catch (err) {
        logError(['メディアストリームの取得に失敗しました:', err.name, err.message]);
    }
});


/**
 * MediaConnectionを開始 (発信側)
 */
connectMediaButton.addEventListener('click', () => {
    if (!peer || peer.destroyed) {
        logWarn('PeerJSが未接続です。');
        return;
    }
    if (!localStream) {
        logWarn('ローカルストリームが取得されていません。「画面/カメラ共有開始」ボタンを押してください。');
        return;
    }
    
    const targetId = document.getElementById('target-id').value;
    if (!targetId) {
        logWarn('接続先の Peer ID を入力してください。');
        return;
    }

    logInfo(`MediaConnectionを試行中... 接続先: ${targetId}`);
    
    // PeerJS callメソッドでストリームを送信
    const call = peer.call(targetId, localStream);
    handleMediaConnection(call);
});


/**
 * MediaConnectionオブジェクトのイベントハンドラを設定
 * @param {PeerJS.MediaConnection} call 
 */
function handleMediaConnection(call) {
    if (mediaConnection) {
        mediaConnection.close();
        logWarn('既存のMediaConnectionを切断しました。');
        remoteVideo.srcObject = null;
    }
    mediaConnection = call;

    call.on('stream', (remoteStream) => {
        logInfo(`MediaConnection確立: リモートストリームを受信しました (相手: ${call.peer})`);
        remoteVideo.srcObject = remoteStream;
    });

    call.on('close', () => {
        logWarn(`MediaConnectionが閉じられました (相手: ${call.peer})`);
        remoteVideo.srcObject = null;
        if (mediaConnection && mediaConnection.peer === call.peer) {
            mediaConnection = null;
        }
    });

    call.on('error', (err) => {
        logError(['MediaConnectionエラー:', err]);
        remoteVideo.srcObject = null;
    });
}


// =============================
// データ接続 (既存ロジック - 変更なし)
// =============================
// ... (connect-data, handleDataConnection, send-message ロジックは変更なし) ...

document.getElementById('connect-data').addEventListener('click', () => {
    if (!peer || peer.destroyed) {
        logWarn('PeerJSが未接続です。「PeerJS 接続 & ID取得」ボタンを押してください。');
        return;
    }
    
    const targetId = document.getElementById('target-id').value;
    if (!targetId) {
        logWarn('接続先の Peer ID を入力してください。');
        return;
    }

    if (dataConnection) {
        dataConnection.close();
        dataConnection = null;
        document.getElementById('send-message').disabled = true;
        logWarn('既存のDataConnectionを切断しました。');
    }

    logInfo(`DataConnectionを試行中... 接続先: ${targetId}`);
    dataConnection = peer.connect(targetId);
    handleDataConnection(dataConnection);
});

/**
 * DataConnectionオブジェクトのイベントハンドラを設定
 * @param {PeerJS.DataConnection} conn 
 */
function handleDataConnection(conn) {
    
    conn.on('open', () => {
        dataConnection = conn;
        logInfo(`DataConnectionが確立しました (相手: ${conn.peer})`);
        document.getElementById('send-message').disabled = false;
    });

    conn.on('data', (data) => {
        logInfo(`データ受信 (相手: ${conn.peer}): ${data}`);
    });

    conn.on('close', () => {
        logWarn(`DataConnectionが閉じられました (相手: ${conn.peer})`);
        if (dataConnection && dataConnection.peer === conn.peer) {
            dataConnection = null;
            document.getElementById('send-message').disabled = true;
        }
    });

    conn.on('error', (err) => {
        logError(['DataConnectionエラー:', err]);
    });
}

document.getElementById('send-message').addEventListener('click', () => {
    if (!dataConnection) {
        logWarn('DataConnectionが確立していません。接続を開始してください。');
        return;
    }

    const data = document.getElementById('send-data').value;
    logInfo(`データ送信 (相手: ${dataConnection.peer}): ${data}`);
    dataConnection.send(data);
});


// =============================
// ログクリア
// =============================

document.getElementById('clear-log').addEventListener('click', () => {
    logOutput.innerHTML = '';
});

// =============================
// ページロード時の処理
// =============================
window.addEventListener('load', () => {
    loadConfig();
    
    // PeerJS設定の変更を監視し、自動保存する
    document.getElementById('peerjs-host').addEventListener('change', saveConfig);
    document.getElementById('peerjs-port').addEventListener('change', saveConfig);
    document.getElementById('peerjs-path').addEventListener('change', saveConfig);
    document.getElementById('peerjs-secure').addEventListener('change', saveConfig);
    
    // メディアソース選択の変更を監視し、自動保存する (追加)
    mediaSourceSelect.addEventListener('change', saveConfig);
});
