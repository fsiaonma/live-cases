import { readFile } from "node:fs/promises"; // 读根目录 .env
import { join } from "node:path"; // 拼路径

const workspace = import.meta.dirname; // 本文件在工作区根目录

// 读工作区根目录 .env。各案例共用。改完保存即可，不用重启。
export async function loadConfig() {
  const text = await readFile(join(workspace, ".env"), "utf8").catch(() => ""); // 没有 .env 就当空白
  const env = {}; // 解析出来的 KEY=VALUE
  for (const line of text.split("\n")) { // 一行一条
    const trimmed = line.trim(); // 去掉首尾空白
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue; // 空行、注释、没有等号的跳过
    const eq = trimmed.indexOf("="); // 第一个等号才是分隔
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim(); // 左边是名字，右边是值
  }
  const base = (env.LLM_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/$/, ""); // 去掉末尾斜杠
  return {
    apiKey: env.LLM_API_KEY || "", // 没有 key 就不能请求模型
    model: env.LLM_MODEL || "qwen-plus", // 没写模型名就用 qwen-plus
    url: base.endsWith("/chat/completions") ? base : `${base}/chat/completions`, // 补上聊天路径
  };
}
