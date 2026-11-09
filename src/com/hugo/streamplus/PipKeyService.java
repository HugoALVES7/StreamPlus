package com.hugo.streamplus;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.view.KeyEvent;
import android.view.accessibility.AccessibilityEvent;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Optional accessibility service: while the floating player (PiP) is open, the remote button
 * chosen in the app's settings opens (or closes) the PiP menu, whatever app is on screen.
 *
 * It runs in its own small process (":pipkey") so it always answers at once, and it only asks
 * Android for key events while a PiP is open: the rest of the time, no key goes through it.
 * It reads nothing on screen.
 */
public class PipKeyService extends AccessibilityService {
    static final String PREFS = "pipkey";

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    /** The chosen key (0 = none). Main process. */
    static int key(Context c) {
        return prefs(c).getInt("key", 0);
    }

    /** Whether the user turned this service on (Settings → Accessibility). */
    static boolean enabled(Context c) {
        String s = android.provider.Settings.Secure.getString(c.getContentResolver(),
                android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        return s != null && s.contains(c.getPackageName() + "/" + PipKeyService.class.getName());
    }

    private static File stateFile(Context c) {
        return new File(c.getFilesDir(), "pipkey.state");
    }

    private static String action(Context c) {
        return c.getPackageName() + ".PIPKEY";
    }

    /** Main process: tells the service (other process) whether a PiP is open and which key to use. */
    static void sync(Context c) {
        boolean on = PipService.inst != null;
        try (FileOutputStream o = new FileOutputStream(stateFile(c))) {
            o.write(((on ? "1" : "0") + " " + key(c)).getBytes(StandardCharsets.UTF_8));
        } catch (Exception ignored) { }
        c.sendBroadcast(new Intent(action(c)).setPackage(c.getPackageName()));
    }

    // ---------------------------------------------------------------- the service (":pipkey")
    private volatile int key;
    private volatile boolean pip, down;

    private final BroadcastReceiver rx = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) { apply(); }
    };

    @Override protected void onServiceConnected() {
        IntentFilter f = new IntentFilter(action(this));
        if (android.os.Build.VERSION.SDK_INT >= 33) registerReceiver(rx, f, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(rx, f);
        apply();
    }

    /** Reads the state written by the app; key events are requested only while a PiP is open. */
    private void apply() {
        boolean on = false;
        int k = 0;
        try {
            String[] s = new String(java.nio.file.Files.readAllBytes(stateFile(this).toPath()), StandardCharsets.UTF_8).trim().split(" ");
            on = "1".equals(s[0]);
            k = Integer.parseInt(s[1]);
        } catch (Exception ignored) { }
        pip = on;
        key = k;
        AccessibilityServiceInfo info = getServiceInfo();
        if (info == null) return;
        boolean want = on && k != 0;
        boolean has = (info.flags & AccessibilityServiceInfo.FLAG_REQUEST_FILTER_KEY_EVENTS) != 0;
        if (want == has) return;
        if (want) info.flags |= AccessibilityServiceInfo.FLAG_REQUEST_FILTER_KEY_EVENTS;
        else info.flags &= ~AccessibilityServiceInfo.FLAG_REQUEST_FILTER_KEY_EVENTS;
        setServiceInfo(info);
    }

    @Override protected boolean onKeyEvent(KeyEvent e) {
        if (key == 0 || e.getKeyCode() != key) return false;
        // the press we took also owns its release (even if the PiP closed in between)
        if (e.getAction() == KeyEvent.ACTION_UP) {
            boolean mine = down;
            down = false;
            return mine;
        }
        if (!pip) return false;
        if (e.getAction() == KeyEvent.ACTION_DOWN && e.getRepeatCount() == 0) {
            down = true;
            // opens the PiP menu, or closes it if it is already shown (PipControlActivity.onNewIntent)
            startActivity(new Intent(this, PipControlActivity.class).putExtra("toggle", true)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
        return true;
    }

    @Override public void onDestroy() {
        try { unregisterReceiver(rx); } catch (Exception ignored) { }
        super.onDestroy();
    }

    @Override public void onAccessibilityEvent(AccessibilityEvent event) { }

    @Override public void onInterrupt() { }
}
