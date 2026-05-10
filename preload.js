const { webFrame } = require('electron');

// Resetar para zoom padrão (100%)
webFrame.setZoomFactor(1.1);
webFrame.setZoomLevel(0);
