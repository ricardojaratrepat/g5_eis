document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  const canvas = document.getElementById('whiteboard');
  const ctx = canvas.getContext('2d');
  const userCountDisplay = document.getElementById('userCount');
  const drawBtn = document.getElementById('drawBtn');
  const eraseBtn = document.getElementById('eraseBtn');

  let drawing = false;
  let currentMode = 'draw'; // 'draw' or 'erase'
  let lastX, lastY;
  const drawColor = 'lightgreen';
  const eraseColor = '#FFFFFF'; // White, same as canvas background
  const lineWidth = 5;
  const eraserSize = 20;

  // Canvas dimensions
  canvas.width = window.innerWidth * 0.9;
  canvas.height = window.innerHeight * 0.8;

  function setMode(newMode) {
    currentMode = newMode;
    drawBtn.classList.toggle('active', newMode === 'draw');
    eraseBtn.classList.toggle('active', newMode === 'erase');
    console.log("Mode set to:", currentMode);
  }

  drawBtn.addEventListener('click', () => setMode('draw'));
  eraseBtn.addEventListener('click', () => setMode('erase'));
  setMode('draw'); // Default mode

  // Function to send messages to the server
  function sendMessage(type, payload) {
    socket.emit('message', { type, payload });
  }

  function drawLine(x0, y0, x1, y1, color, width, emit = false, isEraser = false) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round'; // Makes lines smoother
    ctx.stroke();
    ctx.closePath();

    if (emit) {
      const drawingObject = {
        type: isEraser ? 'ERASE_DRAWING' : 'NEW_DRAWING',
        payload: {
          x0, y0, x1, y1,
          color: isEraser ? eraseColor : color,
          width: isEraser ? eraserSize : width,
          isEraser
        }
      };
      sendMessage(drawingObject.type, drawingObject.payload);
    }
  }

  function eraseSquare(x, y, size, emit = false) {
    const halfSize = size / 2;
    ctx.fillStyle = eraseColor;
    ctx.fillRect(x - halfSize, y - halfSize, size, size);

    if (emit) {
      const eraseObject = {
        type: 'ERASE_DRAWING', // Specific type for erase action
        payload: {
          x: x - halfSize, // Store top-left corner for consistency if needed
          y: y - halfSize,
          size,
          color: eraseColor, // Eraser uses background color
          isEraser: true
        }
      };
      sendMessage(eraseObject.type, eraseObject.payload);
    }
  }


  canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;

    if (currentMode === 'erase') {
      eraseSquare(lastX, lastY, eraserSize, true);
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    if (currentMode === 'draw') {
      drawLine(lastX, lastY, currentX, currentY, drawColor, lineWidth, true, false);
    } else if (currentMode === 'erase') {
      drawLine(lastX, lastY, currentX, currentY, eraseColor, eraserSize, true, true);
    }
    lastX = currentX;
    lastY = currentY;
  });

  canvas.addEventListener('mouseup', () => {
    if (drawing) {
      drawing = false;
    }
  });

  canvas.addEventListener('mouseout', () => {
    // Optional: stop drawing if mouse leaves canvas
  });

  // Socket event listeners
  socket.on('userCount', (count) => {
    userCountDisplay.textContent = `Users: ${count}`;
  });

  socket.on('draw', (data) => {
    if (data.isEraser) {
      // If the incoming data represents an eraser action that was drawn as a line
      drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.width, false, true);
    } else {
      drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.width, false, false);
    }
  });

  socket.on('erase', (data) => {
    if (data.isEraser && data.hasOwnProperty('size')) { // Check if it's a square eraser action
      eraseSquare(data.x + data.size / 2, data.y + data.size / 2, data.size, false);
    } else if (data.isEraser) { // Check if it's an erase action drawn as a line
      drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.width, false, true);
    }
  });

  socket.on('drawingHistory', (history) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas before redrawing history
    history.forEach(item => {
      if (item.type === 'NEW_DRAWING' || (item.type === 'ERASE_DRAWING' && item.isEraser && item.hasOwnProperty('x0'))) {
        drawLine(item.payload.x0, item.payload.y0, item.payload.x1, item.payload.y1, item.payload.color, item.payload.width, false, item.payload.isEraser);
      } else if (item.type === 'ERASE_DRAWING' && item.payload.isEraser && item.payload.hasOwnProperty('size')) {
        eraseSquare(item.payload.x + item.payload.size / 2, item.payload.y + item.payload.size / 2, item.payload.size, false);
      }
    });
  });

  // Request drawing history when connected
  sendMessage('REQUEST_HISTORY', {});
});
