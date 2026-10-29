import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 3790;
const DELAY_MS = 100;
const root = dirname(fileURLToPath(import.meta.url));
const ANSWER =
  "检索先找相关片段，再放进提示词，模型只根据这些片段回答。这样能标出来源，也不会把整库塞进上下文。";

const logs = [];

function pushLog(line) {
  logs.push(line);
  console.log(line);
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

function streamChat(res, { stopOnClose }) {
  logs.length = 0;
  pushLog(
    stopOnClose
      ? "会停止的实现：连接已打开，开始逐字推送"
      : "错误实现：连接已打开，断开后也不会停",
  );
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  const tokens = [...ANSWER];
  let index = 0;
  let clientGone = false;

  res.on("close", () => {
    if (!res.writableEnded) clientGone = true;
  });

  const timer = setInterval(() => {
    if (clientGone && stopOnClose) {
      clearInterval(timer);
      pushLog("客户端已断开，停止生成");
      return;
    }
    if (index >= tokens.length) {
      clearInterval(timer);
      if (!clientGone) {
        writeSse(res, { done: true });
        res.end();
        pushLog("流式返回：全部推送完成");
      } else {
        pushLog("客户端早已断开，错误实现仍把剩余内容生成完了");
      }
      return;
    }
    const token = tokens[index++];
    if (clientGone) {
      pushLog(`客户端已断开，仍在生成：${token}`);
      return;
    }
    try {
      writeSse(res, { token });
    } catch {
      clientGone = true;
    }
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

  if (req.method === "POST" && url.pathname === "/api/chat/stream") {
    streamChat(res, { stopOnClose: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/chat/stream-leak") {
    streamChat(res, { stopOnClose: false });
    return;
  }

  sendJson(res, 404, { error: "没有这个接口" });
});

server.listen(PORT, () => {
  console.log(`打开 http://localhost:${PORT}`);
});
