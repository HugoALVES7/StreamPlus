package com.hugo.streamplus;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * Twitch's own sign-in page (www.twitch.tv/login), shown like in a browser. The password is typed
 * into Twitch's page only; this app never reads it. Once Twitch has set its session cookie, the
 * official embed player recognises the account (sub-only VODs, no ads for subs/Turbo).
 */
public class LoginActivity extends Activity {
    static final String SITE = "https://www.twitch.tv";
    private WebView web;
    private final Handler h = new Handler(Looper.getMainLooper());

    public static boolean signedIn() {
        String c = CookieManager.getInstance().getCookie(SITE);
        return c != null && c.contains("auth-token=");
    }

    /** twitch.tv's session cookies (what makes the player know the account). */
    static final String[] SESSION = {"auth-token", "login", "name", "twilight-user", "persistent", "last_login", "api_token"};

    /** Signs the player out: removes only twitch.tv's session cookies. */
    static void signOut() {
        CookieManager cm = CookieManager.getInstance();
        for (String name : SESSION) {
            cm.setCookie(SITE, name + "=; Max-Age=0; Path=/; Domain=.twitch.tv");
            cm.setCookie(SITE, name + "=; Max-Age=0; Path=/");
        }
        cm.flush();
    }

    /** The current twitch.tv session as JSON {name: value}, to keep it with a profile. */
    public static String exportSession() {
        org.json.JSONObject o = new org.json.JSONObject();
        String all = CookieManager.getInstance().getCookie(SITE);
        if (all != null) {
            for (String kv : all.split(";\\s*")) {
                int i = kv.indexOf('=');
                if (i < 1) continue;
                String n = kv.substring(0, i).trim();
                for (String s : SESSION) {
                    if (s.equals(n)) {
                        try { o.put(n, kv.substring(i + 1)); } catch (Exception ignored) { }
                    }
                }
            }
        }
        return o.toString();
    }

    /** Replaces the twitch.tv session with a profile's saved one (or none). */
    static void importSession(String json) {
        signOut();
        CookieManager cm = CookieManager.getInstance();
        try {
            org.json.JSONObject o = new org.json.JSONObject(json == null || json.isEmpty() ? "{}" : json);
            for (java.util.Iterator<String> it = o.keys(); it.hasNext(); ) {
                String n = it.next();
                cm.setCookie(SITE, n + "=" + o.getString(n) + "; Domain=.twitch.tv; Path=/; Max-Age=31536000; Secure"
                        + (n.equals("auth-token") ? "; HttpOnly" : ""));
            }
        } catch (Exception ignored) { }
        cm.flush();
    }

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        web = new WebView(this);
        Web.setup(web);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String host = r.getUrl().getHost();
                // Stay on Twitch's own pages.
                return host == null || !(host.equals("twitch.tv") || host.endsWith(".twitch.tv"));
            }

            @Override public void onPageFinished(WebView v, String url) {
                check();
            }
        });
        String page = getIntent().getStringExtra("url");
        browse = page != null;
        setContentView(web);
        web.loadUrl(page != null ? page : SITE + "/login");
        if (!browse) h.postDelayed(poll, 1500);
        web.requestFocus();
    }

    private final Runnable poll = new Runnable() {
        @Override public void run() {
            if (!check()) h.postDelayed(this, 1500);
        }
    };

    /** Showing a twitch.tv page: never closes on its own. */
    private boolean browse;

    private boolean check() {
        if (browse || isFinishing() || !signedIn()) return false;
        CookieManager.getInstance().flush();
        Toast.makeText(this, "Lecteur connecté à ton compte Twitch", Toast.LENGTH_LONG).show();
        setResult(RESULT_OK);
        finish();
        return true;
    }

    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        h.removeCallbacks(poll);
        web.destroy();
        super.onDestroy();
    }
}
