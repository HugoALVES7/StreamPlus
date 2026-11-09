package com.hugo.streamplus;

import android.app.Activity;
import android.webkit.WebView;

/**
 * A build-time plugin: a folder or .zip dropped in plugins/ (see plugins/README.md).
 * Its class is created when the app starts, before the web UI loads, so it can add its own
 * JavaScript interface to the WebView; its web/*.js files run after app.js.
 */
public interface Plugin {
    void attach(Activity activity, WebView web);

    default void detach() { }
}
