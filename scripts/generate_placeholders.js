/**
 * generate_placeholders.js
 * Creates all placeholder PNG images for the Bolt game.
 * Run with: node scripts/generate_placeholders.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const combined = Buffer.concat([t, data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, combined, c]);
}

function createPNG(w, h, drawFn) {
  const px = new Uint8Array(w * h * 4); // RGBA
  drawFn(px, w, h);

  // Build raw scanlines with filter byte
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const di = y * (w * 4 + 1) + 1 + x * 4;
      raw[di] = px[si]; raw[di+1] = px[si+1]; raw[di+2] = px[si+2]; raw[di+3] = px[si+3];
    }
  }

  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', zlib.deflateSync(raw)),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Drawing helpers
function setPixel(px, w, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= w || y < 0 || y >= w) return;
  const i = (y * w + Math.floor(x)) * 4;
  px[i] = r; px[i+1] = g; px[i+2] = b; px[i+3] = a;
}

function fillRect(px, w, h, x1, y1, x2, y2, r, g, b, a = 255) {
  for (let y = Math.max(0, y1); y < Math.min(h, y2); y++)
    for (let x = Math.max(0, x1); x < Math.min(w, x2); x++)
      setPixel(px, w, x, y, r, g, b, a);
}

function fillCircle(px, w, h, cx, cy, radius, r, g, b, a = 255) {
  for (let y = Math.max(0, cy-radius); y <= Math.min(h-1, cy+radius); y++)
    for (let x = Math.max(0, cx-radius); x <= Math.min(w-1, cx+radius); x++)
      if ((x-cx)*(x-cx)+(y-cy)*(y-cy) <= radius*radius)
        setPixel(px, w, x, y, r, g, b, a);
}

function fillTriangle(px, w, h, x1,y1, x2,y2, x3,y3, r, g, b, a = 255) {
  const minY = Math.max(0, Math.min(y1,y2,y3));
  const maxY = Math.min(h-1, Math.max(y1,y2,y3));
  for (let y = minY; y <= maxY; y++) {
    for (let x = 0; x < w; x++) {
      // Barycentric method
      const d1 = (x-x2)*(y1-y2)-(x1-x2)*(y-y2);
      const d2 = (x-x3)*(y2-y3)-(x2-x3)*(y-y3);
      const d3 = (x-x1)*(y3-y1)-(x3-x1)*(y-y1);
      const neg = (d1<0)||(d2<0)||(d3<0);
      const pos = (d1>0)||(d2>0)||(d3>0);
      if (!(neg && pos)) setPixel(px, w, x, y, r, g, b, a);
    }
  }
}

function fillDiamond(px, w, h, cx, cy, size, r, g, b, a = 255) {
  for (let y = cy-size; y <= cy+size; y++)
    for (let x = cx-size; x <= cx+size; x++)
      if (Math.abs(x-cx)+Math.abs(y-cy) <= size && x>=0 && x<w && y>=0 && y<h)
        setPixel(px, w, x, y, r, g, b, a);
}

function hexColor(hex) {
  const n = parseInt(hex.replace('0x','').replace('#',''), 16);
  return [(n>>16)&0xff, (n>>8)&0xff, n&0xff];
}

// ====== Image definitions ======
const BASE = path.join(__dirname, '..', 'src', 'assets', 'images');

const images = [];

// --- Player ---
images.push({
  path: 'player/ship.png', w: 64, h: 64,
  draw: (px, w, h) => {
    // Blue fighter ship shape - arrow pointing up
    fillTriangle(px, w, h, 32, 4, 8, 52, 56, 52, 68, 130, 255); // main body
    fillTriangle(px, w, h, 32, 4, 20, 30, 44, 30, 100, 180, 255); // cockpit
    fillRect(px, w, h, 14, 36, 24, 56, 50, 90, 200); // left wing
    fillRect(px, w, h, 40, 36, 50, 56, 50, 90, 200); // right wing
    fillRect(px, w, h, 28, 48, 36, 60, 255, 120, 0); // thruster
  }
});

// --- Enemies (22 types) ---
const enemies = [
  { id: 'scout_drone', color: '0x88aa88', tier: 'scout' },
  { id: 'serpent_drone', color: '0x77bb77', tier: 'scout' },
  { id: 'dive_scout', color: '0x669966', tier: 'scout' },
  { id: 'interceptor', color: '0xcc6644', tier: 'fighter' },
  { id: 'heavy_fighter', color: '0xcc4444', tier: 'fighter' },
  { id: 'laser_fighter', color: '0x4466cc', tier: 'fighter' },
  { id: 'missile_fighter', color: '0xaa6644', tier: 'fighter' },
  { id: 'parasite_tank', color: '0x886644', tier: 'heavy' },
  { id: 'artillery_carrier', color: '0x776633', tier: 'heavy' },
  { id: 'missile_truck', color: '0x665533', tier: 'heavy' },
  { id: 'walker_mech', color: '0x554433', tier: 'heavy' },
  { id: 'aa_turret', color: '0x666666', tier: 'turret' },
  { id: 'laser_tower', color: '0x4455aa', tier: 'turret' },
  { id: 'bullet_tower', color: '0x775555', tier: 'turret' },
  { id: 'missile_silo', color: '0x445544', tier: 'turret' },
  { id: 'elite_interceptor', color: '0xee5533', tier: 'elite' },
  { id: 'laser_destroyer', color: '0x3366cc', tier: 'elite' },
  { id: 'missile_cruiser', color: '0x993333', tier: 'elite' },
  { id: 'drone_carrier', color: '0x664444', tier: 'elite' },
  { id: 'alien_core', color: '0xaa33aa', tier: 'elite' },
  { id: 'fairy', color: '0xffccff', tier: 'hidden' },
  { id: 'ufo', color: '0xffff66', tier: 'hidden' },
];

for (const e of enemies) {
  const [r, g, b] = hexColor(e.color);
  const size = e.tier === 'scout' ? 48 : e.tier === 'fighter' ? 48 : e.tier === 'heavy' ? 56 : e.tier === 'turret' ? 48 : 56;
  const imgSize = 64;

  images.push({
    path: `enemies/${e.id}.png`, w: imgSize, h: imgSize,
    draw: (px, w, h) => {
      const cx = w/2, cy = h/2;
      if (e.tier === 'scout') {
        // Diamond shape pointing down (enemy facing player)
        fillDiamond(px, w, h, cx, cy, 18, r, g, b);
        fillDiamond(px, w, h, cx, cy, 10, Math.min(255,r+40), Math.min(255,g+40), Math.min(255,b+40));
        // Eyes/cockpit
        fillCircle(px, w, h, cx, cy-4, 3, 255, 255, 200);
      } else if (e.tier === 'fighter') {
        // Inverted triangle (facing down)
        fillTriangle(px, w, h, cx, cy+22, cx-20, cy-16, cx+20, cy-16, r, g, b);
        fillRect(px, w, h, cx-6, cy-8, cx+6, cy+6, Math.min(255,r+60), Math.min(255,g+60), Math.min(255,b+60));
        // Wings
        fillRect(px, w, h, cx-24, cy-12, cx-14, cy+4, r, g, b);
        fillRect(px, w, h, cx+14, cy-12, cx+24, cy+4, r, g, b);
      } else if (e.tier === 'heavy') {
        // Large rectangle with details
        fillRect(px, w, h, cx-20, cy-16, cx+20, cy+16, r, g, b);
        fillRect(px, w, h, cx-16, cy-12, cx+16, cy+12, Math.min(255,r+30), Math.min(255,g+30), Math.min(255,b+30));
        // Turret
        fillCircle(px, w, h, cx, cy, 6, Math.max(0,r-30), Math.max(0,g-30), Math.max(0,b-30));
        // Treads
        fillRect(px, w, h, cx-24, cy-14, cx-20, cy+14, Math.max(0,r-50), Math.max(0,g-50), Math.max(0,b-50));
        fillRect(px, w, h, cx+20, cy-14, cx+24, cy+14, Math.max(0,r-50), Math.max(0,g-50), Math.max(0,b-50));
      } else if (e.tier === 'turret') {
        // Circle (stationary)
        fillCircle(px, w, h, cx, cy, 18, r, g, b);
        fillCircle(px, w, h, cx, cy, 10, Math.min(255,r+40), Math.min(255,g+40), Math.min(255,b+40));
        // Gun barrel
        fillRect(px, w, h, cx-2, cy-4, cx+2, cy+20, Math.max(0,r-40), Math.max(0,g-40), Math.max(0,b-40));
      } else if (e.tier === 'elite') {
        // Hexagon-ish shape
        fillDiamond(px, w, h, cx, cy, 22, r, g, b);
        fillRect(px, w, h, cx-16, cy-10, cx+16, cy+10, r, g, b);
        fillCircle(px, w, h, cx, cy, 8, Math.min(255,r+60), Math.min(255,g+60), Math.min(255,b+60));
        // Glow border
        fillCircle(px, w, h, cx, cy, 4, 255, 255, 200);
      } else if (e.tier === 'hidden') {
        // Star/sparkle shape
        fillDiamond(px, w, h, cx, cy, 14, r, g, b);
        fillCircle(px, w, h, cx, cy, 8, 255, 255, 255, 200);
      }
    }
  });
}

// --- Bosses ---
images.push({
  path: 'bosses/tank_boss.png', w: 128, h: 96,
  draw: (px, w, h) => {
    // Large tank body
    fillRect(px, w, h, 16, 20, 112, 72, 85, 102, 68);
    // Treads
    fillRect(px, w, h, 8, 16, 20, 80, 51, 51, 34);
    fillRect(px, w, h, 108, 16, 120, 80, 51, 51, 34);
    // Left turret
    fillCircle(px, w, h, 36, 36, 10, 68, 85, 51);
    fillRect(px, w, h, 32, 36, 40, 60, 68, 85, 51);
    // Right turret
    fillCircle(px, w, h, 92, 36, 10, 68, 85, 51);
    fillRect(px, w, h, 88, 36, 96, 60, 68, 85, 51);
    // Core
    fillCircle(px, w, h, 64, 48, 8, 255, 50, 0);
    // Details
    fillRect(px, w, h, 40, 28, 88, 36, 102, 119, 85);
  }
});

images.push({
  path: 'bosses/bomber_boss.png', w: 160, h: 96,
  draw: (px, w, h) => {
    // Bomber fuselage
    fillRect(px, w, h, 32, 28, 128, 62, 68, 85, 102);
    // Wings
    fillRect(px, w, h, 8, 36, 152, 52, 85, 102, 119);
    // Left engine
    fillCircle(px, w, h, 32, 44, 8, 51, 68, 85);
    // Right engine
    fillCircle(px, w, h, 128, 44, 8, 51, 68, 85);
    // Bomb bay (glow)
    fillRect(px, w, h, 56, 50, 104, 60, 255, 68, 0, 180);
    // Cockpit
    fillCircle(px, w, h, 80, 32, 6, 100, 120, 150);
  }
});

images.push({
  path: 'bosses/carrier_boss.png', w: 192, h: 112,
  draw: (px, w, h) => {
    // Hull
    fillRect(px, w, h, 16, 24, 176, 88, 68, 85, 68);
    // Deck
    fillRect(px, w, h, 20, 28, 172, 84, 85, 102, 85);
    // Bridge
    fillRect(px, w, h, 130, 20, 155, 56, 102, 119, 102);
    // AA turrets (4 corners)
    fillCircle(px, w, h, 32, 32, 6, 136, 136, 102);
    fillCircle(px, w, h, 32, 78, 6, 136, 136, 102);
    fillCircle(px, w, h, 120, 32, 6, 136, 136, 102);
    fillCircle(px, w, h, 120, 78, 6, 136, 136, 102);
    // Missile launchers
    fillRect(px, w, h, 68, 44, 82, 56, 153, 102, 68);
    fillRect(px, w, h, 92, 44, 106, 56, 153, 102, 68);
    // Core
    fillCircle(px, w, h, 80, 55, 8, 255, 34, 0, 200);
  }
});

// --- Bullets ---
images.push({
  path: 'bullets/player_bullet.png', w: 16, h: 16,
  draw: (px, w, h) => {
    fillCircle(px, w, h, 8, 8, 6, 0, 255, 170);
    fillCircle(px, w, h, 8, 8, 3, 200, 255, 255);
  }
});

images.push({
  path: 'bullets/enemy_bullet.png', w: 16, h: 16,
  draw: (px, w, h) => {
    fillCircle(px, w, h, 8, 8, 6, 255, 50, 50);
    fillCircle(px, w, h, 8, 8, 3, 255, 150, 100);
  }
});

// --- Drops ---
images.push({
  path: 'drops/powerup_red.png', w: 32, h: 32,
  draw: (px, w, h) => {
    fillDiamond(px, w, h, 16, 16, 12, 255, 68, 68);
    fillDiamond(px, w, h, 16, 16, 6, 255, 150, 150);
    // "V" for vulcan
    fillRect(px, w, h, 12, 10, 15, 18, 255, 255, 255);
    fillRect(px, w, h, 17, 10, 20, 18, 255, 255, 255);
  }
});

images.push({
  path: 'drops/powerup_blue.png', w: 32, h: 32,
  draw: (px, w, h) => {
    fillDiamond(px, w, h, 16, 16, 12, 68, 68, 255);
    fillDiamond(px, w, h, 16, 16, 6, 150, 150, 255);
    // "L" for laser
    fillRect(px, w, h, 12, 10, 15, 22, 255, 255, 255);
    fillRect(px, w, h, 12, 19, 20, 22, 255, 255, 255);
  }
});

images.push({
  path: 'drops/powerup_purple.png', w: 32, h: 32,
  draw: (px, w, h) => {
    fillDiamond(px, w, h, 16, 16, 12, 170, 68, 255);
    fillDiamond(px, w, h, 16, 16, 6, 220, 150, 255);
    // "H" for homing
    fillRect(px, w, h, 11, 10, 14, 22, 255, 255, 255);
    fillRect(px, w, h, 18, 10, 21, 22, 255, 255, 255);
    fillRect(px, w, h, 14, 14, 18, 17, 255, 255, 255);
  }
});

images.push({
  path: 'drops/bomb.png', w: 32, h: 32,
  draw: (px, w, h) => {
    fillCircle(px, w, h, 16, 18, 10, 255, 136, 0);
    fillCircle(px, w, h, 16, 18, 6, 255, 200, 50);
    // Fuse
    fillRect(px, w, h, 14, 6, 18, 12, 200, 200, 200);
    fillCircle(px, w, h, 16, 5, 3, 255, 100, 0);
  }
});

images.push({
  path: 'drops/medal.png', w: 32, h: 32,
  draw: (px, w, h) => {
    fillCircle(px, w, h, 16, 16, 12, 255, 221, 0);
    fillCircle(px, w, h, 16, 16, 8, 255, 240, 100);
    // Star
    fillDiamond(px, w, h, 16, 16, 5, 255, 255, 200);
  }
});

// --- Background ---
images.push({
  path: 'bg/ground.png', w: 256, h: 256,
  draw: (px, w, h) => {
    // Dark green terrain with grid
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 26, g = 58, b = 26;
        // Grid lines
        if (x % 32 === 0 || y % 32 === 0) { r = 30; g = 68; b = 32; }
        // Random darker patches
        const hash = ((x * 7 + y * 13) * 2654435761) >>> 0;
        if (hash % 100 < 8) { r -= 8; g -= 12; b -= 8; }
        setPixel(px, w, x, y, r, g, b, 255);
      }
    }
  }
});

images.push({
  path: 'bg/clouds.png', w: 256, h: 256,
  draw: (px, w, h) => {
    // Semi-transparent clouds
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        setPixel(px, w, x, y, 0, 0, 0, 0); // transparent base
      }
    }
    // Cloud puffs
    const puffs = [
      [40, 60, 35], [120, 30, 40], [200, 80, 30],
      [80, 180, 45], [160, 140, 35], [220, 200, 40],
      [30, 220, 30], [140, 230, 35], [60, 120, 25],
    ];
    for (const [cx, cy, r] of puffs) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist <= r) {
            const alpha = Math.floor(40 * (1 - dist/r));
            const px_x = (cx + dx + w) % w;
            const px_y = (cy + dy + h) % h;
            const i = (px_y * w + px_x) * 4;
            px[i] = Math.min(255, px[i] + 200);
            px[i+1] = Math.min(255, px[i+1] + 210);
            px[i+2] = Math.min(255, px[i+2] + 230);
            px[i+3] = Math.min(255, px[i+3] + alpha);
          }
        }
      }
    }
  }
});

// ====== Generate all images ======
let count = 0;
for (const img of images) {
  const fullPath = path.join(BASE, img.path);
  const dir = path.dirname(fullPath);
  fs.mkdirSync(dir, { recursive: true });

  const pngData = createPNG(img.w, img.h, img.draw);
  fs.writeFileSync(fullPath, pngData);
  count++;
  console.log(`  ✓ ${img.path} (${img.w}×${img.h})`);
}

console.log(`\nDone! Generated ${count} placeholder images in src/assets/images/`);
