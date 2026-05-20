$ErrorActionPreference = "Stop"

$outPath = "backend/data/db.json"
$now = Get-Date

function Iso([datetime]$d) { $d.ToUniversalTime().ToString("o") }
function AddD([datetime]$b, [int]$days) { $b.AddDays($days) }
function Pick([object[]]$arr) { $arr[(Get-Random -Minimum 0 -Maximum $arr.Count)] }
function Phone() { return ("({0}) 9{1:0000}-{2:0000}" -f (Get-Random -Minimum 11 -Maximum 100), (Get-Random -Minimum 0 -Maximum 10000), (Get-Random -Minimum 0 -Maximum 10000)) }
function Cpf() { return ("{0:000}.{1:000}.{2:000}-{3:00}" -f (Get-Random -Minimum 0 -Maximum 1000), (Get-Random -Minimum 0 -Maximum 1000), (Get-Random -Minimum 0 -Maximum 1000), (Get-Random -Minimum 0 -Maximum 100)) }
function Cns() { return ("{0:000} {1:0000} {2:0000} {3:0000}" -f (Get-Random -Minimum 100 -Maximum 1000), (Get-Random -Minimum 0 -Maximum 10000), (Get-Random -Minimum 0 -Maximum 10000), (Get-Random -Minimum 0 -Maximum 10000)) }

$teams = @(
  [ordered]@{ id = "team-rosa"; name = "Equipe Rosa"; managerUserId = "u-ana"; createdAt = (Iso $now) },
  [ordered]@{ id = "team-azul"; name = "Equipe Azul"; managerUserId = "u-nurse-azul"; createdAt = (Iso $now) },
  [ordered]@{ id = "team-cinza"; name = "Equipe Cinza"; managerUserId = "u-nurse-cinza"; createdAt = (Iso $now) },
  [ordered]@{ id = "team-marrom"; name = "Equipe Marrom"; managerUserId = "u-nurse-marrom"; createdAt = (Iso $now) },
  [ordered]@{ id = "team-amarela"; name = "Equipe Amarela"; managerUserId = "u-nurse-amarela"; createdAt = (Iso $now) }
)

$users = @(
  [ordered]@{ id = "u-ana"; name = "Enfermeira Ana"; role = "nurse_manager"; email = "ana@clinica.local"; password = "123456"; teamId = "team-rosa"; councilType = "COREN"; councilNumber = "123456"; councilUf = "SP" },
  [ordered]@{ id = "u-acs-rosa"; name = "ACS Rosa"; role = "acs"; email = "acs.rosa@clinica.local"; password = "123456"; teamId = "team-rosa" },
  [ordered]@{ id = "u-nurse-azul"; name = "Enfermeira Azul"; role = "nurse_manager"; email = "enfermeira.azul@clinica.local"; password = "123456"; teamId = "team-azul"; councilType = "COREN"; councilNumber = "223456"; councilUf = "SP" },
  [ordered]@{ id = "u-acs-azul"; name = "ACS Azul"; role = "acs"; email = "acs.azul@clinica.local"; password = "123456"; teamId = "team-azul" },
  [ordered]@{ id = "u-nurse-cinza"; name = "Enfermeira Cinza"; role = "nurse_manager"; email = "enfermeira.cinza@clinica.local"; password = "123456"; teamId = "team-cinza"; councilType = "COREN"; councilNumber = "323456"; councilUf = "SP" },
  [ordered]@{ id = "u-acs-cinza"; name = "ACS Cinza"; role = "acs"; email = "acs.cinza@clinica.local"; password = "123456"; teamId = "team-cinza" },
  [ordered]@{ id = "u-nurse-marrom"; name = "Enfermeira Marrom"; role = "nurse_manager"; email = "enfermeira.marrom@clinica.local"; password = "123456"; teamId = "team-marrom"; councilType = "COREN"; councilNumber = "423456"; councilUf = "SP" },
  [ordered]@{ id = "u-acs-marrom"; name = "ACS Marrom"; role = "acs"; email = "acs.marrom@clinica.local"; password = "123456"; teamId = "team-marrom" },
  [ordered]@{ id = "u-nurse-amarela"; name = "Enfermeira Amarela"; role = "nurse_manager"; email = "enfermeira.amarela@clinica.local"; password = "123456"; teamId = "team-amarela"; councilType = "COREN"; councilNumber = "523456"; councilUf = "SP" },
  [ordered]@{ id = "u-acs-amarela"; name = "ACS Amarela"; role = "acs"; email = "acs.amarela@clinica.local"; password = "123456"; teamId = "team-amarela" }
)

$firstF = @("Ana","Maria","Juliana","Camila","Fernanda","Patricia","Aline","Bruna","Larissa","Amanda","Beatriz","Carolina","Daniela","Eliane","Fabiana","Gabriela","Helena","Isabela","Joana","Karina")
$firstC = @("Levi","Miguel","Arthur","Helena","Sophia","Alice","Theo","Gael","Laura","Valentina","Davi","Noah","Ravi","Luna","Cecilia","Matheus","Yasmin","Yuri","Katia","Aline")
$last = @("Silva","Souza","Oliveira","Santos","Pereira","Lima","Costa","Almeida","Rocha","Carvalho","Melo","Martins","Araujo","Nunes","Barbosa","Ribeiro","Fernandes","Gomes","Batista","Teixeira")
$cities = @("Sao Paulo","Guarulhos","Campinas","Santos","Sorocaba","Sao Bernardo do Campo")
$hoods = @("Centro","Jardim America","Vila Nova","Parque das Flores","Jardim Sao Jose","Nova Esperanca")
$streets = @("Rua das Acacias","Rua Sao Joao","Avenida Brasil","Rua do Comercio","Rua Boa Vista","Avenida Paulista")
$acsByTeam = @{ "team-rosa"="u-acs-rosa"; "team-azul"="u-acs-azul"; "team-cinza"="u-acs-cinza"; "team-marrom"="u-acs-marrom"; "team-amarela"="u-acs-amarela" }

$patients = New-Object System.Collections.Generic.List[object]
$appointments = New-Object System.Collections.Generic.List[object]
$tasks = New-Object System.Collections.Generic.List[object]
$clinicalRecords = New-Object System.Collections.Generic.List[object]
$messages = @()
$auditLogs = @()

$p = 1
$cr = 1
$ap = 1
$tk = 1

foreach ($team in $teams) {
  $acsId = $acsByTeam[$team.id]

  for ($i = 0; $i -lt 250; $i++) {
    $isPreg = $i -lt 125
    $patientId = "p-$p"
    $p++

    if ($isPreg) {
      $name = "$(Pick $firstF) $(Pick $last) $(Pick $last)"
      $birth = AddD $now (-(16 + (Get-Random -Minimum 0 -Maximum 25)) * 365 - (Get-Random -Minimum 0 -Maximum 365))
      $pregStart = AddD $now (-(30 + (Get-Random -Minimum 0 -Maximum 220)))

      $chronic = @()
      if ((Get-Random -Minimum 0 -Maximum 100) -lt 12) { $chronic += "hypertension" }
      if ((Get-Random -Minimum 0 -Maximum 100) -lt 8) { $chronic += "diabetes" }

      $pat = [ordered]@{
        id = $patientId
        teamId = $team.id
        name = $name
        motherName = ""
        cpf = Cpf
        cns = Cns
        cnsCpf = ""
        address = "$(Pick $streets), $((Get-Random -Minimum 1 -Maximum 3000)), $(Pick $hoods), $(Pick $cities) - SP"
        phone = Phone
        phoneAlt = Phone
        microArea = ""
        assignedAcsId = $acsId
        careCategory = "pregnant"
        chronicConditions = $chronic
        birthDate = (Iso $birth).Substring(0,10)
        createdAt = (Iso (AddD $now (-(Get-Random -Minimum 1 -Maximum 400))))
        createdBy = $team.managerUserId
        updatedAt = (Iso $now)
        allergies = (Pick @("Nega alergias","Alergia a dipirona","Alergia a penicilina",""))
        comorbidities = (Pick @("Sem comorbidades relevantes","Hipertensao gestacional","Diabetes gestacional",""))
        medications = (Pick @("Acido folico 5mg/dia","Sulfato ferroso 1x/dia","Sem uso continuo",""))
        pregnancyStartDate = (Iso $pregStart).Substring(0,10)
        gestationalAgeDumWeeks = [math]::Floor(($now - $pregStart).TotalDays / 7)
        gestationalAgeDumDays = ([int][math]::Floor(($now - $pregStart).TotalDays) % 7)
      }
      $pat.cnsCpf = $pat.cpf
      $patients.Add($pat)

      $scenario = Get-Random -Minimum 0 -Maximum 100
      $consults = if ($scenario -lt 30) { Get-Random -Minimum 0 -Maximum 2 } elseif ($scenario -lt 70) { Get-Random -Minimum 2 -Maximum 5 } else { Get-Random -Minimum 5 -Maximum 8 }
      $visits = if ($scenario -lt 30) { Get-Random -Minimum 0 -Maximum 1 } elseif ($scenario -lt 70) { Get-Random -Minimum 1 -Maximum 3 } else { Get-Random -Minimum 2 -Maximum 4 }
      $vaccines = if ($scenario -lt 30) { 0 } elseif ($scenario -lt 70) { Get-Random -Minimum 0 -Maximum 2 } else { Get-Random -Minimum 1 -Maximum 4 }

      for ($k = 0; $k -lt $consults; $k++) {
        $clinicalRecords.Add([ordered]@{
          id = "cr-$cr"; patientId = $patientId; type = "consultation"; title = (Pick @("Consulta medica","Consulta de enfermagem"));
          details = "Acompanhamento pre-natal de rotina."; date = (Iso (AddD $now (-(Get-Random -Minimum 1 -Maximum 230)))).Substring(0,10);
          createdBy = $team.managerUserId; createdAt = (Iso (AddD $now (-(Get-Random -Minimum 1 -Maximum 230)))); metadata = @{}
        })
        $cr++
      }
      for ($k = 0; $k -lt $visits; $k++) {
        $clinicalRecords.Add([ordered]@{
          id = "cr-$cr"; patientId = $patientId; type = "visit"; title = "Visita ACS";
          details = "Visita domiciliar de acompanhamento."; date = (Iso (AddD $now (-(Get-Random -Minimum 1 -Maximum 230)))).Substring(0,10);
          createdBy = $acsId; createdAt = (Iso (AddD $now (-(Get-Random -Minimum 1 -Maximum 230)))); metadata = @{}
        })
        $cr++
      }
      for ($k = 0; $k -lt $vaccines; $k++) {
        $clinicalRecords.Add([ordered]@{
          id = "cr-$cr"; patientId = $patientId; type = "vaccine"; title = (Pick @("dTpa","Influenza","COVID-19","Hepatite B"));
          details = "Dose aplicada em sala de vacina."; date = (Iso (AddD $now (-(Get-Random -Minimum 1 -Maximum 180)))).Substring(0,10);
          createdBy = $team.managerUserId; createdAt = (Iso (AddD $now (-(Get-Random -Minimum 1 -Maximum 180)))); metadata = @{}
        })
        $cr++
      }
    }
    else {
      $name = "$(Pick $firstC) $(Pick $last) $(Pick $last)"
      $birth = AddD $now (-(Get-Random -Minimum 1 -Maximum 730))
      $chronic = @()
      if ((Get-Random -Minimum 0 -Maximum 100) -lt 3) { $chronic += "hypertension" }
      if ((Get-Random -Minimum 0 -Maximum 100) -lt 3) { $chronic += "diabetes" }

      $pat = [ordered]@{
        id = $patientId
        teamId = $team.id
        name = $name
        motherName = "$(Pick $firstF) $(Pick $last)"
        cpf = Cpf
        cns = Cns
        cnsCpf = ""
        address = "$(Pick $streets), $((Get-Random -Minimum 1 -Maximum 3000)), $(Pick $hoods), $(Pick $cities) - SP"
        phone = Phone
        phoneAlt = Phone
        microArea = ""
        assignedAcsId = $acsId
        careCategory = "child_followup"
        chronicConditions = $chronic
        birthDate = (Iso $birth).Substring(0,10)
        createdAt = (Iso (AddD $now (-(Get-Random -Minimum 1 -Maximum 400))))
        createdBy = $team.managerUserId
        updatedAt = (Iso $now)
        allergies = (Pick @("Nega alergias","Alergia alimentar (leite)",""))
        comorbidities = (Pick @("Sem comorbidades relevantes","Asma leve",""))
        medications = (Pick @("Vitamina D","Sem uso continuo",""))
      }
      $pat.cnsCpf = $pat.cpf
      $patients.Add($pat)

      $scenario = Get-Random -Minimum 0 -Maximum 100
      $consults = if ($scenario -lt 30) { Get-Random -Minimum 0 -Maximum 2 } elseif ($scenario -lt 70) { Get-Random -Minimum 2 -Maximum 6 } else { Get-Random -Minimum 6 -Maximum 10 }
      $visits = if ($scenario -lt 30) { Get-Random -Minimum 0 -Maximum 1 } elseif ($scenario -lt 70) { Get-Random -Minimum 1 -Maximum 3 } else { Get-Random -Minimum 2 -Maximum 4 }
      $vaccines = if ($scenario -lt 30) { Get-Random -Minimum 0 -Maximum 2 } elseif ($scenario -lt 70) { Get-Random -Minimum 2 -Maximum 7 } else { Get-Random -Minimum 7 -Maximum 13 }

      for ($k = 0; $k -lt $consults; $k++) {
        $clinicalRecords.Add([ordered]@{
          id = "cr-$cr"; patientId = $patientId; type = "consultation"; title = (Pick @("Consulta medica","Consulta de enfermagem"));
          details = "Acompanhamento puericultura."; date = (Iso (AddD $now (-(Get-Random -Minimum 1 -Maximum 700)))).Substring(0,10);
          createdBy = $team.managerUserId; createdAt = (Iso (AddD $now (-(Get-Random -Minimum 1 -Maximum 700)))); metadata = @{}
        })
        $cr++
      }
      for ($k = 0; $k -lt $visits; $k++) {
        $clinicalRecords.Add([ordered]@{
          id = "cr-$cr"; patientId = $patientId; type = "visit"; title = "Visita ACS";
          details = "Visita domiciliar puericultura."; date = (Iso (AddD $now (-(Get-Random -Minimum 1 -Maximum 500)))).Substring(0,10);
          createdBy = $acsId; createdAt = (Iso (AddD $now (-(Get-Random -Minimum 1 -Maximum 500)))); metadata = @{}
        })
        $cr++
      }
      for ($k = 0; $k -lt $vaccines; $k++) {
        $clinicalRecords.Add([ordered]@{
          id = "cr-$cr"; patientId = $patientId; type = "vaccine"; title = (Pick @("BCG","Hepatite B","Penta","VIP","Pneumo 10","Rotavirus","Meningococica","Influenza","COVID","Febre amarela","ACWY","Triplice viral","DTP","Varicela","Hepatite A"));
          details = "Vacina aplicada em sala de vacina."; date = (Iso (AddD $now (-(Get-Random -Minimum 1 -Maximum 720)))).Substring(0,10);
          createdBy = $team.managerUserId; createdAt = (Iso (AddD $now (-(Get-Random -Minimum 1 -Maximum 720)))); metadata = @{}
        })
        $cr++
      }
    }

    $demand = if ((Get-Random -Minimum 0 -Maximum 100) -lt 75) { "scheduled" } else { "spontaneous" }
    $appointments.Add([ordered]@{
      id = "a-$ap"; patientId = $patientId; date = (Iso (AddD $now (-(Get-Random -Minimum 1 -Maximum 120)))).Substring(0,10);
      summary = "Atendimento de rotina"; conduct = "Conduta registrada"; nextStep = "Retorno programado"; demandType = $demand;
      createdBy = $team.managerUserId; createdAt = (Iso (AddD $now (-(Get-Random -Minimum 1 -Maximum 120))))
    })
    $ap++

    if ((Get-Random -Minimum 0 -Maximum 100) -lt 33) {
      $status = if ((Get-Random -Minimum 0 -Maximum 100) -lt 40) { "done" } else { "pending" }
      $tasks.Add([ordered]@{
        id = "t-$tk"; patientId = $patientId; title = "Acompanhamento ativo"; notes = "Acompanhar retorno e pendencias";
        dueDate = (Iso (AddD $now ((Get-Random -Minimum -10 -Maximum 20)))).Substring(0,10);
        assigneeId = $acsId; status = $status; createdBy = $team.managerUserId;
        createdAt = (Iso (AddD $now (-(Get-Random -Minimum 1 -Maximum 30))))
      })
      $tk++
    }
  }
}

$db = [ordered]@{
  teams = $teams
  users = $users
  patients = $patients
  appointments = $appointments
  tasks = $tasks
  messages = $messages
  auditLogs = $auditLogs
  clinicalRecords = $clinicalRecords
}

($db | ConvertTo-Json -Depth 12) | Set-Content -Path $outPath -Encoding UTF8
Write-Host ("db.json atualizado: {0} pacientes, {1} registros" -f $patients.Count, $clinicalRecords.Count)
