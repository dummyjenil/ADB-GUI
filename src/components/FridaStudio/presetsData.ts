import { PresetScript } from "../../types/frida";

export const FRIDA_PRESETS: PresetScript[] = [
  {
    id: "universal-ssl-bypass",
    title: "Universal SSL Pinning Bypass",
    category: "Security Bypass",
    description: "Bypasses SSL/TLS certificate pinning across OkHttp3, TrustManager, Conscrypt, OpenSSL, WebView, and standard Android trust stores.",
    tags: ["SSL", "OkHttp", "TrustManager", "Network", "BurpSuite"],
    script: `/* Universal Android SSL Pinning Bypass Script */
Java.perform(function () {
    console.log("[*] Initializing Universal SSL Pinning Bypass...");

    // 1. TrustManagerImpl (Android > 7)
    try {
        var TrustManagerImpl = Java.use('com.android.org.conscrypt.TrustManagerImpl');
        TrustManagerImpl.verifyChain.implementation = function (untrustedChain, trustAnchorChain, host, clientAuth, ocspData, tlsSctData) {
            console.log('[+] Conscrypt TrustManagerImpl.verifyChain bypassed for host: ' + host);
            return untrustedChain;
        };
    } catch (e) {
        console.log('[-] Conscrypt TrustManagerImpl not found');
    }

    // 2. Custom X509TrustManager
    try {
        var X509TrustManager = Java.use('javax.net.ssl.X509TrustManager');
        var SSLContext = Java.use('javax.net.ssl.SSLContext');
        var TrustManager = Java.registerClass({
            name: 'dev.adb.CustomTrustManager',
            implements: [X509TrustManager],
            methods: {
                checkClientTrusted: function (chain, authType) {},
                checkServerTrusted: function (chain, authType) {},
                getAcceptedIssuers: function () { return []; }
            }
        });
        var TrustManagers = [TrustManager.$new()];
        var SSLContext_init = SSLContext.init.overload('[Ljavax.net.ssl.KeyManager;', '[Ljavax.net.ssl.TrustManager;', 'java.security.SecureRandom');
        SSLContext_init.implementation = function (km, tm, sr) {
            console.log('[+] SSLContext.init hooked with permissive TrustManager');
            SSLContext_init.call(this, km, TrustManagers, sr);
        };
    } catch (e) {
        console.log('[-] SSLContext hook error: ' + e);
    }

    // 3. OkHttp3 CertificatePinner
    try {
        var CertificatePinner = Java.use('okhttp3.CertificatePinner');
        CertificatePinner.check.overload('java.lang.String', 'java.util.List').implementation = function (str, list) {
            console.log('[+] OkHttp3 CertificatePinner.check bypassed for: ' + str);
            return;
        };
        CertificatePinner.check.overload('java.lang.String', '[Ljava.security.cert.Certificate;').implementation = function (str, certs) {
            console.log('[+] OkHttp3 CertificatePinner.check[] bypassed for: ' + str);
            return;
        };
    } catch (e) {
        console.log('[-] OkHttp3 CertificatePinner not found');
    }

    // 4. WebView Client SSL Error Override
    try {
        var WebViewClient = Java.use('android.webkit.WebViewClient');
        WebViewClient.onReceivedSslError.implementation = function (webView, sslErrorHandler, sslError) {
            console.log('[+] WebViewClient.onReceivedSslError bypassed: Proceeding SSL connection');
            sslErrorHandler.proceed();
        };
    } catch (e) {
        console.log('[-] WebViewClient hook skipped');
    }

    console.log("[✓] SSL Pinning Bypass Hooks Activated!");
});`,
  },
  {
    id: "root-bypass-all",
    title: "Universal Root & Integrity Detection Bypass",
    category: "Security Bypass",
    description: "Hooks RootBeer, Su binary checks, Build.TAGS test-keys, Magisk detection, and su file existence checks.",
    tags: ["Root", "RootBeer", "Magisk", "Integrity", "Anti-Tamper"],
    script: `/* Universal Root Detection Bypass */
Java.perform(function () {
    console.log("[*] Activating Root Detection Bypass...");

    // 1. Hook File.exists for root binaries
    try {
        var File = Java.use("java.io.File");
        var suPaths = [
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/local/su",
            "/su/bin/su",
            "/data/adb/magisk"
        ];

        File.exists.implementation = function () {
            var path = this.getAbsolutePath();
            for (var i = 0; i < suPaths.length; i++) {
                if (path.indexOf(suPaths[i]) !== -1) {
                    console.log("[+] Root check blocked for file: " + path);
                    return false;
                }
            }
            return this.exists.call(this);
        };
    } catch (e) {
        console.log("[-] File.exists hook failed: " + e);
    }

    // 2. Build.TAGS test-keys bypass
    try {
        var Build = Java.use("android.os.Build");
        Build.TAGS.value = "release-keys";
        console.log("[+] Build.TAGS set to 'release-keys'");
    } catch (e) {
        console.log("[-] Build.TAGS hook failed");
    }

    // 3. RootBeer Library Bypass
    try {
        var RootBeer = Java.use("com.scottyab.rootbeer.RootBeer");
        RootBeer.isRooted.implementation = function () {
            console.log("[+] RootBeer.isRooted() -> returning false");
            return false;
        };
        RootBeer.isRootedWithoutBusyBoxCheck.implementation = function () {
            console.log("[+] RootBeer.isRootedWithoutBusyBoxCheck() -> returning false");
            return false;
        };
        RootBeer.isRootedWithBusyBoxCheck.implementation = function () {
            console.log("[+] RootBeer.isRootedWithBusyBoxCheck() -> returning false");
            return false;
        };
    } catch (e) {
        console.log("[-] RootBeer class not loaded");
    }

    console.log("[✓] Root Detection Bypass Active!");
});`,
  },
  {
    id: "flag-secure-disabler",
    title: "FLAG_SECURE & Screenshot Disabler",
    category: "UI & UX",
    description: "Disables WindowManager FLAG_SECURE to allow taking screenshots and screen mirroring on sensitive banking or protected app screens.",
    tags: ["FLAG_SECURE", "Screenshot", "Screen Recording", "Bypass"],
    script: `/* Disable WindowManager.LayoutParams.FLAG_SECURE */
Java.perform(function () {
    console.log("[*] Removing FLAG_SECURE restrictions...");

    var Window = Java.use("android.view.Window");
    var FLAG_SECURE = 0x00002000;

    // 1. Hook Window.setFlags
    Window.setFlags.implementation = function (flags, mask) {
        if ((mask & FLAG_SECURE) !== 0) {
            console.log("[+] Preventing FLAG_SECURE from being applied in Window.setFlags");
            mask = mask & ~FLAG_SECURE;
        }
        this.setFlags(flags, mask);
    };

    // 2. Hook Window.addFlags
    Window.addFlags.implementation = function (flags) {
        if ((flags & FLAG_SECURE) !== 0) {
            console.log("[+] Stripping FLAG_SECURE in Window.addFlags");
            flags = flags & ~FLAG_SECURE;
        }
        this.addFlags(flags);
    };

    // 3. Hook SurfaceView.setSecure
    try {
        var SurfaceView = Java.use("android.view.SurfaceView");
        SurfaceView.setSecure.implementation = function (isSecure) {
            console.log("[+] Overriding SurfaceView.setSecure(" + isSecure + ") -> false");
            this.setSecure(false);
        };
    } catch (e) {
        console.log("[-] SurfaceView hook skipped");
    }

    console.log("[✓] FLAG_SECURE disabled across windows!");
});`,
  },
  {
    id: "crypto-logger",
    title: "Live Crypto & Secret Key Interceptor",
    category: "Crypto & Storage",
    description: "Intercepts and logs AES/DES/RSA SecretKeys, IVs, plaintexts, and ciphertexts from javax.crypto.Cipher in real-time.",
    tags: ["Crypto", "AES", "Cipher", "SecretKey", "Security Audit"],
    script: `/* Real-time Crypto Interceptor */
Java.perform(function () {
    console.log("[*] Attaching to javax.crypto.Cipher...");

    var Cipher = Java.use("javax.crypto.Cipher");
    var StringClass = Java.use("java.lang.String");

    function bytesToHex(bytes) {
        if (!bytes) return "null";
        var hex = [];
        for (var i = 0; i < bytes.length; i++) {
            var b = (bytes[i] & 0xFF).toString(16);
            if (b.length === 1) b = "0" + b;
            hex.push(b);
        }
        return hex.join("");
    }

    // Hook Cipher.init
    Cipher.init.overload('int', 'java.security.Key', 'java.security.spec.AlgorithmParameterSpec').implementation = function (opmode, key, params) {
        var opStr = opmode === 1 ? "ENCRYPT" : (opmode === 2 ? "DECRYPT" : "MODE_" + opmode);
        console.log("\\n[🔒 CIPHER INIT] Op: " + opStr + " | Algo: " + this.getAlgorithm());
        try {
            console.log("  ↳ Key (" + key.getAlgorithm() + "): " + bytesToHex(key.getEncoded()));
        } catch (e) {}
        this.init(opmode, key, params);
    };

    // Hook Cipher.doFinal
    Cipher.doFinal.overload('[B').implementation = function (input) {
        var result = this.doFinal(input);
        console.log("\\n[⚡ CIPHER DO_FINAL] Algo: " + this.getAlgorithm());
        try {
            console.log("  ↳ Input (Hex): " + bytesToHex(input));
            console.log("  ↳ Output (Hex): " + bytesToHex(result));
            try {
                console.log("  ↳ Input (UTF-8 String): " + StringClass.$new(input).toString());
            } catch(e) {}
        } catch (e) {}
        return result;
    };

    console.log("[✓] Crypto Interceptor Active!");
});`,
  },
  {
    id: "biometric-bypass",
    title: "Biometric & Fingerprint Auth Bypass",
    category: "Security Bypass",
    description: "Hooks Android BiometricPrompt and FingerprintManager authentication callbacks to force successful biometric verification.",
    tags: ["Biometric", "Fingerprint", "Auth", "Bypass"],
    script: `/* Biometric / Fingerprint Bypass */
Java.perform(function () {
    console.log("[*] Hooking Biometric & Fingerprint Callbacks...");

    try {
        var BiometricPromptAuthenticationCallback = Java.use("android.hardware.biometrics.BiometricPrompt$AuthenticationCallback");
        BiometricPromptAuthenticationCallback.onAuthenticationFailed.implementation = function () {
            console.log("[+] Biometric auth failed intercepted! Overriding to success...");
            // Call onAuthenticationSucceeded with null or default result
            this.onAuthenticationSucceeded(null);
        };
        console.log("[+] BiometricPrompt callback hooked");
    } catch (e) {
        console.log("[-] BiometricPrompt hook error: " + e);
    }

    try {
        var FingerprintManager = Java.use("android.hardware.fingerprint.FingerprintManager");
        var FingerprintManagerAuthenticationCallback = Java.use("android.hardware.fingerprint.FingerprintManager$AuthenticationCallback");
        FingerprintManagerAuthenticationCallback.onAuthenticationFailed.implementation = function () {
            console.log("[+] Fingerprint auth failed intercepted! Overriding to success...");
            this.onAuthenticationSucceeded(null);
        };
        console.log("[+] FingerprintManager callback hooked");
    } catch (e) {
        console.log("[-] FingerprintManager hook error: " + e);
    }

    console.log("[✓] Biometric Bypass Active!");
});`,
  },
  {
    id: "webview-debugger",
    title: "Force WebView Remote Debugging",
    category: "Inspection",
    description: "Forces android.webkit.WebView.setWebContentsDebuggingEnabled(true) for all WebViews to allow Chrome DevTools inspection.",
    tags: ["WebView", "DevTools", "Chrome Debug", "Hybrid Apps"],
    script: `/* Enable WebView Remote Debugging */
Java.perform(function () {
    console.log("[*] Enabling WebView debugging...");

    try {
        var WebView = Java.use("android.webkit.WebView");
        WebView.$init.overload('android.content.Context').implementation = function (ctx) {
            WebView.setWebContentsDebuggingEnabled(true);
            console.log("[+] WebView initialized -> Remote debugging enabled!");
            this.$init(ctx);
        };
        WebView.setWebContentsDebuggingEnabled(true);
        console.log("[✓] WebView.setWebContentsDebuggingEnabled set to TRUE!");
    } catch (e) {
        console.log("[-] WebView hook error: " + e);
    }
});`,
  },
];
