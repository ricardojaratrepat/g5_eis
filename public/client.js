document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  
  const canvas = document.getElementById('whiteboard');
  const backgroundCanvas = document.getElementById('backgroundCanvas');
  const backgroundCtx = backgroundCanvas.getContext('2d');
  const ctx = canvas.getContext('2d');
  const overlayCanvas = document.createElement('canvas');
  const overlayCtx = overlayCanvas.getContext('2d');
  overlayCanvas.style.position = 'absolute';
  overlayCanvas.style.top = '0';
  overlayCanvas.style.left = '0';
  overlayCanvas.style.pointerEvents = 'none';
  document.getElementById('canvasContainer').appendChild(overlayCanvas);
  const userCountDisplay = document.getElementById('userCount');
  const drawBtn = document.getElementById('drawBtn');
  const eraseBtn = document.getElementById('eraseBtn');
  const rectBtn = document.getElementById('rectBtn');

  
  let drawing = false;
  let currentMode = 'draw'; // 'draw' or 'erase'
  let lastX, lastY, startRectX, startRectY;
  let isDrawingRectangle = false;
  
  const drawColor = 'lightgreen';
  const eraseColor = '#FFFFFF'; // White, same as canvas background
  const lineWidth = 5;
  const eraserSize = 20;

  // Canvas dimensions
  function setupCanvas() {
    const container = document.getElementById('canvasContainer');
    const containerRect = container.getBoundingClientRect();
    
    const width = containerRect.width;
    const height = containerRect.height;
    const devicePixelRatio = window.devicePixelRatio || 1;
    
    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    backgroundCanvas.width = width * devicePixelRatio;
    backgroundCanvas.height = height * devicePixelRatio;
    overlayCanvas.width = width * devicePixelRatio;
    overlayCanvas.height = height * devicePixelRatio;
    
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    backgroundCanvas.style.width = width + 'px';
    backgroundCanvas.style.height = height + 'px';
    overlayCanvas.style.width = width + 'px';
    overlayCanvas.style.height = height + 'px';
    
    ctx.scale(devicePixelRatio, devicePixelRatio);
    backgroundCtx.scale(devicePixelRatio, devicePixelRatio);
    overlayCtx.scale(devicePixelRatio, devicePixelRatio);
    
    canvas.displayWidth = width;
    canvas.displayHeight = height;
    canvas.scaleFactor = devicePixelRatio;
    overlayCanvas.displayWidth = width;
    overlayCanvas.displayHeight = height;
  }

  // Initial setup
  setupCanvas();

  // Resize handler
  window.addEventListener('resize', () => {
    setupCanvas();
    // Request redraw from server
    sendMessage('REQUEST_HISTORY', {});
  });

  function setBackgroundImage(src) {
    const img = new Image();
    img.onload = () => {
      backgroundCtx.clearRect(0, 0, canvas.displayWidth, canvas.displayHeight);
      backgroundCtx.drawImage(img, 0, 0, canvas.displayWidth, canvas.displayHeight);
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
    console.log("Modo establecido a:", currentMode);
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

  function drawPreviewRect(startX, startY, currentX, currentY) {
    const width = currentX - startX;
    const height = currentY - startY;
    
    // Clear the overlay canvas
    overlayCtx.clearRect(0, 0, overlayCanvas.displayWidth, overlayCanvas.displayHeight);
    
    // Draw preview rectangle with dashed line
    overlayCtx.save();
    overlayCtx.setLineDash([5, 5]);
    overlayCtx.strokeStyle = drawColor;
    overlayCtx.lineWidth = lineWidth;
    overlayCtx.globalAlpha = 0.7;
    overlayCtx.strokeRect(startX, startY, width, height);
    overlayCtx.restore();
  }

  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.displayWidth / rect.width;
    const scaleY = canvas.displayHeight / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  canvas.addEventListener('mousedown', (e) => {
    if (!isAdmin) return;
    const pos = getMousePos(e);
    const x = pos.x;
    const y = pos.y;

    drawing = true;

    if (currentMode === 'rectangle') {
      startRectX = x;
      startRectY = y;
      isDrawingRectangle = true;
    } else {
      lastX = x;
      lastY = y;
      if (currentMode === 'erase') {
        eraseSquare(x, y, eraserSize, true);
      }
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isAdmin) return;
    if (!drawing) return;
    const pos = getMousePos(e);
    const currentX = pos.x;
    const currentY = pos.y;

    if (currentMode === 'draw') {
      drawLine(lastX, lastY, currentX, currentY, drawColor, lineWidth, true, false);
    } else if (currentMode === 'erase') {
      drawLine(lastX, lastY, currentX, currentY, eraseColor, eraserSize, true, true);
    } else if (currentMode === 'rectangle' && isDrawingRectangle) {
      drawPreviewRect(startRectX, startRectY, currentX, currentY);
    }
    lastX = currentX;
    lastY = currentY;
  });

  canvas.addEventListener('mouseup', (e) => {
    if (!isAdmin || !drawing) return;
    drawing = false;

    const pos = getMousePos(e);
    const x = pos.x;
    const y = pos.y;

    if (currentMode === 'rectangle' && isDrawingRectangle) {
      const width = x - startRectX;
      const height = y - startRectY;
      
      // Clear preview and draw final rectangle
      overlayCtx.clearRect(0, 0, overlayCanvas.displayWidth, overlayCanvas.displayHeight);
      
      // Draw final rectangle
      drawRect(startRectX, startRectY, width, height, drawColor, lineWidth, true);
      isDrawingRectangle = false;
    }
  });

  canvas.addEventListener('mouseout', () => {
    // Optional: stop drawing if mouse leaves canvas
    drawing = false;
  });

  // Socket event listeners
  socket.on('userCount', (count) => {
    const counterText = document.querySelector('.counter-text');
    if (counterText) {
      counterText.textContent = `Usuarios: ${count}`;
    } else {
      userCountDisplay.textContent = `Usuarios: ${count}`;
    }
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
    // Store history in sessionStorage for preview functionality
    sessionStorage.setItem('drawingHistory', JSON.stringify(history));
    
    ctx.clearRect(0, 0, canvas.displayWidth, canvas.displayHeight);
    // First, apply any background image from history
    const backgroundItem = history.find(item => item.type === 'SET_BACKGROUND');
    if (backgroundItem) {
      setBackgroundImage(backgroundItem.payload.src);
    }
    
    // Then draw all other elements
    history.forEach(item => {
      if (item.type === 'NEW_DRAWING' || (item.type === 'ERASE_DRAWING' && item.payload.isEraser && item.payload.hasOwnProperty('x0'))) {
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

  function showSuccessNotification() {
    const notification = document.getElementById('successNotification');
    notification.classList.remove('hidden');
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.5s ease-in';
      setTimeout(() => {
        notification.classList.add('hidden');
        notification.style.animation = '';
      }, 500);
    }, 4000);
  }

  //Admin functionality
  document.getElementById('adminBtn').addEventListener('click', () => {
      document.getElementById('adminLogin').classList.remove('hidden');
  });

  document.getElementById('submitAdmin').addEventListener('click', () => {
    const code = document.getElementById('adminCode').value;
    if (code === '1234') { // Cambia este código según necesites
        isAdmin = true;
        showSuccessNotification();
        document.getElementById('adminLogin').classList.add('hidden');
        document.getElementById('adminBtn').classList.add('hidden');
        document.getElementById('adminCode').value = '';
        document.getElementById('toolbar_button').classList.remove('hidden');
    } else {
        alert('Código incorrecto. Por favor, inténtalo de nuevo.');
    }
  });

  document.getElementById('closeAdminLogin').addEventListener('click', () => {
    document.getElementById('adminLogin').classList.add('hidden');
  });

  const bgBtn = document.getElementById('bgBtn');

  bgBtn.addEventListener('click', () => {
    // Create a temporary file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = function (event) {
        const imageDataURL = event.target.result;
        setBackgroundImage(imageDataURL);

        // Send to other users
        socket.emit('message', {
          type: 'SET_BACKGROUND',
          payload: { src: imageDataURL }
        });
      };
      reader.readAsDataURL(file);
      
      // Clean up the temporary input
      document.body.removeChild(fileInput);
    });
    
    // Add to DOM temporarily and trigger click
    document.body.appendChild(fileInput);
    fileInput.click();
  });

  socket.on('setBackground', (data) => {
    setBackgroundImage(data.src);
  });
});
