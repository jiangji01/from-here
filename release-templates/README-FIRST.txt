FROM HERE ●  v1.1.0

从正在听的歌出发，决定想走多远。

第一次使用
──────────
1. 双击 Install.command
   官方 GitHub Release 已自带 From Here 运行时和网易云 ncm-cli。
   不需要 Homebrew、npm，也不会在安装时下载“当前歌曲读取组件”。
   当前歌曲直接通过 macOS 系统媒体接口读取。

   如果这台 Mac 还没授权网易云，安装器会先解释为什么需要 App ID / PrivateKey，
   并可直接打开网易云官方入驻指南和申请页；不会突然让你填写陌生字段。
2. Chrome 打开 chrome://extensions/
   开启「开发者模式」→「加载未打包的扩展程序」
   选择本目录里的「Chrome Extension」
3. 双击 Start.command
4. 打开网易云音乐 Mac 客户端，播放一首歌
5. 点击 Chrome 工具栏里的 From Here

之后使用
────────
通常只需要双击 Start.command。
Bridge 会在后台运行，不需要一直保留 Terminal 窗口。

AI
──
From Here 默认尝试跟随你本机已有的 Claude Code / AI 配置。
需要切换 Provider 或模型：Support/Configure AI.command
网易云授权未完成：Support/Connect NetEase.command

排查问题
────────
Support/Diagnose.command
日志保存在隐藏目录 .from-here/bridge/.data/bridge.log

当前版本支持 macOS + 网易云音乐桌面版 + Chrome/Chromium。
