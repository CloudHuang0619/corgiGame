<#
.SYNOPSIS
    建置 Android 版：先打包網頁、同步進原生專案、再跑 Gradle。

.DESCRIPTION
    這支腳本存在的理由是三件事都很容易漏掉：

    1. `npm run build` 一定要在 `cap sync` 之前跑完，否則同步進去的是上一版的
       網頁資源——改了程式碼卻在 App 裡看不到，最難查的一種錯。
    2. 這台機器需要 JAVA_TOOL_OPTIONS 的變通設定才跑得動 Gradle，原因寫在下面。
    3. JDK 與 Android SDK 是解 zip 裝在使用者目錄的，沒有寫進系統 PATH，
       所以每次都要自己指。

.PARAMETER Task
    Gradle 任務。預設 bundleRelease（產出上架用的 .aab）。
    其他常用：assembleDebug（可直接安裝的 .apk）、assembleRelease（正式版 apk）。

.EXAMPLE
    pwsh scripts/android-build.ps1
    pwsh scripts/android-build.ps1 -Task assembleDebug
#>
param(
    [string]$Task = 'bundleRelease',
    [string]$Toolchain = "$env:USERPROFILE\dev-tools"
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

$jdk = Get-ChildItem $Toolchain -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue |
    Select-Object -First 1
if (-not $jdk) { throw "找不到 JDK 21，預期在 $Toolchain\jdk-21*。安裝方式見 RELEASE.md" }

$env:JAVA_HOME = $jdk.FullName
$env:ANDROID_HOME = Join-Path $Toolchain 'android-sdk'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

<#
    這台機器上不設這一項，每一次 Gradle 建置都會死在
    "Unable to establish loopback connection"。

    JDK 在 Windows 用 AF_UNIX socket 實作 NIO pipe，而 Selector.open() 一定會用到。
    自動綁定的 socket 路徑取自 jdk.net.unixdomain.tmpdir，預設等於 java.io.tmpdir，
    在這台機器上是 C:\Users\CLOUDP~1\AppData\Local\Temp —— 那個 8.3 短檔名路徑
    bind 得起來卻 connect 不了（EINVAL）。換成沒有短檔名、沒有空白的目錄就正常。

    用 JAVA_TOOL_OPTIONS 而不是 GRADLE_OPTS 或 org.gradle.jvmargs，是因為 Gradle
    至少會起三層 JVM（launcher、daemon、編譯器 fork）：GRADLE_OPTS 只到 launcher，
    org.gradle.jvmargs 只到 daemon 而且會被 android/gradle.properties 蓋掉。
    只有 JAVA_TOOL_OPTIONS 三層都吃得到。
#>
$sockTmp = 'C:\jtmp'
New-Item -ItemType Directory -Force -Path $sockTmp | Out-Null
$env:JAVA_TOOL_OPTIONS = "-Djdk.net.unixdomain.tmpdir=$sockTmp"

Push-Location $repo
try {
    Write-Host '==> 打包網頁' -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'npm run build 失敗' }

    Write-Host '==> 同步到原生專案' -ForegroundColor Cyan
    npx cap sync android
    if ($LASTEXITCODE -ne 0) { throw 'cap sync 失敗' }

    Write-Host "==> Gradle $Task" -ForegroundColor Cyan
    $gradlew = Join-Path $repo 'android\gradlew.bat'
    cmd /c "cd /d `"$repo\android`" && `"$gradlew`" $Task"
    if ($LASTEXITCODE -ne 0) { throw "Gradle $Task 失敗" }

    Write-Host '==> 產出' -ForegroundColor Green
    Get-ChildItem "$repo\android\app\build\outputs" -Recurse -Include *.aab, *.apk |
        Select-Object FullName, @{ n = 'MB'; e = { [math]::Round($_.Length / 1MB, 2) } } |
        Format-Table -AutoSize
}
finally {
    Pop-Location
}
