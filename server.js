// server.js - Glitch用のWebSocketサーバー
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 静的ファイルの提供
app.use(express.static('public'));

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
                        text: 'テキストがここに表示されます',
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
                        
                        // 現在のテキストを送信
                        ws.send(JSON.stringify({
                            type: 'room_joined',
                            text: rooms.get(data.roomCode).text
                        }));
                        console.log(`ルーム参加: ${data.roomCode}`);
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'ルームが見つかりません'
                        }));
                    }
                    break;
                    
                case 'update_text':
                    // テキスト更新
                    if (ws.roomCode && rooms.has(ws.roomCode)) {
                        const room = rooms.get(ws.roomCode);
                        room.text = data.text;
                        
                        // ホストに通知
                        wss.clients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN && 
                                client.roomCode === ws.roomCode && 
                                client.isHost) {
                                client.send(JSON.stringify({
                                    type: 'text_updated',
                                    text: data.text
                                }));
                            }
                        });
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
            room.clients.delete(ws);
            
            // ホストが切断した場合、ルームを削除
            if (ws.isHost) {
                rooms.delete(ws.roomCode);
                console.log(`ルーム削除: ${ws.roomCode}`);
            }
        }
    });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`サーバー起動: http://localhost:${PORT}`);
});
