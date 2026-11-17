#!/usr/bin/env python3
"""Opt-in real-provider acceptance. Creates only owned test sessions and a new SQLite DB.
Uses the official App Server directly; inference requests use the caller's existing Codex sign-in.
Never point this harness at product data. No credentials are copied or recorded.
"""
import argparse,datetime,hashlib,json,os,pathlib,queue,socket,subprocess,threading,time,urllib.request,urllib.error,uuid
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--beeteam',required=True,type=pathlib.Path,help='Candidate Bee Team executable')
parser.add_argument('--codex',required=True,type=pathlib.Path,help='Official native Codex executable (not a shell wrapper)')
parser.add_argument('--output',required=True,type=pathlib.Path,help='Parent directory for a NEW isolated run')
args=parser.parse_args()
binary=args.beeteam.resolve(strict=True);codex=args.codex.resolve(strict=True)
root=args.output.resolve()/('managed-proof-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:8])
root.mkdir(parents=True);cwd=root/'workspace';cwd.mkdir()
hidden=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
cli_version=subprocess.check_output([str(codex),'--version'],text=True,creationflags=hidden).strip().split()[-1]
with socket.socket() as selected:
 selected.bind(('127.0.0.1',0));port=selected.getsockname()[1]

from qa_codex_app_server import AppServer
class Server(AppServer):
 def __init__(self):super().__init__(codex,cwd,root)

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
 try:return json.load(urllib.request.urlopen(req,timeout=30))
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
def deliveries(tid):return get('/api/v2/tasks/'+tid+'/session-deliveries?limit=100')['items']
def complete_count(tid,count):
 rows=deliveries(tid)
 bad=[r for r in rows if r['state']in ['failed','uncertain','superseded']]
 if bad:raise RuntimeError('delivery failed '+json.dumps(bad))
 return rows if len(rows)>=count and all(r['state']=='completed' for r in rows)else None

def message(tid,recipient,text,actor):
 t=get('/api/v2/tasks/'+tid)
 return post('/api/v2/tasks/'+tid+'/comments',{'body':text,'mentionedAgentIds':[recipient]},t['version'],actor)

def metrics(tid,agent):
 paths=list((codex_home/'sessions').rglob('*'+tid+'*.jsonl'))
 assert len(paths)==1,paths
 models=set();latest=None
 for line in paths[0].open(encoding='utf8'):
  try:o=json.loads(line)
  except:continue
  if o.get('type')=='turn_context' and o.get('payload',{}).get('model'):models.add(o['payload']['model'])
  if o.get('type')=='event_msg' and o.get('payload',{}).get('type')=='token_count' and o['payload'].get('info'):latest=o
 assert models=={'gpt-6.1-sol'} and latest
 u=latest['payload']['info']['total_token_usage'];assert u['total_tokens']==u['input_tokens']+u['output_tokens']
 return {'entries':[dict(source='codex-owned-integration-rollout',harness='Codex App Server',surface='local-stdio-integration-proof',harnessVersion=cli_version,sessionId=tid,epoch='gpt-6.1-sol-owned-cli-'+cli_version,evidenceId='counter-'+latest['timestamp'],previousEvidenceId=None,actor={'kind':'agent','id':agent},actorRole='worker',provider='openai',modelId='gpt-6.1-sol',scope='session',reportKind='cumulative_snapshot',quality='measured',attribution='unallocated',observedAt=latest['timestamp'],periodStart=None,periodEnd=None,inputTokens=str(u['input_tokens']),outputTokens=str(u['output_tokens']),cachedInputTokens=str(u['cached_input_tokens']),reasoningOutputTokens=str(u['reasoning_output_tokens']),totalTokens=str(u['total_tokens']),discovery=None)]}

def rpc(name,args):
 req=urllib.request.Request(base+'/mcp',data=json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':name,'arguments':args}}).encode(),headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream'})
 text=urllib.request.urlopen(req,timeout=30).read().decode()
 if text.startswith('event:'):text=text.split('data: ',1)[1].split('\n')[0]
 r=json.loads(text)['result'];assert not r.get('isError'),r
 return r['structuredContent']['data']

def summary(tid,agent,thread,role='worker',completed=False):
 t=get('/api/v2/tasks/'+tid);status=t['statusId']
 if completed:status=get('/api/v2/boards/'+t['boardId']+'/statuses?isDone=true')['items'][0]['id']
 usage=metrics(thread,agent);usage['entries'][0]['actorRole']=role
 body={'currentSummary':'Isolated real-provider acceptance checkpoint.','summary':'Own test thread completed the recorded marker; measured session counters are unallocated and not exact task usage.','outcome':'completed' if completed else 'progress','statusId':status,'deliverables':[],'pending':[],'commitReport':{'hasCommits':False,'commits':[]},'usageReport':usage,'executionContext':{'rootTaskId':tid,'originBoardId':t['boardId']}}
 args={'params':{'taskId':tid},'actor':{'kind':'agent','id':agent},'expectedVersion':t['version'],'idempotencyKey':str(uuid.uuid4()),'body':body}
 first=rpc('createExecutionSummary',args);assert rpc('createExecutionSummary',args)==first
 return first['executionSummary']['id']

try:
 s=Server()
 try:
  initialized=s.init();codex_home=pathlib.Path(initialized['codexHome'])
  def owned_thread(marker):
   tid=s.request('thread/start',{'cwd':str(cwd),'approvalPolicy':'never','sandbox':'read-only','model':'gpt-6.1-sol','baseInstructions':'Owned isolated protocol acceptance. Never use tools. Reply briefly only to the test prompt.','developerInstructions':'Never read files or use tools.'})['thread']['id']
   turn=s.request('turn/start',{'threadId':tid,'input':[{'type':'text','text':'Reply only '+marker+'. Do not use tools.'}]})['turn']['id']
   end=time.monotonic()+90
   while time.monotonic()<end:
    event=s.q.get(timeout=max(.01,end-time.monotonic()))
    if event.get('method')=='turn/completed' and event.get('params',{}).get('turn',{}).get('id')==turn:
     assert event['params']['turn']['status']=='completed';return tid
   raise TimeoutError('owned thread initialization')
  leader_thread=owned_thread('READY_LEADER');worker_threads=[owned_thread('READY_WORKER_ONE'),owned_thread('READY_WORKER_TWO')]
 finally:s.close()
 report.update(leaderThreadId=leader_thread,workerThreadIds=worker_threads,cliVersion=cli_version,apiUrl=base)
 start();print('BACKEND_STARTED',proc.pid,flush=True)
 def agent(name,thread):return post('/api/v2/agents/with-session',{'agent':{'name':name},'session':{'harness':'codex','installationId':'isolated-owned-proof','externalId':thread,'projectRoot':str(cwd)}})['agent']
 leader=agent('Owned proof leader',leader_thread);workers=[agent('Owned proof worker '+str(i+1),thread)for i,thread in enumerate(worker_threads)]
 team=post('/api/v2/teams',{'name':'Owned acceptance team','leaderId':leader['id'],'workerIds':[w['id']for w in workers],'coordinationContext':{'mode':'manual','conversationRef':'isolated-owned-proof','approvalRef':'isolated-owned-proof'}})
 board=post('/api/v2/boards',{'name':'Owned acceptance board','teamId':team['id']})
 def task(title):return post('/api/v2/boards/'+board['id']+'/tasks',{'title':title,'authorAgentId':leader['id'],'executorAgentId':workers[0]['id'],'workScope':{'projects':[{'key':'owned-proof','name':'Owned acceptance workspace','rootPath':str(cwd)}]},'coordinationContext':{'mode':'manual','conversationRef':'isolated-owned-proof','approvalRef':'isolated-owned-proof'}})
 t=task('Own real-provider delivery acceptance');tid=t['id'];report['taskId']=tid;report['profiles']={'leader':leader['id'],'workers':[w['id']for w in workers]};save()
 originals=[]
 for i,w in enumerate(workers):originals.append(message(tid,w['id'],'Reply only BEE_FLOW_WORKER_'+str(i+1)+'. Do not use tools.',leader['id']))
 rows=wait_for(lambda:complete_count(tid,4),'two recipients and origin responses')
 comments=get('/api/v2/tasks/'+tid+'/comments?limit=100')['items']
 for i,original in enumerate(originals):
  replies=[c for c in comments if c.get('inReplyToCommentId')==original['id']];assert len(replies)==1 and replies[0]['body'].strip()=='BEE_FLOW_WORKER_'+str(i+1)
 assert len([r for r in rows if r['kind']=='response' and r['targetAgentId']==leader['id']])==2
 report['checks']['twoRecipientsAndOriginResponses']=True;save();print('TWO_RECIPIENTS_AND_ORIGIN_RESPONSES_PASSED',flush=True)
 sid=summary(tid,workers[0]['id'],worker_threads[0]);rows=wait_for(lambda:complete_count(tid,5),'worker notice')
 assert len([r for r in rows if r['kind']=='worker_summary' and r['sourceId']==sid])==1
 report['checks']['workerIntermediateNoticeAndReplay']=True
 summary(tid,leader['id'],leader_thread,'leader');assert len(deliveries(tid))==5
 report['checks']['leaderSummaryNoNotice']=True;save();print('WORKER_NOTICE_AND_LEADER_SUPPRESSION_PASSED',flush=True)
 stop();start();message(tid,workers[0]['id'],'Reply only BEE_RESTART_ONE. Do not use tools.',leader['id'])
 rows=wait_for(lambda:complete_count(tid,7),'normal restart resume')
 assert any(c['body'].strip()=='BEE_RESTART_ONE' for c in get('/api/v2/tasks/'+tid+'/comments?limit=100')['items'])
 report['checks']['restartPreservesBindingAndResume']=True
 sid=summary(tid,workers[0]['id'],worker_threads[0],completed=True);rows=wait_for(lambda:complete_count(tid,8),'final worker notice')
 assert len([r for r in rows if r['kind']=='worker_summary'])==2
 report['checks']['finalWorkerNoticeAndReplay']=True;save();print('RESTART_AND_FINAL_WORKER_NOTICE_PASSED',flush=True)
 fault=task('Own interrupted-delivery acceptance');fid=fault['id'];comment=message(fid,workers[0]['id'],'Interruption test: output numbers 1 through 1000, one per line. Do not use tools.',leader['id'])
 def acknowledged():
  rows=deliveries(fid)
  return next((r for r in rows if r['commentId']==comment['id'] and r['state']=='acknowledged'),None)
 ack=wait_for(acknowledged,'acknowledgement before crash',60);report['interruptedDeliveryId']=ack['id'];report['interruptedTurnId']=ack['turnId'];save()
 # Only children of this owned test process are selected, never other Codex sessions.
 if os.name=='nt':
  output=subprocess.check_output(['powershell.exe','-NoProfile','-Command','Get-CimInstance Win32_Process -Filter "ParentProcessId = '+str(proc.pid)+'" | ForEach-Object { $_.ProcessId }'],creationflags=hidden,text=True)
  owned=[int(x) for x in output.split() if x.isdigit()]
 else:
  output=subprocess.check_output(['ps','-axo','pid=,ppid='],text=True)
  owned=[int(row.split()[0])for row in output.splitlines()if len(row.split())==2 and row.split()[1]==str(proc.pid)]
 stop()
 for child in owned:
  try:os.kill(child,15)
  except OSError:pass
 start();rows=wait_for(lambda:[r for r in deliveries(fid)if r['id']==ack['id'] and r['state']=='uncertain'],'cold recovery',30)
 time.sleep(1.5);rows=deliveries(fid);assert len(rows)==1 and rows[0]['state']=='uncertain' and rows[0]['turnId']==ack['turnId']
 report['checks']['crashAfterAcknowledgementNoResend']=True
 message(fid,workers[1]['id'],'Reply only BEE_OTHER_CONTINUES. Do not use tools.',leader['id'])
 def other_done():return [r for r in deliveries(fid)if r['kind']=='mention' and r['targetAgentId']==workers[1]['id'] and r['state']=='completed']
 wait_for(other_done,'other worker continues');report['checks']['uncertainWorkerDoesNotBlockOtherWorker']=True;save();print('CRASH_RECOVERY_AND_ISOLATION_PASSED',flush=True)
 print('REAL_E2E_PASSED',str(folder/'report.json'),flush=True)
finally:
 stop();save()
