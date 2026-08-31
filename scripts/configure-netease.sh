#!/bin/bash
set -u

ROOT="${FROM_HERE_ROOT:?FROM_HERE_ROOT missing}"
VERSION="1.1.0"
GUIDE_URL="https://developer.music.163.com/st/developer/document?docId=9504d35aa41a47c6ac9830b2dbf48f94"
APPLY_URL="https://developer.music.163.com/st/developer/apply/account?type=INDIVIDUAL"

say(){ printf '%s\n' "$1"; }
pause(){ printf '\n'; read -r -p "$1" _; }

ensure_ncm(){
  if command -v ncm-cli >/dev/null 2>&1; then return 0; fi
  say '○ From Here 需要网易云官方 ncm-cli 来搜索歌曲、获取推荐并维护播放队列。'
  if ! command -v npm >/dev/null 2>&1; then
    say '✗ 当前没有 npm，无法自动安装 ncm-cli。请先安装 Node.js 18+ 后重试。'
    return 1
  fi
  read -r -p '现在自动安装 ncm-cli？ [Y/n] ' ans
  case "$ans" in n|N|no|NO) return 1;; esac
  npm install -g @music163/ncm-cli || return 1
}

printf '\n网易云授权\n────────\n'
ensure_ncm || exit 1

if ncm-cli login --check >/dev/null 2>&1; then
  say '✓ 这台 Mac 已经授权 From Here 使用网易云。'
  ncm-cli config set player orpheus >/dev/null 2>&1 || true
  say '✓ 播放器模式：网易云 macOS 客户端'
  exit 0
fi

cat <<'TXT'
○ 这台 Mac 还没有完成 From Here 的网易云授权。

这和“网易云音乐客户端是否已经登录”是两回事：
网易云客户端负责播放；From Here 通过网易云官方 ncm-cli
进行搜索、推荐和队列控制，因此每台新 Mac 都需要单独授权一次。

网易云目前要求 ncm-cli 用户先完成开发者入驻，并取得：

  • App ID
  • PrivateKey

如果你已经在另一台电脑申请过，不需要重新申请；
可以在这台 Mac 继续使用你自己的同一组 App ID / PrivateKey。

它们由 ncm-cli 保存在这台 Mac 上。
From Here 不读取、不保存、也不会上传这两个凭证。
TXT

while true; do
  printf '\n你现在是哪种情况？\n'
  say '  1) 我已经有 App ID / PrivateKey'
  say '  2) 我还没有，带我去申请'
  say '  3) 稍后再配置'
  printf '\n'
  read -r -p '请选择 [1/2/3]: ' choice
  case "$choice" in
    1) break ;;
    2)
      printf '\n正在打开网易云官方页面…\n'
      open "$GUIDE_URL" >/dev/null 2>&1 || true
      sleep 0.5
      open "$APPLY_URL" >/dev/null 2>&1 || true
      cat <<'TXT'

请在浏览器里完成：

  1. 按网易云官方「入驻指南」完成个人开发者入驻
  2. 申请 API Key
  3. 准备好页面提供的 App ID 和 PrivateKey

完成后回到这个窗口。
TXT
      printf '\n'
      read -r -p '已经拿到 App ID / PrivateKey？按 Enter 继续；输入 q 稍后再说： ' ready
      case "$ready" in q|Q) say '○ 已跳过网易云授权。之后可运行 Support/Connect NetEase.command 继续。'; exit 2;; esac
      break
      ;;
    3)
      say '○ 已跳过网易云授权。'
      say '  之后运行 Support/Connect NetEase.command 即可继续，不需要重新安装其它组件。'
      exit 2
      ;;
    *) say '请输入 1、2 或 3。' ;;
  esac
done

cat <<'TXT'

接下来会进入网易云官方 ncm-cli 的配置界面。
你只需要输入刚才准备好的 App ID 和 PrivateKey。
这不是网易云账号密码，也不是 From Here 的账号。
TXT
printf '\n'
read -r -p '准备好了，按 Enter 开始配置…' _

if ! ncm-cli configure; then
  say '✗ 网易云 API 配置没有完成。'
  say '  你可以稍后重新运行 Support/Connect NetEase.command。'
  exit 1
fi

cat <<'TXT'

API 配置完成。
下一步是授权你的网易云账号。
这是“允许 ncm-cli 使用你的网易云账号”，不会改变网易云 Mac 客户端里的登录状态。
TXT
printf '\n'
read -r -p '按 Enter 开始网易云账号授权…' _

ncm-cli login || true

if ncm-cli login --check >/dev/null 2>&1; then
  ncm-cli config set player orpheus >/dev/null 2>&1 || true
  say '✓ 网易云授权完成'
  say '✓ 播放器模式：网易云 macOS 客户端'
  exit 0
fi

say '○ 暂时还没有检测到授权完成。'
say '  不影响其它组件安装；稍后可再次运行 Support/Connect NetEase.command。'
exit 2
