import { useState, useEffect, useMemo, useRef } from "react";
import { matchesPatientSearch, gestationalAgeInfo } from "../../utils/clinical";
import { maskCpf } from "../../utils/formatting";
import Avatar from "./Avatar";
import Button from "./Button";
import Input from "./Input";

const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

function GlobalSearch({ patients, templates, onNavigate }) {
  const [open, setOpen]   = useState(false);
  const [q, setQ]         = useState("");
  const ref               = useRef(null);
  const inputRef          = useRef(null);

  useEffect(()=>{
    function handler(e) {
      if((e.ctrlKey||e.metaKey)&&e.key==="k"){ e.preventDefault(); setOpen(v=>!v); }
      if(e.key==="Escape") setOpen(false);
    }
    document.addEventListener("keydown",handler);
    return ()=>document.removeEventListener("keydown",handler);
  },[]);

  useEffect(()=>{ if(open&&inputRef.current) inputRef.current.focus(); },[open]);

  const results = useMemo(()=>{
    if(!q.trim()||q.length<2) return [];
    return patients.filter(p => matchesPatientSearch(p, q)).slice(0,8);
  },[q,patients]);

  function select(p) { onNavigate(p.id); setOpen(false); setQ(""); }

  return (
    <>
      <Button className="global-search__trigger" variant="ghost" onClick={()=>setOpen(true)}>
        <IconSearch/> Buscar paciente...
        <span className="global-search__kbd">Ctrl+K</span>
      </Button>
      {open&&(
        <div className="global-search__overlay" onClick={()=>setOpen(false)}>
          <div ref={ref} className="global-search__panel" onClick={e=>e.stopPropagation()}>
            <div className="global-search__input-row">
              <IconSearch/>
              <Input ref={inputRef} inputClassName="global-search__input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Nome, CPF, CNS ou telefone..." autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}/>
              <Button className="icon-btn" variant="ghost" size="sm" iconOnly onClick={()=>setOpen(false)}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </Button>
            </div>
            {q.length>=2&&!results.length&&(
              <p className="global-search__empty">Nenhum paciente encontrado.</p>
            )}
            {results.map(p=>{
              const g=gestationalAgeInfo(p);
              return(
                <Button key={p.id} className="global-search__result" variant="ghost" onClick={()=>select(p)}>
                  <Avatar name={p.name}/>
                  <div className="global-search__result-copy">
                    <div className="global-search__result-name">{p.name}</div>
                    <div className="global-search__result-meta">
                      {p.cpf&&<span>CPF {maskCpf(p.cpf)} · </span>}
                      <span>{templates.find(t=>t.category===p.careCategory)?.label||p.careCategory||"Geral"}</span>
                      {g&&String(p.careCategory||"").toLowerCase()==="pregnant"&&<span> · IG {g.weeks}s{g.days}d</span>}
                    </div>
                  </div>
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="global-search__result-chevron">
                    <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Button>
              );
            })}
            {!q&&(
              <p className="global-search__empty">Digite para buscar por nome, CPF, CNS ou telefone.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default GlobalSearch;
