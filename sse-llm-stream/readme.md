## 如何运行

在本目录执行：

```bash
npm start
```

浏览器打开 http://localhost:3789

这个 demo 没有调用任何外部模型。回答是服务端写死的 48 个字，每个字间隔 100 毫秒吐出，用来演示响应是攒完再发，还是逐字推。

## 期望看到什么

1. 点「一次性返回」：大约 5 秒内回答区是空的。时间到了，48 个字一起出现，首字时间和整段时间几乎一样。日志是「现在才返回 JSON」。
2. 点「流式返回」：大约 0.1 秒出现第一个字，然后逐字增加，整段仍要大约 5 秒。首字时间远小于整段时间。日志先写「开始逐字推送」，结束时写「全部推送完成」。

## 分析

聊天页问了一句：为什么 RAG 要先检索再生成。点「一次性返回」，回答区会空着，直到整段 JSON 一起出现。点「流式返回」，第一个字马上出现，后面逐字接上。

结论：JSON 要等最后一个字生成完才有响应体；SSE 每生成一个字就写一帧，页面边收边画。整段要花的时间并没有变短。

一次性返回把字留在服务端，循环结束才发出 JSON。这段时间页面一个字都没有，首字时间几乎等于整段时间，大约 5 秒。

```js
// server.mjs
for (const token of [...ANSWER]) {
  await sleep(DELAY_MS);
  text += token;
}
if (res.destroyed || res.writableEnded) return;
pushLog(`一次性返回：生成完成，现在才返回 JSON，共 ${[...text].length} 个字`);
sendJson(res, 200, { text });
```

SSE 的响应头是 `text/event-stream`。每来一个字就写一帧，浏览器收到 `token` 就追加。首字大约 0.1 秒，整段仍要大约 5 秒。

```js
// server.mjs
function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}
```

```js
// index.html
if (data.token) {
  if (firstAt == null) firstAt = performance.now() - startedAt;
  answer.textContent += data.token;
}
```

容易讲错的是：流式让回答更快。两条路径都是每个字等 `DELAY_MS` 再取下一个，整段时间一样。SSE 分开的是首字时间和整段时间，不是把生成本身加快。
