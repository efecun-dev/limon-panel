const { app, BrowserWindow, dialog } = require('electron');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');

// Asar arşivi içinden .env.local dosyasını manuel okuyup process.env'e ekliyoruz
try {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {
  console.error("Env loading error:", e);
}

const dev = !true;
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
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js')
        }
      });

      // Gizli menü bar (gerekirse alt tuşu ile açılır)
      mainWindow.setMenuBarVisibility(false);

      mainWindow.loadURL(`http://localhost:${PORT}`);

      // Auto Updater Events
      autoUpdater.on('update-available', () => {
        mainWindow.webContents.send('update-available');
      });
      autoUpdater.on('update-not-available', () => {
        mainWindow.webContents.send('update-not-available');
      });
      autoUpdater.on('download-progress', (progressObj) => {
        mainWindow.webContents.send('download-progress', progressObj);
      });
      autoUpdater.on('update-downloaded', () => {
        mainWindow.webContents.send('update-downloaded');
      });
      autoUpdater.on('error', (err) => {
        mainWindow.webContents.send('update-error', err.toString());
      });
    });
  });
});

const { ipcMain } = require('electron');

ipcMain.on('check-for-updates', () => {
  autoUpdater.checkForUpdates();
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

