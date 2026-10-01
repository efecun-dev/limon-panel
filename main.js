const { app, BrowserWindow, dialog } = require('electron');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const dev = !app.isPackaged;
const dir = path.join(__dirname);
const nextApp = next({ dev, dir });
const handle = nextApp.getRequestHandler();

let mainWindow;

app.whenReady().then(() => {
  // Check for updates
  autoUpdater.checkForUpdatesAndNotify();

  nextApp.prepare().then(() => {
    // Start Next.js custom server
    const server = createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    });

    const PORT = 3000;
    server.listen(PORT, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://localhost:${PORT}`);

      // Create Electron window once server is ready
      mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "Limon Panel",
        icon: path.join(__dirname, 'public/limonlogo.ico'), // Limon Logosu
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      // Gizli menü bar (gerekirse alt tuşu ile açılır)
      mainWindow.setMenuBarVisibility(false);

      mainWindow.loadURL(`http://localhost:${PORT}`);
    });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
