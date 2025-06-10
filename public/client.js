document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  
  const canvas = document.getElementById('whiteboard');
  const backgroundCanvas = document.getElementById('backgroundCanvas');
  const backgroundCtx = backgroundCanvas.getContext('2d');
  const ctx = canvas.getContext('2d');
  const userCountDisplay = document.getElementById('userCount');
  const drawBtn = document.getElementById('drawBtn');
  const eraseBtn = document.getElementById('eraseBtn');
  const rectBtn = document.getElementById('rectBtn');

  
  let drawing = false;
  let currentMode = 'draw'; // 'draw' or 'erase'
  let lastX, lastY, startRectX, startRectY;
  
  const drawColor = 'lightgreen';
  const eraseColor = '#FFFFFF'; // White, same as canvas background
  const lineWidth = 5;
  const eraserSize = 20;

  // Canvas dimensions
  canvas.width = window.innerWidth * 0.9;
  canvas.height = window.innerHeight * 0.8;
  backgroundCanvas.width = canvas.width;
  backgroundCanvas.height = canvas.height;

  function setBackgroundImage(src) {
    const img = new Image();
    img.onload = () => {
      backgroundCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
      backgroundCtx.drawImage(img, 0, 0, backgroundCanvas.width, backgroundCanvas.height);
    };
    img.src = src;
  }



  // Admin variables
  let isAdmin = false;

  function setMode(newMode) {
    currentMode = newMode;
    drawBtn.classList.toggle('active', newMode === 'draw');
    eraseBtn.classList.toggle('active', newMode === 'erase');
    rectBtn.classList.toggle('active', newMode === 'rectangle');
    console.log("Mode set to:", currentMode);
  }

  drawBtn.addEventListener('click', () => setMode('draw'));
  eraseBtn.addEventListener('click', () => setMode('erase'));
  rectBtn.addEventListener('click', () => setMode('rectangle'));
  setMode('draw'); // Default mode

  // Function to send messages to the server
  function sendMessage(type, payload) {
    socket.emit('message', { type, payload });
  }

  function drawLine(x0, y0, x1, y1, color, width, emit = false, isEraser = false) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
    }
    ctx.stroke();
    ctx.closePath();
    ctx.restore();

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

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)'; // cualquier color, no importa en destination-out
    ctx.fillRect(x - halfSize, y - halfSize, size, size);
    ctx.restore();

    if (emit) {
      const eraseObject = {
        type: 'ERASE_DRAWING',
        payload: {
          x: x - halfSize,
          y: y - halfSize,
          size,
          isEraser: true
        }
      };
      sendMessage(eraseObject.type, eraseObject.payload);
    }
  }


  function drawRect(x, y, width, height, color, lineWidth, emit = false) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x, y, width, height);
    ctx.closePath();

    if (emit) {
      console.log('Enviando rectángulo al servidor:', { x, y, width, height });
      sendMessage('DRAW_RECTANGLE', {
        x, y, width, height,
        color,
        lineWidth,
        isEraser: false
      });
    }
  }

  canvas.addEventListener('mousedown', (e) => {
    if (!isAdmin) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    drawing = true;

    if (currentMode === 'rectangle') {
      startRectX = x;
      startRectY = y;
    } else {
      lastX = x;
      lastY = y;
      if (currentMode === 'erase') {
        eraseSquare(x, y, eraserSize, true);
      }
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isAdmin) return; // Only allow drawing if admin
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

  canvas.addEventListener('mouseup', (e) => {
  if (!isAdmin || !drawing) return;
  drawing = false;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  console.log('mouseup mode:', currentMode); // DEBUG

  if (currentMode === 'rectangle') {
    const width = x - startRectX;
    const height = y - startRectY;
    console.log('Rectángulo capturado:', { x: startRectX, y: startRectY, width, height }); // DEBUG
    drawRect(startRectX, startRectY, width, height, drawColor, lineWidth, true);
  }
});

  canvas.addEventListener('mouseout', () => {
    // Optional: stop drawing if mouse leaves canvas
    drawing = false;
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

  socket.on('drawRectangle', (data) => {
    drawRect(data.x, data.y, data.width, data.height, data.color, data.lineWidth, false);
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
      } else if (item.type === 'DRAW_RECTANGLE') {
        drawRect(item.payload.x, item.payload.y, item.payload.width, item.payload.height, item.payload.color, item.payload.lineWidth, false);
      }
    });
  });

  // Request drawing history when connected
  sendMessage('REQUEST_HISTORY', {});

  //Admin functionality
  document.getElementById('adminBtn').addEventListener('click', () => {
      document.getElementById('adminLogin').classList.remove('hidden');
  });

  document.getElementById('submitAdmin').addEventListener('click', () => {
    const code = document.getElementById('adminCode').value;
    if (code === '1234') { // Cambia este código según necesites
        isAdmin = true;
        alert('Entraste como administrador');
        document.getElementById('adminLogin').classList.add('hidden');
        document.getElementById('adminBtn').classList.add('hidden');
        document.getElementById('adminCode').value = '';
        document.getElementById('toolbar_button').classList.remove('hidden');
    } else {
        alert('Código incorrecto');
    }
  });

  document.getElementById('closeAdminLogin').addEventListener('click', () => {
    document.getElementById('adminLogin').classList.add('hidden');
  });

  const bgInput = document.getElementById('bgInput');

  bgInput.classList.remove('hidden');

  bgInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (event) {
      const imageDataURL = event.target.result;
      setBackgroundImage(imageDataURL);

      // (Opcional) enviar a otros usuarios
      socket.emit('message', {
        type: 'SET_BACKGROUND',
        payload: { src: imageDataURL }
      });
    };
    reader.readAsDataURL(file);
  });

  socket.on('setBackground', (data) => {
    setBackgroundImage(data.src);
  });
});
