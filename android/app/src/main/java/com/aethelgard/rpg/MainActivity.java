package com.aethelgard.rpg;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * Aethelgard RPG for Android: the same game as the Telegram Mini App, opened in a WebView.
 * Telegram signs the player's login (init data); the app gets it once from the game in Telegram
 * (aethelgard://login?d=...) and passes it to the page the same way Telegram does (#tgWebAppData=...).
 */
public class MainActivity extends Activity {
    static final String GAME_HOST = "app8958621621.tgcloud.ai";
    static final String GAME_URL = "https://" + GAME_HOST + "/";
    static final String PREFS = "aethelgard";
    private WebView web;
    private long lastBack = 0;
    private boolean fullscreen = true;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#0b0f0d"));
        w.setNavigationBarColor(Color.parseColor("#0b0f0d"));
        fullscreen = prefs().getBoolean("fullscreen", true);
        applyFullscreen();

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0b0f0d"));
        setContentView(web);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true); // the built-in login screen (file:///android_asset/login.html)
        s.setLoadWithOverviewMode(false); // the game scales itself (viewport tag); overview mode left a gap at the bottom
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setUserAgentString(s.getUserAgentString() + " AethelgardApk/" + BuildConfigVersion.name(this));
        CookieManager.getInstance().setAcceptCookie(true);
        web.addJavascriptInterface(new Bridge(), "AethApk");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request.getUrl());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                // window.open / Telegram.WebApp.openLink: open in the browser or in Telegram
                WebView.HitTestResult r = view.getHitTestResult();
                String url = r != null ? r.getExtra() : null;
                if (url != null) { openExternal(url); return false; }
                WebView tmp = new WebView(MainActivity.this);
                tmp.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) { openExternal(req.getUrl().toString()); v.destroy(); return true; }
                });
                ((WebView.WebViewTransport) resultMsg.obj).setWebView(tmp);
                resultMsg.sendToTarget();
                return true;
            }
        });

        Alarms.createChannel(this);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);

        if (!takeLogin(getIntent())) openStart();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (takeLogin(intent)) return;
        if (intent != null && intent.getBooleanExtra("fromNotification", false) && web.getUrl() == null) openStart();
    }

    /** aethelgard://login?d=<init data> from the game in Telegram */
    private boolean takeLogin(Intent intent) {
        Uri data = intent != null ? intent.getData() : null;
        if (data == null || !"aethelgard".equals(data.getScheme())) return false;
        String d = data.getQueryParameter("d");
        if (d == null || !d.contains("hash=")) { Toast.makeText(this, "Ссылка входа повреждена. Попробуйте ещё раз из игры в Telegram.", Toast.LENGTH_LONG).show(); openStart(); return true; }
        prefs().edit().putString("initData", d).putLong("linkedAt", System.currentTimeMillis()).apply();
        Toast.makeText(this, "Приложение подключено к вашему герою!", Toast.LENGTH_SHORT).show();
        openGame();
        return true;
    }

    private void openStart() {
        if (prefs().getString("initData", null) != null) openGame();
        else web.loadUrl("file:///android_asset/login.html");
    }

    private void openGame() {
        String d = prefs().getString("initData", "");
        String hash = "tgWebAppData=" + Uri.encode(d) + "&tgWebAppVersion=8.0&tgWebAppPlatform=android"
                + "&tgWebAppThemeParams=" + Uri.encode("{\"bg_color\":\"#0b0f0d\",\"text_color\":\"#f1ead8\",\"button_color\":\"#c99a3c\",\"button_text_color\":\"#1d1408\",\"secondary_bg_color\":\"#141a17\"}");
        web.loadUrl(GAME_URL + "?apk=" + BuildConfigVersion.code(this) + "#" + hash);
    }

    private boolean handleUrl(Uri uri) {
        String scheme = uri.getScheme();
        if ("aethelgard".equals(scheme)) { takeLogin(new Intent(Intent.ACTION_VIEW, uri)); return true; }
        if (("https".equals(scheme) || "http".equals(scheme)) && GAME_HOST.equals(uri.getHost())) return false;
        if ("file".equals(scheme)) return false;
        openExternal(uri.toString());
        return true;
    }

    void openExternal(String url) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Не найдено приложение для ссылки", Toast.LENGTH_SHORT).show();
        }
    }

    private void applyFullscreen() {
        View decor = getWindow().getDecorView();
        if (fullscreen) decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        else decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        // the page measures its height on resize: tell it once the bars have actually moved
        if (web != null) for (int ms : new int[]{120, 450}) web.postDelayed(() -> web.evaluateJavascript("window.dispatchEvent(new Event('resize'))", null), ms);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyFullscreen();
    }

    @Override
    public void onBackPressed() {
        // first let the game close its open window; a second press within 2 s leaves the app
        web.evaluateJavascript("(function(){var p=document.querySelector('.ae-backdrop .ae-x, .game-dialog-backdrop button[aria-label=\"Закрыть\"]');if(p){p.click();return 'closed';}"
                + "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return '';})()", value -> {
            if (value != null && value.contains("closed")) return;
            if (web.canGoBack() && web.getUrl() != null && !web.getUrl().contains(GAME_HOST)) { web.goBack(); return; }
            long now = System.currentTimeMillis();
            if (now - lastBack < 2000) finish();
            else { lastBack = now; Toast.makeText(this, "Нажмите «Назад» ещё раз, чтобы выйти", Toast.LENGTH_SHORT).show(); }
        });
    }

    @Override
    protected void onResume() { super.onResume(); if (web != null) { web.onResume(); web.evaluateJavascript("window.dispatchEvent(new Event('aeth-apk-resume'))", null); } }

    @Override
    protected void onPause() { if (web != null) web.onPause(); super.onPause(); }

    SharedPreferences prefs() { return getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    /** window.AethApk — what the game can ask from the phone */
    class Bridge {
        @JavascriptInterface public int version() { return BuildConfigVersion.code(MainActivity.this); }
        @JavascriptInterface public String versionName() { return BuildConfigVersion.name(MainActivity.this); }
        @JavascriptInterface public boolean linked() { return prefs().getString("initData", null) != null; }
        @JavascriptInterface public void saveLogin(String initData) {
            if (initData == null || !initData.contains("hash=")) return;
            prefs().edit().putString("initData", initData).putLong("linkedAt", System.currentTimeMillis()).apply();
            runOnUiThread(MainActivity.this::openGame);
        }
        @JavascriptInterface public void logout() {
            prefs().edit().remove("initData").apply();
            Alarms.cancelAll(MainActivity.this);
            runOnUiThread(() -> web.loadUrl("file:///android_asset/login.html"));
        }
        @JavascriptInterface public void schedule(int id, double atMs, String title, String text) { Alarms.schedule(MainActivity.this, id, (long) atMs, title, text); }
        @JavascriptInterface public void cancel(int id) { Alarms.cancel(MainActivity.this, id); }
        @JavascriptInterface public void vibrate(int ms) {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !prefs().getBoolean("vibrate", true)) return;
            int d = Math.max(5, Math.min(400, ms));
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(d, VibrationEffect.DEFAULT_AMPLITUDE)); else v.vibrate(d);
        }
        @JavascriptInterface public void setPref(String key, boolean on) {
            prefs().edit().putBoolean(key, on).apply();
            if ("fullscreen".equals(key)) runOnUiThread(() -> { fullscreen = on; applyFullscreen(); });
        }
        @JavascriptInterface public boolean getPref(String key, boolean def) { return prefs().getBoolean(key, def); }
        @JavascriptInterface public void keepAwake(boolean on) {
            runOnUiThread(() -> { if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); });
        }
        @JavascriptInterface public void share(String text) {
            Intent i = new Intent(Intent.ACTION_SEND); i.setType("text/plain"); i.putExtra(Intent.EXTRA_TEXT, text);
            Intent c = Intent.createChooser(i, "Поделиться"); c.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(c);
        }
        @JavascriptInterface public void copy(String text) {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Aethelgard", text));
        }
        @JavascriptInterface public String paste() {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm == null || !cm.hasPrimaryClip() || cm.getPrimaryClip().getItemCount() == 0) return "";
            CharSequence t = cm.getPrimaryClip().getItemAt(0).coerceToText(MainActivity.this);
            return t == null ? "" : t.toString();
        }
        @JavascriptInterface public void openExternal(String url) { MainActivity.this.openExternal(url); }
        @JavascriptInterface public void reload() { runOnUiThread(MainActivity.this::openStart); }
    }
}
