#!/usr/bin/env python3
"""Opt-in real MCP origin acceptance. Writes only newly created owned fixtures.
Creates a second isolated canary instance with the same IDs. Makes real inference requests.
Global Codex configuration and product databases are never edited.
"""
import argparse
import pathlib
from qa_codex_app_server import AppServer
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--beeteam',required=True,type=pathlib.Path)
parser.add_argument('--codex',required=True,type=pathlib.Path)
parser.add_argument('--shim',required=True,type=pathlib.Path,help='Compiled codex_mcp_canary example')
parser.add_argument('--output',required=True,type=pathlib.Path)
args=parser.parse_args()
import pathlib,sqlite3,json,urllib.request,urllib.error,subprocess,os,time,uuid,datetime,socket,hashlib
root=args.output.resolve()/('mcp-canary-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:8]);root.mkdir(parents=True);folder=root;cwd=folder/'workspace';cwd.mkdir()
binary=str(args.beeteam.resolve(strict=True));native=str(args.codex.resolve(strict=True));shim=str(args.shim.resolve(strict=True))
class Server(AppServer):
 def __init__(self):super().__init__(native,cwd,root)
def port():
 with socket.socket()as sock:sock.bind(('127.0.0.1',0));return sock.getsockname()[1]
current_port=port();wrong_port=port();base='http://127.0.0.1:'+str(current_port);wrong='http://127.0.0.1:'+str(wrong_port);procs=[];report={'origin':base,'canaryOrigin':wrong,'checks':{}}
def save():(folder/'report.json').write_text(json.dumps(report,indent=2))
def api(method,path,body=None,version=None):
 headers={'Content-Type':'application/json','X-Actor-Kind':'human','Idempotency-Key':str(uuid.uuid4())}
 if version is not None:headers['If-Match']='"'+str(version)+'"'
 req=urllib.request.Request(base+path,data=None if body is None else json.dumps(body).encode(),method=method,headers=headers)
 try:return json.load(urllib.request.urlopen(req,timeout=30))
 except urllib.error.HTTPError as e:raise RuntimeError(str(e.code)+' '+e.read().decode())
def get(path):return api('GET',path)
def post(path,body,version=None):return api('POST',path,body,version)
def start(db,port,managed):
 env=os.environ.copy();env.update(APP_HOST='127.0.0.1',APP_PORT=str(port),DATABASE_DRIVER='sqlite',DATABASE_URL='sqlite://'+str(db).replace('\\','/'),OTEL_ENABLED='false',MCP_ENABLED='true',MCP_PATH='/mcp',BEE_FRONTEND_MODE='disabled')
 for key in ['BEE_SESSION_INSTALLATION_ID','BEE_SESSION_STATE_DIR','BEE_CODEX_EXECUTABLE']:env.pop(key,None)
 if managed:env.update(BEE_SESSION_INSTALLATION_ID='owned-canary',BEE_SESSION_STATE_DIR=str(folder/'leases'),BEE_CODEX_EXECUTABLE=shim,BEE_PROOF_CODEX_NATIVE=native,BEE_PROOF_MCP_CANARY=wrong+'/mcp')
 log=open(folder/('managed.log'if managed else'canary.log'),'a');p=subprocess.Popen([binary],env=env,cwd=folder,stdout=log,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0);log.close();procs.append(p)
 end=time.monotonic()+30
 while time.monotonic()<end:
  if p.poll()is not None:raise RuntimeError('process failed')
  try:urllib.request.urlopen('http://127.0.0.1:'+str(port)+'/health',timeout=1);return
  except Exception:time.sleep(.1)
 raise TimeoutError('health')
def snapshot(path):
 c=sqlite3.connect('file:'+str(path)+'?mode=ro',uri=True);c.create_collation('beeteam_nocase',lambda a,b:(a.lower()>b.lower())-(a.lower()<b.lower()));tables=c.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%'").fetchall();r={}
 for(t,)in tables:r[t]=hashlib.sha256(repr(c.execute('select * from "'+t+'" order by rowid').fetchall()).encode()).hexdigest()
 c.close();return r
try:
 s=Server()
 try:
  s.init();thread=s.request('thread/start',{'cwd':str(cwd),'approvalPolicy':'never','sandbox':'read-only','model':'gpt-6.1-sol','baseInstructions':'Owned Bee Team MCP acceptance. Use only the current-instance Bee Team MCP server when explicitly requested. Never use filesystem,shell,network or harness-chat tools.','developerInstructions':'For READY prompts reply text only. For explicit routing tests use only current Bee Team getTask and createComment tools.'})['thread']['id']
  turn=s.request('turn/start',{'threadId':thread,'input':[{'type':'text','text':'Reply only READY_MCP. No tools.'}]})['turn']['id'];end=time.monotonic()+90
  while time.monotonic()<end:
   m=s.q.get(timeout=max(.01,end-time.monotonic()))
   if m.get('method')=='turn/completed'and m.get('params',{}).get('turn',{}).get('id')==turn:assert m['params']['turn']['status']=='completed';break
 finally:s.close()
 report['threadId']=thread;start(folder/'source.sql',current_port,True)
 lead=post('/api/v2/agents',{'name':'Owned canary leader'})
 worker=post('/api/v2/agents/with-session',{'agent':{'name':'Owned MCP worker'},'session':{'harness':'codex','installationId':'owned-canary','externalId':thread,'projectRoot':str(cwd)}})['agent']
 coordination={'mode':'manual','conversationRef':'owned-canary','approvalRef':'owned-canary'}
 team=post('/api/v2/teams',{'name':'Owned canary team','leaderId':lead['id'],'workerIds':[worker['id']],'coordinationContext':coordination});board=post('/api/v2/boards',{'name':'Owned canary board','teamId':team['id']})
 task=post('/api/v2/boards/'+board['id']+'/tasks',{'title':'Owned MCP route test','authorAgentId':lead['id'],'executorAgentId':worker['id'],'workScope':{'projects':[{'key':'owned-canary','name':'Owned canary workspace','rootPath':str(cwd)}]},'coordinationContext':coordination})
 source=sqlite3.connect(str(folder/'source.sql'));dest=sqlite3.connect(str(folder/'wrong.sql'));source.backup(dest);dest.close();source.close();start(folder/'wrong.sql',wrong_port,False);before=snapshot(folder/'wrong.sql')
 body='Explicit independent routing test. Use only the configured current-instance Bee Team MCP server. First call getTask for taskId '+task['id']+' to read its current version. Then call createComment for that task, actor {kind:agent,id:'+worker['id']+'}, expectedVersion from getTask, idempotencyKey '+str(uuid.uuid4())+', body {body:MCP_CURRENT_INSTANCE_CANARY_OK}. Do not mention anyone. Finally reply only MCP_DONE. No other tools and no other chats.'
 original=post('/api/v2/tasks/'+task['id']+'/comments',{'body':body,'mentionedAgentIds':[worker['id']]},task['version']);end=time.monotonic()+240
 while time.monotonic()<end:
  rows=get('/api/v2/tasks/'+task['id']+'/session-deliveries')['items']
  if rows and rows[0]['state']in ['failed','uncertain','superseded']:raise RuntimeError(json.dumps(rows))
  if rows and rows[0]['state']=='completed':break
  time.sleep(.2)
 else:raise TimeoutError('managed MCP response')
 comments=get('/api/v2/tasks/'+task['id']+'/comments?limit=100')['items'];matches=[c for c in comments if c['body'].strip()=='MCP_CURRENT_INSTANCE_CANARY_OK'];assert len(matches)==1 and matches[0]['actorId']==worker['id'],comments
 assert rows[0].get('backendOrigin')==base,rows
 assert snapshot(folder/'wrong.sql')==before
 report.update(taskId=task['id'],deliveryId=rows[0]['id'],turnId=rows[0]['turnId'],binarySha256=hashlib.sha256(pathlib.Path(binary).read_bytes()).hexdigest());report['checks'].update(modelReadAndWriteThroughCurrentMcp=True,wrongInstanceSameIdsUnchanged=True,verifiedBackendOrigin=True)
 # Fresh unmanaged resume must still use its ordinary global configuration/policies.
 s=Server()
 try:
  s.init();r=s.request('thread/resume',{'threadId':thread},timeout=45);assert r.get('approvalPolicy')=='never'
  policy=r.get('sandbox',{});assert policy.get('type')=='readOnly',policy
  statuses=s.request('mcpServerStatus/list',{'threadId':thread,'limit':100,'detail':'toolsAndAuthOnly'},timeout=45)['data']
  inherited=[x for x in statuses if x['name']=='beeteam'];assert inherited and all(x.get('runtimeStatus')!='disabled'for x in inherited)
  report['checks']['unmanagedResumePolicyAndMcpUnchanged']=True
 finally:s.close()
 save();print('MCP_CANARY_PASSED',str(folder/'report.json'),flush=True)
finally:
 for p in procs:
  if p.poll()is None:p.terminate();p.wait(timeout=10)
 save()
