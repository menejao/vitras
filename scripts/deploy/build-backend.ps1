Set-Location C:\dev\vitras\backend
npm install
node C:\dev\vitras\scripts\deploy\build-backend.js
Write-Host "Backend zip criado em C:\dev\vitras\deploy-artifacts\backend.zip"
Write-Host "  npm audit fix"
Write-Host ""
Write-Host "Run ``npm audit`` for details."
