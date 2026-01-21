// server.js - ニコニコ風横スクロールアプリ用WebSocketサーバー
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, 'public')));

// ルートパスの処理
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ルーム管理
const rooms = new Map();

// WebSocket接続
wss.on('connection', (ws) => {
    console.log('新しい接続');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'create_room':
                    // ルーム作成
                    rooms.set(data.roomCode, {
                        host: ws,
                        clients: new Set()
                    });
                    ws.roomCode = data.roomCode;
                    ws.isHost = true;
                    console.log(`ルーム作成: ${data.roomCode}`);
                    break;
                    
                case 'join_room':
                    // ルーム参加
                    if (rooms.has(data.roomCode)) {
                        ws.roomCode = data.roomCode;
                        ws.isHost = false;
                        rooms.get(data.roomCode).clients.add(ws);
                        console.log(`ルーム参加: ${data.roomCode}`);
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'ルームが見つかりません'
                        }));
                    }
                    break;
                    
                case 'send_text':
                    // テキスト送信（ホストにブロードキャスト）
                    if (ws.roomCode && rooms.has(data.roomCode)) {
                        const room = rooms.get(data.roomCode);
                        
                        // ホストに送信
                        if (room.host && room.host.readyState === WebSocket.OPEN) {
                            room.host.send(JSON.stringify({
                                type: 'text_sent',
                                text: data.text
                            }));
                            console.log(`テキスト送信: ${data.roomCode} - "${data.text}"`);
                        }
                    }
                    break;
                    
                case 'send_image':
                    // 画像送信（ホストにブロードキャスト）
                    if (ws.roomCode && rooms.has(data.roomCode)) {
                        const room = rooms.get(data.roomCode);
                        
                        // ホストに送信
                        if (room.host && room.host.readyState === WebSocket.OPEN) {
                            room.host.send(JSON.stringify({
                                type: 'image_sent',
                                image: data.image
                            }));
                            console.log(`画像送信: ${data.roomCode}`);
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error('エラー:', error);
        }
    });
    
    ws.on('close', () => {
        if (ws.roomCode && rooms.has(ws.roomCode)) {
            const room = rooms.get(ws.roomCode);
            
            if (ws.isHost) {
                // ホストが切断した場合、ルームを削除
                rooms.delete(ws.roomCode);
                console.log(`ルーム削除: ${ws.roomCode}`);
            } else {
                // クライアントが切断した場合、セットから削除
                room.clients.delete(ws);
            }
        }
    });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`サーバー起動: http://localhost:${PORT}`);
});
