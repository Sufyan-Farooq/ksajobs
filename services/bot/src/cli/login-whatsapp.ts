import dotenv from 'dotenv';
dotenv.config();

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';

async function main() {
  console.log('\n======================================================');
  console.log('📲 KSA Jobs - WhatsApp QR Login Generator');
  console.log('======================================================\n');

  const sessionPath = process.env.WHATSAPP_SESSION_PATH || './sessions/whatsapp';
  
  // Clean up partial invalid files if resetting
  if (process.argv.includes('--fresh') && fs.existsSync(sessionPath)) {
    console.log('🧹 Clearing old session folder for fresh login...');
    fs.rmSync(sessionPath, { recursive: true, force: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({
    version: [2, 3000, 1015901307] as [number, number, number],
    isLatest: true,
  }));

  console.log(`🌐 Baileys Version: ${version.join('.')} (isLatest: ${isLatest})`);

  const socket = makeWASocket({
    version,
    auth: state,
    browser: Browsers.windows('Desktop'),
    printQRInTerminal: false,
    generateHighQualityLinkPreview: true,
  });

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n' + '='.repeat(60));
      console.log('📸 SCAN THIS WHATSAPP QR CODE WITH YOUR PHONE:');
      console.log('Open WhatsApp > Linked Devices > Link a Device');
      console.log('='.repeat(60) + '\n');

      qrcode.generate(qr, { small: true });

      console.log('\n' + '='.repeat(60));

      // Save high-resolution QR image for web browser view
      try {
        const publicDir = path.resolve(process.cwd(), '../../apps/web/public');
        if (fs.existsSync(publicDir)) {
          const qrPath = path.join(publicDir, 'whatsapp-qr.png');
          await QRCode.toFile(qrPath, qr, { width: 400, margin: 2 });
          console.log(`🖼️  QR Image saved to: ${qrPath}`);
          console.log(`🌐 Or view on your browser at: http://localhost:3000/whatsapp-qr.png`);
        }
      } catch (err) {}
      console.log('='.repeat(60) + '\n');
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`⚠️ Connection update: Closed (Code: ${statusCode}). Reconnecting: ${shouldReconnect}...`);
      if (shouldReconnect) {
        setTimeout(() => main(), 3000);
      } else {
        console.log('❌ Logged out. Re-run `pnpm qr --fresh` to generate a fresh QR.');
        process.exit(0);
      }
    } else if (connection === 'open') {
      console.log('\n🎉 SUCCESS! WhatsApp connected & session saved!');
      console.log('✅ You can now start the background bot: pnpm dev:bot\n');
      process.exit(0);
    }
  });
}

main().catch((err) => {
  console.error('Fatal WhatsApp Login Error:', err);
  process.exit(1);
});
