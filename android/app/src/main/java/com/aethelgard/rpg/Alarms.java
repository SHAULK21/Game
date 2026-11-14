package com.aethelgard.rpg;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONObject;

import java.util.Map;

/** Local reminders the game schedules (energy full, pet hungry…). Kept in prefs so they survive a reboot. */
final class Alarms {
    static final String CHANNEL = "game";
    private static final String STORE = "alarms";
    private Alarms() {}

    static void createChannel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Игра", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("Энергия, питомец и события Аэтельгарда");
        nm.createNotificationChannel(ch);
    }

    private static PendingIntent pending(Context c, int id, String title, String text) {
        Intent i = new Intent(c, AlarmReceiver.class).putExtra("id", id).putExtra("title", title).putExtra("text", text);
        return PendingIntent.getBroadcast(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void schedule(Context c, int id, long atMs, String title, String text) {
        if (atMs <= System.currentTimeMillis() + 5000) { cancel(c, id); return; }
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try {
            JSONObject o = new JSONObject().put("at", atMs).put("title", title).put("text", text);
            c.getSharedPreferences(STORE, Context.MODE_PRIVATE).edit().putString(String.valueOf(id), o.toString()).apply();
        } catch (Exception ignored) {}
        PendingIntent pi = pending(c, id, title, text);
        if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi); else am.set(AlarmManager.RTC_WAKEUP, atMs, pi);
    }

    static void cancel(Context c, int id) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pending(c, id, "", ""));
        c.getSharedPreferences(STORE, Context.MODE_PRIVATE).edit().remove(String.valueOf(id)).apply();
    }

    static void cancelAll(Context c) {
        SharedPreferences sp = c.getSharedPreferences(STORE, Context.MODE_PRIVATE);
        for (String k : sp.getAll().keySet()) { try { cancel(c, Integer.parseInt(k)); } catch (NumberFormatException ignored) {} }
    }

    /** After a reboot: set the stored reminders again. */
    static void restore(Context c) {
        SharedPreferences sp = c.getSharedPreferences(STORE, Context.MODE_PRIVATE);
        for (Map.Entry<String, ?> e : sp.getAll().entrySet()) {
            try {
                JSONObject o = new JSONObject(String.valueOf(e.getValue()));
                schedule(c, Integer.parseInt(e.getKey()), o.getLong("at"), o.getString("title"), o.getString("text"));
            } catch (Exception ignored) {}
        }
    }

    static void forget(Context c, int id) {
        c.getSharedPreferences(STORE, Context.MODE_PRIVATE).edit().remove(String.valueOf(id)).apply();
    }
}
