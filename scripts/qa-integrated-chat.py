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
 if method=='POST':headers['Idempotency-Key']=key or str(uuid.uuid4())
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
 leader=post('/api/v2/agents',{'name':'Isolated integrated leader'})
 team=post('/api/v2/teams',{'name':'Isolated integrated team','leaderId':leader['id'],'coordinationContext':{'mode':'manual','conversationRef':'owned QA','approvalRef':'implementation testing'}})
 leader=get('/api/v2/agents/'+leader['id'])
 session_path='/api/v2/agents/'+leader['id']+'/integrated-session'
 key=str(uuid.uuid4());body={'projectRoot':str(cwd),'expectedBindingId':None}
 binding=post(session_path,body,leader['version'],key=key)
 assert post(session_path,body,leader['version'],key=key)==binding
 report['checks']['bootstrap_replay']=True
 runtime=get('/api/v2/agents/'+leader['id']+'/runtime')
 assert runtime['mode']=='integrated' and runtime['readiness']=='ready',runtime
 report['checks']['runtime']=runtime
 chat=post('/api/v2/leader-chats',{'teamId':team['id'],'leaderAgentId':leader['id'],'bindingId':binding['bindingId'],'title':'Owned integration proof'})
 path='/api/v2/leader-chats/'+chat['id']
 snapshot=get(path);cursor=snapshot['eventCursor']
 def send(text):
  response=post(path+'/messages',{'clientMessageId':str(uuid.uuid4()),'bindingId':binding['bindingId'],'content':text})
  turn_path=path+'/turns/'+response['turn']['id']
  def completed():
   turn=get(turn_path)
   if turn['status']in ['failed','uncertain']:raise RuntimeError(json.dumps(turn))
   return turn if turn['status']=='completed' else None
  return wait_for(completed,'turn completion',180)
 first=send('Reply exactly BEE_CHAT_ALPHA. Do not use tools, edit files, or run commands.')
 report['checks']['first_turn']=first
 snapshot=get(path);assert any(m['role']=='assistant' and 'BEE_CHAT_ALPHA' in m['content'] for m in snapshot['messages']),snapshot
 report['checks']['snapshot']=True
 (folder/'responses.json').write_text(json.dumps({'IntegratedSession':binding,'AgentRuntime':runtime,'LeaderChat':chat,'ChatSnapshot':snapshot},indent=2))
 req=urllib.request.Request(base+path+'/events?after='+cursor,headers={'Accept':'text/event-stream','Last-Event-ID':cursor})
 with urllib.request.urlopen(req,timeout=20) as response:
  frame=[]
  for line in response:
   frame.append(line.decode())
   if line.strip()==b'' and any(x.startswith('data:') for x in frame):break
  assert any(x.startswith('id:') for x in frame) and any('schemaVersion' in x for x in frame),frame
 report['checks']['sse_replay']=True
 stop();start()
 after=get(path);assert after['messages']==snapshot['messages']
 second=send('What exact marker did you reply with previously? Reply only that marker. Do not use tools.')
 final=get(path);assert final['messages'][-1]['role']=='assistant' and 'BEE_CHAT_ALPHA' in final['messages'][-1]['content'],final
 report['checks']['restart_resume']=True
 report['checks']['second_turn']=second
 third=send('Use the Bee Team MCP listTeams tool to read this isolated instance, then use web search to find the official OpenAI Codex documentation. Reply with the team name returned and the official URL found. Do not modify any resource, edit files, or run commands.')
 tools=get(path)['toolActivities'];names=[t['name'] for t in tools]
 assert 'mcpToolCall' in names and 'webSearch' in names,names
 report['checks']['mcp_and_web_execution']={'turn':third,'toolNames':names}
 final=get(path)
 (folder/'responses-final.json').write_text(json.dumps({'ChatSnapshot':final},indent=2))
 # Deliberate fault injection ONLY into this newly-created proof database:
 # emulate a completed provider turn whose final Bee Team receipt was lost.
 before_messages=[(m['id'],m['content']) for m in final['messages']]
 stop()
 with sqlite3.connect(folder/'proof.sql') as db:
  db.create_collation('beeteam_nocase',lambda a,b:(a.casefold()>b.casefold())-(a.casefold()<b.casefold()))
  row=db.execute('SELECT data FROM leader_chat_turns WHERE id=?',(third['id'],)).fetchone()
  data=json.loads(row[0]);data['status']='uncertain';data['failure']={'code':'proof_lost_receipt'}
  db.execute('UPDATE leader_chat_turns SET data=?,version=version+1 WHERE id=?',(json.dumps(data),third['id']))
  db.commit()
 start()
 pending=get(path+'/turns/'+third['id']);assert pending['status']=='uncertain',pending
 recovery_key=str(uuid.uuid4());recovery_path=path+'/turns/'+third['id']+'/reconcile'
 recovered=post(recovery_path,{},pending['version'],key=recovery_key)
 assert recovered['resolved'] and recovered['turn']['status']=='completed',recovered
 assert post(recovery_path,{},pending['version'],key=recovery_key)==recovered
 assert [(m['id'],m['content']) for m in get(path)['messages']]==before_messages
 report['checks']['reconciliation']={'faultInjection':'Only isolated proof DB changed to emulate a lost final receipt','resolved':True,'idempotentReplay':True,'noDuplicateMessages':True}
 (folder/'responses-recovery.json').write_text(json.dumps({'ReconcileResult':recovered},indent=2))
 report['status']='passed';save();print(json.dumps({'status':'passed','report':str(folder/'report.json')}))
except Exception as error:
 report['status']='failed';report['error']=str(error);save();print(json.dumps({'status':'failed','report':str(folder/'report.json'),'error':str(error)}));raise
finally:stop()
