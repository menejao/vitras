cd C:\dev\vitras\backend

npm install

if (Test-Path "C:\dev\vitras\deploy-artifacts\backend.zip") {
  Remove-Item "C:\dev\vitras\deploy-artifacts\backend.zip"
}

tar -a -c -f "C:\dev\vitras\deploy-artifacts\backend.zip" *

Write-Host "Backend zip criado em C:\dev\vitras\deploy-artifacts\backend.zip"
