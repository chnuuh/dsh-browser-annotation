import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

export function makeIndex({repo, commit, publishedAt, version, icon}) {
  if (!/^[\w-]+\/[\w.-]+$/.test(repo ?? '')) throw Error('repo must be OWNER/REPO');
  if (!/^[a-f0-9]{40}$/.test(commit ?? '') || /^0+$/.test(commit)) throw Error('commit must be the published 40-character Git commit SHA');
  const timestamp=Date.parse(publishedAt);
  if (!Number.isFinite(timestamp) || !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(publishedAt)) throw Error('published-at must be an ISO date with time zone');
  return {format:1,title:{zh:'浏览器标注插件',en:'Browser annotation plugin'},plugins:[{
    name:'dsh-browser-annotation',title:{zh:'浏览器标注',en:'Browser annotations'},
    description:{zh:'网页元素快速引用与批量标注，加入 DSH Desktop 聊天草稿。',en:'Quick and batch webpage annotations for DSH Desktop chat drafts.'},
    homepage:`https://github.com/${repo}`,repository:{url:`https://github.com/${repo}`},
    icon:`data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}`,
    versions:[{version,publishTimestamp:Math.floor(timestamp/1000),source:{type:'git',url:`https://github.com/${repo}`,commit}}]
  }]};
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args=process.argv.slice(2);const get=name=>args[args.indexOf(name)+1];
  for(const flag of ['--repo','--commit','--published-at'])if(!args.includes(flag))throw Error(`Required: ${flag}`);
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const {version}=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const index=makeIndex({repo:get('--repo'),commit:get('--commit'),publishedAt:get('--published-at'),version,icon:fs.readFileSync(path.join(root,'icon.svg'),'utf8')});
  const data=JSON.stringify(index,null,2)+'\n';
  if(args.includes('--output'))fs.writeFileSync(get('--output'),data);else process.stdout.write(data);
}
