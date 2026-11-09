#!/usr/bin/env python3
"""Opt-in real-provider acceptance. Creates only owned test sessions and a new SQLite DB.
Uses the official App Server directly; inference requests use the caller's existing Codex sign-in.
Never point this harness at product data. No credentials are copied or recorded.
"""
import argparse,datetime,hashlib,json,os,pathlib,shutil,sqlite3,socket,subprocess,time,urllib.request,urllib.error,uuid
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--beeteam',required=True,type=pathlib.Path,help='Candidate Bee Team executable')
parser.add_argument('--codex',required=True,type=pathlib.Path,help='Official native Codex executable (not a shell wrapper)')
parser.add_argument('--output',required=True,type=pathlib.Path,help='Parent directory for a NEW isolated run')
args=parser.parse_args()
binary=args.beeteam.resolve(strict=True);codex=args.codex.resolve(strict=True)
root=args.output.resolve()/('chat-proof-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:8])
root.mkdir(parents=True);cwd=root/'workspace';cwd.mkdir()
shutil.copy2(binary,root/binary.name);binary=root/binary.name
hidden=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
cli_version=subprocess.check_output([str(codex),'--version'],text=True,creationflags=hidden).strip().split()[-1]
with socket.socket() as selected:
 selected.bind(('127.0.0.1',0));port=selected.getsockname()[1]


folder=root/('e2e-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'));folder.mkdir()
base='http://127.0.0.1:'+str(port)
exe=str(codex)
report={'binarySha256':hashlib.sha256(binary.read_bytes()).hexdigest(),'database':str(folder/'proof.sql'),'scope':'Owned isolated sessions and API fixtures only','checks':{}}
proc=None

def save(): (folder/'report.json').write_text(json.dumps(report,indent=2))
def request(method,path,body=None,version=None,actor=None,key=None):
 headers={'Content-Type':'application/json','X-Actor-Kind':'agent' if actor else 'human'}
 if actor:headers['X-Actor-Id']=actor
 if version is not None:headers['If-Match']='"'+str(version)+'"'
 if method in ('POST','PUT'):headers['Idempotency-Key']=key or str(uuid.uuid4())
 req=urllib.request.Request(base+path,data=None if body is None else json.dumps(body).encode(),method=method,headers=headers)
 try:return json.load(urllib.request.urlopen(req,timeout=120))
 except urllib.error.HTTPError as e:raise RuntimeError(str(e.code)+' '+e.read().decode())
def get(path):return request('GET',path)
def post(path,body,version=None,actor=None,key=None):return request('POST',path,body,version,actor,key)
def start():
 global proc
 env=os.environ.copy();env.update(APP_HOST='127.0.0.1',APP_PORT=str(port),DATABASE_DRIVER='sqlite',DATABASE_URL='sqlite://'+str(folder/'proof.sql').replace('\\','/'),OTEL_ENABLED='false',MCP_ENABLED='true',MCP_PATH='/mcp',BEE_FRONTEND_MODE='disabled',BEE_SESSION_INSTALLATION_ID='isolated-owned-proof',BEE_CODEX_EXECUTABLE=exe,BEE_SESSION_STATE_DIR=str(folder/'leases'))
 log=open(folder/'backend.log','a')
 proc=subprocess.Popen([str(binary)],cwd=folder,env=env,stdout=log,stderr=log,creationflags=hidden)
 log.close();end=time.monotonic()+30
 while time.monotonic()<end:
  if proc.poll() is not None:raise RuntimeError('backend exited: '+(folder/'backend.log').read_text()[-2000:])
  try:get('/health');return
  except Exception:time.sleep(.1)
 raise TimeoutError('health')
def stop():
 global proc
 if proc and proc.poll() is None:proc.terminate();proc.wait(timeout=10)
def wait_for(predicate,label,seconds=150):
 end=time.monotonic()+seconds
 while time.monotonic()<end:
  result=predicate()
  if result:return result
  time.sleep(.15)
 raise TimeoutError(label)
try:
 start()
 agent=post('/api/v2/agents',{'name':'Managed request isolated proof'})
 route='/api/v2/agents/'+agent['id']
 config={'provider':'codex','projectRoot':str(cwd),'toolProfile':{'webSearch':'disabled','networkAccess':False,'enabledMcpServers':[],'skillRoots':[]}}
 configured=request('PUT',route+'/execution-config',config,agent['version'])
 key=str(uuid.uuid4());body={'content':'Reply exactly BEE_MANAGED_ALPHA. Do not use tools or modify anything.'}
 first=post(route+'/requests',body,key=key)
 assert post(route+'/requests',body,key=key)==first
 def finish(r):
  def poll():
   snap=get('/api/v2/agent-requests/'+r['id'])
   if snap['request']['state'] in ['failed','uncertain']:raise RuntimeError(json.dumps(snap['request']))
   return snap if snap['request']['state']=='completed' else None
  return wait_for(poll,'managed completion',180)
 snapshot=finish(first)
 assert snapshot['messages']['items'][-1]['content'].strip()=='BEE_MANAGED_ALPHA',snapshot
 report['checks']['owned_send_and_replay']=True
 cursor=first['id']+':'+first['id']
 req=urllib.request.Request(base+'/api/v2/agent-requests/'+first['id']+'/events?after='+cursor,headers={'Accept':'text/event-stream'})
 with urllib.request.urlopen(req,timeout=20) as response:
  for line in response:
   if line.startswith(b'data:'):assert b'request.updated' in line;break
 report['checks']['sse_replay']=True
 stop();start()
 second=post(route+'/requests',{'content':'What marker did you reply with previously? Reply only that marker. Do not use tools.','conversationId':first['conversationId']})
 final=finish(second)
 assert final['messages']['items'][-1]['content'].strip()=='BEE_MANAGED_ALPHA',final
 report['checks']['restart_continue']=True
 report['checks']['no_provider_identifiers']=not any(x in json.dumps(final) for x in ['providerThread','providerTurn','externalId'])
 assert report['checks']['no_provider_identifiers']
 report['status']='passed';save();print(json.dumps({'status':'passed','report':str(folder/'report.json')}))
except Exception as error:
 report['status']='failed';report['error']=str(error);save();print(json.dumps({'status':'failed','report':str(folder/'report.json'),'error':str(error)}));raise
finally:stop()
