import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const nextDir = path.join(process.cwd(), '.next');

// 1. Clean .next/dev and .next/cache directories
console.log('Cleaning Next.js cache...');
try {
  const devDir = path.join(nextDir, 'dev');
  const cacheDir = path.join(nextDir, 'cache');
  
  if (fs.existsSync(devDir)) {
    fs.rmSync(devDir, { recursive: true, force: true });
    console.log('Removed .next/dev');
  }
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    console.log('Removed .next/cache');
  }
} catch (err) {
  console.warn('Warning: Could not clean cache directories:', err.message);
}

// 2. Terminate any process on port 3000
console.log('Checking for processes on port 3000...');
try {
  if (process.platform === 'win32') {
    // Windows command to find PID on port 3000
    const output = execSync('netstat -ano | findstr :3000', { encoding: 'utf8' });
    const lines = output.split('\n');
    const pids = new Set();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && !isNaN(Number(pid))) {
          pids.add(pid);
        }
      }
    }
    for (const pid of pids) {
      console.log(`Killing process with PID ${pid} on port 3000...`);
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
    }
  } else {
    // Unix command
    try {
      const pids = execSync('lsof -t -i:3000', { encoding: 'utf8' }).trim().split('\n');
      for (const pid of pids) {
        if (pid) {
          console.log(`Killing process with PID ${pid} on port 3000...`);
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        }
      }
    } catch {
      // lsof returns non-zero code if no process is found, which is fine
    }
  }
} catch (err) {
  // If netstat/lsof fails (e.g. no process on port 3000), it's fine
}

console.log('Predev setup completed successfully.');
