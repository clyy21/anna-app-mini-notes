# 面试题目

## 测试目标

请实现一个 本地运行的最小 Anna 风格应用（Mini App）。

这个测试主要考察：

- 工程基础能力
- 阅读和理解平台文档的能力
- 前端 + 本地工具（tool）联动能力
- 代码结构与工程规范
- 独立完成最小产品闭环的能力

预计完成时间：约 2 小时

注意：

- 这不是生产环境接入任务。
- 不需要接入线上 Anna 平台、不需要发布、不需要真实账号或外部 API。
- 但必须使用 Anna 本地开发模型：anna-app dev 运行本地 harness，UI bundle 通过 AnnaAppRuntime.connect() 调用 host API。

## 开发文档

请先阅读 Anna 开发者文档和示例仓库：

开发文档：

Anna Developer Docs (https://staging.anna.partners/developers?utm_source=chatgpt.com)

示例仓库：

anna-executa-examples (https://github.com/whtcjdtc2007/anna-executa-examples)

可以理解这些概念：

- Anna App 是什么
- Executa Tool 是什么
- JSON-RPC over stdio 通信方式
- manifest 的作用
- Anna App 的整体架构思路

按照开发文档配置本地 anna-app harness

你不需要完整实现线上平台接入，只需要理解其设计模型。

## 任务描述

请实现一个：

Mini Notes App（最小笔记应用）

功能要求如下：

## 1. 创建笔记

用户可以输入一段简短文字并保存。

例如：

- 明天跟客户 follow up
- 修复登录 bug
- Workshop 内容想法

## 2. 查看笔记列表

页面中展示已经保存的笔记。

至少包含：

- 笔记内容
- 添加顺序

可选：

- 时间戳
- 删除按钮

## 3. 笔记总结（Summarize）

页面提供一个 Summarize 按钮。

点击后：

- 前端通过 Anna local harness 的 anna.tools.invoke 调用本地 Executa tool；不得绕过 Anna runtime 自建业务 API。
- tool 使用 JSON-RPC over stdio 通信
- tool 返回当前所有笔记的简短总结（规则驱动）

例如：

已有笔记：

- 修登录 bug
- 跟设计沟通需求
- 准备 workshop 提纲

返回：

当前共有 3 条待处理事项，主要集中在开发、协作和内容准备。

注意：

这里不要求接真实 LLM。

可以用简单规则生成 summary，例如：

- 按数量总结
- 拼接内容
- 简单关键词归类

都可以。

## 技术要求

## 前端

本地运行即可。

技术栈不限

至少支持：

- 输入 note
- 保存
- 展示 note list
- summarize 按钮
- summary 展示

## Tool / Backend

请实现一个本地 Executa 风格 tool。

要求：

- 本地可执行进程
- stdin / stdout 通信
- JSON-RPC 协议

至少实现：

describe

返回 tool 描述信息

invoke

处理 summarize 请求

## manifest

请包含一个最小的 manifest.json

不要求完全生产可用，但需要体现你对 Anna App 结构的理解。

## 不需要做的事情

请不要做：

- 云端部署
- Anna 平台真实账号接入
- 数据库存储
- 复杂 UI 美化

重点是：

实现一个最小可运行闭环。

## 最终交付物

请提交：

一个 GitHub 仓库链接

仓库中必须包含：

必须项

- 完整源码
- 前端 UI
- 本地 tool 实现
- manifest.json
- README.md

README 必须包含

- 如何安装依赖
- 如何手动测试 Executa JSON-RPC
- 解释 bundle / manifest / executas 的关系

## 验收标准

1. anna-app validate --strict 通过
2. anna-app dev 可以启动
4. 输入 note 后能保存并展示
5. 点击 Summarize 后，RPC log 中能看到 tools.invoke
6. Executa 的 describe / invoke 可用

## 时间要求

请控制在：

2 小时以内完成。

我们更关注：

- 思路是否清晰
- 工程是否规范
- 是否能快速理解系统设计
- 是否能独立完成最小闭环

而不是功能越多越好。