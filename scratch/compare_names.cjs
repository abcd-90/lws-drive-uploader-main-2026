const https = require('https');

const API_KEY = 'AIzaSyC2CeH8R9aUMoVMeMQllc6hv1skCdoKHmE';
const FOLDER_ID = '1C25aheFHZKh7wdWi4kYOeyA9j9qhtmAx';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function printCharCodes(str) {
  return [...str].map(c => `U+${c.codePointAt(0).toString(16).toUpperCase()}`).join(' ');
}

async function main() {
  const q = encodeURIComponent(`'${FOLDER_ID}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&key=${API_KEY}`;
  const res = await fetchJson(url);
  const files = res.files || [];
  
  console.log('Comparing characters from API response:');
  for (const f of files) {
    if (f.mimeType !== 'application/vnd.google-apps.folder') {
      console.log(`\nFile: "${f.name}"`);
      console.log(`Char Codes: ${printCharCodes(f.name)}`);
    }
  }
}

main();
