// Minimal Chrome DevTools-protocol client over --remote-debugging-pipe:
// no debugging port and no npm dependencies. Shared by browser-check.mjs and
// qr-check.mjs.
import {spawn} from 'node:child_process';

export const chrome=process.env.CHROME_BIN||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'chromium');
export const COMMAND_TIMEOUT=30000;

export class Browser {
  constructor(args){
    this.child=spawn(chrome,['--remote-debugging-pipe',...args],{stdio:['ignore','ignore','pipe','pipe','pipe']});
    this.stderr='';this.child.stderr.on('data',c=>this.stderr+=c);
    this.id=0;this.pending=new Map();this.listeners=new Set();let buffer=Buffer.alloc(0);
    this.child.stdio[4].on('data',chunk=>{
      buffer=Buffer.concat([buffer,chunk]);let end;
      while((end=buffer.indexOf(0))>=0){
        const message=JSON.parse(buffer.subarray(0,end).toString('utf8'));buffer=buffer.subarray(end+1);
        if(message.id&&this.pending.has(message.id)){const {resolve,reject}=this.pending.get(message.id);this.pending.delete(message.id);
          message.error?reject(Error(message.error.message)):resolve(message.result);}
        else for(const listener of this.listeners)listener(message);
      }
    });
    // A crashed or missing browser must fail the run, never leave it waiting.
    this.dead=null;
    const fail=error=>{this.dead??=error;for(const {reject} of this.pending.values())reject(this.dead);this.pending.clear();};
    this.exited=new Promise(resolve=>this.child.on('close',(code,signal)=>{fail(Error(`Chrome exited (code ${code}, signal ${signal||'none'})`));resolve();}));
    this.child.on('error',fail);
    this.child.stdio[3].on('error',fail);
  }
  send(method,params={},sessionId){
    if(this.dead)return Promise.reject(this.dead);
    const id=++this.id;const message={id,method,params};if(sessionId)message.sessionId=sessionId;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(Error(`${method} timed out after ${COMMAND_TIMEOUT} ms`));},COMMAND_TIMEOUT);
      const settle=fn=>value=>{clearTimeout(timer);fn(value);};
      this.pending.set(id,{resolve:settle(resolve),reject:settle(reject)});
      this.child.stdio[3].write(JSON.stringify(message)+'\0');
    });
  }
  close(){this.child.kill('SIGKILL');return this.exited;}
}

