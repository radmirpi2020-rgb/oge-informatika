# deploy-github.ps1 - publishes the site to GitHub and turns on GitHub Pages.
#
# Steps:
#   1. checks that keys, .env and heavy archives are git-ignored;
#   2. builds the deploy/ folder (only files the site needs);
#   3. creates the GitHub repository if it does not exist;
#   4. pushes: branch main - sources, branch gh-pages - built site;
#   5. enables Pages on gh-pages and prints the site address.
#
# Run (credentials are taken from GH_LOGIN / GH_TOKEN, so they never appear
# in the command text or in the shell history):
#
#   $env:GH_LOGIN = "your-login"
#   $env:GH_TOKEN = "ghp_..."
#   powershell -File tools/deploy-github.ps1
#
# Without those variables the script asks for login and token interactively.
# Token needs the "repo" scope (create repository, push).

param(
  [string]$Repo = "oge-informatika",
  [string]$Branch = "gh-pages",
  [string]$Login = "",
  [string]$Token = "",
  [switch]$SkipPages
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

function Say($text, $color = "White") { Write-Host $text -ForegroundColor $color }

# git пишет часть сообщений в stderr, а PowerShell 5.1 при ErrorActionPreference=Stop
# принимает это за ошибку. Этот помощник глушит такое поведение вокруг вызовов git.
function RunGit {
  param([scriptblock]$Block)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { & $Block } finally { $ErrorActionPreference = $prev }
}

# ---------- 1. credentials ----------
if (-not $Login) { $Login = $env:GH_LOGIN }
if (-not $Token) { $Token = $env:GH_TOKEN }
if (-not $Login) { $Login = Read-Host "GitHub login" }
if (-not $Token) {
  $sec = Read-Host "GitHub token (hidden)" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  $Token = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  $sec = $null
}
if (-not $Login -or -not $Token) { Say "Login and token are required." "Red"; exit 1 }

function Api($method, $path, $body) {
  $uri = "https://api.github.com$path"
  $headers = @{
    Authorization = "token $Token"
    Accept = "application/vnd.github+json"
    "User-Agent" = "oge-deploy"
  }
  if ($body) {
    $json = $body | ConvertTo-Json -Depth 6
    return Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Body $json -ContentType "application/json"
  }
  return Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
}

# ---------- 2. safety checks ----------
Say "`n1/5 Checking that secrets are not going public" "Cyan"

$mustIgnore = @(
  "config/deepseek-key.local.js",
  "server/.env",
  "server/node_modules",
  "_research/fipi/inf_9_2026.zip"
)
$bad = @()
foreach ($p in $mustIgnore) {
  if (Test-Path $p) {
    git check-ignore -q $p
    if ($LASTEXITCODE -ne 0) { $bad += $p }
  }
}
if ($bad.Count) {
  Say "These files are not git-ignored, refusing to publish:" "Red"
  $bad | ForEach-Object { Say "  - $_" "Red" }
  Say "Add them to .gitignore and run again." "Red"
  exit 1
}
Say "  ok  keys, .env and heavy archives are ignored" "Green"

$tpl = "config/deepseek-key.js"
if (Test-Path $tpl) {
  $content = Get-Content $tpl -Raw
  if ($content -match "sk-[A-Za-z0-9_\-]{20,}") {
    Say "config/deepseek-key.js contains a live key - anyone could read it via F12." "Red"
    Say "Move the key to config/deepseek-key.local.js (it is not published)." "Red"
    exit 1
  }
  Say "  ok  the template file has no live key" "Green"
}

# ---------- 3. build deploy folder ----------
Say "`n2/5 Building deploy/ (site files only)" "Cyan"

$deployDir = Join-Path $root "deploy"
if (Test-Path $deployDir) { Remove-Item $deployDir -Recurse -Force }

$include = @(
  "index.html", "manifest.webmanifest",
  "assets", "data", "scripts", "styles",
  "config/deepseek-key.js", "config/api.js"
)
foreach ($item in $include) {
  $src = Join-Path $root $item
  if (-not (Test-Path $src)) { Say "  skip (missing): $item" "Yellow"; continue }
  $dst = Join-Path $deployDir $item
  New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
  if ((Get-Item $src).PSIsContainer) { Copy-Item $src $dst -Recurse -Force }
  else { Copy-Item $src $dst -Force }
}

# a live key must never reach the public build: server-side proxy comes later
$localKey = Join-Path $deployDir "config/deepseek-key.local.js"
if (Test-Path $localKey) { Remove-Item $localKey -Force }

# GitHub Pages does not run Jekyll for us, and needs a 404 page
New-Item -ItemType File -Force -Path (Join-Path $deployDir ".nojekyll") | Out-Null
Copy-Item (Join-Path $root "index.html") (Join-Path $deployDir "404.html") -Force

$size = [math]::Round((Get-ChildItem $deployDir -Recurse -File | Measure-Object Length -Sum).Sum / 1MB, 1)
$files = (Get-ChildItem $deployDir -Recurse -File | Measure-Object).Count
Say ("  ok  {0} files, {1} MB" -f $files, $size) "Green"

# ---------- 4. repository and push ----------
Say "`n3/5 Checking the GitHub repository" "Cyan"

$me = Api "GET" "/user"
Say ("  signed in as: " + $me.login) "Green"

$exists = $false
try { Api "GET" "/repos/$Login/$Repo" | Out-Null; $exists = $true } catch { $exists = $false }

if (-not $exists) {
  Say "  creating repository $Login/$Repo"
  Api "POST" "/user/repos" @{
    name = $Repo
    description = "Informatika 5-9 class and OGE preparation: lessons, practice, AI tutor"
    private = $false
    has_issues = $true
    has_wiki = $false
  } | Out-Null
  Say "  ok  repository created" "Green"
} else {
  Say "  ok  repository exists, updating it" "Green"
}

Say "`n4/5 Pushing sources (main) and site ($Branch)" "Cyan"

$auth = "https://{0}:{1}@github.com/{2}/{3}.git" -f $Login, $Token, $Login, $Repo
$clean = "https://github.com/{0}/{1}.git" -f $Login, $Repo

$existingRemote = RunGit { git remote get-url origin 2>$null }
if ($existingRemote) { RunGit { git remote set-url origin $auth } } else { RunGit { git remote add origin $auth } }

RunGit { git add -A } | Out-Null
$dirty = RunGit { git status --porcelain }
if ($dirty) {
  RunGit { git -c core.quotepath=false commit -q -m "Deploy: site and server" }
  Say "  committed local changes"
} else {
  Say "  nothing new to commit"
}

RunGit { git branch -M main }
RunGit { git push -q -u origin main }
Say "  ok  main pushed" "Green"

Push-Location $deployDir
try {
  RunGit { git init -q }
  RunGit { git checkout -q -b $Branch }
  RunGit { git -c user.email="site@localhost" -c user.name="Informatika 5-9" add -A }
  RunGit { git -c user.email="site@localhost" -c user.name="Informatika 5-9" commit -q -m "Site build for GitHub Pages" }
  RunGit { git remote add origin $auth }
  RunGit { git push -q -f origin $Branch }
  Say "  ok  $Branch pushed" "Green"
} finally {
  Pop-Location
}

# ---------- 5. GitHub Pages ----------
$url = "https://$Login.github.io/$Repo/"
if (-not $SkipPages) {
  Say "`n5/5 Turning on GitHub Pages" "Cyan"
  try {
    Api "POST" "/repos/$Login/$Repo/pages" @{
      source = @{ branch = $Branch; path = "/" }
    } | Out-Null
    Say "  ok  Pages enabled on branch $Branch" "Green"
  } catch {
    try {
      Api "PUT" "/repos/$Login/$Repo/pages" @{
        source = @{ branch = $Branch; path = "/" }
      } | Out-Null
      Say "  ok  Pages reconfigured to branch $Branch" "Green"
    } catch {
      Say ("  Pages was not enabled automatically: " + $_.Exception.Message) "Yellow"
      Say "  enable it by hand: Settings - Pages - Source: Deploy from a branch - $Branch" "Yellow"
    }
  }
}

# drop the token from .git/config so it does not stay on disk
RunGit { git remote set-url origin $clean }

Say "`nDone." "Green"
Say "Site: $url" "Cyan"
Say "(the first Pages build takes a minute or two)" "DarkGray"
Say "Revoke the token you used: github.com - Settings - Developer settings - Tokens" "Yellow"
