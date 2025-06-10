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

// Message Handlers: Each one of these handles a WebSocket Message from the client
const messageHandlers = {
  NEW_DRAWING: (socket, data) => {
    drawingHistory.push(data);
    // Broadcast the message to all connected clients (except the sender)
    socket.broadcast.emit('draw', data);
  },
  ERASE_DRAWING: (socket, data) => {
    // TODO: Identify and remove specific drawing objects
    // for now it just clears a rectangular area
    drawingHistory.push(data);
    socket.broadcast.emit('erase', data);
  },
  REQUEST_HISTORY: (socket) => {
    socket.emit('drawingHistory', drawingHistory)
  },
  
  DRAW_RECTANGLE: (socket, data) => {
    drawingHistory.push({ type: 'DRAW_RECTANGLE', payload: data });
    socket.broadcast.emit('drawRectangle', data);
  },

  SET_BACKGROUND: (socket, data) => {
    drawingHistory.push({ type: 'SET_BACKGROUND', payload: data });
    socket.broadcast.emit('setBackground', data);
  }
  
  // More messages go here as the app grows
};

io.on('connection', (socket) => {
  connectedUsers++;
  io.emit('userCount', connectedUsers);
  console.log('New client connected. Users:', connectedUsers);

  // Send drawing history to new client
  messageHandlers.REQUEST_HISTORY(socket);

  // This forwards messages to our handler
  socket.on('message', (message) => {
    const { type, payload } = message;
    const handler = messageHandlers[type];
    if (handler) {
      handler(socket, payload);
    } else {
      console.log(`No handler for message type: ${type}`);
    }
  });

  // This handles disconnects
  socket.on('disconnect', () => {
    connectedUsers--;
    io.emit('userCount', connectedUsers);
    console.log('Client disconnected. Users:', connectedUsers);
  });

})

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
})
