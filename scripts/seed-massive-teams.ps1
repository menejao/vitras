param(
  [string]$ApiUrl = "https://saude-backend-gkj7.onrender.com",
  [int]$PatientsPerTeam = 250,
  [int]$FocusPregChildPerTeam = 40,
  [string]$DefaultPassword = "SaudeUbs@2026!",
  [switch]$SkipUserCreation
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Get-HttpStatusCode {
  param([object]$ErrorRecord)
  try {
    if ($null -ne $ErrorRecord.Exception.Response.StatusCode.value__) {
      return [int]$ErrorRecord.Exception.Response.StatusCode.value__
    }
  } catch {}
  try {
    return [int]$ErrorRecord.Exception.Response.StatusCode
  } catch {}
  return 0
}

function Invoke-Api {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Path,
    [object]$Body = $null,
    [string]$Token = ""
  )

  $headers = @{ "Content-Type" = "application/json" }
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }

  $uri = "$ApiUrl$Path"
  if ($Body -ne $null) {
    $json = $Body | ConvertTo-Json -Depth 12 -Compress
    $lastErr = $null
    for ($try = 1; $try -le 5; $try++) {
      try {
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $json
      } catch {
        $lastErr = $_
        $status = Get-HttpStatusCode $_
        try {
          $respBody = $_.ErrorDetails.Message
          if (-not $respBody -and $_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            if ($stream) {
              $reader = New-Object System.IO.StreamReader($stream)
              $respBody = $reader.ReadToEnd()
              $reader.Close()
            }
          }
          if ($status -ge 400 -and $status -lt 500 -and $respBody) {
            Write-Host ("   ! API {0} {1} => {2}: {3}" -f $Method, $Path, $status, $respBody)
          }
        } catch {}
        if ($status -ge 400 -and $status -lt 500 -and $status -ne 429) { break }
        Start-Sleep -Seconds ([Math]::Min(12, 2 * $try))
      }
    }
    throw $lastErr
  }
  $lastErr = $null
  for ($try = 1; $try -le 5; $try++) {
    try {
      return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
    } catch {
      $lastErr = $_
      $status = Get-HttpStatusCode $_
      try {
        $respBody = $_.ErrorDetails.Message
        if (-not $respBody -and $_.Exception.Response) {
          $stream = $_.Exception.Response.GetResponseStream()
          if ($stream) {
            $reader = New-Object System.IO.StreamReader($stream)
            $respBody = $reader.ReadToEnd()
            $reader.Close()
          }
        }
        if ($status -ge 400 -and $status -lt 500 -and $respBody) {
          Write-Host ("   ! API {0} {1} => {2}: {3}" -f $Method, $Path, $status, $respBody)
        }
      } catch {}
      if ($status -ge 400 -and $status -lt 500 -and $status -ne 429) { break }
      Start-Sleep -Seconds ([Math]::Min(12, 2 * $try))
    }
  }
  throw $lastErr
}

function Try-RegisterUser {
  param(
    [string]$Name,
    [string]$Email,
    [string]$Role,
    [string]$TeamId,
    [string]$CouncilUf = "SP",
    [string]$CouncilNumber = ""
  )

  $payload = @{
    name = $Name
    email = $Email
    password = $DefaultPassword
    role = $Role
    teamId = $TeamId
    councilUf = $CouncilUf
    councilNumber = $CouncilNumber
  }

  try {
    $res = Invoke-Api -Method "POST" -Path "/auth/register" -Body $payload
    Write-Host "   + Usuário criado: $Email"
    if ($res -and $res.token) {
      return @{ created = $true; token = [string]$res.token }
    }
    return @{ created = $true; token = "" }
  } catch {
    $statusCode = Get-HttpStatusCode $_
    $msg = $_.Exception.Message
    if ($statusCode -eq 409 -or $msg -match "já cadastrado|j. cadastrado|E-mail j|Conflito|Conflict") {
      Write-Host "   = Usuário já existe: $Email"
      return @{ created = $false; token = "" }
    } else {
      throw
    }
  }
}

function Try-CreateManagedUser {
  param(
    [string]$ManagerToken,
    [string]$Name,
    [string]$Email,
    [string]$Role,
    [string]$CouncilUf = "SP",
    [string]$CouncilNumber = ""
  )

  $payload = @{
    name = $Name
    email = $Email
    password = $DefaultPassword
    role = $Role
    councilUf = $CouncilUf
    councilNumber = $CouncilNumber
  }

  try {
    $null = Invoke-Api -Method "POST" -Path "/users" -Body $payload -Token $ManagerToken
    Write-Host "   + Usuário da equipe criado: $Email"
  } catch {
    $statusCode = Get-HttpStatusCode $_
    $msg = $_.Exception.Message
    if ($statusCode -eq 409 -or $msg -match "já cadastrado|j. cadastrado|E-mail j|Conflito|Conflict") {
      Write-Host "   = Usuário já existe: $Email"
    } else {
      throw
    }
  }
}

function Do-Login {
  param([string]$Email)
  $res = Invoke-Api -Method "POST" -Path "/auth/login" -Body @{ email = $Email; password = $DefaultPassword }
  if (-not $res.token) { throw "Login sem token para $Email" }
  return $res
}

function Resolve-NurseToken {
  param(
    [string]$Name,
    [string]$BaseEmail,
    [string]$TeamId,
    [string]$CouncilUf = "SP",
    [string]$CouncilNumber = ""
  )

  $registerResult = $null
  if (-not $SkipUserCreation) {
    $registerResult = Try-RegisterUser -Name $Name -Email $BaseEmail -Role "nurse_manager" -TeamId $TeamId -CouncilUf $CouncilUf -CouncilNumber $CouncilNumber
  }

  if ($registerResult -and $registerResult.token) {
    return @{ email = $BaseEmail; token = [string]$registerResult.token }
  }

  try {
    $login = Do-Login -Email $BaseEmail
    return @{ email = $BaseEmail; token = [string]$login.token }
  } catch {
    $statusCode = Get-HttpStatusCode $_
    if ($statusCode -ne 401) { throw }
    if ($SkipUserCreation) {
      throw "Falha de login (401) para $BaseEmail com SkipUserCreation ativo."
    }

    $suffix = [DateTime]::UtcNow.ToString("yyyyMMddHHmmss")
    $altEmail = ($BaseEmail -replace "@", ".$suffix@")
    Write-Host "   ! Login 401 para $BaseEmail. Criando enfermeira alternativa: $altEmail"
    $altRegister = Try-RegisterUser -Name $Name -Email $altEmail -Role "nurse_manager" -TeamId $TeamId -CouncilUf $CouncilUf -CouncilNumber $CouncilNumber
    if ($altRegister -and $altRegister.token) {
      return @{ email = $altEmail; token = [string]$altRegister.token }
    }
    $altLogin = Do-Login -Email $altEmail
    return @{ email = $altEmail; token = [string]$altLogin.token }
  }
}

function Random-From {
  param([object[]]$Items)
  return $Items[(Get-Random -Minimum 0 -Maximum $Items.Count)]
}

function New-RandomDateString {
  param(
    [datetime]$MinDate,
    [datetime]$MaxDate
  )
  $range = ($MaxDate - $MinDate).Days
  if ($range -lt 1) { return $MinDate.ToString("yyyy-MM-dd") }
  $offset = Get-Random -Minimum 0 -Maximum ($range + 1)
  return $MinDate.AddDays($offset).ToString("yyyy-MM-dd")
}

function New-Phone {
  return ("({0}) 9{1:0000}-{2:0000}" -f (Get-Random -Minimum 11 -Maximum 100), (Get-Random -Minimum 0 -Maximum 10000), (Get-Random -Minimum 0 -Maximum 10000))
}

function New-Cpf {
  return ("{0:000}.{1:000}.{2:000}-{3:00}" -f (Get-Random -Minimum 0 -Maximum 1000), (Get-Random -Minimum 0 -Maximum 1000), (Get-Random -Minimum 0 -Maximum 1000), (Get-Random -Minimum 0 -Maximum 100))
}

function New-Cns {
  return "{0:000} {1:0000} {2:0000} {3:0000}" -f (Get-Random -Minimum 100 -Maximum 1000), (Get-Random -Minimum 0 -Maximum 10000), (Get-Random -Minimum 0 -Maximum 10000), (Get-Random -Minimum 0 -Maximum 10000)
}

function Build-PregnantPatientPayload {
  param(
    [string]$TeamName,
    [string]$AssignedAcsId
  )

  $first = @("Ana","Maria","Juliana","Camila","Fernanda","Patricia","Aline","Bruna","Larissa","Amanda","Beatriz","Carolina","Daniela","Eliane","Fabiana","Gabriela","Helena","Isabela","Joana","Karina")
  $last  = @("Silva","Souza","Oliveira","Santos","Pereira","Lima","Costa","Almeida","Rocha","Carvalho","Melo","Martins","Araujo","Nunes","Barbosa","Ribeiro","Fernandes","Gomes","Batista","Teixeira")
  $city  = @("São Paulo","Guarulhos","Campinas","Santos","Sorocaba","São Bernardo do Campo")
  $neigh = @("Centro","Jardim América","Vila Nova","Parque das Flores","Jardim São José","Nova Esperança")
  $street = @("Rua das Acácias","Rua São João","Avenida Brasil","Rua do Comércio","Rua Boa Vista","Avenida Paulista")

  $name = "$(Random-From $first) $(Random-From $last) $(Random-From $last)"
  $birth = [datetime]::UtcNow.AddYears(-1 * (Get-Random -Minimum 16 -Maximum 42)).AddDays(-1 * (Get-Random -Minimum 0 -Maximum 365))
  $pregStart = [datetime]::UtcNow.AddDays(-1 * (Get-Random -Minimum 30 -Maximum 250))
  $usgWeeks = Get-Random -Minimum 6 -Maximum 24
  $usgDays = Get-Random -Minimum 0 -Maximum 7
  $usgDate1 = $pregStart.AddDays((Get-Random -Minimum 15 -Maximum 50))

  $conditions = @()
  if ((Get-Random -Minimum 0 -Maximum 100) -lt 12) { $conditions += "hypertension" }
  if ((Get-Random -Minimum 0 -Maximum 100) -lt 9)  { $conditions += "diabetes" }

  return @{
    name = $name
    birthDate = $birth.ToString("yyyy-MM-dd")
    phone = New-Phone
    phoneAlt = New-Phone
    cpf = New-Cpf
    cns = New-Cns
    careCategory = "pregnant"
    assignedAcsId = $AssignedAcsId
    chronicConditions = $conditions
    zipCode = "{0:00000}-{1:000}" -f (Get-Random -Minimum 10000 -Maximum 99999), (Get-Random -Minimum 0 -Maximum 1000)
    address = Random-From $street
    number = [string](Get-Random -Minimum 1 -Maximum 5000)
    complement = "Casa $(Get-Random -Minimum 1 -Maximum 50)"
    neighborhood = Random-From $neigh
    city = Random-From $city
    state = "SP"
    sex = "feminino"
    raceColor = Random-From @("Branca","Parda","Preta","Amarela","Indígena")
    maritalStatus = Random-From @("Solteira","Casada","União estável","Divorciada")
    allergies = Random-From @("Nega alergias","Alergia a dipirona","Alergia a penicilina","")
    comorbidities = Random-From @("Sem comorbidades relevantes","Hipertensão gestacional","Diabetes gestacional","")
    medications = Random-From @("Ácido fólico 5mg/dia","Sulfato ferroso 1x/dia","Sem uso contínuo","")
    pregnancyStartDate = $pregStart.ToString("yyyy-MM-dd")
    gestationalAgeDumWeeks = [int]([math]::Floor((([datetime]::UtcNow - $pregStart).Days)/7))
    gestationalAgeDumDays = [int]((([datetime]::UtcNow - $pregStart).Days) % 7)
    usgDate1 = $usgDate1.ToString("yyyy-MM-dd")
    gestationalAgeUsgWeeks = $usgWeeks
    gestationalAgeUsgDays = $usgDays
    teamName = $TeamName
  }
}

function Build-ChildPatientPayload {
  param(
    [string]$TeamName,
    [string]$AssignedAcsId
  )

  $first = @("Levi","Miguel","Arthur","Helena","Sophia","Alice","Theo","Gael","Laura","Valentina","Davi","Noah","Ravi","Luna","Cecilia")
  $last  = @("Silva","Souza","Oliveira","Santos","Pereira","Lima","Costa","Almeida","Rocha","Carvalho","Melo","Martins","Araujo","Nunes","Barbosa")
  $city  = @("São Paulo","Guarulhos","Campinas","Santos","Sorocaba","São Bernardo do Campo")
  $neigh = @("Centro","Jardim América","Vila Nova","Parque das Flores","Jardim São José","Nova Esperança")
  $street = @("Rua das Acácias","Rua São João","Avenida Brasil","Rua do Comércio","Rua Boa Vista","Avenida Paulista")
  $resp = @("Mariana","Patrícia","Carla","Vanessa","Joana","Luciana","Márcia","Fernanda","Aparecida","Rosana")

  $name = "$(Random-From $first) $(Random-From $last) $(Random-From $last)"
  $ageDays = Get-Random -Minimum 1 -Maximum 730
  $birth = [datetime]::UtcNow.AddDays(-1 * $ageDays)

  $conditions = @()
  if ((Get-Random -Minimum 0 -Maximum 100) -lt 3) { $conditions += "diabetes" }
  if ((Get-Random -Minimum 0 -Maximum 100) -lt 3) { $conditions += "hypertension" }

  return @{
    name = $name
    guardianName = "$(Random-From $resp) $(Random-From $last)"
    birthDate = $birth.ToString("yyyy-MM-dd")
    phone = New-Phone
    phoneAlt = New-Phone
    cpf = New-Cpf
    cns = New-Cns
    careCategory = "child_followup"
    assignedAcsId = $AssignedAcsId
    chronicConditions = $conditions
    zipCode = "{0:00000}-{1:000}" -f (Get-Random -Minimum 10000 -Maximum 99999), (Get-Random -Minimum 0 -Maximum 1000)
    address = Random-From $street
    number = [string](Get-Random -Minimum 1 -Maximum 5000)
    complement = "Casa $(Get-Random -Minimum 1 -Maximum 50)"
    neighborhood = Random-From $neigh
    city = Random-From $city
    state = "SP"
    sex = Random-From @("masculino","feminino")
    raceColor = Random-From @("Branca","Parda","Preta","Amarela","Indígena")
    maritalStatus = ""
    allergies = Random-From @("Nega alergias","Alergia alimentar (leite)","")
    comorbidities = Random-From @("Sem comorbidades relevantes","Asma leve","")
    medications = Random-From @("Vitamina D","Sem uso contínuo","")
    teamName = $TeamName
  }
}

function Build-OtherPatientPayload {
  param(
    [string]$TeamName,
    [string]$AssignedAcsId
  )

  $first = @("Carlos","Marina","Eliane","Fernando","Joana","Ricardo","Paula","Renata","Tiago","Luciana","Bruno","Camila","Eduardo","Sonia","Jorge")
  $last  = @("Silva","Souza","Oliveira","Santos","Pereira","Lima","Costa","Almeida","Rocha","Carvalho","Melo","Martins","Araujo","Nunes","Barbosa")
  $city  = @("São Paulo","Guarulhos","Campinas","Santos","Sorocaba","São Bernardo do Campo")
  $neigh = @("Centro","Jardim América","Vila Nova","Parque das Flores","Jardim São José","Nova Esperança")
  $street = @("Rua das Acácias","Rua São João","Avenida Brasil","Rua do Comércio","Rua Boa Vista","Avenida Paulista")

  $categories = @("general","puerperal","elderly","pap_only","chronic")
  $cat = Random-From $categories
  $ageMin = 20
  $ageMax = 75
  if ($cat -eq "elderly") { $ageMin = 60; $ageMax = 90 }
  if ($cat -eq "pap_only") { $ageMin = 25; $ageMax = 64 }
  if ($cat -eq "puerperal") { $ageMin = 16; $ageMax = 42 }

  $name = "$(Random-From $first) $(Random-From $last) $(Random-From $last)"
  $birth = [datetime]::UtcNow.AddYears(-1 * (Get-Random -Minimum $ageMin -Maximum ($ageMax + 1))).AddDays(-1 * (Get-Random -Minimum 0 -Maximum 365))
  $conditions = @()
  if ($cat -eq "chronic" -or $cat -eq "elderly") {
    if ((Get-Random -Minimum 0 -Maximum 100) -lt 70) { $conditions += "hypertension" }
    if ((Get-Random -Minimum 0 -Maximum 100) -lt 55) { $conditions += "diabetes" }
  }

  return @{
    name = $name
    birthDate = $birth.ToString("yyyy-MM-dd")
    phone = New-Phone
    phoneAlt = New-Phone
    cpf = New-Cpf
    cns = New-Cns
    careCategory = $cat
    assignedAcsId = $AssignedAcsId
    chronicConditions = $conditions
    zipCode = "{0:00000}-{1:000}" -f (Get-Random -Minimum 10000 -Maximum 99999), (Get-Random -Minimum 0 -Maximum 1000)
    address = Random-From $street
    number = [string](Get-Random -Minimum 1 -Maximum 5000)
    complement = "Casa $(Get-Random -Minimum 1 -Maximum 50)"
    neighborhood = Random-From $neigh
    city = Random-From $city
    state = "SP"
    sex = Random-From @("masculino","feminino")
    raceColor = Random-From @("Branca","Parda","Preta","Amarela","Indígena")
    maritalStatus = Random-From @("Solteiro(a)","Casado(a)","União estável","Divorciado(a)","Viúvo(a)")
    allergies = Random-From @("Nega alergias","Alergia a dipirona","")
    comorbidities = Random-From @("Sem comorbidades relevantes","Hipertensão arterial","Diabetes mellitus","")
    medications = Random-From @("Losartana 50mg","Metformina 850mg","Sem uso contínuo","")
    teamName = $TeamName
  }
}

function Create-Record {
  param(
    [string]$Token,
    [string]$PatientId,
    [string]$Type,
    [string]$Title,
    [datetime]$Date,
    [string]$Details
  )
  $payload = @{
    type = $Type
    title = $Title
    date = $Date.ToString("yyyy-MM-dd")
    details = $Details
  }
  $null = Invoke-Api -Method "POST" -Path "/patients/$PatientId/records" -Body $payload -Token $Token
}

function Populate-RecordsForPatient {
  param(
    [string]$Token,
    [object]$Patient,
    [string]$Category
  )

  $now = [datetime]::UtcNow
  $scenario = Get-Random -Minimum 1 -Maximum 101  # 1..100

  if ($Category -eq "pregnant") {
    $consults = 0
    $visits = 0
    $vaccines = 0

    if ($scenario -le 30) { $consults = Get-Random -Minimum 0 -Maximum 2; $visits = Get-Random -Minimum 0 -Maximum 1; $vaccines = 0 }       # crítico
    elseif ($scenario -le 70) { $consults = Get-Random -Minimum 2 -Maximum 5; $visits = Get-Random -Minimum 1 -Maximum 3; $vaccines = Get-Random -Minimum 0 -Maximum 2 } # atenção
    else { $consults = Get-Random -Minimum 5 -Maximum 8; $visits = Get-Random -Minimum 2 -Maximum 4; $vaccines = Get-Random -Minimum 1 -Maximum 4 } # em dia

    1..$consults | ForEach-Object {
      $d = $now.AddDays(-1 * (Get-Random -Minimum 3 -Maximum 210))
      $title = Random-From @("Consulta médica","Consulta de enfermagem")
      Create-Record -Token $Token -PatientId $Patient.id -Type "consultation" -Title $title -Date $d -Details "Acompanhamento pré-natal de rotina."
    }
    1..$visits | ForEach-Object {
      $d = $now.AddDays(-1 * (Get-Random -Minimum 3 -Maximum 210))
      Create-Record -Token $Token -PatientId $Patient.id -Type "visit" -Title "Visita ACS" -Date $d -Details "Visita domiciliar de acompanhamento."
    }

    $pregVaccines = @("dTpa","Influenza","COVID-19","Hepatite B")
    1..$vaccines | ForEach-Object {
      $d = $now.AddDays(-1 * (Get-Random -Minimum 1 -Maximum 180))
      Create-Record -Token $Token -PatientId $Patient.id -Type "vaccine" -Title (Random-From $pregVaccines) -Date $d -Details "Dose aplicada por enfermagem."
    }

    if ((Get-Random -Minimum 0 -Maximum 100) -lt 55) {
      $d = $now.AddDays(-1 * (Get-Random -Minimum 5 -Maximum 120))
      Create-Record -Token $Token -PatientId $Patient.id -Type "procedure" -Title "Teste rápido 1º trimestre HIV sífilis" -Date $d -Details "TR realizado e registrado."
    }
    if ((Get-Random -Minimum 0 -Maximum 100) -lt 40) {
      $d = $now.AddDays(-1 * (Get-Random -Minimum 1 -Maximum 70))
      Create-Record -Token $Token -PatientId $Patient.id -Type "procedure" -Title "Teste rápido 3º trimestre HIV sífilis" -Date $d -Details "TR de 3º trimestre realizado."
    }
  }
  elseif ($Category -eq "child_followup") {
    $consults = 0
    $visits = 0
    $vaccines = 0

    if ($scenario -le 30) { $consults = Get-Random -Minimum 0 -Maximum 2; $visits = Get-Random -Minimum 0 -Maximum 1; $vaccines = Get-Random -Minimum 0 -Maximum 2 }       # crítico
    elseif ($scenario -le 70) { $consults = Get-Random -Minimum 2 -Maximum 6; $visits = Get-Random -Minimum 1 -Maximum 2; $vaccines = Get-Random -Minimum 2 -Maximum 7 } # atenção
    else { $consults = Get-Random -Minimum 6 -Maximum 10; $visits = Get-Random -Minimum 2 -Maximum 3; $vaccines = Get-Random -Minimum 7 -Maximum 12 } # em dia

    1..$consults | ForEach-Object {
      $d = $now.AddDays(-1 * (Get-Random -Minimum 3 -Maximum 700))
      $title = Random-From @("Consulta médica","Consulta de enfermagem")
      Create-Record -Token $Token -PatientId $Patient.id -Type "consultation" -Title $title -Date $d -Details "Acompanhamento puericultura."
    }
    1..$visits | ForEach-Object {
      $d = $now.AddDays(-1 * (Get-Random -Minimum 3 -Maximum 500))
      Create-Record -Token $Token -PatientId $Patient.id -Type "visit" -Title "Visita ACS" -Date $d -Details "Visita domiciliar de criança."
    }

    $childVaccines = @("BCG","Hepatite B","Penta","VIP","Pneumo 10","Rotavírus","Meningocócica","Influenza","COVID","Febre amarela","ACWY","Tríplice viral","DTP","Varicela","Hepatite A")
    1..$vaccines | ForEach-Object {
      $d = $now.AddDays(-1 * (Get-Random -Minimum 1 -Maximum 720))
      Create-Record -Token $Token -PatientId $Patient.id -Type "vaccine" -Title (Random-From $childVaccines) -Date $d -Details "Vacina aplicada em sala de vacina."
    }
  } else {
    $consults = 0
    $visits = 0
    $vaccines = 0

    if ($scenario -le 30) { $consults = Get-Random -Minimum 0 -Maximum 2; $visits = Get-Random -Minimum 0 -Maximum 1; $vaccines = Get-Random -Minimum 0 -Maximum 1 }
    elseif ($scenario -le 70) { $consults = Get-Random -Minimum 1 -Maximum 3; $visits = Get-Random -Minimum 1 -Maximum 2; $vaccines = Get-Random -Minimum 0 -Maximum 2 }
    else { $consults = Get-Random -Minimum 2 -Maximum 5; $visits = Get-Random -Minimum 1 -Maximum 3; $vaccines = Get-Random -Minimum 1 -Maximum 3 }

    1..$consults | ForEach-Object {
      $d = $now.AddDays(-1 * (Get-Random -Minimum 3 -Maximum 360))
      $title = Random-From @("Consulta médica","Consulta de enfermagem")
      Create-Record -Token $Token -PatientId $Patient.id -Type "consultation" -Title $title -Date $d -Details "Acompanhamento clínico."
    }
    1..$visits | ForEach-Object {
      $d = $now.AddDays(-1 * (Get-Random -Minimum 3 -Maximum 360))
      Create-Record -Token $Token -PatientId $Patient.id -Type "visit" -Title "Visita ACS" -Date $d -Details "Visita domiciliar de acompanhamento."
    }
    $vaccinesPool = @("Influenza","COVID-19","Hepatite B","dTpa","HPV","Febre amarela")
    1..$vaccines | ForEach-Object {
      $d = $now.AddDays(-1 * (Get-Random -Minimum 1 -Maximum 360))
      Create-Record -Token $Token -PatientId $Patient.id -Type "vaccine" -Title (Random-From $vaccinesPool) -Date $d -Details "Dose aplicada."
    }

    if ($Category -eq "chronic") {
      if ((Get-Random -Minimum 0 -Maximum 100) -lt 65) {
        $d = $now.AddDays(-1 * (Get-Random -Minimum 1 -Maximum 330))
        Create-Record -Token $Token -PatientId $Patient.id -Type "procedure" -Title "Hemoglobina glicada solicitada/avaliada" -Date $d -Details "Registro de seguimento de condição crônica."
      }
      if ((Get-Random -Minimum 0 -Maximum 100) -lt 60) {
        $d = $now.AddDays(-1 * (Get-Random -Minimum 1 -Maximum 330))
        Create-Record -Token $Token -PatientId $Patient.id -Type "procedure" -Title "Avaliação dos pés" -Date $d -Details "Avaliação anual dos pés registrada."
      }
    }
  }
}

Write-Host "== Iniciando seed massivo =="
Write-Host "API: $ApiUrl"
Write-Host "Pacientes por equipe: $PatientsPerTeam"
Write-Host "Distribuição alvo: $FocusPregChildPerTeam entre gestantes/crianças + restante misto"

$teams = Invoke-Api -Method "GET" -Path "/teams/public"
if (-not $teams -or $teams.Count -lt 5) {
  throw "Não foi possível carregar as 5 equipes públicas."
}

$targetTeams = @("Amarela","Azul","Cinza","Marrom","Rosa")
$selectedTeams = @()
foreach ($c in $targetTeams) {
  $t = $teams | Where-Object { $_.name -match $c } | Select-Object -First 1
  if (-not $t) { throw "Equipe da cor '$c' não encontrada em /teams/public." }
  $selectedTeams += $t
}

Write-Host "Equipes alvo:"
$selectedTeams | ForEach-Object { Write-Host (" - {0} ({1})" -f $_.name, $_.id) }

$usersByTeam = @{}
foreach ($team in $selectedTeams) {
  $slug = ($team.name.ToLower() -replace "[^a-z0-9]+","-").Trim("-")
  $nurseEmail = "enfermeira.$slug@ubs.local"
  $acsEmail = "acs.$slug@ubs.local"

  $nurseAuth = Resolve-NurseToken -Name "Enfermeira $($team.name)" -BaseEmail $nurseEmail -TeamId $team.id -CouncilUf "SP" -CouncilNumber ("{0:000000}" -f (Get-Random -Minimum 100000 -Maximum 999999))
  $nurseEmail = [string]$nurseAuth.email
  $nurseLogin = @{ token = [string]$nurseAuth.token }

  if (-not $SkipUserCreation) {
    try {
      Try-CreateManagedUser -ManagerToken $nurseLogin.token -Name "ACS $($team.name)" -Email $acsEmail -Role "acs"
    } catch {
      $statusCode = Get-HttpStatusCode $_
      if ($statusCode -eq 401 -or $statusCode -eq 403) {
        Write-Host "   ! Sem permissão para criar ACS via /users nesta equipe. Seguindo seed com ACS existente/sem ACS."
      } else {
        throw
      }
    }
  }
  $bootstrap = Invoke-Api -Method "GET" -Path "/bootstrap" -Token $nurseLogin.token
  $acsUser = $bootstrap.users | Where-Object { $_.role -eq "acs" } | Select-Object -First 1

  $usersByTeam[$team.id] = @{
    teamName = $team.name
    nurseEmail = $nurseEmail
    nurseToken = $nurseLogin.token
    acsId = if ($acsUser) { $acsUser.id } else { "" }
  }
}

$totalCreated = 0
$totalRecords = 0

foreach ($team in $selectedTeams) {
  $ctx = $usersByTeam[$team.id]
  $teamToken = [string]$ctx.nurseToken
  $acsId = [string]$ctx.acsId
  $teamName = [string]$ctx.teamName

  $focusCount = [Math]::Min($PatientsPerTeam, $FocusPregChildPerTeam)
  $pregnantCount = [int][math]::Floor($focusCount * 0.5)
  $childCount = $focusCount - $pregnantCount
  $otherCount = $PatientsPerTeam - $focusCount

  Write-Host ""
  Write-Host ("== Equipe {0}: criando {1} gestantes + {2} crianças + {3} mistos ==" -f $teamName, $pregnantCount, $childCount, $otherCount)

  for ($i=1; $i -le $pregnantCount; $i++) {
    $payload = Build-PregnantPatientPayload -TeamName $teamName -AssignedAcsId $acsId
    $created = Invoke-Api -Method "POST" -Path "/patients" -Body $payload -Token $teamToken
    $totalCreated++
    Populate-RecordsForPatient -Token $teamToken -Patient $created -Category "pregnant"
    $totalRecords += 1
    if (($i % 25) -eq 0) { Write-Host ("   Gestantes: {0}/{1}" -f $i, $pregnantCount) }
  }

  for ($i=1; $i -le $childCount; $i++) {
    $payload = Build-ChildPatientPayload -TeamName $teamName -AssignedAcsId $acsId
    $created = Invoke-Api -Method "POST" -Path "/patients" -Body $payload -Token $teamToken
    $totalCreated++
    Populate-RecordsForPatient -Token $teamToken -Patient $created -Category "child_followup"
    $totalRecords += 1
    if (($i % 25) -eq 0) { Write-Host ("   Crianças: {0}/{1}" -f $i, $childCount) }
  }

  for ($i=1; $i -le $otherCount; $i++) {
    $payload = Build-OtherPatientPayload -TeamName $teamName -AssignedAcsId $acsId
    $created = Invoke-Api -Method "POST" -Path "/patients" -Body $payload -Token $teamToken
    $totalCreated++
    Populate-RecordsForPatient -Token $teamToken -Patient $created -Category $payload.careCategory
    $totalRecords += 1
    if (($i % 10) -eq 0) { Write-Host ("   Mistos: {0}/{1}" -f $i, $otherCount) }
  }
}

Write-Host ""
Write-Host "== Concluído =="
Write-Host ("Pacientes criados: {0}" -f $totalCreated)
Write-Host ("Pacientes com registros clínicos simulados: {0}" -f $totalRecords)
Write-Host "Login padrão criado por equipe: enfermeira.<equipe>@ubs.local / acs.<equipe>@ubs.local"
Write-Host ("Senha padrão: {0}" -f $DefaultPassword)
