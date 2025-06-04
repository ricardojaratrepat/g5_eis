const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 8000;

// To serve files from the public dir
app.use(express.static('public'));

let connectedUsers = 0;
let drawingHistory = [];


server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
})
