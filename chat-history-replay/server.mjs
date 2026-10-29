import { createServer } from "node:http"; // Node 自带 HTTP，不引框架
import { readFile } from "node:fs/promises"; // 读 index.html
import { join } from "node:path"; // 拼本目录下的文件路径
import { loadConfig } from "../config.js"; // 读工作区根目录 .env

const PORT = 3792; // 浏览器打开 http://localhost:3792
const root = import.meta.dirname; // 本案例目录

// 请求模型。参数 messages 就是这一次的全部上下文。
async function requestLLM(messages, config) {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    // 没有会话。这次收到什么 messages，模型就只看见这些。
    body: JSON.stringify({ model: config.model, messages }),
  });
  const data = await response.json();
  return data.choices[0].message.content.trim();
}

createServer(async (req, res) => {
  if (req.method === "GET") { // 打开首页
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(await readFile(join(root, "index.html")));
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk); // 收齐 POST 正文
  const messages = JSON.parse(Buffer.concat(chunks).toString()).messages; // 原样取出，不改写、不补历史
  const config = await loadConfig(); // 现读根目录 .env
  const reply = await requestLLM(messages, config); // 回复只来自这次的 messages
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ reply }));
}).listen(PORT, () => {
  console.log(`打开 http://localhost:${PORT}`);
});
