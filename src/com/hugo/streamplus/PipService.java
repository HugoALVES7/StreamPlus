package com.hugo.streamplus;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Outline;
import android.graphics.PixelFormat;
import android.graphics.Point;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.widget.FrameLayout;

import org.json.JSONObject;

/**
 * The floating player: one Twitch embed in an always-on-top window that never takes focus, so the
 * remote keeps driving whatever app is underneath. Only its volume can be changed (PiP panel).
 */
public class PipService extends Service {
    static PipService inst;

    private WindowManager wm;
    private FrameLayout frame;
    private WebView web;
    private WindowManager.LayoutParams lp;
    private SharedPreferences prefs;

    JSONObject src = new JSONObject();
    float volume = 0.5f;
    boolean muted;
    int corner = 3;  // 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right
    int size = 1;    // 0 small, 1 medium, 2 large
    static final float[] SIZES = {0.25f, 0.33f, 0.45f};

    @Override public IBinder onBind(Intent i) {
        return null;
    }

    @Override public void onCreate() {
        super.onCreate();
        inst = this;
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        prefs = getSharedPreferences("pip", MODE_PRIVATE);
        corner = prefs.getInt("corner", 3);
        size = prefs.getInt("size", 1);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        foreground();
        if (intent != null && intent.hasExtra("json")) {
            try {
                src = new JSONObject(intent.getStringExtra("json"));
                volume = (float) src.optDouble("volume", volume);
                muted = src.optBoolean("muted", false);
            } catch (Exception ignored) { }
            show();
        }
        return START_NOT_STICKY;
    }

    private void foreground() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel("pip", "Lecteur flottant", NotificationManager.IMPORTANCE_LOW));
        PendingIntent pi = PendingIntent.getActivity(this, 0, new Intent(this, PipControlActivity.class),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(this, "pip")
                .setContentTitle(getString(R.string.pip_name))
                .setContentText(src.optString("title", "Lecture en cours"))
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= 29) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        else startForeground(1, n);
    }

    private Point screen() {
        Point p = new Point();
        wm.getDefaultDisplay().getRealSize(p);
        if (p.x < p.y) p.set(p.y, p.x);
        return p;
    }

    private String pageUrl() {
        Uri.Builder b = Uri.parse(Web.ORIGIN + "/pip.html").buildUpon();
        if (src.has("video")) b.appendQueryParameter("video", src.optString("video"));
        else b.appendQueryParameter("channel", src.optString("channel"));
        if (src.has("time")) b.appendQueryParameter("time", src.optString("time"));
        b.appendQueryParameter("vol", String.valueOf(volume));
        b.appendQueryParameter("muted", muted ? "1" : "0");
        return b.build().toString();
    }

    private void show() {
        if (web == null) {
            web = new WebView(this);
            Web.setup(web);
            web.setWebChromeClient(new WebChromeClient());
            web.setFocusable(false);
            web.addJavascriptInterface(new Object() {
                @android.webkit.JavascriptInterface
                public void time(double t) {
                    time = t;
                }

                @android.webkit.JavascriptInterface
                public void tap() {
                    web.post(() -> {
                        float x = web.getWidth() / 2f, y = web.getHeight() / 2f;
                        long t = android.os.SystemClock.uptimeMillis();
                        android.view.MotionEvent d = android.view.MotionEvent.obtain(t, t, android.view.MotionEvent.ACTION_DOWN, x, y, 0);
                        d.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);
                        web.dispatchTouchEvent(d);
                        d.recycle();
                        web.postDelayed(() -> {
                            android.view.MotionEvent u = android.view.MotionEvent.obtain(t, android.os.SystemClock.uptimeMillis(), android.view.MotionEvent.ACTION_UP, x, y, 0);
                            u.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);
                            web.dispatchTouchEvent(u);
                            u.recycle();
                        }, 60);
                    });
                }
            }, "Native");
            frame = new FrameLayout(this);
            frame.addView(web, new FrameLayout.LayoutParams(-1, -1));
            // Glass rim on top of the video.
            View rim = new View(this);
            GradientDrawable g = new GradientDrawable();
            g.setColor(0x00000000);
            g.setStroke(3, 0x66FFFFFF);
            rim.setBackground(g);
            frame.addView(rim, new FrameLayout.LayoutParams(-1, -1));
            frame.setKeepScreenOn(true);
            frame.setClipToOutline(true);
            lp = new WindowManager.LayoutParams(1, 1,
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                            | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                    PixelFormat.TRANSLUCENT);
            lp.gravity = Gravity.TOP | Gravity.START;
            layout();
            wm.addView(frame, lp);
        }
        web.loadUrl(pageUrl());
    }

    private void layout() {
        Point s = screen();
        int w = Math.round(s.x * SIZES[size]), h = Math.round(w * 9f / 16f);
        int m = Math.round(s.x * 0.025f);
        lp.width = w;
        lp.height = h;
        lp.x = (corner == 0 || corner == 2) ? m : s.x - w - m;
        lp.y = (corner == 0 || corner == 1) ? m : s.y - h - m;
        final float r = s.x * 0.012f;
        frame.setOutlineProvider(new ViewOutlineProvider() {
            @Override public void getOutline(View v, Outline o) {
                o.setRoundRect(0, 0, v.getWidth(), v.getHeight(), r);
            }
        });
        GradientDrawable g = (GradientDrawable) frame.getChildAt(1).getBackground();
        g.setCornerRadius(r);
        if (frame.isAttachedToWindow()) wm.updateViewLayout(frame, lp);
    }

    private void applyAudio() {
        if (web != null) web.evaluateJavascript("window.pip && pip.audio(" + volume + "," + muted + ")", null);
    }

    void command(String cmd, String arg) {
        switch (cmd) {
            case "volume":
                volume = Math.max(0f, Math.min(1f, Float.parseFloat(arg)));
                if (volume > 0) muted = false;
                applyAudio();
                break;
            case "mute":
                muted = arg == null || arg.isEmpty() ? !muted : Boolean.parseBoolean(arg);
                applyAudio();
                break;
            case "corner":
                corner = arg == null || arg.isEmpty() ? (corner + 1) % 4 : Integer.parseInt(arg);
                prefs.edit().putInt("corner", corner).apply();
                layout();
                break;
            case "size":
                size = arg == null || arg.isEmpty() ? (size + 1) % 3 : Integer.parseInt(arg);
                prefs.edit().putInt("size", size).apply();
                layout();
                break;
            case "expand":
                expand(this);
                break;
            case "stop":
                stopSelf();
                break;
            default:
                break;
        }
    }

    /** Last playback position reported by the page (VODs resume there when expanded). */
    volatile double time;

    /** Opens the stream full screen in the app and closes the floating player. */
    void expand(Context c) {
        JSONObject o = state();
        try {
            if (time > 0) o.put("time", Math.round(time));
        } catch (Exception ignored) { }
        c.startActivity(new Intent(c, MainActivity.class).putExtra("open", o.toString())
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP));
        stopSelf();
    }

    JSONObject state() {
        JSONObject o = new JSONObject();
        try {
            for (java.util.Iterator<String> it = src.keys(); it.hasNext(); ) {
                String k = it.next();
                o.put(k, src.get(k));
            }
            o.put("volume", volume);
            o.put("muted", muted);
            o.put("corner", corner);
            o.put("size", size);
        } catch (Exception ignored) { }
        return o;
    }

    @Override public void onDestroy() {
        inst = null;
        if (frame != null) {
            try {
                wm.removeView(frame);
            } catch (Exception ignored) { }
        }
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
