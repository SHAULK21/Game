#!/usr/bin/env bash
# Smoke test on an emulator: install, open the login screen, open the game with a (fake) login link,
# open the in-game menu, press Back; screenshots and the crash log go to $2.
set -x
APK="$1"; OUT="$2"; mkdir -p "$OUT"
PKG=com.aethelgard.rpg
shot() { sleep "$2"; adb exec-out screencap -p > "$OUT/$1.png"; }
adb install -r "$APK" || exit 1
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS || true
adb logcat -c
adb shell am start -n $PKG/.MainActivity
shot 01-login 8
# a login link like the one the game sends (fake signature: the server will refuse it, the app must not crash)
D='query_id%3DAAE%26user%3D%257B%2522id%2522%253A1%252C%2522first_name%2522%253A%2522Test%2522%257D%26auth_date%3D1763000000%26hash%3D0000'
adb shell am start -a android.intent.action.VIEW -d "aethelgard://login?d=$D" $PKG
shot 02-game-loading 12
shot 03-game-25s 13
adb shell input keyevent KEYCODE_BACK
shot 04-after-back 3
adb shell input keyevent KEYCODE_BACK
shot 05-after-back2 2
adb shell am start -n $PKG/.MainActivity
shot 06-reopen 6
adb logcat -d > "$OUT/logcat-full.txt"
grep -E "FATAL EXCEPTION|AndroidRuntime|chromium.*Console|aethelgard" "$OUT/logcat-full.txt" | head -300 > "$OUT/logcat-app.txt"
pidof_ok=$(adb shell pidof $PKG || true); echo "pid after test: $pidof_ok" > "$OUT/status.txt"
grep -q "FATAL EXCEPTION" "$OUT/logcat-full.txt" && echo "CRASH" >> "$OUT/status.txt" || echo "no crash" >> "$OUT/status.txt"
exit 0
