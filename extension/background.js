chrome.runtime.onInstalled.addListener(async()=>{ try{await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});}catch(e){console.warn(e);} });
chrome.runtime.onStartup.addListener(async()=>{ try{await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});}catch(e){} });
