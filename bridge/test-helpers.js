const fs=require('fs');
const os=require('os');
const path=require('path');

function pickPort(offset=0){
  const explicit=Number(process.env.FROM_HERE_TEST_PORT_BASE||0);
  const base=explicit || (24000 + Math.floor(Math.random()*16000));
  return base + offset;
}
function isolatedBridge(extra={}, offset=0){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'from-here-test-'));
  const dataDir=path.join(root,'data');fs.mkdirSync(dataDir,{recursive:true});
  const configFile=path.join(root,'config.local.json');
  const port=pickPort(offset);
  const env={...process.env,
    PORT:String(port),
    FROM_HERE_DATA_DIR:dataDir,
    FROM_HERE_CONFIG_FILE:configFile,
    FROM_HERE_DISABLE_LOCAL_AI:'1',
    LL_AI_API_KEY:'', LLM_API_KEY:'', ANTHROPIC_AUTH_TOKEN:'', ANTHROPIC_API_KEY:'', OPENAI_API_KEY:'',
    LL_AI_BASE_URL:'', LLM_BASE_URL:'', ANTHROPIC_BASE_URL:'', OPENAI_BASE_URL:'',
    LL_AI_MODEL:'', LLM_MODEL:'', ANTHROPIC_MODEL:'', OPENAI_MODEL:'', CLAUDE_MODEL:'',
    ...extra
  };
  return {port,root,dataDir,configFile,env,cleanup(){try{fs.rmSync(root,{recursive:true,force:true})}catch{}}};
}
module.exports={pickPort,isolatedBridge};
