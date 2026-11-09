package com.hugo.streamplus;

import android.annotation.SuppressLint;
import android.content.Context;
import android.net.Uri;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * The UI is a web app in assets/web, served from a secure origin of our own
 * (https://appassets.androidplatform.net, never hits the network) so that Twitch's official embed
 * player accepts it as its "parent" domain.
 */
final class Web {
    static final String HOST = "appassets.androidplatform.net";
    static final String ORIGIN = "https://" + HOST;

    private Web() { }

    @SuppressLint("SetJavaScriptEnabled")
    static void setup(WebView w) {
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // The embed player treats Android WebViews like any Chrome; drop the "; wv" marker.
        s.setUserAgentString(s.getUserAgentString().replace("; wv", ""));
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(w, true);
        w.setBackgroundColor(0xFF000000);
        w.setFocusable(true);
        w.setFocusableInTouchMode(true);
        w.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return intercept(v.getContext(), r);
            }

            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                // Only our own pages in the top frame; links inside embeds stay in their iframe.
                return r.isForMainFrame() && !HOST.equals(r.getUrl().getHost());
            }
        });
    }

    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html");
        MIME.put("js", "application/javascript");
        MIME.put("css", "text/css");
        MIME.put("json", "application/json");
        MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("ttf", "font/ttf");
    }

    /** Every request of our WebViews: our assets, Twitch's VOD player page (speed hook), else network. */
    static WebResourceResponse intercept(Context c, WebResourceRequest r) {
        Uri u = r.getUrl();
        if ("player.twitch.tv".equals(u.getHost()) && !r.isForMainFrame() && "GET".equals(r.getMethod())
                && (u.getPath() == null || u.getPath().equals("/") || u.getPath().isEmpty())
                && (u.getQueryParameter("video") != null || u.getQueryParameter("channel") != null)) {
            WebResourceResponse p = vodPlayer(c, r);
            if (p != null) return p;
        }
        return asset(c, u);
    }

    /**
     * Twitch's VOD player page, fetched like the WebView would (same headers and cookies), with one
     * small script added: it sets the video's playback speed when the app asks (postMessage).
     * The player itself offers speeds on twitch.tv; the embed API just doesn't expose them.
     */
    /** Low-latency mode for lives (Twitch's player reads it from its own storage at start). */
    static volatile boolean lowLatency = true;

    private static String hook(Context ctx) {
        return "<script>(function(){"
            + "try{localStorage.setItem('lowLatencyModeEnabled','" + lowLatency + "');}catch(e){}"
            + "var r=1;function a(){var v=document.querySelectorAll('video');"
            + "for(var i=0;i<v.length;i++){if(v[i].playbackRate!==r)v[i].playbackRate=r;}}"
            + "function q(t){return document.querySelector('[data-a-target=\"'+t+'\"]');}"
            // Twitch's "mature content" gate: reported to the app, which asks the viewer; never accepted on its own
            + "function gateBtn(){var b=q('content-classification-gate-overlay-start-watching-button')||q('player-overlay-mature-accept');"
            + "if(b)return b;return [].filter.call(document.querySelectorAll('button'),function(x){return /commencer . regarder|start watching/i.test(x.textContent||'');})[0];}"
            + "var gs=0;setInterval(function(){var b=gateBtn();if(b&&!gs){gs=1;parent.postMessage({streamPlusGate:1},'*');}if(!b)gs=0;},1000);"
            + "addEventListener('message',function(e){var d=e.data;if(!d)return;"
            // speed (VODs)
            + "if(d.streamPlusRate){r=+d.streamPlusRate;a();}"
            + "if(d.streamPlusGateAccept){var g=gateBtn();if(g)g.click();}"
            + "});"
            // Twitch's notice about muted parts (copyright) is closed as soon as it shows
            + "setInterval(function(){var b=[].filter.call(document.querySelectorAll('button[aria-label]'),function(x){var l=x.getAttribute('aria-label');"
            + "return /son coup|muted|audio/i.test(l)&&/rejet|dismiss|ferm|close/i.test(l);})[0];if(b)b.click();},700);"
            + "setInterval(a,400);})();</script>" + pluginScripts(ctx);
    }

    /** Scripts of plugins that run inside Twitch's player page (their player/*.js, gathered by build.sh). */
    private static String pluginScripts(Context ctx) {
        try (InputStream in = ctx.getAssets().open("web/player-plugins.js")) {
            String js = new String(Bridge.readAll(in), java.nio.charset.StandardCharsets.UTF_8).trim();
            return js.isEmpty() ? "" : "<script>" + js.replace("</script", "<\\/script") + "</script>";
        } catch (IOException e) {
            return "";
        }
    }

    private static WebResourceResponse vodPlayer(Context ctx, WebResourceRequest r) {
        String url = r.getUrl().toString();
        try {
            java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
            for (Map.Entry<String, String> e : r.getRequestHeaders().entrySet()) c.setRequestProperty(e.getKey(), e.getValue());
            String ck = CookieManager.getInstance().getCookie(url);
            if (ck != null) c.setRequestProperty("Cookie", ck);
            c.setRequestProperty("Accept-Encoding", "identity");
            c.setConnectTimeout(10000);
            c.setReadTimeout(15000);
            if (c.getResponseCode() != 200) return null;
            java.util.List<String> sc = c.getHeaderFields().get("Set-Cookie");
            if (sc != null) for (String v : sc) CookieManager.getInstance().setCookie(url, v);
            String html = new String(Bridge.readAll(c.getInputStream()), java.nio.charset.StandardCharsets.UTF_8);
            int i = html.indexOf("<head>");
            String hk = hook(ctx);
            html = i < 0 ? hk + html : html.substring(0, i + 6) + hk + html.substring(i + 6);
            Map<String, String> h = new HashMap<>();
            h.put("Cache-Control", "no-store");
            return new WebResourceResponse("text/html", "utf-8", 200, "OK", h,
                    new ByteArrayInputStream(html.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return null;
        }
    }

    static WebResourceResponse asset(Context c, Uri u) {
        if (!HOST.equals(u.getHost())) return null;
        String path = u.getPath();
        if (path == null || path.equals("/")) path = "/index.html";
        String ext = path.substring(path.lastIndexOf('.') + 1);
        String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";
        Map<String, String> h = new HashMap<>();
        h.put("Cache-Control", "no-cache");
        h.put("Access-Control-Allow-Origin", "*");
        try {
            InputStream in = c.getAssets().open("web" + path);
            return new WebResourceResponse(mime, "utf-8", 200, "OK", h, in);
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", h, new ByteArrayInputStream(new byte[0]));
        }
    }
}
