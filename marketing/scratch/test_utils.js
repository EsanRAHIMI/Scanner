
const isVideoUrl = (url) => {
  if (!url) return false;
  const l = url.toLowerCase();
  const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v'];
  return videoExts.some((ext) => l.includes(ext)) || l.includes('#video');
}

const getGoogleDriveFileId = (url) => {
  if (!url) return null;
  const match = url.match(/[\/=]d\/([^\/=\?&#\s]+)/) || 
                url.match(/[?&]id=([^\/=\?&#\s]+)/);
  
  if (match?.[1]) return match[1];
  
  if (url.includes('lh3.googleusercontent.com/d/')) {
    const parts = url.split('lh3.googleusercontent.com/d/');
    if (parts[1]) {
      const id = parts[1].split(/[=\?&#\s]/)[0];
      return id || null;
    }
  }

  return null;
}

const getMediaPreviewUrl = (url) => {
  if (!url) return '';
  const driveId = getGoogleDriveFileId(url);
  if (driveId) {
    return `https://lh3.googleusercontent.com/d/${driveId}`;
  }
  return url;
}

const isImageUrl = (url) => {
  if (!url) return false;
  const l = url.toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.heic'];
  if (l.includes('drive.google.com') || l.includes('lh3.googleusercontent.com/d/')) {
    return !isVideoUrl(url);
  }
  return imageExts.some((ext) => l.includes(ext));
}

const urls = [
  'https://lh3.googleusercontent.com/d/18JCMXuKO-YHGaqJwGbiJvua-qakoYgld=w1000',
  'https://drive.google.com/file/d/1M4Agv5lP7TeJuwOsBnLi-GMp6-XDpuv7/view?usp=drive_link',
  'https://drive.google.com/file/d/18TIZP8FV-mUnviW4gQ5nr-9aKuuWNwH3/view?usp=sharing#video'
];

urls.forEach(u => {
  console.log('Original:', u);
  console.log('ID:', getGoogleDriveFileId(u));
  console.log('Preview:', getMediaPreviewUrl(u));
  console.log('IsImage:', isImageUrl(u));
  console.log('IsVideo:', isVideoUrl(u));
  console.log('---');
});
