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
const MAX_HISTORY_LENGTH = 1000; // Maximum number of entries in the history
let drawingHistory = [];

// Message Handlers: Each one of these handles a WebSocket Message from the client
const messageHandlers = {
  NEW_DRAWING: (socket, data) => {
    drawingHistory.push({ type: 'NEW_DRAWING', payload: data });
    if (drawingHistory.length > MAX_HISTORY_LENGTH) {
        drawingHistory.shift(); // Remove the oldest entry
    }
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
  },

  SET_VIDEO: (socket, data) => {
    // Remove any existing video entries and add the new one
    drawingHistory = drawingHistory.filter(item => item.type !== 'SET_VIDEO');
    if (data.videoId) {
      drawingHistory.push({ type: 'SET_VIDEO', payload: data });
    }
    socket.broadcast.emit('setVideo', data);
  }
  
  // More messages go here as the app grows
};

io.on('connection', (socket) => {
  connectedUsers++;
  io.emit('userCount', connectedUsers);
  console.log('Nuevo cliente conectado. Usuarios:', connectedUsers);

  // Send drawing history to new client
  messageHandlers.REQUEST_HISTORY(socket);

  // This forwards messages to our handler
  socket.on('message', (message) => {
    const { type, payload } = message;
    const handler = messageHandlers[type];
    if (handler) {
      handler(socket, payload);
    } else {
      console.log(`No hay manejador para el tipo de mensaje: ${type}`);
    }
  });

  // This handles disconnects
  socket.on('disconnect', () => {
    connectedUsers--;
    io.emit('userCount', connectedUsers);
    console.log('Cliente desconectado. Usuarios:', connectedUsers);
  });

})

server.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
})
