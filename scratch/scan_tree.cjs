const https = require('https');

const API_KEY = 'AIzaSyC2CeH8R9aUMoVMeMQllc6hv1skCdoKHmE';
const ROOT_FOLDER_ID = '1C25aheFHZKh7wdWi4kYOeyA9j9qhtmAx';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    }).on('error', reject);
  });
}

async function listChildren(folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&pageSize=1000&key=${API_KEY}`;
  const res = await fetchJson(url);
  return res.files || [];
}

async function walk(folderId, path = '') {
  const items = await listChildren(folderId);
  for (const item of items) {
    const currentPath = path ? `${path}/${item.name}` : item.name;
    console.log(`[${item.mimeType}] ${currentPath} (ID: ${item.id})`);
    if (item.mimeType === 'application/vnd.google-apps.folder') {
      await walk(item.id, currentPath);
    }
  }
}

async function main() {
  console.log('Scanning folder structure recursively...');
  try {
    await walk(ROOT_FOLDER_ID);
    console.log('Scan completed successfully!');
  } catch (err) {
    console.error('Scan failed:', err);
  }
}

main();
