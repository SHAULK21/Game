package com.aethelgard.rpg;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Reminders are lost on reboot; set them again. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) Alarms.restore(c);
    }
}
