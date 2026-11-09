package com.hugo.streamplus;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Base64;
import android.view.MotionEvent;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import io.nayuki.qrcodegen.QrCode;

/** window.Native in the web UI: HTTP without CORS, QR codes, the floating player, taps. */
final class Bridge {
    private static final ExecutorService NET = Executors.newFixedThreadPool(6);
    private final Activity a;
    private final WebView w;

    Bridge(Activity a, WebView w) {
        this.a = a;
        this.w = w;
    }

    /** Async HTTP; answers with window.__nativeCb(id, status, base64Body). */
    @JavascriptInterface
    public void http(final int id, final String method, final String url, final String headers, final String body) {
        NET.execute(() -> {
            int code;
            byte[] out;
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(10000);
                c.setReadTimeout(15000);
                c.setRequestMethod(method);
                if (headers != null && !headers.isEmpty()) {
                    JSONObject h = new JSONObject(headers);
                    for (Iterator<String> it = h.keys(); it.hasNext(); ) {
                        String k = it.next();
                        c.setRequestProperty(k, h.getString(k));
                    }
                }
                if (body != null && !body.isEmpty()) {
                    c.setDoOutput(true);
                    try (OutputStream os = c.getOutputStream()) {
                        os.write(body.getBytes(StandardCharsets.UTF_8));
                    }
                }
                code = c.getResponseCode();
                InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
                out = in == null ? new byte[0] : readAll(in);
                c.disconnect();
            } catch (Exception e) {
                code = 0;
                out = String.valueOf(e).getBytes(StandardCharsets.UTF_8);
            }
            final String js = "window.__nativeCb(" + id + "," + code + ",'" + Base64.encodeToString(out, Base64.NO_WRAP) + "')";
            w.post(() -> w.evaluateJavascript(js, null));
        });
    }

    static byte[] readAll(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
        in.close();
        return bo.toByteArray();
    }

    /** QR code as a PNG data URL (white quiet zone). */
    @JavascriptInterface
    public String qr(String text) {
        QrCode q = QrCode.encodeText(text, QrCode.Ecc.MEDIUM);
        int border = 2, scale = 10, n = (q.size + border * 2);
        Bitmap b = Bitmap.createBitmap(n * scale, n * scale, Bitmap.Config.ARGB_8888);
        for (int y = 0; y < n * scale; y++) {
            for (int x = 0; x < n * scale; x++) {
                boolean on = q.getModule(x / scale - border, y / scale - border);
                b.setPixel(x, y, on ? 0xFF0E0E10 : 0xFFFFFFFF);
            }
        }
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        b.compress(Bitmap.CompressFormat.PNG, 100, bo);
        return "data:image/png;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
    }

    // ---- Floating player (PiP) ----

    @JavascriptInterface
    public boolean canOverlay() {
        return Settings.canDrawOverlays(a);
    }

    @JavascriptInterface
    public void requestOverlay() {
        a.runOnUiThread(() -> {
            try {
                a.startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + a.getPackageName())));
            } catch (Exception e) {
                Toast.makeText(a, "Autorise l'overlay avec adb : appops set " + a.getPackageName() + " SYSTEM_ALERT_WINDOW allow", Toast.LENGTH_LONG).show();
            }
        });
    }

    /** json: {channel|video, time, title, volume, muted, login, avatar} ; goHome: leave the app afterwards. */
    @JavascriptInterface
    public boolean startPip(String json, boolean goHome) {
        if (!Settings.canDrawOverlays(a)) return false;
        Intent i = new Intent(a, PipService.class).putExtra("json", json);
        a.startForegroundService(i);
        if (goHome) a.runOnUiThread(this::goHome);
        return true;
    }

    @JavascriptInterface
    public String pipState() {
        PipService s = PipService.inst;
        return s == null ? "null" : s.state().toString();
    }

    @JavascriptInterface
    public void pipCmd(final String cmd, final String arg) {
        a.runOnUiThread(() -> {
            PipService s = PipService.inst;
            if (s != null) s.command(cmd, arg);
        });
    }

    @JavascriptInterface
    public void openPipPanel() {
        a.runOnUiThread(() -> a.startActivity(new Intent(a, PipControlActivity.class)));
    }

    // ---- Player sign-in (twitch.tv cookies) ----

    @JavascriptInterface
    public boolean playerSignedIn() {
        return LoginActivity.signedIn();
    }

    @JavascriptInterface
    public void playerSignIn() {
        a.runOnUiThread(() -> a.startActivity(new Intent(a, LoginActivity.class)));
    }

    @JavascriptInterface
    public String playerSession() {
        return LoginActivity.exportSession();
    }

    @JavascriptInterface
    public void setPlayerSession(String json) {
        LoginActivity.importSession(json);
    }

    /** Opens a twitch.tv page (only twitch.tv) in the app, signed in with the player session. */
    @JavascriptInterface
    public void openTwitch(final String url) {
        if (url == null || !url.startsWith("https://www.twitch.tv/")) return;
        a.runOnUiThread(() -> a.startActivity(new Intent(a, LoginActivity.class).putExtra("url", url)));
    }

    @JavascriptInterface
    public void playerSignOut() {
        a.runOnUiThread(LoginActivity::signOut);
    }

    /** The web UI says whether the focused item has a long-press menu (see MainActivity). */
    @JavascriptInterface
    public void setOkMode(boolean on) {
        if (a instanceof MainActivity) ((MainActivity) a).okMode = on;
    }

    /** Low-latency mode of Twitch's player for lives (applies to players created afterwards). */
    @JavascriptInterface
    public void setLowLatency(boolean on) {
        Web.lowLatency = on;
    }

    /** The app's name (Stream+, or what a personal build calls it). */
    @JavascriptInterface
    public String appName() {
        return a.getString(R.string.app_name);
    }

    // ---- Remote button for the PiP menu (PipKeyService) ----

    /** {key, name, enabled}: the chosen button and whether its accessibility service is on. */
    @JavascriptInterface
    public String pipKey() {
        int k = PipKeyService.key(a);
        JSONObject o = new JSONObject();
        try {
            o.put("key", k);
            o.put("name", k == 0 ? "" : android.view.KeyEvent.keyCodeToString(k).replace("KEYCODE_", ""));
            o.put("enabled", PipKeyService.enabled(a));
        } catch (Exception ignored) { }
        return o.toString();
    }

    /** The next button pressed on the remote becomes the PiP menu key (answer: app.keyLearned). */
    @JavascriptInterface
    public void learnPipKey() {
        if (a instanceof MainActivity) ((MainActivity) a).learningKey = true;
    }

    @JavascriptInterface
    public void clearPipKey() {
        PipKeyService.prefs(a).edit().remove("key").commit();
        PipKeyService.sync(a);
    }

    /** Android's accessibility settings, where the user turns the service on. */
    @JavascriptInterface
    public void openAccessibility() {
        a.runOnUiThread(() -> {
            try {
                a.startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
            } catch (Exception e) {
                a.startActivity(new Intent(Settings.ACTION_SETTINGS));
            }
        });
    }

    // ---- Encrypted storage (tokens, twitch.tv session) ----
    private static final String KEY = "streamplus.store";
    private static javax.crypto.SecretKey secret;

    /** AES-256 key kept in the Android Keystore (it cannot be read out of the TV). */
    private static synchronized javax.crypto.SecretKey key() throws Exception {
        if (secret != null) return secret;
        java.security.KeyStore ks = java.security.KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (!ks.containsAlias(KEY)) {
            javax.crypto.KeyGenerator g = javax.crypto.KeyGenerator.getInstance(android.security.keystore.KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            g.init(new android.security.keystore.KeyGenParameterSpec.Builder(KEY,
                    android.security.keystore.KeyProperties.PURPOSE_ENCRYPT | android.security.keystore.KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256).build());
            g.generateKey();
        }
        secret = (javax.crypto.SecretKey) ks.getKey(KEY, null);
        return secret;
    }

    /** "sp1:<iv>:<data>" (AES-GCM), or null if encryption is unavailable. */
    @JavascriptInterface
    public String seal(String plain) {
        try {
            javax.crypto.Cipher c = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
            c.init(javax.crypto.Cipher.ENCRYPT_MODE, key());
            byte[] out = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            return "sp1:" + Base64.encodeToString(c.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(out, Base64.NO_WRAP);
        } catch (Exception e) {
            return null;
        }
    }

    @JavascriptInterface
    public String unseal(String sealed) {
        try {
            String[] p = sealed.split(":");
            javax.crypto.Cipher c = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
            c.init(javax.crypto.Cipher.DECRYPT_MODE, key(), new javax.crypto.spec.GCMParameterSpec(128, Base64.decode(p[1], Base64.NO_WRAP)));
            return new String(c.doFinal(Base64.decode(p[2], Base64.NO_WRAP)), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    // ---- Misc ----

    @JavascriptInterface
    public void goHome() {
        a.runOnUiThread(() -> {
            Intent h = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            a.startActivity(h);
        });
    }

    /** Synthesised tap at a fraction of the page: reaches into the embed (mature-content gate, etc.). */
    @JavascriptInterface
    public void tap(final float fx, final float fy) {
        w.post(() -> {
            float x = fx * w.getWidth(), y = fy * w.getHeight();
            long t = SystemClock.uptimeMillis();
            MotionEvent d = MotionEvent.obtain(t, t, MotionEvent.ACTION_DOWN, x, y, 0);
            d.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);
            w.dispatchTouchEvent(d);
            d.recycle();
            w.postDelayed(() -> {
                long t2 = SystemClock.uptimeMillis();
                MotionEvent u = MotionEvent.obtain(t, t2, MotionEvent.ACTION_UP, x, y, 0);
                u.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);
                w.dispatchTouchEvent(u);
                u.recycle();
                w.requestFocus();
            }, 60);
        });
    }

    @JavascriptInterface
    public void keepOn(final boolean on) {
        a.runOnUiThread(() -> {
            if (on) a.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else a.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
    }

    @JavascriptInterface
    public void toast(final String s) {
        a.runOnUiThread(() -> Toast.makeText(a, s, Toast.LENGTH_SHORT).show());
    }

    @JavascriptInterface
    public void exit() {
        a.runOnUiThread(a::finish);
    }

    @JavascriptInterface
    public String version() {
        try {
            return a.getPackageManager().getPackageInfo(a.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "?";
        }
    }
}
