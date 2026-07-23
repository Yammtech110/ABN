package com.example.shiabusinessdirectory;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * Live shell: loads https://abn-1.onrender.com.
 * Disable aggressive WebView HTTP cache so Render redeploys show up after app restart.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onStart() {
        super.onStart();
        applyLiveWebSettings();
    }

    @Override
    public void onResume() {
        super.onResume();
        applyLiveWebSettings();
    }

    private void applyLiveWebSettings() {
        if (bridge == null) return;
        WebView webView = bridge.getWebView();
        if (webView == null) return;

        WebSettings settings = webView.getSettings();
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        // Always revalidate against the live Static Site (no stale Sign In UI)
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);
    }
}
