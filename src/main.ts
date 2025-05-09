import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import { getCommuteTime, is192Network } from './commute';

// TypeScript compiler will provide these in the compiled JS
declare const __dirname: string;

// Set app name
app.name = 'Commute Time';

// Create custom menu
const template: Electron.MenuItemConstructorOptions[] = [
  {
    label: 'Commute Time',
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  },
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'close' }
    ]
  }
];

let mainWindow: BrowserWindow;
let tray: Tray | null = null;
let isQuitting = false;
// Store last 24 commute times (2 hours worth of 5-minute intervals)
const historicalTimes: number[] = [];

function getLocationEmoji() {
  return is192Network() ? '🚗💼' : '🚗🏠';
}

async function createTray() {
  // Load car icon
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'car.png'));
  // Determine emoji based on network
  const locationEmoji = getLocationEmoji();
  tray = new Tray(icon);
  tray.setTitle(`${locationEmoji} Loading...`);
  
  // Show window on click instead of context menu
  tray.on('click', () => mainWindow.show());
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 250,
    height: 250, // Increased height to accommodate sparkline
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: 'Commute Time',
    icon: path.join(__dirname, 'assets', 'car.png')
  });

  await mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  // Hide window instead of closing it
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  
  // Get initial commute time
  updateCommuteTime();
  
  // Update commute time every 5 minutes
  setInterval(updateCommuteTime, 5 * 60 * 1000);
}

async function updateCommuteTime() {
  try {
    const time = await getCommuteTime();
    // Parse time string to total minutes (supports "1 hr 2 min", "49 min", etc)
    let minutes = 0;
    const hrMatch = time.match(/(\d+)\s*hr/);
    const minMatch = time.match(/(\d+)\s*min/);
    if (hrMatch) {
      minutes += parseInt(hrMatch[1], 10) * 60;
    }
    if (minMatch) {
      minutes += parseInt(minMatch[1], 10);
    }
    if (!isNaN(minutes) && minutes > 0) {
      historicalTimes.push(minutes);
      // Keep only last 24 readings
      if (historicalTimes.length > 24) {
        historicalTimes.shift();
      }
    }
    // Update both window and tray with location emoji
    const locationEmoji = getLocationEmoji();
    mainWindow.webContents.send('update-time', { current: time, history: historicalTimes });
    if (tray) {
      tray.setTitle(`${locationEmoji} ${time}`);
    }
  } catch (error) {
    console.error('Error fetching commute time:', error);
    const locationEmoji = getLocationEmoji();
    if (tray) {
      tray.setTitle(`${locationEmoji} Error`);
    }
  }
}

// Initialize app and create both window and tray
app.whenReady().then(async () => {
    await createTray();
  await createWindow();
});

// Only quit when explicitly asked to quit
app.on('window-all-closed', () => {
  // Do nothing, keep the app running
});

// Set quitting flag when quitting
app.on('before-quit', () => {
  isQuitting = true;
});

app.on('activate', () => {
  // Show window when clicking dock icon
  mainWindow.show();
});