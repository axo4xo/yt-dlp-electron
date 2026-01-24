import './index.css';

const ytdlpPathInput = document.getElementById('ytdlp-path') as HTMLInputElement;
const sourceUrlInput = document.getElementById('source-url') as HTMLInputElement;
const downloadPathInput = document.getElementById('download-path') as HTMLInputElement;
const browseYtdlpBtn = document.getElementById('browse-ytdlp') as HTMLButtonElement;
const browseFolderBtn = document.getElementById('browse-folder') as HTMLButtonElement;
const downloadMp3Btn = document.getElementById('download-mp3') as HTMLButtonElement;
const downloadMp4Btn = document.getElementById('download-mp4') as HTMLButtonElement;
const statusText = document.getElementById('status-text') as HTMLDivElement;
const progressContainer = document.getElementById('progress-container') as HTMLDivElement;
const progressBar = document.getElementById('progress-bar') as HTMLDivElement;
const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
const openFolderBtn = document.getElementById('open-folder-btn') as HTMLButtonElement;
const logElement = document.getElementById('log') as HTMLPreElement;

let isDownloading = false;
let removeProgressListener: (() => void) | null = null;

async function init() {
  const settings = await window.api.getSettings();
  ytdlpPathInput.value = settings.ytdlpPath;
  downloadPathInput.value = settings.downloadPath;

  await checkClipboardForUrl();

  browseYtdlpBtn.addEventListener('click', browseYtdlp);
  browseFolderBtn.addEventListener('click', browseFolder);
  downloadMp3Btn.addEventListener('click', () => startDownload('mp3'));
  downloadMp4Btn.addEventListener('click', () => startDownload('mp4'));
  cancelBtn.addEventListener('click', cancelDownload);
  openFolderBtn.addEventListener('click', openFolder);

  sourceUrlInput.addEventListener('click', checkClipboardForUrl);

  ytdlpPathInput.addEventListener('blur', saveSettings);
  downloadPathInput.addEventListener('blur', saveSettings);

  removeProgressListener = window.api.onProgress((text) => {
    appendLog(text);
    parseProgress(text);
  });
}

async function checkClipboardForUrl() {
  const clipboardText = await window.api.getClipboardText();
  if (clipboardText && clipboardText.includes('https://')) {
    sourceUrlInput.value = clipboardText;
  }
}

async function browseYtdlp() {
  const path = await window.api.selectFile();
  if (path) {
    ytdlpPathInput.value = path;
    saveSettings();
  }
}

async function browseFolder() {
  const path = await window.api.selectFolder();
  if (path) {
    downloadPathInput.value = path;
    saveSettings();
  }
}

async function saveSettings() {
  await window.api.setSettings({
    ytdlpPath: ytdlpPathInput.value,
    downloadPath: downloadPathInput.value,
  });
}

async function startDownload(format: 'mp3' | 'mp4') {
  const url = sourceUrlInput.value.trim();
  const ytdlpPath = ytdlpPathInput.value.trim();
  const downloadPath = downloadPathInput.value.trim();

  if (!url) {
    setStatus('Please enter a URL', 'error');
    sourceUrlInput.focus();
    return;
  }

  if (!ytdlpPath) {
    setStatus('Please set yt-dlp binary path', 'error');
    ytdlpPathInput.focus();
    return;
  }

  if (!downloadPath) {
    setStatus('Please set download destination', 'error');
    downloadPathInput.focus();
    return;
  }

  setDownloading(true);
  clearLog();
  setStatus(`Downloading ${format.toUpperCase()}...`, 'downloading');
  showProgress();

  try {
    await window.api.download({
      url,
      ytdlpPath,
      downloadPath,
      format,
    });
    setStatus('Download complete!', 'success');
    openFolderBtn.classList.remove('hidden');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Download failed';
    setStatus(message, 'error');
    appendLog(`\nError: ${message}`);
  } finally {
    setDownloading(false);
    hideProgress();
  }
}

async function cancelDownload() {
  await window.api.cancelDownload();
  setStatus('Download cancelled', 'error');
  setDownloading(false);
  hideProgress();
}

async function openFolder() {
  await window.api.openFolder(downloadPathInput.value);
}

function setStatus(text: string, type?: 'downloading' | 'success' | 'error') {
  statusText.textContent = text;
  statusText.className = 'status-text';
  if (type) {
    statusText.classList.add(type);
  }
}

function setDownloading(downloading: boolean) {
  isDownloading = downloading;
  downloadMp3Btn.disabled = downloading;
  downloadMp4Btn.disabled = downloading;
  cancelBtn.classList.toggle('hidden', !downloading);
  openFolderBtn.classList.add('hidden');
  
  if (downloading) {
    downloadMp3Btn.classList.add('downloading');
    downloadMp4Btn.classList.add('downloading');
  } else {
    downloadMp3Btn.classList.remove('downloading');
    downloadMp4Btn.classList.remove('downloading');
  }
}

function showProgress() {
  progressContainer.classList.add('active');
  progressBar.style.width = '0%';
}

function hideProgress() {
  progressContainer.classList.remove('active');
}

function parseProgress(text: string) {
  const match = text.match(/\[download\]\s+(\d+\.?\d*)%/);
  if (match) {
    const percent = parseFloat(match[1]);
    progressBar.style.width = `${percent}%`;
  }
}

function appendLog(text: string) {
  logElement.textContent += text;
  logElement.scrollTop = logElement.scrollHeight;
}

function clearLog() {
  logElement.textContent = '';
}

init();
