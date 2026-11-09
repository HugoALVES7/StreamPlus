package com.hugo.streamplus;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Point;
import android.graphics.Typeface;
import android.graphics.drawable.ClipDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.graphics.drawable.StateListDrawable;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;

import org.json.JSONObject;

/**
 * Liquid-glass panel shown over whatever is on screen: volume and mute of the floating player
 * (plus moving/resizing it, going back full screen, or closing it). Its own window is only the
 * size of the card, so the system blurs just what's behind the card.
 */
public class PipControlActivity extends Activity {
    private float u;  // 1/960 of the screen width
    private Typeface regular, semibold, display;
    private TextView volLabel;
    private Button muteBtn;
    private SeekBar seek;

    private int px(float units) {
        return Math.round(units * u);
    }

    private Typeface font(String f) {
        try {
            return Typeface.createFromAsset(getAssets(), "web/fonts/" + f + ".ttf");
        } catch (Exception e) {
            return Typeface.DEFAULT;
        }
    }

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        Point p = new Point();
        getWindowManager().getDefaultDisplay().getRealSize(p);
        u = Math.max(p.x, p.y) / 960f;
        regular = font("Inter-Regular");
        semibold = font("Inter-SemiBold");
        display = font("InterDisplay-Bold");
        build();
    }

    @Override protected void onResume() {
        super.onResume();
        refresh();
    }

    private GradientDrawable round(int color, float r) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(r);
        return g;
    }

    private TextView text(String s, Typeface f, float size, int color) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTypeface(f);
        t.setTextColor(color);
        t.setTextSize(TypedValue.COMPLEX_UNIT_PX, px(size));
        return t;
    }

    /** tvOS capsule: frosted when idle, solid white with dark text when focused. */
    private Button pill(String label, View.OnClickListener l) {
        Button btn = new Button(this);
        btn.setAllCaps(false);
        btn.setText(label);
        btn.setTypeface(semibold);
        btn.setTextSize(TypedValue.COMPLEX_UNIT_PX, px(11));
        btn.setPadding(px(14), 0, px(14), 0);
        btn.setMinWidth(0);
        btn.setMinimumWidth(0);
        btn.setMinHeight(0);
        btn.setMinimumHeight(0);
        StateListDrawable s = new StateListDrawable();
        s.addState(new int[]{android.R.attr.state_focused}, round(0xFFFFFFFF, px(16)));
        GradientDrawable idle = round(0x26FFFFFF, px(16));
        idle.setStroke(Math.max(1, px(0.5f)), 0x40FFFFFF);
        s.addState(new int[]{}, idle);
        btn.setBackground(s);
        btn.setTextColor(new android.content.res.ColorStateList(
                new int[][]{{android.R.attr.state_focused}, {}}, new int[]{0xFF111114, 0xFFFFFFFF}));
        btn.setStateListAnimator(null);
        btn.setFocusable(true);
        btn.setOnFocusChangeListener((v, has) -> v.animate().scaleX(has ? 1.08f : 1f).scaleY(has ? 1.08f : 1f).setDuration(150).start());
        btn.setOnClickListener(l);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, px(32));
        lp.setMarginEnd(px(8));
        btn.setLayoutParams(lp);
        return btn;
    }

    private void build() {
        Window win = getWindow();
        // Real frosted glass where the TV can blur other windows; otherwise a denser tint.
        boolean blur = Build.VERSION.SDK_INT >= 31 && getWindowManager().isCrossWindowBlurEnabled();
        GradientDrawable glass = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                blur ? new int[]{0x8C2A2438, 0x80141418} : new int[]{0xF02A2438, 0xF0141418});
        glass.setCornerRadius(px(26));
        glass.setStroke(Math.max(1, px(0.6f)), 0x66FFFFFF);
        win.setBackgroundDrawable(glass);
        if (blur) {
            win.setBackgroundBlurRadius(px(30));
            win.addFlags(WindowManager.LayoutParams.FLAG_BLUR_BEHIND);
            WindowManager.LayoutParams a = win.getAttributes();
            a.setBlurBehindRadius(0);
            win.setAttributes(a);
        }
        win.clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
        // Opposite side to the floating player, so the panel never hides under it.
        int corner = PipService.inst != null ? PipService.inst.corner : 3;
        boolean pipRight = corner == 1 || corner == 3, pipBottom = corner >= 2;
        win.setGravity((pipBottom ? Gravity.BOTTOM : Gravity.TOP) | (pipRight ? Gravity.START : Gravity.END));
        win.setLayout(px(440), WindowManager.LayoutParams.WRAP_CONTENT);
        WindowManager.LayoutParams a = win.getAttributes();
        a.x = px(24);
        a.y = px(24);
        win.setAttributes(a);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(px(22), px(18), px(22), px(20));

        PipService s = PipService.inst;
        if (s == null) {
            root.addView(text(getString(R.string.pip_name), display, 18, Color.WHITE));
            TextView t = text("Aucun stream en Picture in Picture.\nLance un live dans " + getString(R.string.app_name) + ", puis choisis « PiP ».", regular, 11, 0xCCFFFFFF);
            t.setPadding(0, px(6), 0, px(14));
            root.addView(t);
            LinearLayout row = new LinearLayout(this);
            row.addView(pill("Ouvrir " + getString(R.string.app_name), v -> {
                startActivity(new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                finish();
            }));
            row.addView(pill("Fermer", v -> finish()));
            root.addView(row);
            setContentView(root);
            row.getChildAt(0).requestFocus();
            return;
        }

        JSONObject st = s.state();
        LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        TextView live = text(st.has("video") ? "VOD" : "LIVE", semibold, 9, Color.WHITE);
        live.setBackground(round(st.has("video") ? 0xFF6441A5 : 0xFFEB0400, px(4)));
        live.setPadding(px(5), px(1), px(5), px(1));
        head.addView(live);
        TextView name = text(st.optString("name", st.optString("channel", "Stream")), display, 17, Color.WHITE);
        name.setPadding(px(8), 0, 0, 0);
        name.setSingleLine(true);
        head.addView(name);
        root.addView(head);
        TextView title = text(st.optString("title", ""), regular, 10, 0xB3FFFFFF);
        title.setSingleLine(true);
        title.setEllipsize(android.text.TextUtils.TruncateAt.END);
        title.setPadding(0, px(3), 0, px(12));
        root.addView(title);

        // Volume row: [mute] [=====] 65 %
        LinearLayout vol = new LinearLayout(this);
        vol.setGravity(Gravity.CENTER_VERTICAL);
        muteBtn = pill("Muet", v -> {
            s.command("mute", "");
            refresh();
        });
        vol.addView(muteBtn);
        seek = new SeekBar(this);
        seek.setMax(100);
        seek.setKeyProgressIncrement(5);
        seek.setFocusable(true);
        seek.setProgressDrawable(track());
        seek.setThumb(thumb(false));
        seek.setThumbOffset(0);
        seek.setSplitTrack(false);
        if (Build.VERSION.SDK_INT >= 29) {
            seek.setMinHeight(px(3));
            seek.setMaxHeight(px(3));
        }
        seek.setPadding(px(10), 0, px(10), 0);
        seek.setOnFocusChangeListener((v, has) -> seek.setThumb(thumb(has)));
        seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar sb, int pr, boolean user) {
                if (user && PipService.inst != null) {
                    PipService.inst.command("volume", String.valueOf(pr / 100f));
                    refresh();
                }
            }

            @Override public void onStartTrackingTouch(SeekBar sb) { }

            @Override public void onStopTrackingTouch(SeekBar sb) { }
        });
        LinearLayout.LayoutParams sl = new LinearLayout.LayoutParams(0, px(32), 1f);
        vol.addView(seek, sl);
        volLabel = text("", semibold, 12, Color.WHITE);
        volLabel.setMinWidth(px(44));
        volLabel.setGravity(Gravity.END);
        vol.addView(volLabel);
        root.addView(vol);

        TextView hint = text("◀ ▶ règle le son du stream", regular, 9, 0x80FFFFFF);
        hint.setPadding(0, px(6), 0, px(12));
        root.addView(hint);

        LinearLayout row = new LinearLayout(this);
        row.addView(pill("Déplacer", v -> s.command("corner", "")));
        row.addView(pill("Taille", v -> s.command("size", "")));
        row.addView(pill("Plein écran", v -> {
            s.expand(this);
            finish();
        }));
        row.addView(pill("Fermer le PiP", v -> {
            s.command("stop", "");
            finish();
        }));
        root.addView(row);
        setContentView(root);
        seek.requestFocus();
    }

    private Drawable track() {
        GradientDrawable bg = round(0x4DFFFFFF, px(3));
        GradientDrawable fg = round(0xFFFFFFFF, px(3));
        ClipDrawable clip = new ClipDrawable(fg, Gravity.START, ClipDrawable.HORIZONTAL);
        LayerDrawable l = new LayerDrawable(new Drawable[]{bg, clip});
        l.setId(0, android.R.id.background);
        l.setId(1, android.R.id.progress);
        return l;
    }

    private Drawable thumb(boolean focused) {
        GradientDrawable g = new GradientDrawable();
        g.setShape(GradientDrawable.OVAL);
        g.setColor(focused ? 0xFFFFFFFF : 0xFFDDDDE2);
        if (focused) g.setStroke(px(2), 0xFF9146FF);
        int d = px(focused ? 18 : 12);
        g.setSize(d, d);
        return g;
    }

    private void refresh() {
        PipService s = PipService.inst;
        if (s == null || seek == null) return;
        int v = Math.round(s.volume * 100);
        if (seek.getProgress() != v) seek.setProgress(v);
        volLabel.setText(s.muted ? "Muet" : v + " %");
        muteBtn.setText(s.muted ? "Activer le son" : "Muet");
    }

    @Override public boolean onKeyDown(int k, KeyEvent e) {
        if (k == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE && PipService.inst != null) {
            PipService.inst.command("mute", "");
            refresh();
            return true;
        }
        return super.onKeyDown(k, e);
    }
}
