# Workflow obrigatório dos Agents VALENS

Para qualquer alteração no projeto:

1. Ler contexto da tarefa.
2. Identificar áreas afetadas.
3. Executar mentalmente os agents aplicáveis:
   - Design System Guardian
   - Business Rules Guardian
   - Architecture Guardian
   - UX Flow Guardian
   - QA Regression Guardian

4. Antes de alterar:
   - localizar arquivos relevantes;
   - entender padrão existente;
   - localizar regras de negócio;
   - localizar componentes DS;
   - localizar impactos.

5. Durante alteração:
   - respeitar DS;
   - respeitar negócio;
   - manter arquitetura limpa;
   - evitar duplicação;
   - evitar CSS improvisado;
   - evitar lógica no lugar errado.

6. Depois da alteração:
   - revisar arquivos alterados;
   - executar lint/build/testes quando possível;
   - gerar relatório final em pt-BR.

Nenhuma entrega deve ser considerada concluída sem relatório.
