const { app, BrowserWindow, nativeTheme } = require('electron');
const path = require('path');

let mainWindow;
let reloadAttempted = false;
function createWindow() {
  // Configuração do modo escuro
  nativeTheme.themeSource = 'dark';

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    zoomToPageWidth:true,
    show: false, // Esconde até estar pronto
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#000000' : '#ffffff',
    autoHideMenuBar: true,
    hiddenInMissionControl: true,
    transparent: true,
    fullscreen:true,
    backgroundMaterial: 'acrylic', // Windows 11,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js') // Opcional
    }
  });


  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
     // Força reload apenas uma vez
  if (!reloadAttempted) {
    mainWindow.webContents.reload();
    reloadAttempted = true;
  }
  });

  // Carrega APENAS localhost
  mainWindow.loadURL('http://localhost:3993');
}

// Atualiza tema dinamicamente
nativeTheme.on('updated', () => {
  mainWindow.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#000000' : '#ffffff');

});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
