const puppeteer = require('puppeteer');
const { parse } = require('yaml');
const { readFileSync } = require('fs');
const { join } = require('path');
const os = require('os');

// TypeScript compiler will provide these in the compiled JS
declare const __dirname: string;

interface Config {
  addresses: {
    workAddress: string;
    homeAddress: string;
  }
}

export function is192Network(): boolean {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.')) {
        return true;
      }
    }
  }
  return false;
}

export async function getCommuteTime(): Promise<string> {
  const configPath = join(__dirname, 'config.yaml');
  const config = parse(readFileSync(configPath, 'utf8')) as Config;
  
  let { workAddress, homeAddress } = config.addresses;
  const url = is192Network() ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(homeAddress)}&destination=${encodeURIComponent(workAddress)}&travelmode=driving`:`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(workAddress)}&destination=${encodeURIComponent(homeAddress)}&travelmode=driving`;
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    const timeElement = await page.waitForSelector('xpath=//div[contains(text(), " min") and string-length() < 20]', { timeout: 15000 });
    const time = await timeElement?.evaluate((el: Element) => el.textContent) || 'Unable to fetch time';
    return time.trim();
  } finally {
    await browser.close();
  }
}
