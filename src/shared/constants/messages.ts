/** 画面・API で使う共通メッセージ（日本語） */
export const MESSAGES = {
  auth: {
    invalidCredentials: "ユーザーIDまたはパスワードが正しくありません",
    locked: "アカウントがロックされています。管理者にお問い合わせください",
    mustChangePassword: "初回ログインのためパスワードの変更が必要です",
    loginRequired: "ログインが必要です",
    forbidden: "この操作を行う権限がありません",
  },
  common: {
    saved: "保存しました",
    deleted: "削除しました",
    unexpected: "予期しないエラーが発生しました",
    notFound: "対象が見つかりません",
  },
} as const;
