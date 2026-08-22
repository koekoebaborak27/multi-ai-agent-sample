/** 再発行の申請を受け付けなかった理由。画面には出さず、ログにだけ残す */
export type SkipReason = "user_not_found" | "user_deleted" | "rate_limited";
