package com.aethelgard.rpg;

import android.content.Context;
import android.content.pm.PackageInfo;

/** Version of the installed app (read from the package, so no BuildConfig generation is needed). */
final class BuildConfigVersion {
    private BuildConfigVersion() {}
    static int code(Context c) {
        try { PackageInfo p = c.getPackageManager().getPackageInfo(c.getPackageName(), 0); return p.versionCode; } catch (Exception e) { return 0; }
    }
    static String name(Context c) {
        try { PackageInfo p = c.getPackageManager().getPackageInfo(c.getPackageName(), 0); return p.versionName; } catch (Exception e) { return "?"; }
    }
}
