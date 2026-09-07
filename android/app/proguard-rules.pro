# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ---------------------------------------------------------------------------
# Google Mobile Ads / AdMob
#
# SDK 內部大量用反射載入轉接器與廣告格式的類別，R8 看不出這些類別有被用到，
# 會把它們當成無用程式碼清掉。症狀很難查：debug 版廣告正常，release 版
# 不報錯也不當掉，就只是永遠載不到廣告。
# ---------------------------------------------------------------------------
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.ads.** { *; }
-dontwarn com.google.android.gms.ads.**

# Capacitor 的 plugin 是靠註解與反射掛起來的，方法名稱不能被改
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class com.getcapacitor.** { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public <methods>;
}

# JS 橋接呼叫的方法同理，被改名就叫不到
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
