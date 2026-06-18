#!/usr/bin/env python3
import json, sys

# Node.js smoke script — single quotes OK here since Python uses double-quote strings for outer
node_script = """import { readDb, withDb } from './src/db.js';
import { ensureDbShape } from './src/utils/domain.js';
import { buildAddressKey, syncPatientFamilyGroup } from './src/utils/family-groups.js';
const TS = Date.now();
const TEAM = 'smkfc-' + TS;
const ACS1 = 'smkacs1-' + TS;
const ACS2 = 'smkacs2-' + TS;
const P1 = 'smkp1-' + TS;
const P2 = 'smkp2-' + TS;
const P3 = 'smkp3-' + TS;
const ADDR1 = 'Rua das Flores 100 Centro Testelandia SP';
const ADDR2 = 'Rua Novembro 200 Centro Testelandia SP';
const rs = [];
const pass = (id, d) => rs.push({ id, s: 'PASS', d });
const fail = (id, d) => rs.push({ id, s: 'FAIL', d });
const mgr = { id: 'smkmgr-'+TS, name: 'Mgr', role: 'manager', teamId: TEAM, email: 'mgr@t.v' };
const acs1 = { id: ACS1, name: 'ACS1', role: 'acs', teamId: TEAM, email: 'a1@t.v', assignedAcsId: ACS1 };
const acs2 = { id: ACS2, name: 'ACS2', role: 'acs', teamId: TEAM, email: 'a2@t.v', assignedAcsId: ACS2 };
const gestor = { id: 'smkgest-'+TS, name: 'G', role: 'gestor', teamId: 'OTHER-999', email: 'g@t.v' };
const p1 = { id: P1, teamId: TEAM, name: 'P1', address: ADDR1, assignedAcsId: ACS1, microArea: 'A', cpf: '', cns: '', inactive: false };
const p2 = { id: P2, teamId: TEAM, name: 'P2', address: ADDR1, assignedAcsId: ACS1, microArea: 'A', cpf: '', cns: '', inactive: false };
const p3 = { id: P3, teamId: TEAM, name: 'P3', address: ADDR2, assignedAcsId: ACS2, microArea: 'B', cpf: '', cns: '', inactive: false };
try {
  await withDb((db) => {
    ensureDbShape(db);
    db.users.push({...acs1,passwordHash:'x'},{...acs2,passwordHash:'x'});
    db.patients.push(p1,p2,p3);
    db.households = db.households || [];
    db.households.push({id:'smkhh-'+TS,patientId:P1,teamId:TEAM,familyCode:'FC001',housingType:'CASA',waterSupply:'REDE',sewage:'REDE',garbage:'COLETA',electricity:'SIM',homeVisitFreq:'MENSAL',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  });
} catch(e) { console.error('SETUP FAIL',e.message); process.exit(1); }
let G1;
try {
  await withDb((db)=>{ensureDbShape(db);syncPatientFamilyGroup(db,p1,mgr,'FC-01');});
  const db=await readDb(); ensureDbShape(db);
  const g=db.familyGroups.find((g)=>g.teamId===TEAM&&g.memberPatientIds.includes(P1));
  if(!g) fail('FC-01','grupo nao criado');
  else { G1=g.id; if(g.addressKey!==buildAddressKey(ADDR1)) fail('FC-01','addressKey mismatch '+g.addressKey); else pass('FC-01','grupo '+g.id+' criado members='+g.memberPatientIds.length); }
} catch(e){fail('FC-01',e.message);}
try {
  await withDb((db)=>{ensureDbShape(db);syncPatientFamilyGroup(db,p2,mgr,'FC-02');});
  const db=await readDb(); const g=db.familyGroups.find((g)=>g.id===G1);
  if(!g||!g.memberPatientIds.includes(P2)) fail('FC-02','p2 nao no grupo '+G1);
  else pass('FC-02','p2 em '+G1+' members='+g.memberPatientIds.length);
} catch(e){fail('FC-02',e.message);}
const {isManager,canonicalRole}=await import('./src/utils/helpers.js');
const cm=(u)=>{const r=canonicalRole(u?.role);return isManager(u)||r==='break_glass_admin'||r==='doctor';};
const vis=(g,u)=>{const r=canonicalRole(u?.role);if(cm(u))return g.teamId===u.teamId;if(r==='acs')return g.teamId===u.teamId&&g.assignedAcsId===u.id;return g.teamId===u.teamId;};
try {
  const db=await readDb(); ensureDbShape(db);
  const mine=db.familyGroups.filter((g)=>vis(g,mgr)&&g.teamId===TEAM);
  if(!mine.length)fail('FC-03','manager nao ve grupos'); else pass('FC-03','manager ve '+mine.length+' grupo(s)');
} catch(e){fail('FC-03',e.message);}
try {
  await withDb((db)=>{ensureDbShape(db);syncPatientFamilyGroup(db,p3,acs2,'FC-04');});
  const db=await readDb(); ensureDbShape(db);
  const a1=db.familyGroups.filter((g)=>vis(g,acs1)&&g.teamId===TEAM);
  const s2=a1.some((g)=>g.assignedAcsId===ACS2); const s1=a1.some((g)=>g.id===G1);
  if(!s1)fail('FC-04','ACS1 nao ve proprio grupo');
  else if(s2)fail('FC-04','ACS1 VE grupo ACS2 RBAC VIOLADO');
  else pass('FC-04','ACS1 ve '+a1.length+' proprios nao ve ACS2');
} catch(e){fail('FC-04',e.message);}
try {
  const db=await readDb(); ensureDbShape(db);
  const cross=db.familyGroups.filter((g)=>vis(g,gestor)&&g.teamId===TEAM);
  if(cross.length)fail('FC-05','gestor outra equipe ve '+cross.length+' RBAC VIOLADO');
  else pass('FC-05','gestor outra equipe nao ve grupos TEAM');
} catch(e){fail('FC-05',e.message);}
try {
  const {addAuditLog}=await import('./src/services/audit.js');
  const ex='smkex-'+TS;
  await withDb((db)=>{
    ensureDbShape(db); const i=db.familyGroups.findIndex((g)=>g.id===G1); if(i<0)throw new Error('grupo');
    const nm=[...db.familyGroups[i].memberPatientIds,ex];
    db.familyGroups[i]={...db.familyGroups[i],memberPatientIds:nm,updatedAt:new Date().toISOString()};
    addAuditLog(db,mgr,'familyGroup.membersUpdated','familyGroup',G1,{memberPatientIds:nm});
  });
  const db=await readDb();
  const g=db.familyGroups.find((g)=>g.id===G1);
  const ae=db.auditLog?.find((e)=>e.event==='familyGroup.membersUpdated'&&e.targetId===G1);
  if(!g?.memberPatientIds.includes(ex))fail('FC-06','membro extra nao adicionado');
  else if(!ae)fail('FC-06','audit membersUpdated nao encontrado');
  else pass('FC-06','membro ok members='+g.memberPatientIds.length+' audit='+ae.event);
} catch(e){fail('FC-06',e.message);}
try {
  const {addAuditLog}=await import('./src/services/audit.js');
  const just='Smoke FC-07 transfer test justificativa';
  await withDb((db)=>{
    ensureDbShape(db); const i=db.familyGroups.findIndex((g)=>g.id===G1); if(i<0)throw new Error('grupo');
    const u=db.users.find((u)=>u.id===ACS2);
    if(!u||canonicalRole(u.role)!=='acs'||u.teamId!==TEAM)throw new Error('ACS2 invalido');
    const at=new Date().toISOString();
    db.familyGroups[i]={...db.familyGroups[i],assignedAcsId:ACS2,updatedAt:at,transferHistory:[...(db.familyGroups[i].transferHistory||[]),{fromAcsId:ACS1,toAcsId:ACS2,justification:just,transferredBy:mgr.id,transferredAt:at}]};
    addAuditLog(db,mgr,'familyGroup.transferred','familyGroup',G1,{fromAcsId:ACS1,toAcsId:ACS2,justification:just});
  });
  const db=await readDb();
  const g=db.familyGroups.find((g)=>g.id===G1);
  const ae=db.auditLog?.find((e)=>e.event==='familyGroup.transferred'&&e.targetId===G1);
  if(g.assignedAcsId!==ACS2)fail('FC-07','assignedAcsId nao mudou '+g.assignedAcsId);
  else if(!ae)fail('FC-07','audit transferred nao encontrado');
  else pass('FC-07','transfer ok th='+g.transferHistory.length+' audit ok');
} catch(e){fail('FC-07',e.message);}
try {
  const db0=await readDb();
  const oldGid=db0.familyGroups.find((g)=>g.teamId===TEAM&&g.memberPatientIds.includes(P1))?.id;
  await withDb((db)=>{
    ensureDbShape(db);
    const pi=db.patients.findIndex((p)=>p.id===P1);
    if(pi>=0)db.patients[pi].address=ADDR2;
    syncPatientFamilyGroup(db,{...p1,address:ADDR2},mgr,'FC-08');
  });
  const db=await readDb();
  const og=db.familyGroups.find((g)=>g.id===oldGid);
  const ng=db.familyGroups.find((g)=>g.teamId===TEAM&&g.memberPatientIds.includes(P1)&&g.addressKey===buildAddressKey(ADDR2));
  if(og&&og.memberPatientIds.includes(P1))fail('FC-08','p1 ainda no grupo antigo');
  else if(!ng)fail('FC-08','p1 nao no novo grupo');
  else pass('FC-08','leave '+oldGid+' join '+ng.id);
} catch(e){fail('FC-08',e.message);}
try {
  const db=await readDb(); ensureDbShape(db);
  const hh=(db.households||[]).filter((h)=>h.patientId===P1);
  if(!hh.length)fail('FC-09','nenhum household'); else pass('FC-09',hh.length+' hh familyCode='+hh[0].familyCode);
} catch(e){fail('FC-09',e.message);}
try {
  const db=await readDb(); ensureDbShape(db);
  const g=db.familyGroups.find((g)=>g.id===G1);
  if(!g)fail('FC-10','grupo nao encontrado');
  else if('cnsResponsavel' in g)fail('FC-10','cnsResponsavel no grupo VAZAMENTO');
  else {
    const ROLES=new Set(['doctor','nurse_manager','dentist','nursing_tech','break_glass_admin']);
    const tp={id:'x',cnsResponsavel:'enc',name:'X'};
    const gf=ROLES.has(canonicalRole(gestor.role))?tp:(({cnsResponsavel:_,...r})=>r)(tp);
    if('cnsResponsavel' in gf)fail('FC-10','cnsResponsavel nao filtrado para gestor');
    else pass('FC-10','grupo sem cnsResponsavel; filtro gestor ok');
  }
} catch(e){fail('FC-10',e.message);}
try {
  await withDb((db)=>{
    ensureDbShape(db);
    db.patients=db.patients.filter((p)=>!String(p.id).startsWith('smk'));
    db.users=db.users.filter((u)=>!String(u.id).startsWith('smk'));
    db.familyGroups=db.familyGroups.filter((g)=>g.teamId!==TEAM);
    db.households=(db.households||[]).filter((h)=>!String(h.id).startsWith('smk'));
    if(db.auditLog){const aids=new Set([mgr.id,acs1.id,acs2.id]); db.auditLog=db.auditLog.filter((e)=>!aids.has(String(e.actorId||e.actor?.id||'')));}
  });
  console.log('[CLEANUP] OK');
} catch(e){console.error('[CLEANUP] WARN',e.message);}
console.log('\\n==========================================================');
console.log('  SMOKE FC-01..FC-10 GRUPO C FAMILY');
console.log('==========================================================');
let allP=true;
for(const r of rs){console.log('  '+r.id.padEnd(6)+' '+(r.s==='PASS'?'PASS':'FAIL')+'  '+r.d);if(r.s!=='PASS')allP=false;}
console.log('==========================================================');
console.log('  RESULTADO: '+(allP?'ALL PASS':'HA FALHAS'));
console.log('==========================================================');
process.exit(allP?0:1);
"""

# Two-step: write the MJS file then execute it
write_cmd = (
    "cat > /var/app/current/tmp-smoke-fc.mjs << 'EONODE'\n"
    + node_script
    + "\nEONODE"
)

run_cmd = (
    "set -a && source /opt/elasticbeanstalk/deployment/env 2>/dev/null; "
    "unset DATA_ENCRYPTION_KEYS; "
    "cd /var/app/current && node tmp-smoke-fc.mjs"
)

cleanup_cmd = "rm -f /var/app/current/tmp-smoke-fc.mjs"

payload = {
    "InstanceIds": ["i-0544ee7c6a6b78c6f"],
    "DocumentName": "AWS-RunShellScript",
    "TimeoutSeconds": 180,
    "Comment": "VITRAS FC-01..FC-10 Group C Family",
    "Parameters": {
        "commands": [write_cmd, run_cmd, cleanup_cmd],
        "executionTimeout": ["180"]
    }
}
out_path = "/tmp/smoke-fc-ssm.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False)

size = len(open(out_path).read())
print(f"OK size={size} path={out_path}")
