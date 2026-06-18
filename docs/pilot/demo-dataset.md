# Demo Municipal Dataset — VITRAS APS

**Versão:** 1.0  
**Data:** 2026-06-18  
**Município fictício:** Santa Esperança / SP  
**Propósito:** demonstrações comerciais, treinamentos, homologação PEC  
**CRÍTICO:** Todos os dados são 100% sintéticos. Nunca usar em produção real.

---

## 1. Município e UBS

| Campo | Valor |
|-------|-------|
| Município | Santa Esperança |
| UF | SP |
| Código IBGE | 9999999 (sintético) |
| UBS | UBS Vila Nova Esperança |
| CNES | 9999001 (sintético — usar CNES real na homologação) |
| Endereço UBS | Rua das Palmeiras, 100 — Centro — CEP 00000-000 |

---

## 2. Equipe de Saúde (ESF)

| Campo | Valor |
|-------|-------|
| Nome da equipe | ESF Rosa dos Ventos |
| INE | 0000099999 (sintético) |
| Modalidade | ESF |
| Área de cobertura | Microáreas 001 a 005 |

---

## 3. Profissionais (Usuários de Demo)

| Nome | Perfil (role) | Especialidade | CNS sintético | Login demo |
|------|---------------|---------------|---------------|-----------|
| Dra. Ana Beatriz Lima | doctor | Medicina de Família | 898 0000 0000 0001 | ana.lima@demo |
| Enf. Carlos Eduardo Souza | nurse_manager | Enfermagem | 898 0000 0000 0002 | carlos.souza@demo |
| Téc. Fernanda Rocha | nursing_tech | Técnica de Enfermagem | 898 0000 0000 0003 | fernanda.rocha@demo |
| ACS Josefina Almeida | acs | Agente Comunitário | 898 0000 0000 0004 | josefina.almeida@demo |
| ACS Marcos Vinícius | acs | Agente Comunitário | 898 0000 0000 0005 | marcos.vinicius@demo |
| Recep. Paula Cristina | receptionist | Recepção | — | paula.cristina@demo |
| Gestor Roberto Mendes | gestor | Gestão | — | roberto.mendes@demo |

---

## 4. Pacientes Sintéticos

### 4.1 Família Oliveira (Microárea 001 — ACS Josefina)

**Domicílio:**  
Rua das Flores, 42 — Bairro Centro — CEP 00001-000  
Tipo: Domicílio · Posse: Próprio · 4 moradores

| Nome | Parentesco | Nasc. | Sexo | CNS sintético | Condições |
|------|-----------|-------|------|---------------|-----------|
| Maria da Conceição Oliveira | Responsável | 1968-03-15 | F | 898 0000 0001 0001 | HAS, DM2 |
| João Carlos Oliveira | Cônjuge | 1965-07-22 | M | 898 0000 0001 0002 | Tabagismo |
| Ana Paula Oliveira | Filha | 1995-11-08 | F | 898 0000 0001 0003 | Gestante |
| Pedro Henrique Oliveira | Filho | 2010-05-20 | M | 898 0000 0001 0004 | — |

### 4.2 Família Santos (Microárea 001 — ACS Josefina)

**Domicílio:**  
Avenida Principal, 200 — Bairro Alto — CEP 00001-100  
Tipo: Domicílio · Posse: Alugado · 2 moradores

| Nome | Parentesco | Nasc. | Sexo | CNS sintético | Condições |
|------|-----------|-------|------|---------------|-----------|
| Carla Regina Santos | Responsável | 1980-09-12 | F | 898 0000 0002 0001 | — |
| Lucas Santos | Filho | 2015-02-28 | M | 898 0000 0002 0002 | Asma |

### 4.3 Paciente com Nome Social (Microárea 002 — ACS Marcos)

| Campo | Valor |
|-------|-------|
| Nome completo | Roberto Alves Ferreira |
| Nome social | **Roberta Ferreira** |
| Data nascimento | 1990-06-14 |
| Sexo | Masculino |
| Identidade de gênero | Mulher transexual |
| CNS sintético | 898 0000 0003 0001 |
| Domicílio | Rua do Sol, 15 — Bairro Jardim — CEP 00002-000 |

### 4.4 Paciente Idoso com Múltiplas Condições (Microárea 003)

| Campo | Valor |
|-------|-------|
| Nome | Antônio José Vieira |
| Data nascimento | 1942-01-05 |
| Sexo | Masculino |
| CNS sintético | 898 0000 0004 0001 |
| Condições | HAS, DM2, Cardiopatia |
| Domicílio | Estrada da Roça, S/N — Sítio — CEP 00003-000 |

### 4.5 Paciente Recém-nascido

| Campo | Valor |
|-------|-------|
| Nome | Sofia Gonçalves Pereira |
| Data nascimento | 2026-05-10 |
| Sexo | Feminino |
| CNS sintético | 898 0000 0005 0001 |
| Mãe | Luciana Gonçalves Pereira (CNS: 898 0000 0005 0002) |

---

## 5. Atendimentos de Demo

| # | Paciente | Data | Profissional | Tipo | CID-10 | CIAP-2 |
|---|---------|------|-------------|------|--------|--------|
| AT-01 | Maria da Conceição | 2026-06-01 | Dra. Ana Beatriz | Consulta agendada | I10 | K86 |
| AT-02 | Maria da Conceição | 2026-06-10 | Enf. Carlos Eduardo | Cuidado continuado | E11 | T90 |
| AT-03 | Ana Paula Oliveira | 2026-06-05 | Dra. Ana Beatriz | Pré-natal | Z34 | W78 |
| AT-04 | Lucas Santos | 2026-06-08 | Enf. Carlos Eduardo | Consulta agendada | J45 | R96 |
| AT-05 | Roberta Ferreira | 2026-06-12 | Dra. Ana Beatriz | Escuta inicial | Z71 | A97 |
| AT-06 | Antônio José Vieira | 2026-06-03 | Dra. Ana Beatriz | Cuidado continuado | I50, I10 | K77 |

---

## 6. Fluxos de Demo por Perfil

### Médico (Dra. Ana Beatriz)
1. Login → Dashboard com alertas de pacientes críticos
2. Selecionar Maria da Conceição → ver prontuário
3. Criar atendimento com CID I10 / CIAP K86
4. Ver histórico de atendimentos
5. Gerar CDS Export

### Enfermeiro (Carlos Eduardo)
1. Login → Triagem de pacientes na fila
2. Protocolo de HAS para Maria da Conceição
3. Agendamento de retorno

### ACS (Josefina)
1. Login → Lista de tarefas ACS
2. Visita domiciliar — família Oliveira
3. Atualizar cadastro domiciliar
4. Registrar condição de saúde

### Recepção (Paula Cristina)
1. Login → ReceptionistApp (tela própria)
2. Fila de espera do dia
3. Confirmar chegada de paciente
4. Registrar agendamento

### Gestor (Roberto Mendes)
1. Login → Tab Gestor automática
2. Dashboard de métricas
3. Demanda mensal por categoria
4. Não visualiza dados clínicos (F7-03)

---

## 7. Cenários de Demo por Objetivo

| Objetivo | Paciente | Fluxo |
|----------|---------|-------|
| Demonstrar nome social | Roberta Ferreira | FCI → visualização → exportação |
| Demonstrar HAS/DM | Maria da Conceição | Atendimento + protocolo |
| Demonstrar pré-natal | Ana Paula Oliveira | AT-03 |
| Demonstrar família completa | Família Oliveira | FCD multi-membro |
| Demonstrar segurança | Qualquer | Gestor tenta ver clínico → negado |
| Demonstrar CDS Export | Todos | Exportar + importar PEC |

---

*VITRAS APS — docs/pilot/demo-dataset.md*
