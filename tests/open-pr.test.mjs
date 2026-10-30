import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,cp,rm} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const realGit=execFileSync('which',['git'],{encoding:'utf8'}).trim();
const root=path.resolve(import.meta.dirname,'..');

async function fixture(t,{exists=false,networkError=false}={}){
  const scratch=await mkdtemp(path.join(os.tmpdir(),'printshop-pr-test-'));
  t.after(()=>rm(scratch,{recursive:true,force:true}));
  const work=path.join(scratch,'work'),bare=path.join(scratch,'remote.git'),bin=path.join(scratch,'bin'),stateFile=path.join(scratch,'github.json');
  await mkdir(path.join(work,'scripts'),{recursive:true});await mkdir(path.join(work,'.github'));await mkdir(bin);
  await cp(path.join(root,'scripts/open-pr.sh'),path.join(work,'scripts/open-pr.sh'));
  await cp(path.join(root,'.github/pull-request-mvp.md'),path.join(work,'.github/pull-request-mvp.md'));
  await writeFile(path.join(work,'README.md'),'Initial Printshop app\n');
  await writeFile(path.join(work,'.gitignore'),'.local-git/\n');
  await writeFile(stateFile,JSON.stringify({exists,networkError,pr:'',calls:[]}));
  const env={...process.env,GIT_CONFIG_GLOBAL:os.devNull,GIT_CONFIG_NOSYSTEM:'1',
    PATH:bin+path.delimiter+process.env.PATH,PRINTSHOP_TEST_REMOTE:bare,
    PRINTSHOP_TEST_STATE:stateFile,PRINTSHOP_TEST_REAL_GIT:realGit};
  const git=(...args)=>execFileSync(realGit,['--git-dir='+path.join(work,'.local-git'),'--work-tree='+work,...args],{env,encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']}).trim();
  execFileSync(realGit,['init','--bare',bare],{env,timeout:10000,stdio:'pipe'});
  git('init','-b','feature/initial-vertical-slice');
  git('config','user.name','Printshop Test');git('config','user.email','test@example.invalid');
  git('add','.');git('commit','-m','Initial feature');
  const initial=git('rev-parse','HEAD');
  // Only network operations are redirected. Commits, merges and branch
  // comparisons use actual Git against an isolated local bare repository.
  await writeFile(path.join(bin,'git'),`#!${process.execPath}
import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2);
if(args.some(a=>['push','fetch','ls-remote'].includes(a)))for(let i=0;i<args.length;i++)if(args[i]==='origin')args[i]=process.env.PRINTSHOP_TEST_REMOTE;
const r=spawnSync(process.env.PRINTSHOP_TEST_REAL_GIT,args,{stdio:'inherit',timeout:15000});process.exit(r.status??1);
`,{mode:0o755});
  await writeFile(path.join(bin,'gh'),`#!${process.execPath}
import fs from 'node:fs';
const file=process.env.PRINTSHOP_TEST_STATE,s=JSON.parse(fs.readFileSync(file,'utf8')),a=process.argv.slice(2),cmd=a.slice(0,2).join(' ');
s.calls.push(cmd);let output='',error='',status=0;
switch(cmd){
case 'auth status':break;
case 'repo view':if(s.networkError){error='error connecting to api.github.com';status=1;}else if(!s.exists){error='HTTP 404: Not Found';status=1;}break;
case 'repo create':s.exists=true;break;
case 'repo edit':break;
case 'pr list':output=s.pr;break;
case 'pr create':s.pr='https://github.com/PSCatLabs/printshop/pull/1';s.body=fs.readFileSync(a[a.indexOf('--body-file')+1],'utf8');output=s.pr;break;
default:error='Unexpected gh command: '+a.join(' ');status=1;
}
fs.writeFileSync(file,JSON.stringify(s));if(output)console.log(output);if(error)console.error(error);process.exit(status);
`,{mode:0o755});
  await writeFile(path.join(bin,'npm'),`#!${process.execPath}
import fs from 'node:fs';const f=process.env.PRINTSHOP_TEST_STATE,s=JSON.parse(fs.readFileSync(f,'utf8'));s.calls.push('npm '+process.argv.slice(2).join(' '));fs.writeFileSync(f,JSON.stringify(s));
`,{mode:0o755});
  const run=()=>spawnSync('bash',[path.join(work,'scripts/open-pr.sh')],{cwd:scratch,env,encoding:'utf8',timeout:30000});
  const state=async()=>JSON.parse(await readFile(stateFile,'utf8'));
  const remote=(...args)=>execFileSync(realGit,['--git-dir='+bare,...args],{env,encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']}).trim();
  return {scratch,work,bare,env,git,run,state,remote,initial};
}

test('publishing creates a shared empty base without rewriting feature history; reruns reuse the PR',async t=>{
  const f=await fixture(t);let result=f.run();assert.equal(result.status,0,result.stderr);
  assert.match(f.remote('for-each-ref','--format=%(refname)'),/refs\/heads\/main/,result.stdout+'\n'+result.stderr);
  assert.equal(f.remote('ls-tree','-r','main'),'');
  const head=f.git('rev-parse','HEAD');
  assert.notEqual(head,f.initial);
  f.git('merge-base','--is-ancestor',f.initial,head);
  f.git('merge-base','--is-ancestor','main',head);
  assert.equal(f.remote('rev-parse','feature/initial-vertical-slice'),head);
  assert.ok(f.git('diff','--name-only','main...HEAD').includes('README.md'));
  assert.equal(f.git('status','--porcelain'),'');
  result=f.run();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/Updated existing PR:/);
  assert.equal(f.git('rev-parse','HEAD'),head);
  const state=await f.state();assert.equal(state.calls.filter(c=>c==='repo create').length,1);
  assert.equal(state.calls.filter(c=>c==='pr create').length,1);
  assert.match(state.body,/actual PSCat WebAssembly/);
  assert.ok(state.calls.indexOf('npm run build')<state.calls.indexOf('repo create'));
});

test('publishing against an existing shared main does not add a bootstrap or merge',async t=>{
  const f=await fixture(t,{exists:true});
  f.git('push',f.bare,'HEAD:refs/heads/main');
  await writeFile(path.join(f.work,'app.txt'),'New feature\n');f.git('add','app.txt');f.git('commit','-m','Add feature');
  const head=f.git('rev-parse','HEAD'),result=f.run();assert.equal(result.status,0,result.stderr);
  assert.equal(f.git('rev-parse','HEAD'),head);assert.equal(f.remote('rev-parse','main'),f.initial);
  assert.ok(!(await f.state()).calls.includes('repo create'));
});

test('dirty working trees stop before checks or GitHub mutations',async t=>{
  const f=await fixture(t);await writeFile(path.join(f.work,'README.md'),'Uncommitted\n');
  const result=f.run();assert.notEqual(result.status,0);assert.match(result.stderr,/Commit or stash/);
  assert.deepEqual((await f.state()).calls,[]);assert.equal(f.git('rev-parse','HEAD'),f.initial);
});

test('connectivity failures are not treated as a missing repository',async t=>{
  const f=await fixture(t,{networkError:true});const result=f.run();assert.notEqual(result.status,0);
  assert.match(result.stderr,/Cannot inspect the GitHub repository/);
  const state=await f.state();assert.ok(!state.calls.includes('repo create'));assert.ok(!state.calls.includes('pr create'));
  assert.equal(f.git('rev-parse','HEAD'),f.initial);
});

test('an unrelated remote base is left for explicit reconciliation',async t=>{
  const f=await fixture(t,{exists:true});
  const emptyTree=f.git('hash-object','-t','tree','--stdin');
  const unrelated=f.git('commit-tree',emptyTree,'-m','Unrelated remote initialization');
  f.git('push',f.bare,unrelated+':refs/heads/main');
  const result=f.run();assert.notEqual(result.status,0);assert.match(result.stderr,/remote base has unrelated history/);
  assert.equal(f.git('rev-parse','HEAD'),f.initial);assert.equal(f.remote('rev-parse','main'),unrelated);
  assert.ok(!(await f.state()).calls.includes('pr create'));
});

test('a different origin is not replaced or pushed to',async t=>{
  const f=await fixture(t,{exists:true});f.git('remote','add','origin','https://github.com/Other/project.git');
  const result=f.run();assert.notEqual(result.status,0);assert.match(result.stderr,/origin points somewhere else/);
  assert.equal(f.git('remote','get-url','origin'),'https://github.com/Other/project.git');
  assert.equal(f.git('rev-parse','HEAD'),f.initial);assert.ok(!(await f.state()).calls.includes('pr create'));
});
