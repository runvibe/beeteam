"""Create clearly labeled local preview data via HTTP; preserve existing edits on rerun."""
import json
import os
import uuid
from pathlib import Path
from urllib.request import Request, urlopen

BASE = f"http://127.0.0.1:{os.environ.get('APP_PORT', '59865')}"
STATE = Path(__file__).resolve().parent.parent / '.local' / 'bootstrap.json'
state = {'keys': {}, 'results': {}, 'requests': {}}

def save():
    STATE.parent.mkdir(exist_ok=True)
    temporary = STATE.with_suffix('.tmp')
    with temporary.open('w', encoding='utf-8') as handle:
        json.dump(state, handle, ensure_ascii=False, indent=2)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, STATE)

def call(method, path, body=None, version=None, key=None):
    headers = {'Content-Type': 'application/json', 'X-Actor-Kind': 'human'}
    if version is not None:
        headers['If-Match'] = f'"{version}"'
    if key:
        headers['Idempotency-Key'] = key
    data = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
    with urlopen(Request(BASE + path, data=data, headers=headers, method=method), timeout=30) as response:
        return json.load(response)

def once(label, method, path, body, version=None):
    if label in state['results']:
        return state['results'][label]
    pending = state.setdefault('requests', {}).get(label)
    if pending is None:
        key = state['keys'].setdefault(label, str(uuid.uuid4()))
        pending = {'method': method, 'path': path, 'body': body, 'version': version, 'key': key}
        state['requests'][label] = pending
        save()
    # A retry keeps the original intent, body and If-Match, even after UI changes.
    result = call(pending['method'], pending['path'], pending['body'], pending['version'], pending['key'] if pending['method'] == 'POST' else None)
    state['results'][label] = result
    save()
    return result

def main():
    global state
    state = json.loads(STATE.read_text(encoding='utf-8')) if STATE.exists() else {'keys': {}, 'results': {}, 'requests': {}}
    context = {'mode': 'manual', 'conversationRef': 'local-integration-preview', 'approvalRef': 'user-authorized-local-integration'}
    leader = once('leader', 'POST', '/api/v1/agents', {'name': 'Líder local', 'roleDescription': 'Fixture de integração local, sem execução automática.'})
    worker = once('worker', 'POST', '/api/v1/agents', {'name': 'Colaborador local', 'roleDescription': 'Fixture para validar edição e relações na interface.'})
    team = once('team', 'POST', '/api/v1/teams', {'name': 'Equipe de integração local', 'purpose': 'Dados reais de preview para verificar transporte e persistência.', 'leaderId': leader['id'], 'collaboratorIds': [worker['id']], 'coordinationContext': context})
    board = once('board', 'POST', '/api/v1/boards', {'name': 'Bee Team local', 'description': 'Quadro de validação local da interface/API.', 'teamId': team['id']})
    task = once('task', 'POST', f"/api/v1/boards/{board['id']}/tasks", {'title': 'Validar integração real', 'description': 'Fixture identificada de preview local.', 'specification': '# Entrega\n\nConectar a interface à API local.\n\n## Aceite\n- [ ] Edições persistem após recarregar.\n- [ ] Relações e links por slug funcionam.\n', 'authorAgentId': leader['id'], 'executorAgentId': worker['id'], 'coordinationContext': context})
    task_path = f"/api/v1/tasks/{task['id']}"
    current = call('GET', task_path)
    child = once('child', 'POST', f"/api/v1/boards/{board['id']}/tasks", {'title': 'Conferir persistência pelo frontend', 'parentId': task['id'], 'specification': '## Verificação\nEditar pela UI e recarregar a mesma URL.\n', 'authorAgentId': leader['id'], 'executorAgentId': worker['id'], 'coordinationContext': context}, current['version'])
    current = call('GET', task_path)
    plan = once('plan', 'POST', task_path + '/plans', {'title': 'Plano da integração local', 'content': '# Plano\n1. Ler dados reais.\n2. Editar e recarregar.\n3. Conferir slug e relações.\n'}, current['version'])
    current = call('GET', task_path)
    once('plan-revision', 'POST', task_path + f"/plans/{plan['planId']}/revisions", {'baseRevision': 1, 'content': '# Plano revisado\n1. Ler dados reais.\n2. Editar e recarregar.\n3. Conferir slug, relações e histórico.\n', 'changeSummary': 'Incluída validação de histórico no preview.'}, current['version'])
    current = call('GET', task_path)
    once('comment', 'POST', task_path + '/comments', {'body': 'Dados criados pela API para validação local autorizada. Não representam trabalho operacional de produto.'}, current['version'])
    current = call('GET', task_path)
    current = call('GET', task_path)
    once('execution', 'POST', task_path + '/execution-summaries', {'summary': 'Bootstrap local criou perfis, time, quadro, task, filho, plano/revisão e comentário por HTTP.', 'currentSummary': 'Ambiente e dados locais preparados. Integração da interface em validação. Próximo passo: conferir edições persistentes na UI.', 'outcome': 'progress', 'statusId': current['statusId'], 'deliverables': [], 'pending': ['Validar operações na interface real e recarregar.'], 'executionContext': {'rootTaskId': task['id'], 'originBoardId': board['id']}}, current['version'])
    state['complete'] = True
    save()
    print(json.dumps({'baseUrl': BASE, 'leaderId': leader['id'], 'workerId': worker['id'], 'teamId': team['id'], 'teamSlug': team['slug'], 'boardId': board['id'], 'taskId': task['id'], 'taskSlug': task['slug'], 'childId': child['id'], 'childSlug': child['slug']}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
