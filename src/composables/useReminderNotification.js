import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const STORAGE_KEY = 'byerun.reminder';

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export async function ensureNotificationPermission() {
  if (!isNativeApp()) return false;
  try {
    let status = await LocalNotifications.checkPermissions();
    if (status.display === 'prompt') {
      status = await LocalNotifications.requestPermissions();
    }
    return status.display === 'granted';
  } catch (e) {
    console.error('check permission error:', e);
    return false;
  }
}

export async function scheduleDailyReminder({ hour, minute, enabled = true }) {
  if (!isNativeApp()) {
    return { ok: false, reason: 'not_native' };
  }

  // 先取消所有旧提醒
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  } catch (e) {
    console.error('cancel old reminder error:', e);
  }

  if (!enabled) {
    localStorage.removeItem(STORAGE_KEY);
    return { ok: true, action: 'cancelled' };
  }

  const granted = await ensureNotificationPermission();
  if (!granted) {
    return { ok: false, reason: 'permission_denied' };
  }

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 1,
          title: 'Byerun 校园跑提醒',
          body: '今天还没校园跑，记得去打卡哦',
          schedule: { on: { hour, minute } },
          extra: { type: 'run_reminder' },
        },
      ],
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hour, minute, enabled: true }));
    return { ok: true, action: 'scheduled' };
  } catch (e) {
    console.error('schedule reminder error:', e);
    return { ok: false, reason: 'schedule_error' };
  }
}

export function loadReminderConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
