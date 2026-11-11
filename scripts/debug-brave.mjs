// Development-only, interactive CDP client. Never packaged with YouTools.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
const [port, path] = (await readFile(join(process.env.LOCALAPPDATA, 'BraveSoftware/Brave-Browser/User Data/DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/);
const socket = new WebSocket(`ws://127.0.0.1:${port}${path}`);
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
    message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
  }
});
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, sessionId }));
});
console.log('Connected to Brave.');
const { targetInfos } = await send('Target.getTargets');
const candidates = targetInfos.filter(t => t.type === 'page' && /^https:\/\/www\.youtube\.com\/watch/.test(t.url));
console.log(JSON.stringify(candidates.map(t => ({ targetId: t.targetId, url: t.url }))));
let sessionId;
if (candidates.length === 1) ({ sessionId } = await send('Target.attachToTarget', { targetId: candidates[0].targetId, flatten: true }));
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  if (!line.trim()) continue;
  try {
    const command = JSON.parse(line);
    if (command.exit) { socket.close(); input.close(); break; }
    if (command.targetId) ({ sessionId } = await send('Target.attachToTarget', { targetId: command.targetId, flatten: true }));
    if (command.method) {
      const result = await send(command.method, command.params || {}, command.browser ? undefined : sessionId);
      if (command.saveScreenshot) { await writeFile(command.saveScreenshot, Buffer.from(result.data, 'base64')); console.log('Screenshot saved.'); }
      else console.log(JSON.stringify(result));
    } else if (command.expression) {
      const result = await send('Runtime.evaluate', { expression: command.expression, returnByValue: true, awaitPromise: true, userGesture: !!command.userGesture }, sessionId);
      console.log(JSON.stringify(result));
    } else console.log('Target attached.');
  } catch (error) { console.log(JSON.stringify({ error: error.message })); }
}
