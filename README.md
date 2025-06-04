# 🚗 LIVEPARK

A simple real-time collaborative whiteboard application built with Node.js, Express, and Socket.IO. It is meant to be used as a wizard of Oz, by being overlayed over a live video feed of parking lots.

## 🛠️ How to Run Locally

Follow these steps to get the application running on your local machine:

### 1. Prerequisites

* Node.js and npm (Node Package Manager) installed. You can download them from <https://nodejs.org/>.

### 2. Clone the Repository

```bash
git clone https://github.com/ricardojaratrepat/g5_eis.git
```

### 3. Navigate to Project Directory

```bash
cd g5_eis
```

### 4. Install Dependencies

```bash
npm install
```

(This will install `express` and `socket.io` as defined in the package.json)

### 5. Run the Server

```bash
node server.js
```

### 6. Test in Browser

* Open your web browser and navigate to `http://localhost:8000`.
* To see the collaborative features, you can open the same URL in multiple browser tabs or different browsers.

## 📂 Project Structure

```markdown
g5_eis/
├── public/                     # Static files served to the client
│   ├── index.html              # Main HTML structure
│   ├── style.css               # CSS for styling
│   └── client.js               # Client-side JavaScript logic
├── server.js                   # Node.js server with Express and Socket.IO logic
├── package.json                # Project metadata and dependencies
└── README.md                   # This file
```

## 🧱 Data Structures

The primary data structure in this application is the **Drawing Object**. Each action on the whiteboard (drawing a line segment or erasing) is represented as an object.

### Drawing/Erasing Object (Line-based)

This object is created when a user draws a continuous line or drags the eraser.

* **Sent by Client & Broadcast by Server**

```js
{
    x0: Number,       // Starting X coordinate of the line segment
    y0: Number,       // Starting Y coordinate of the line segment
    x1: Number,       // Ending X coordinate of the line segment
    y1: Number,       // Ending Y coordinate of the line segment
    color: String,    // Color of the line (e.g., 'lightgreen' for draw, '#FFFFFF' for erase)
    width: Number,    // Width of the line (or size of the eraser path)
    isEraser: Boolean // true if this is an erasing action, false for drawing
}
```

### Erasing Object (Square-based - for initial click)

This object is created when a user clicks with the eraser tool (not when he drags).

* **Sent by Client & Broadcast by Server**

```js
    x: Number,        // Top-left X coordinate of the erase square
    y: Number,        // Top-left Y coordinate of the erase square
    size: Number,     // Size (width and height) of the erase square
    color: String,    // Color of the erase (e.g., '#FFFFFF')
    isEraser: Boolean // Always true for this type
```

### Drawing History Storage (`drawingHistory` on Server)

The server maintains an array called drawingHistory. Each element in this array is an object that wraps the drawing/erasing data with its type:

```js
// Example element in drawingHistory array
{
    type: 'NEW_DRAWING', // or 'ERASE_DRAWING'
    payload: { /* ... drawing or erasing object as defined above ... */ }
}
```

## 💬 Socket.IO Messaging

Communication between the client and server is handled via Socket.IO. A generic message event is used on the server-side for receiving client actions.

### General Message Design Pattern (Client to Server)

Clients send messages to the server using a common structure:

* **Event Name:** `message`
* **Data Sent:**

```js
{
    type: String,    // The type of action (e.g., 'NEW_DRAWING', 'ERASE_DRAWING')
    payload: Object  // Data specific to the action type (see Data Structures above)
}
```

### Server-Side Message Handling

The `server.js` uses a `messageHandlers` object to process incoming messages based on their `type`:

```js
const messageHandlers = {
    NEW_DRAWING: (socket, payload) => { /* ... */ },
    ERASE_DRAWING: (socket, payload) => { /* ... */ },
    REQUEST_HISTORY: (socket, payload) => { /* ... */ }
};

// Inside io.on('connection', ...):
socket.on('message', (message) => {
    const { type, payload } = message;
    const handler = messageHandlers[type];
    if (handler) {
        handler(socket, payload); // socket is passed for context (e.g., broadcasting)
    }
});
```

You can see specific message implementations over at `messageHandlers`.

