/**
 * 複数の場所で使うメッセージを1か所にまとめたもの。
 * 同じ意味の文言が場所によって変わるのを防ぎ、修正するときも1か所を直せば済むようにする。
 */
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
  masterExport: {
    generating: "CSVを作成しています。しばらくお待ちください",
    timeout: "時間がかかっています。しばらくしてからもう一度お試しください",
    failed: "CSVの生成に失敗しました。もう一度お試しください",
  },
} as const;
