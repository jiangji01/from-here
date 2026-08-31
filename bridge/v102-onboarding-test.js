const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const core=read('scripts/install-core.sh');
const netease=read('scripts/configure-netease.sh');
const panel=read('extension/sidepanel.js');
const server=read('bridge/server.js');
const first=read('release-templates/README-FIRST.txt');
function ok(x,msg){if(!x)throw new Error(msg)}
ok(!core.includes('现在运行 configure？'),'install-core must not drop users into raw configure prompt');
ok(netease.includes('我还没有，带我去申请'),'guided apply option missing');
ok(netease.includes('developer.music.163.com/st/developer/document'),'official onboarding guide missing');
ok(netease.includes('developer.music.163.com/st/developer/apply/account'),'official apply page missing');
ok(netease.includes('这和“网易云音乐客户端是否已经登录”是两回事'),'desktop login vs ncm auth explanation missing');
ok(netease.includes('Support/Connect NetEase.command'),'resume path missing');
ok(first.includes('Support/Connect NetEase.command'),'runtime README must show resume path');
ok(panel.includes("网易云 · 待授权"),'Side Panel must distinguish unauthorized state');
ok(server.includes('ncmAuthorized:!!login'),'health must expose NetEase authorization state');
console.log('✓ v1.0.2 NetEase onboarding: guided application + resumable authorization + clear UI state');
