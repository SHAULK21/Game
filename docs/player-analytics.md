# Admin player analytics

Available in the admin console: **First levels and return sessions**, `GET /api/admin/player-analytics?days=7|30|90`. Authentication and the existing administrator middleware are required. The current administrator is excluded.

- The period selects players by their first observed telemetry session. It is not a filter on individual heartbeats.
- The level 1–10 funnel and class comparison include only players whose first observed session explicitly started at level 1. Legacy snapshots without a starting level are shown in the player list but excluded from the newcomer funnel.
- Reached level is the maximum observed session level; crossing a level counts, even if a multi-level reward skipped its checkpoint. Time-to-level is available only for explicitly observed checkpoints. It adds visible active time across earlier sessions; sample count is shown.
- Sessions begin on application load or return after at least 30 minutes in the background (an unfinished battle retains its existing session). Multiple sessions are not the same as next-day retention; D1/D7 remain in the balance report.
- No activity for 24 hours is an inactivity signal, not proof of churn. Last screen, energy and battle outcome describe observed state and cannot establish why a person left.
- Session snapshots are sent initially, on level changes, navigation, battle start/end, page hide and every 20 seconds while visible. Buffered retries use increasing sequences and do not duplicate sessions or checkpoints. Forced application termination may lose the last seconds.
- Data are client diagnostics, not authoritative economy or anti-cheat evidence. Old play history cannot be reconstructed. Administrative account resets retain telemetry history.

The schema migration adds nullable session metadata, a player/date index and `balance_progress`. It is repeatable and accepts telemetry from older clients. No rewards, combat calculations or progression balance are changed.

Validation covers PostgreSQL migrations, old clients, stale retries, administrator access, early inactivity, multi-session time-to-level, navigation capture, Ukrainian labels and mobile layouts.
