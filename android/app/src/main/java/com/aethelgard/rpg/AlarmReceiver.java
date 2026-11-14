package com.aethelgard.rpg;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Shows a reminder the game scheduled; tapping it opens the game. */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        int id = intent.getIntExtra("id", 0);
        Alarms.forget(c, id);
        if (!c.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE).getBoolean("notify", true)) return;
        Alarms.createChannel(c);
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("fromNotification", true);
        PendingIntent pi = PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, Alarms.CHANNEL) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_stat_game)
                .setContentTitle(intent.getStringExtra("title"))
                .setContentText(intent.getStringExtra("text"))
                .setStyle(new Notification.BigTextStyle().bigText(intent.getStringExtra("text")))
                .setAutoCancel(true)
                .setContentIntent(pi);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            try { nm.notify(id, b.build()); } catch (SecurityException ignored) { /* notifications not allowed */ }
        }
    }
}
