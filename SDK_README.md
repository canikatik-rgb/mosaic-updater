# Mosaic App Node SDK Guide

**Version:** 1.0  
**Protocol:** Mosaic Inter-App Messaging

## Overview

Mosaic uses a "Hybrid Architecture" where complex nodes are independent HTML applications running inside sandboxed iframes. These "App Nodes" communicate with the core system and other nodes using the **Mosaic Node SDK** (`MosaicNode.js`).

This guide explains how to build a new App Node that can:
1.  **Save/Load State** (Persistence)
2.  **Receive Input** from other nodes.
3.  **Send Output** to other nodes.

---

## 1. File Structure

Each App Node lives in its own folder within `node_types/`.

```
Mosaic/
├── node_types/
│   ├── my_super_node/
│   │   └── index.html  <-- Your App
├── js/
│   └── MosaicNode.js   <-- The SDK (Include this!)
```

## 2. Basic Boilerplate

Every App Node has this structure. You must include `../../js/MosaicNode.js`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        /* Your App Styles */
        body { margin: 0; background: #fff; }
    </style>
</head>
<body>
    <!-- Your App UI -->
    <div id="app">
        <input type="text" id="myInput" placeholder="Type something...">
        <button id="sendBtn">Send</button>
    </div>

    <!-- The SDK -->
    <script src="../../js/MosaicNode.js"></script>
    
    <!-- Your App Logic -->
    <script>
        // ... Code goes here ...
    </script>
</body>
</html>
```

## 3. Communication API

The `window.Mosaic` object is your gateway to the system.

### Sending Output (The "Output Port")

When your node produces data (e.g., user picked a color, generated text), send it out.
The core system will route this to any node connected to your **Right Pin**.

```javascript
// Send simple data
window.Mosaic.send({ type: 'text', value: 'Hello World' });

// Send complex objects
window.Mosaic.send({ 
    color: '#ff0000', 
    timestamp: Date.now(),
    meta: { source: 'my_super_node' } 
});
```

### Receiving Input (The "Input Port")

When another node sends data to your **Left Pin**, you receive it here.

```javascript
window.Mosaic.on('input', (payload) => {
    console.log('Received data:', payload);
    
    // Example: Update UI based on input
    if (payload.color) {
        document.body.style.backgroundColor = payload.color;
    }
});
```

## 4. Persistence (Save/Load)

Mosaic automatically saves your project, but you must tell it *what* to save.

### Saving State

Call this whenever your app's state changes (e.g., user typed text).

```javascript
// Save the current value
window.Mosaic.saveData({ 
    myInputValue: document.getElementById('myInput').value,
    mode: 'dark'
});
```

### Loading State

When the project opens, Mosaic gives you back your saved data.

```javascript
window.Mosaic.onDataLoaded = (data) => {
    if (data.myInputValue) {
        document.getElementById('myInput').value = data.myInputValue;
    }
    // Handle other state...
};
```

## 5. Design Guidelines (The "Shell" Contract)

To ensure your node feels native to Mosaic:

1.  **Zero Margins**: `body { margin: 0; }`. The shell handles the container border/shadow.
2.  **Responsive**: The user can resize your node. Use `100vw` / `100vh` or Flexbox to adapt.
3.  **Transparent Backgrounds**: If you want the node to blend in, use `background: transparent`.
4.  **Instant Feedback**: Call `saveData` on input events, not just blur, to prevent data loss on crash.

## 6. Example: A "Transform Node"

This node takes text input, uppercases it, and forwards it.

```javascript
// 1. Listen for Input
window.Mosaic.on('input', (data) => {
    if (data.value && typeof data.value === 'string') {
        const transformed = data.value.toUpperCase();
        
        // 2. Process & Update UI
        document.getElementById('display').innerText = transformed;
        
        // 3. Send Output immediately
        window.Mosaic.send({ type: 'text', value: transformed });
    }
});
```
