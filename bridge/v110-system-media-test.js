const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const jxa=read('bridge/now-playing-jxa.js');
const server=read('bridge/server.js');
const core=read('scripts/install-core.sh');
const builder=read('scripts/build-release.sh');
const runtimeEnv=read('scripts/runtime-env.sh');
const testRelease=read('scripts/test-release.sh');
const workflow=read('.github/workflows/release.yml');
const readme=read('README.md');
const notices=read('THIRD_PARTY_NOTICES.md');

assert(jxa.includes("MediaRemote.framework"),'JXA must load system MediaRemote');
assert(jxa.includes("MRNowPlayingRequest"),'JXA must use system MRNowPlayingRequest');
for(const key of ['Title','Artist','Album','Duration','ElapsedTime','PlaybackRate','UniqueIdentifier']){
  assert(jxa.includes(`kMRMediaRemoteNowPlayingInfo${key}`),`missing JXA field ${key}`);
}
assert(server.includes("'/usr/bin/osascript'"),'Bridge must prefer built-in osascript');
assert(server.includes("'nowplaying-cli-fallback'"),'Bridge must retain optional legacy fallback');
assert(!server.includes("vendor', 'nowplaying-cli'"),'Bridge must not depend on a downloaded private nowplaying binary');
assert(server.includes("process.env.FROM_HERE_NCM_BIN||'ncm-cli'"),'Bridge must support bundled ncm-cli');

for(const forbidden of ['install-nowplaying-local.sh','formulae.brew.sh','ghcr.io','Homebrew Bottle']){
  assert(!core.includes(forbidden),`installer still contains obsolete media dependency: ${forbidden}`);
}
assert(core.includes('/usr/bin/osascript'),'installer must verify built-in system media API');
assert(core.includes('不需要 Homebrew，不下载额外媒体组件'),'installer copy must explain no media download');

assert(runtimeEnv.includes('runtime/node/$FH_ARCH') && runtimeEnv.includes('runtime/ncm/$FH_ARCH'),'runtime env must select bundled Node + ncm by architecture');
assert(runtimeEnv.includes('runtime/ncm'),'runtime env must expose bundled ncm-cli');
assert(builder.includes('FROM_HERE_BUNDLED_NODE_ARM64_DIR'),'release builder must support bundled arm64 Node');
assert(builder.includes('FROM_HERE_BUNDLED_NCM_ARM64_DIR') && builder.includes('FROM_HERE_BUNDLED_NCM_X64_DIR'),'release builder must support architecture-specific ncm-cli payloads');
assert(builder.includes('FROM_HERE_BUNDLED_NODE_X64_DIR'),'release builder must support bundled Intel Node');
assert(builder.includes('FROM_HERE_REQUIRE_BUNDLED_RUNTIME'),'official release must be able to require full runtime');
assert(testRelease.includes('obsolete media-download path'),'release test must reject old media downloader');

assert(workflow.includes('NODE_VERSION=22.22.0') && workflow.includes('node_arch: arm64') && workflow.includes('5ed4db0fcf1eaf84d91ad12462631d73bf4576c1377e192d222e48026a902640'),'release CI must pin official arm64 Node runtime + checksum');
assert(workflow.includes('NODE_VERSION=22.22.0') && workflow.includes('node_arch: x64') && workflow.includes('5ea50c9d6dea3dfa3abb66b2656f7a4e1c8cef23432b558d45fb538c7b5dedce'),'release CI must pin official Intel Node runtime + checksum');
assert(workflow.includes('@music163/ncm-cli@${NCM_VERSION}'),'release CI must pin ncm-cli');
assert(workflow.includes('runtime-arm64') && workflow.includes('runtime-x64'),'release CI must build ncm-cli on both target macOS architectures');
assert(workflow.includes('macos-15') && workflow.includes('macos-15-intel'),'release CI must smoke-test both Mac architectures');
assert(workflow.includes('FROM_HERE_REQUIRE_BUNDLED_RUNTIME=1'),'official workflow must refuse partial runtime');
assert(/build-universal:[\s\S]*?runs-on: macos-15/.test(workflow),'universal macOS package must be assembled on macOS');
assert(workflow.includes('Hosted CI has no music app playing'),'CI must not require an actively playing track');
assert(testRelease.includes('OWNED_SCAN_PATHS'),'release scans must separate From Here-owned code from bundled third-party runtime');
assert(testRelease.includes('exact ZIP users will download'),'release test must validate the archived artifact, not only staging files');
assert(builder.includes('ditto -c -k'),'macOS release builder should preserve platform archive semantics');

assert(/1\.1\.0/.test(readme),'README must describe v1.1.0');
assert(!/brew install nowplaying-cli|downloads the official `nowplaying-cli`|Homebrew Bottle into From Here/i.test(readme),'README must not tell end users to assemble media dependencies');
assert(notices.includes('@music163/ncm-cli') && notices.includes('Node.js'),'bundled runtime notices missing');
assert(!notices.includes('Install.command downloads'),'notices still describe runtime downloads');
console.log('✓ v1.1.0 system-media + self-contained release architecture');
