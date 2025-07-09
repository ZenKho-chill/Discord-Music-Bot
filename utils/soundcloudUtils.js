const https = require('https');

// Resolve SoundCloud shortlinks (on.soundcloud.com)
async function resolveSoundCloudShortlink(shortUrl) {
  return new Promise((resolve, reject) => {
    https.get(shortUrl, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(res.headers.location);
      } else {
        resolve(shortUrl); // Không redirect, trả về link cũ
      }
    }).on('error', reject);
  });
}

module.exports = {
  resolveSoundCloudShortlink
};
