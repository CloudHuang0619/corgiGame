# Android 上架

從原始碼到 Google Play。廣告串接的說明在 [README 的「廣告」一節](README.md#廣告)。

## 目前狀態

| 項目 | 狀態 |
| --- | --- |
| Capacitor 原生殼 | ✅ `android/` 已建立 |
| AdMob 三個版位 | ✅ 已接（橫幅／插頁／獎勵式） |
| Debug APK | ✅ 建得出來（11.7 MB） |
| Release AAB | ✅ 建得出來（8.28 MB，**未簽章**） |
| 上傳金鑰 | ❌ 尚未產生 —— 必須由你本人做，見下方 |
| 正式 AdMob ID | ❌ 目前全是 Google 測試單元 |
| Play Console 帳號 | ❌ 需自行申請（一次性 25 美元） |
| 商店素材、隱私權政策 | ❌ 未準備 |

## 建置環境

JDK 與 Android SDK 是**解 zip 裝在 `%USERPROFILE%\dev-tools\`** 的，沒有寫進系統
PATH，也沒有裝 Android Studio。用 MSI／winget 裝 JDK 會跳 UAC，自動化流程按不到那個
對話框，所以走免安裝的 zip。

| 元件 | 位置 |
| --- | --- |
| Microsoft OpenJDK 21 | `%USERPROFILE%\dev-tools\jdk-21.0.12+8` |
| Android SDK | `%USERPROFILE%\dev-tools\android-sdk` |
| SDK 元件 | `platform-tools`、`platforms;android-35`、`build-tools;35.0.0` |

`android/local.properties` 指向上面的 SDK，該檔案是機器專屬的、不進版控。

### 為什麼一定要透過腳本建置

直接跑 `gradlew` 在這台機器上**必定失敗**：

```
java.io.IOException: Unable to establish loopback connection
Caused by: java.net.SocketException: Invalid argument: connect
```

JDK 在 Windows 用 AF_UNIX socket 實作 NIO pipe，`Selector.open()` 一定會走到。自動綁定
的 socket 路徑取自 `jdk.net.unixdomain.tmpdir`，預設等於 `java.io.tmpdir`，在這台機器上
是 `C:\Users\CLOUDP~1\AppData\Local\Temp`——那個 8.3 短檔名路徑 bind 得起來卻 connect
不了。JDK 17 一樣中招，`WEPollSelectorImpl` 把 AF_UNIX 寫死，沒有退回 TCP 的路徑。

修正是設 `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:\jtmp`。用這個環境變數而不是
`GRADLE_OPTS` 或 `org.gradle.jvmargs`，是因為 Gradle 至少會起三層 JVM，前兩者各自只涵蓋
一層，而且 `android/gradle.properties` 會蓋掉使用者層級的設定。

`scripts/android-build.ps1` 把這些都包好了：

```bash
pwsh scripts/android-build.ps1
```

`-Task assembleDebug` 可以改成產出可直接安裝的 APK。

## 一、產生上傳金鑰（你本人做）

**這一步我不能代做**：金鑰密碼是憑證，而且這把金鑰決定了你的 App 身分——弄丟就再也
不能更新，只能用新的套件名稱重新上架。密碼請自己想、自己保管。

```bash
"$env:USERPROFILE\dev-tools\jdk-21.0.12+8\bin\keytool.exe" -genkeypair -v -keystore corgidoku-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias corgidoku
```

會問你密碼與姓名／組織。產生後：

1. 把 `corgidoku-upload.jks` 放到**專案外面**的安全位置，另外備份一份。
2. 在 `android/keystore.properties` 寫入（此檔已在 `.gitignore`）：

```properties
storeFile=C:/path/to/corgidoku-upload.jks
storePassword=你的密碼
keyAlias=corgidoku
keyPassword=你的密碼
```

放好之後 `bundleRelease` 就會自動簽章——`android/app/build.gradle` 讀不到這個檔案時
只是產出未簽章的 AAB，不會讓建置失敗。

## 二、換掉測試廣告 ID

現在全部是 Google 官方測試單元，會出假廣告、沒有收益。**上架前一定要換**，但開發時
請維持測試 ID：拿真 ID 點自己的廣告會被 Google 判為無效流量，帳號可能被停。

1. 到 [AdMob](https://apps.admob.com) 建立應用程式（Android），拿到 App ID
   （格式 `ca-app-pub-XXXX~YYYY`，**波浪號**）。
2. 建立三個廣告單元：橫幅、插頁、獎勵式，各拿一組 ID（格式 `.../YYYY`，**斜線**）。
   兩種 ID 長得很像，填錯 App ID 會讓 App 一啟動就當掉。
3. App ID 填進 [`android/app/src/main/AndroidManifest.xml`](android/app/src/main/AndroidManifest.xml)
   的 `com.google.android.gms.ads.APPLICATION_ID`。
4. 三個單元 ID 複製 `.env.example` 成 `.env.production` 後填入。

## 三、Play Console（你本人做）

1. 申請開發者帳號（25 美元，需要身分驗證，可能要等幾天）。
2. 建立應用程式，套件名稱 `com.corgidoku.app`——**這個之後改不了**。
3. 填寫必要項目：
   - **資料安全**：本 App 透過 AdMob 收集**廣告 ID**，要據實勾選。
     `AndroidManifest.xml` 裡已宣告 `com.google.android.gms.permission.AD_ID`。
   - **隱私權政策**：有廣告就是必填，要有可公開存取的網址。
   - **廣告聲明**：勾「是，本應用程式含有廣告」。
   - **內容分級**問卷、目標對象與內容。
   - 商店素材：應用程式圖示 512×512、主題圖片 1024×500、至少 2 張螢幕截圖。
4. 上傳 `android/app/build/outputs/bundle/release/app-release.aab`。
5. 先發到**內部測試**軌道，用真機裝起來確認三個版位都會出廣告，再送正式審查。

## 四、更新版本

每次上傳都要提高 `versionCode`，`versionName` 是給人看的：

```gradle
// android/app/build.gradle
versionCode 2
versionName "1.0.1"
```

## 待辦

- [ ] 應用程式圖示還是 Capacitor 的預設圖，要換成柯基。
- [ ] `app-ads.txt`：有官網的話應該放一份，可以擋掉冒用你 App 名義的假流量。
- [ ] iOS 版：`npx cap add ios` 需要 macOS 與 Xcode，`src/ads/units.ts` 已經備好 iOS 的 ID 分支。
