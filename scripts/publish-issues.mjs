import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const repo='PSCatLabs/printshop';
const issues=JSON.parse(await readFile('docs/issues.json','utf8'));
function body(issue){return `<!-- printshop:${issue.id} -->\n\n${issue.scope}\n\nLocal status: ${issue.status}\n\nDependencies: ${issue.dependsOn.length?issue.dependsOn.join(', '):'none'}.\n\nAcceptance criteria:\n\n${issue.acceptance.map(item=>'- [ ] '+item).join('\n')}\n\nImplementation/evidence: ${issue.evidence}\n\nSource definition: docs/issues.json (${issue.id}, roadmap phase ${issue.phase}).\n`;}
if(process.argv.includes('--dry-run')){
  console.log(issues.map(i=>`${i.id}: ${i.title}\n${body(i)}`).join('\n'));
}else{
  function gh(args){const result=spawnSync('gh',args,{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});if(result.error||result.status!==0)throw Error(result.error?.message||result.stderr||'gh failed');return result.stdout.trim();}
  gh(['repo','view',repo,'--json','name']);
  const existing=JSON.parse(gh(['issue','list','--repo',repo,'--state','all','--limit','1000','--json','number,body,url']));
  const scratch=await mkdtemp(path.join(os.tmpdir(),'printshop-issues-'));
  try{
    for(const issue of issues){
      const found=existing.find(item=>item.body?.includes(`<!-- printshop:${issue.id} -->`));
      if(found){issue.url=found.url;console.log(`${issue.id}: exists ${issue.url}`);}
      else{
        const file=path.join(scratch,issue.id+'.md');await writeFile(file,body(issue));
        issue.url=gh(['issue','create','--repo',repo,'--title',`${issue.id}: ${issue.title}`,'--body-file',file]);
        console.log(`${issue.id}: ${issue.url}`);
      }
      // Persist after every successful call; reruns still check remote markers.
      await writeFile('docs/issues.json',JSON.stringify(issues,null,2)+'\n');
    }
  }finally{await rm(scratch,{recursive:true,force:true});}
}
