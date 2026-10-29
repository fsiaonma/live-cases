import { createInterface } from "node:readline/promises"; // 控制台一行一行读输入
import { stdin, stdout } from "node:process"; // 标准输入输出
import { loadConfig } from "../config.js"; // 读工作区根目录 .env

const transcript = []; // 本地留下的对话。模型看不到这份数组，下一轮要靠函数再提交。
const config = await loadConfig();
const rl = createInterface({ input: stdin, output: stdout });

// 问题：只提交当前这一句。
function submitCurrent(content) {
  return [{ role: "user", content }]; // 数组里就是这一句话
}

// 解决方案：带上历史记录。
function submitWithHistory() {
  return transcript.map((message) => ({ ...message })); // 本地留下的每一条，含刚刚这句
}

// 请求模型。参数 messages 就是这一次的全部上下文。
async function requestLLM(messages) {
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

console.log("输入一句话回车。直播时改下面那一行调用哪个函数。Ctrl+C 退出。");

while (true) {
  const content = (await rl.question("\n你：")).trim();
  transcript.push({ role: "user", content }); // 先留在本地
  // 直播时改这一行：submitWithHistory() 或 submitCurrent(content)
  // const messages = submitWithHistory();
  const messages = submitCurrent(content);
  console.log("请求上下文：");
  console.log(JSON.stringify(messages, null, 2)); // 这次真正交给模型的数组
  const reply = await requestLLM(messages);
  console.log(`\n模型：${reply}`);
  transcript.push({ role: "assistant", content: reply }); // 回复也留下，下一轮带历史时才会提交
}
