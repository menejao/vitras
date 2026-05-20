cd C:\dev\vitras\backend

npm install

if (Test-Path "C:\dev\vitras\deploy-artifacts\backend.zip") {
  Remove-Item "C:\dev\vitras\deploy-artifacts\backend.zip"
}

Compress-Archive -Path .\* -DestinationPath "C:\dev\vitras\deploy-artifacts\backend.zip" -Force

Write-Host "Backend zip criado em C:\dev\vitras\deploy-artifacts\backend.zip"
