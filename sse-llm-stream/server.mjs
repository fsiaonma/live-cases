import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 3789;
const DELAY_MS = 100;
const root = dirname(fileURLToPath(import.meta.url));
const ANSWER =
  "检索先找相关片段，再放进提示词，模型只根据这些片段回答。这样能标出来源，也不会把整库塞进上下文。";

const logs = [];

function pushLog(line) {
  logs.push(line);
  console.log(line);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendJson(res, status, body) {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(raw),
  });
  res.end(raw);
}

function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function bufferChat(res) {
  logs.length = 0;
  pushLog("一次性返回：开始生成，响应先不发出");
  let text = "";
  for (const token of [...ANSWER]) {
    await sleep(DELAY_MS);
    text += token;
  }
  if (res.destroyed || res.writableEnded) return;
  pushLog(`一次性返回：生成完成，现在才返回 JSON，共 ${[...text].length} 个字`);
  sendJson(res, 200, { text });
}

function streamChat(res) {
  logs.length = 0;
  pushLog("流式返回：连接已打开，开始逐字推送");
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  const tokens = [...ANSWER];
  let index = 0;
  const timer = setInterval(() => {
    if (res.destroyed || res.writableEnded) {
      clearInterval(timer);
      return;
    }
    if (index >= tokens.length) {
      clearInterval(timer);
      writeSse(res, { done: true });
      res.end();
      pushLog("流式返回：全部推送完成");
      return;
    }
    writeSse(res, { token: tokens[index++] });
  }, DELAY_MS);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/") {
    const html = await readFile(join(root, "index.html"));
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(html);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/logs") {
    sendJson(res, 200, { logs });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/chat/buffer") {
    await bufferChat(res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/chat/stream") {
    streamChat(res);
    return;
  }

  sendJson(res, 404, { error: "没有这个接口" });
});

server.listen(PORT, () => {
  console.log(`打开 http://localhost:${PORT}`);
});
