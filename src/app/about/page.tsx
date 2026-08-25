import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "システム紹介 | サンプル契約管理システム",
  description: "本テンプレートのコンセプトと機能を紹介します。",
};

// テンプレートの紹介ページ。ログイン画面の「システム紹介」リンクから新しいタブで開く。
// 内容はデザイン担当が用意した LP (LP_murtiAI.html) をそのまま移植したもの。
// もとのファイルは支援用スクリプト（support.js）に依存する独自タグで書かれていたため、
// それらを取り除き、スタイルは .lp-root 配下だけに効くよう書き換えて、アプリ本体の見た目に影響しないようにしている。
export default function AboutPage() {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&family=Noto+Sans+JP:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap"
      />
      <style>{LP_STYLE}</style>
      <div className="lp-root" dangerouslySetInnerHTML={{ __html: LP_BODY }} />
    </>
  );
}

const LP_STYLE = `
  :root{
    --bg:#FFFFFF; --bg-soft:#F7F7FC; --ink:#20223A; --muted:#5B5E77; --line:#E7E7F0;
    --indigo:#4F46E5; --indigo-soft:#EEEDFC; --indigo-deep:#1B1830;
    --coral:#FF6B4A; --coral-soft:#FFEEE8;
  }
  .lp-root, .lp-root *{box-sizing:border-box;}
  .lp-root{background:var(--bg);color:var(--ink);font-family:'Noto Sans JP','Space Grotesk',sans-serif;}
  .lp-root .heading{font-family:'Zen Maru Gothic','Space Grotesk',sans-serif;font-weight:900;color:var(--ink);margin:0;white-space:nowrap;}
  .lp-root a{color:var(--indigo);text-decoration:none;}
  .lp-root a:hover{color:#3B32C4;}
  .lp-root img,.lp-root svg{max-width:100%;}
  .lp-root .container{max-width:1120px;margin:0 auto;padding-left:clamp(20px,6vw,64px);padding-right:clamp(20px,6vw,64px);}
  .lp-root .kicker{font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.08em;color:var(--coral);text-transform:uppercase;}
  .lp-root .btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--indigo);color:#fff;font-weight:700;font-size:15px;padding:15px 30px;border-radius:999px;}
  .lp-root .btn-secondary{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#fff;color:var(--ink);font-weight:700;font-size:15px;padding:15px 30px;border-radius:999px;border:1.5px solid var(--line);}
  .lp-root .card{background:#fff;border:1px solid var(--line);border-radius:20px;box-shadow:0 10px 30px rgba(32,34,58,0.06);}
  .lp-root .pill{font-family:'Space Grotesk',sans-serif;font-size:12px;font-weight:600;padding:5px 12px;border-radius:999px;display:inline-block;}
  .lp-root .icon-circle{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}

  /* ---- structural blocks (layout only; typography is fluid via clamp) ---- */
  .lp-root .nav-wrap{display:flex;align-items:center;justify-content:space-between;padding:clamp(16px,3vw,26px) clamp(20px,6vw,64px);}
  .lp-root .nav-links{display:flex;align-items:center;gap:36px;}
  .lp-root .hero-diagram-mobile{display:none;}
  .lp-root .split-wrap{display:flex;}
  .lp-root .split-divider-wrap{width:0;position:relative;}
  .lp-root .split-divider-circle{position:absolute;left:-28px;top:50%;transform:translateY(-50%);width:56px;height:56px;border-radius:50%;background:#fff;box-shadow:0 6px 18px rgba(32,34,58,0.14);display:flex;align-items:center;justify-content:center;z-index:2;}
  .lp-root .features-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;margin-top:44px;}
  .lp-root .rules-row{display:flex;gap:24px;}
  .lp-root .rules-connector-desktop{display:block;}
  .lp-root .rules-connector-mobile{display:none;}
  .lp-root .rule-tree-desktop{display:block;}
  .lp-root .rule-tree-mobile{display:none;}
  .lp-root .quality-row{display:flex;margin-top:48px;position:relative;gap:24px;}
  .lp-root .quality-line-desktop{display:block;}
  .lp-root .roles-row{display:flex;gap:24px;margin-top:44px;}
  .lp-root .recap-row{display:flex;gap:20px;justify-content:center;margin-top:40px;flex-wrap:wrap;}
  .lp-root .footer-row{display:flex;justify-content:space-between;align-items:center;}
  .lp-root .workflow-row{display:flex;margin-top:44px;}

  @media (max-width:680px){
    .lp-root .heading{white-space:normal;}
    .lp-root .nav-links{display:none;}
    .lp-root .hero-diagram-desktop{display:none;}
    .lp-root .hero-diagram-mobile{display:block;}
    .lp-root .split-wrap{flex-direction:column;}
    .lp-root .split-divider-wrap{display:none;}
    .lp-root .features-grid{grid-template-columns:1fr;gap:16px;}
    .lp-root .rules-row{flex-direction:column;}
    .lp-root .rules-connector-desktop{display:none;}
    .lp-root .rules-connector-mobile{display:block;}
    .lp-root .rule-tree-desktop{display:none;}
    .lp-root .rule-tree-mobile{display:block;}
    .lp-root .quality-row{flex-direction:column;gap:28px;}
    .lp-root .quality-line-desktop{display:none;}
    .lp-root .roles-row{flex-direction:column;}
    .lp-root .recap-row{flex-direction:column;align-items:stretch;}
    .lp-root .footer-row{flex-direction:column;gap:10px;text-align:center;}
    .lp-root .workflow-row{flex-direction:column;}
    .lp-root .workflow-rail{display:none !important;}
    .lp-root .workflow-cards{padding-left:0 !important;}
  }
`;

const LP_BODY = `
<div style="width:100%;">

  <!-- NAV -->
  <div class="nav-wrap">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:32px;height:32px;border-radius:10px;background:var(--indigo);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 3l7 4v10l-7 4-7-4V7l7-4z"/><path d="M12 12l7-4M12 12v9M12 12L5 8"/></svg>
      </div>
      <span style="font-weight:700;font-size:clamp(13px,2.5vw,15px);">Agent Ready Template</span>
    </div>
    <div class="nav-links">
      <span style="font-size:14px;color:var(--muted);font-weight:500;">コンセプト</span>
      <span style="font-size:14px;color:var(--muted);font-weight:500;">機能</span>
      <span style="font-size:14px;color:var(--muted);font-weight:500;">開発フロー</span>
      <div class="btn-primary" style="padding:10px 22px;font-size:13px;">お問い合わせ</div>
    </div>
  </div>

  <!-- HERO -->
  <div class="container" style="padding-top:clamp(40px,8vw,64px);padding-bottom:clamp(48px,9vw,88px);text-align:center;">
    <div style="display:flex;justify-content:center;">
      <div class="pill" style="background:var(--coral-soft);color:var(--coral);">AI エージェント対応 開発基盤テンプレート</div>
    </div>
    <div style="font-family:'Space Grotesk',sans-serif;font-size:clamp(14px,2.6vw,20px);font-weight:600;color:var(--muted);margin-top:22px;">Claude Code / Codex / GitHub Copilot</div>
    <h1 class="heading" style="font-size:clamp(28px,6.5vw,46px);line-height:1.5;margin-top:14px;max-width:760px;margin-left:auto;margin-right:auto;">
      同じルールで動く、<br>
      <span style="color:var(--indigo);">ひとつの開発基盤。</span>
    </h1>
    <p style="font-size:clamp(14.5px,2.4vw,17px);line-height:1.9;color:var(--muted);max-width:620px;margin:26px auto 0;">
      契約管理システムは実装サンプル。本当の価値は、認証・DB・テスト・CI/CD をそのまま流用できる「共通開発基盤」にあります。業務部分だけ差し替えれば、次の案件にすぐ使えます。
    </p>

    <!-- hero diagram card -->
    <div class="card" style="margin-top:clamp(36px,7vw,64px);padding:clamp(20px,5vw,48px);text-align:left;">

      <!-- desktop diagram: 3-across with SVG connectors -->
      <div class="hero-diagram-desktop">
        <div style="display:flex;width:100%;">
          <div style="flex:1;display:flex;justify-content:center;">
            <div style="background:var(--indigo-soft);border-radius:16px;padding:18px 24px;text-align:center;width:220px;">
              <div style="font-weight:700;font-size:14px;">Claude Code</div>
              <div class="pill" style="background:#fff;color:var(--indigo);margin-top:10px;">CLAUDE.md</div>
            </div>
          </div>
          <div style="flex:1;display:flex;justify-content:center;">
            <div style="background:var(--indigo-soft);border-radius:16px;padding:18px 24px;text-align:center;width:220px;">
              <div style="font-weight:700;font-size:14px;">Codex</div>
              <div class="pill" style="background:#fff;color:var(--indigo);margin-top:10px;">AGENTS.md</div>
            </div>
          </div>
          <div style="flex:1;display:flex;justify-content:center;">
            <div style="background:var(--indigo-soft);border-radius:16px;padding:18px 24px;text-align:center;width:220px;">
              <div style="font-weight:700;font-size:14px;">GitHub Copilot</div>
              <div class="pill" style="background:#fff;color:var(--indigo);margin-top:10px;">copilot-instructions.md</div>
            </div>
          </div>
        </div>
        <svg width="100%" height="52" viewBox="0 0 1216 52" style="display:block;">
          <line x1="203" y1="0" x2="203" y2="26" stroke="#D9D8F5" stroke-width="2.5"/>
          <line x1="608" y1="0" x2="608" y2="26" stroke="#D9D8F5" stroke-width="2.5"/>
          <line x1="1013" y1="0" x2="1013" y2="26" stroke="#D9D8F5" stroke-width="2.5"/>
          <line x1="203" y1="26" x2="1013" y2="26" stroke="#D9D8F5" stroke-width="2.5"/>
          <line x1="608" y1="26" x2="608" y2="52" stroke="var(--indigo)" stroke-width="3"/>
        </svg>
        <div style="display:flex;justify-content:center;">
          <div style="background:var(--indigo);color:#fff;border-radius:16px;padding:20px 40px;text-align:center;">
            <div style="font-weight:700;font-size:16px;">共通の開発基盤</div>
            <div style="font-size:12px;opacity:0.85;margin-top:6px;">認証 ・ DB ・ テスト ・ CI/CD</div>
          </div>
        </div>
      </div>

      <!-- mobile diagram: stacked with simple down-arrow connectors -->
      <div class="hero-diagram-mobile">
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="background:var(--indigo-soft);border-radius:16px;padding:16px 20px;text-align:center;">
            <div style="font-weight:700;font-size:14px;">Claude Code</div>
            <div class="pill" style="background:#fff;color:var(--indigo);margin-top:8px;">CLAUDE.md</div>
          </div>
          <div style="text-align:center;color:var(--line);font-size:18px;">↓</div>
          <div style="background:var(--indigo-soft);border-radius:16px;padding:16px 20px;text-align:center;">
            <div style="font-weight:700;font-size:14px;">Codex</div>
            <div class="pill" style="background:#fff;color:var(--indigo);margin-top:8px;">AGENTS.md</div>
          </div>
          <div style="text-align:center;color:var(--line);font-size:18px;">↓</div>
          <div style="background:var(--indigo-soft);border-radius:16px;padding:16px 20px;text-align:center;">
            <div style="font-weight:700;font-size:14px;">GitHub Copilot</div>
            <div class="pill" style="background:#fff;color:var(--indigo);margin-top:8px;">copilot-instructions.md</div>
          </div>
          <div style="text-align:center;color:var(--indigo);font-size:18px;">↓</div>
          <div style="background:var(--indigo);color:#fff;border-radius:16px;padding:16px 20px;text-align:center;">
            <div style="font-weight:700;font-size:15px;">共通の開発基盤</div>
            <div style="font-size:12px;opacity:0.85;margin-top:6px;">認証 ・ DB ・ テスト ・ CI/CD</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- CONCEPT -->
  <div style="background:var(--bg-soft);padding:clamp(48px,9vw,88px) 0;">
    <div class="container">
      <div class="kicker">CONCEPT</div>
      <h2 class="heading" style="font-size:clamp(22px,4.6vw,32px);margin-top:14px;line-height:1.6;">共通基盤は残す。業務部分だけを、案件ごとに置き換える。</h2>
      <p style="font-size:clamp(14px,2vw,15.5px);line-height:1.9;color:var(--muted);max-width:640px;margin-top:18px;">
        Claude Code・Codex・GitHub Copilot のどれでも使える、AI エージェント対応の開発テンプレートです。契約管理システムはサンプルであり、目的は共通基盤の再利用にあります。
      </p>

      <div class="card" style="margin-top:44px;padding:0;overflow:hidden;">
        <div class="split-wrap">
          <div style="flex:1;background:var(--indigo-soft);padding:clamp(24px,5vw,40px);">
            <div style="font-weight:700;font-size:18px;color:var(--indigo);">残す — 共通基盤</div>
            <div style="margin-top:20px;display:flex;flex-direction:column;gap:12px;font-size:15px;">
              <div style="display:flex;align-items:center;gap:10px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2.4"><path d="M4 12l6 6L20 6" stroke-linecap="round" stroke-linejoin="round"/></svg>認証・権限</div>
              <div style="display:flex;align-items:center;gap:10px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2.4"><path d="M4 12l6 6L20 6" stroke-linecap="round" stroke-linejoin="round"/></svg>DB・ファイル保存</div>
              <div style="display:flex;align-items:center;gap:10px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2.4"><path d="M4 12l6 6L20 6" stroke-linecap="round" stroke-linejoin="round"/></svg>テスト・CI/CD</div>
              <div style="display:flex;align-items:center;gap:10px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2.4"><path d="M4 12l6 6L20 6" stroke-linecap="round" stroke-linejoin="round"/></svg>AI エージェント向けルール</div>
            </div>
          </div>
          <div class="split-divider-wrap">
            <div class="split-divider-circle">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6B4A" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
          </div>
          <div style="flex:1;background:var(--coral-soft);padding:clamp(24px,5vw,40px);">
            <div style="font-weight:700;font-size:18px;color:var(--coral);">替える — 業務部分</div>
            <div style="margin-top:20px;font-size:15px;">契約管理</div>
            <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
              <span class="pill" style="background:#fff;color:var(--coral);">販売管理</span>
              <span class="pill" style="background:#fff;color:var(--coral);">申請管理</span>
              <span class="pill" style="background:#fff;color:var(--coral);">在庫管理</span>
              <span class="pill" style="background:#fff;color:var(--coral);">など</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- FEATURES -->
  <div class="container" style="padding-top:clamp(48px,9vw,88px);padding-bottom:clamp(48px,9vw,88px);">
    <div class="kicker">FEATURES</div>
    <h2 class="heading" style="font-size:clamp(22px,4.6vw,32px);margin-top:14px;line-height:1.6;">検索一覧・登録・詳細・更新・削除。一式をあらかじめ揃えています。</h2>
    <p style="font-size:clamp(14px,2vw,15.5px);line-height:1.9;color:var(--muted);max-width:640px;margin-top:18px;">契約管理システムは説明用のサンプルではなく「業務モジュールの実装例」です。</p>

    <div class="features-grid">
      <div class="card" style="padding:clamp(22px,4vw,32px);">
        <div class="icon-circle" style="background:var(--indigo);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3" stroke-linecap="round"/></svg>
        </div>
        <div style="font-size:17px;font-weight:700;margin-top:18px;">利用者管理・認証</div>
        <div style="font-size:14px;line-height:1.85;color:var(--muted);margin-top:10px;">Auth.js v5 による ID/PW 認証（必須）。Microsoft Entra ID を任意で追加可能。ロールに応じた画面・操作の権限制御。</div>
      </div>
      <div class="card" style="padding:clamp(22px,4vw,32px);">
        <div class="icon-circle" style="background:var(--coral);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" stroke-linecap="round"/></svg>
        </div>
        <div style="font-size:17px;font-weight:700;margin-top:18px;">マスタ管理</div>
        <div style="font-size:14px;line-height:1.85;color:var(--muted);margin-top:10px;">マスタ・マスタ分類の検索／登録／更新／削除。CSVダウンロードと Excel 出力（worker による非同期処理）。</div>
      </div>
      <div class="card" style="padding:clamp(22px,4vw,32px);">
        <div class="icon-circle" style="background:var(--indigo);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9"><path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v5h5M9 14h6M9 17h6" stroke-linecap="round"/></svg>
        </div>
        <div style="font-size:17px;font-weight:700;margin-top:18px;">契約先・契約管理</div>
        <div style="font-size:14px;line-height:1.85;color:var(--muted);margin-top:10px;">契約先（取引先）と契約の検索／登録／更新／削除。「検索一覧→詳細→編集/新規登録は別ページ→削除」に統一。</div>
      </div>
      <div class="card" style="padding:clamp(22px,4vw,32px);">
        <div class="icon-circle" style="background:var(--coral);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 118 0v3" stroke-linecap="round"/><circle cx="12" cy="15" r="1.4" fill="#fff" stroke="none"/></svg>
        </div>
        <div style="font-size:17px;font-weight:700;margin-top:18px;">パスワードリセット</div>
        <div style="font-size:14px;line-height:1.85;color:var(--muted);margin-top:10px;">利用者自身によるパスワード再設定。メールアドレスの登録・変更と確認、メール送信。</div>
      </div>
    </div>
    <p style="font-size:14px;font-style:italic;color:var(--muted);margin-top:24px;">いずれも共通の型で実装されているため、別案件で業務モジュールを追加する際の手本になります。</p>
  </div>

  <!-- COMMON RULES -->
  <div style="background:var(--bg-soft);padding:clamp(48px,9vw,88px) 0;">
    <div class="container">
      <div class="kicker">COMMON RULES</div>
      <h2 class="heading" style="font-size:clamp(22px,4.6vw,32px);margin-top:14px;line-height:1.6;">入口ファイルが違うだけ。守るルールは、ひとつ。</h2>
      <p style="font-size:clamp(14px,2vw,15.5px);line-height:1.9;color:var(--muted);max-width:640px;margin-top:18px;">
        Claude Code・Codex・GitHub Copilot は、読み込む設定ファイルの場所や形式が異なります。共通ルールを参照する形にしているため、どれを使っても同じ方針で開発できます。
      </p>

      <div style="margin-top:44px;">
        <div class="rules-row">
          <div class="card" style="flex:1;padding:26px;text-align:center;">
            <div style="font-weight:700;font-size:15px;">Claude Code</div>
            <div class="pill" style="background:var(--indigo-soft);color:var(--indigo);margin-top:12px;">CLAUDE.md</div><br>
            <div class="pill" style="background:var(--indigo-soft);color:var(--indigo);margin-top:8px;">.claude/skills/</div>
          </div>
          <div class="card" style="flex:1;padding:26px;text-align:center;">
            <div style="font-weight:700;font-size:15px;">Codex</div>
            <div class="pill" style="background:var(--indigo-soft);color:var(--indigo);margin-top:12px;">AGENTS.md</div><br>
            <div class="pill" style="background:var(--indigo-soft);color:var(--indigo);margin-top:8px;">.agents/skills/</div>
          </div>
          <div class="card" style="flex:1;padding:26px;text-align:center;">
            <div style="font-weight:700;font-size:15px;">GitHub Copilot</div>
            <div class="pill" style="background:var(--indigo-soft);color:var(--indigo);margin-top:12px;">.github/copilot-instructions.md</div>
          </div>
        </div>

        <svg class="rules-connector-desktop" width="100%" height="44" viewBox="0 0 1216 44" style="display:block;">
          <line x1="203" y1="0" x2="203" y2="20" stroke="#D9D8F5" stroke-width="2.5"/>
          <line x1="608" y1="0" x2="608" y2="20" stroke="#D9D8F5" stroke-width="2.5"/>
          <line x1="1013" y1="0" x2="1013" y2="20" stroke="#D9D8F5" stroke-width="2.5"/>
          <line x1="203" y1="20" x2="1013" y2="20" stroke="#D9D8F5" stroke-width="2.5"/>
          <line x1="608" y1="20" x2="608" y2="44" stroke="var(--coral)" stroke-width="3"/>
        </svg>
        <div class="rules-connector-mobile" style="text-align:center;color:var(--coral);font-size:18px;padding:14px 0;">↓</div>

        <div style="display:flex;justify-content:center;">
          <div style="background:var(--coral);color:#fff;border-radius:999px;padding:16px 32px;font-weight:700;">共通ルールを参照</div>
        </div>
      </div>
      <p style="font-size:14px;color:var(--muted);margin-top:28px;max-width:680px;">エージェントごとの差は「どの入口ファイルから読み始めるか」だけです。開発時に守るルールは共通です。</p>

      <div class="card" style="margin-top:36px;padding:clamp(20px,5vw,40px);">
        <div style="display:flex;justify-content:center;">
          <div class="pill" style="background:var(--indigo);color:#fff;font-size:13px;padding:8px 18px;">AGENTS.md</div>
        </div>

        <!-- desktop rule tree: SVG + 4 columns -->
        <div class="rule-tree-desktop">
          <svg width="100%" height="64" viewBox="0 0 1040 64" style="display:block;">
            <line x1="520" y1="0" x2="520" y2="20" stroke="#E7E7F0" stroke-width="2.5"/>
            <line x1="130" y1="20" x2="910" y2="20" stroke="#E7E7F0" stroke-width="2.5"/>
            <line x1="130" y1="20" x2="130" y2="64" stroke="#E7E7F0" stroke-width="2.5"/>
            <line x1="390" y1="20" x2="390" y2="64" stroke="#E7E7F0" stroke-width="2.5"/>
            <line x1="650" y1="20" x2="650" y2="64" stroke="#E7E7F0" stroke-width="2.5"/>
            <line x1="910" y1="20" x2="910" y2="64" stroke="#E7E7F0" stroke-width="2.5"/>
          </svg>
          <div style="display:flex;">
            <div style="width:260px;text-align:center;padding:0 8px;">
              <div class="pill" style="background:var(--indigo-soft);color:var(--indigo);">src/AGENTS.md</div>
              <div style="font-size:12.5px;color:var(--muted);margin-top:10px;">実装・配置の規約</div>
            </div>
            <div style="width:260px;text-align:center;padding:0 8px;">
              <div class="pill" style="background:var(--indigo-soft);color:var(--indigo);">TESTING.md</div>
              <div style="font-size:12.5px;color:var(--muted);margin-top:10px;">テスト方針</div>
            </div>
            <div style="width:260px;text-align:center;padding:0 8px;">
              <div class="pill" style="background:var(--indigo-soft);color:var(--indigo);">docs/skills/</div>
              <div style="font-size:12.5px;color:var(--muted);margin-top:10px;">定型作業の手順</div>
            </div>
            <div style="width:260px;text-align:center;padding:0 8px;">
              <div class="pill" style="background:var(--indigo-soft);color:var(--indigo);">docs/</div>
              <div style="font-size:12.5px;color:var(--muted);margin-top:10px;">要件定義書・設計書</div>
            </div>
          </div>
        </div>

        <!-- mobile rule tree: simple stacked list -->
        <div class="rule-tree-mobile">
          <div style="text-align:center;color:var(--line);font-size:16px;padding:10px 0 4px;">│</div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="pill" style="background:var(--indigo-soft);color:var(--indigo);flex-shrink:0;">src/AGENTS.md</span>
              <span style="font-size:12.5px;color:var(--muted);">実装・配置の規約</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="pill" style="background:var(--indigo-soft);color:var(--indigo);flex-shrink:0;">TESTING.md</span>
              <span style="font-size:12.5px;color:var(--muted);">テスト方針</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="pill" style="background:var(--indigo-soft);color:var(--indigo);flex-shrink:0;">docs/skills/</span>
              <span style="font-size:12.5px;color:var(--muted);">定型作業の手順</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="pill" style="background:var(--indigo-soft);color:var(--indigo);flex-shrink:0;">docs/</span>
              <span style="font-size:12.5px;color:var(--muted);">要件定義書・設計書</span>
            </div>
          </div>
        </div>

        <p style="font-size:13px;color:var(--muted);margin-top:22px;line-height:1.8;">例：「契約登録機能を実装して」と依頼された場合は、AGENTS.md／src/AGENTS.md／docs/ の設計書／TESTING.md を確認します。</p>
      </div>
    </div>
  </div>

  <!-- WORKFLOW -->
  <div class="container" style="padding-top:clamp(48px,9vw,88px);padding-bottom:clamp(48px,9vw,88px);">
    <div class="kicker">WORKFLOW</div>
    <h2 class="heading" style="font-size:clamp(22px,4.6vw,32px);margin-top:14px;line-height:1.6;">要件が決まる前に、AI は自由に実装しません。</h2>
    <p style="font-size:clamp(14px,2vw,15.5px);line-height:1.9;color:var(--muted);max-width:640px;margin-top:18px;">人が要件や設計を整理し、AI はそれをもとに支援します。</p>

    <div class="workflow-row">
      <div class="workflow-rail" style="width:64px;position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="width:44px;height:44px;border-radius:50%;background:var(--indigo);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-family:'Space Grotesk';z-index:2;flex-shrink:0;">1</div>
        <div style="width:2.5px;flex:1;background:var(--line);margin:4px 0;min-width:16px;"></div>
        <div style="width:44px;height:44px;border-radius:50%;background:var(--coral);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-family:'Space Grotesk';z-index:2;flex-shrink:0;">2</div>
        <div style="width:2.5px;flex:1;background:var(--line);margin:4px 0;min-width:16px;"></div>
        <div style="width:44px;height:44px;border-radius:50%;background:var(--indigo);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-family:'Space Grotesk';z-index:2;flex-shrink:0;">3</div>
      </div>
      <div class="workflow-cards" style="flex:1;display:flex;flex-direction:column;gap:20px;padding-left:24px;">
        <div class="card" style="padding:26px 30px;">
          <div class="pill" style="background:var(--indigo-soft);color:var(--indigo);">人</div>
          <div style="font-size:16.5px;font-weight:700;margin-top:12px;">要望を整理する</div>
          <div style="font-size:14px;color:var(--muted);margin-top:8px;line-height:1.8;">要件定義書・設計書を docs/ に置く。実装する機能と完了条件を決める。</div>
        </div>
        <div class="card" style="padding:26px 30px;border-color:var(--coral);">
          <div class="pill" style="background:var(--coral-soft);color:var(--coral);">AI</div>
          <div style="font-size:16.5px;font-weight:700;margin-top:12px;">実装・テスト・報告</div>
          <div style="font-size:14px;color:var(--muted);margin-top:8px;line-height:1.8;">設計書と既存コードを確認し、実装とテストコードを作成・更新。確認用コマンドを実行し、結果・未確定事項・変更内容を報告する。</div>
        </div>
        <div class="card" style="padding:26px 30px;">
          <div class="pill" style="background:var(--indigo-soft);color:var(--indigo);">人</div>
          <div style="font-size:16.5px;font-weight:700;margin-top:12px;">確認・承認する</div>
          <div style="font-size:14px;color:var(--muted);margin-top:8px;line-height:1.8;">内容を確認し、必要に応じて修正を指示。承認後にコミット・Pull Request・リリースへ進む。</div>
        </div>
      </div>
    </div>
  </div>

  <!-- QUALITY GATES -->
  <div style="background:var(--bg-soft);padding:clamp(48px,9vw,88px) 0;">
    <div class="container">
      <div class="kicker">QUALITY GATES</div>
      <h2 class="heading" style="font-size:clamp(22px,4.6vw,32px);margin-top:14px;line-height:1.6;">AIの回答が正しいかではなく、コードが壊れていないかを確認する。</h2>
      <p style="font-size:clamp(14px,2vw,15.5px);line-height:1.9;color:var(--muted);max-width:640px;margin-top:18px;">AI エージェントは、実装後に次の確認を自動で実行します。</p>

      <div class="quality-row">
        <svg class="quality-line-desktop" width="100%" height="4" viewBox="0 0 1216 4" style="position:absolute;top:22px;left:0;"><line x1="60" y1="2" x2="1156" y2="2" stroke="#E7E7F0" stroke-width="3"/></svg>
        <div style="flex:1;text-align:center;">
          <div style="width:44px;height:44px;border-radius:50%;background:var(--indigo);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;margin:0 auto;position:relative;z-index:2;">1</div>
          <div style="font-weight:700;font-size:15px;margin-top:14px;">lint</div>
          <div style="font-size:13px;color:var(--muted);margin-top:8px;line-height:1.7;padding:0 12px;">ルール違反や誤りにつながる記述を機械的に確認</div>
        </div>
        <div style="flex:1;text-align:center;">
          <div style="width:44px;height:44px;border-radius:50%;background:var(--indigo);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;margin:0 auto;position:relative;z-index:2;">2</div>
          <div style="font-weight:700;font-size:15px;margin-top:14px;">型検査</div>
          <div style="font-size:13px;color:var(--muted);margin-top:8px;line-height:1.7;padding:0 12px;">TypeScript が検出できる不整合を確認</div>
        </div>
        <div style="flex:1;text-align:center;">
          <div style="width:44px;height:44px;border-radius:50%;background:var(--indigo);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;margin:0 auto;position:relative;z-index:2;">3</div>
          <div style="font-weight:700;font-size:15px;margin-top:14px;">テスト</div>
          <div style="font-size:13px;color:var(--muted);margin-top:8px;line-height:1.7;padding:0 12px;">期待した処理結果になるかを自動で確認</div>
        </div>
        <div style="flex:1;text-align:center;">
          <div style="width:44px;height:44px;border-radius:50%;background:var(--coral);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;margin:0 auto;position:relative;z-index:2;">4</div>
          <div style="font-weight:700;font-size:15px;margin-top:14px;">ビルド</div>
          <div style="font-size:13px;color:var(--muted);margin-top:8px;line-height:1.7;padding:0 12px;">本番用アプリとして組み立てられるかを確認</div>
        </div>
      </div>
      <p style="font-size:14px;color:var(--muted);margin-top:32px;max-width:680px;">AI の回答が正しいかの確認ではなく、変更したコードがルールと既存機能を壊していないかを確認する仕組みです。</p>

      <div class="card" style="margin-top:24px;padding:22px 28px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        <span class="pill" style="background:var(--indigo-soft);color:var(--indigo);">同一フォルダにテスト配置</span>
        <span style="color:var(--muted);">→</span>
        <span class="pill" style="background:var(--indigo-soft);color:var(--indigo);">Vitest（ユニット）</span>
        <span style="color:var(--muted);">→</span>
        <span class="pill" style="background:var(--indigo-soft);color:var(--indigo);">Playwright（E2E）</span>
        <span style="color:var(--muted);">→</span>
        <span class="pill" style="background:var(--indigo-soft);color:var(--indigo);">GitHub Actions（PR時に全チェック）</span>
      </div>
    </div>
  </div>

  <!-- ROLES -->
  <div class="container" style="padding-top:clamp(48px,9vw,88px);padding-bottom:clamp(48px,9vw,88px);">
    <div class="kicker">ROLES</div>
    <h2 class="heading" style="font-size:clamp(22px,4.6vw,32px);margin-top:14px;line-height:1.6;">作業速度はAIに。データとリリースの判断は人に。</h2>
    <p style="font-size:clamp(14px,2vw,15.5px);line-height:1.9;color:var(--muted);max-width:640px;margin-top:18px;">AI エージェントは、調査・実装・テスト・記録を支援します。一方で、影響が大きい操作は人が判断します。</p>

    <div class="roles-row">
      <div class="card" style="flex:1;padding:clamp(24px,5vw,36px);background:var(--indigo-soft);border:none;">
        <div style="font-size:17px;font-weight:700;color:var(--indigo);">AI が支援する作業</div>
        <div style="margin-top:20px;display:flex;flex-direction:column;gap:14px;font-size:14.5px;">
          <div style="display:flex;gap:10px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2.4"><path d="M4 12l6 6L20 6" stroke-linecap="round" stroke-linejoin="round"/></svg>コード・設計書の確認</div>
          <div style="display:flex;gap:10px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2.4"><path d="M4 12l6 6L20 6" stroke-linecap="round" stroke-linejoin="round"/></svg>実装とテストコードの作成</div>
          <div style="display:flex;gap:10px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2.4"><path d="M4 12l6 6L20 6" stroke-linecap="round" stroke-linejoin="round"/></svg>lint・型検査・テストの実行</div>
          <div style="display:flex;gap:10px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2.4"><path d="M4 12l6 6L20 6" stroke-linecap="round" stroke-linejoin="round"/></svg>作業結果の報告</div>
        </div>
      </div>
      <div class="card" style="flex:1;padding:clamp(24px,5vw,36px);background:var(--coral-soft);border:none;">
        <div style="font-size:17px;font-weight:700;color:var(--coral);">人の確認が必要な作業</div>
        <div style="margin-top:20px;display:flex;flex-direction:column;gap:14px;font-size:14.5px;">
          <div style="display:flex;gap:10px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B4A" stroke-width="2.4"><path d="M12 9v4M12 17h.01" stroke-linecap="round"/><path d="M10.3 3.9L2.9 17a2 2 0 001.7 3h14.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke-linejoin="round"/></svg>新規ファイルの生成</div>
          <div style="display:flex;gap:10px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B4A" stroke-width="2.4"><path d="M12 9v4M12 17h.01" stroke-linecap="round"/><path d="M10.3 3.9L2.9 17a2 2 0 001.7 3h14.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke-linejoin="round"/></svg>テストデータの削除・復元</div>
          <div style="display:flex;gap:10px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B4A" stroke-width="2.4"><path d="M12 9v4M12 17h.01" stroke-linecap="round"/><path d="M10.3 3.9L2.9 17a2 2 0 001.7 3h14.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke-linejoin="round"/></svg>コミット・push</div>
          <div style="display:flex;gap:10px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B4A" stroke-width="2.4"><path d="M12 9v4M12 17h.01" stroke-linecap="round"/><path d="M10.3 3.9L2.9 17a2 2 0 001.7 3h14.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke-linejoin="round"/></svg>本番環境や外部サービスの変更</div>
        </div>
      </div>
    </div>
    <p style="font-size:14px;color:var(--muted);margin-top:24px;max-width:680px;">この分担により、AI エージェントの作業速度を活かしつつ、データやリリースに関する判断は人が保持します。</p>
  </div>

  <!-- FINAL CTA (dark) -->
  <div style="background:var(--indigo-deep);padding:clamp(56px,10vw,96px) clamp(20px,6vw,64px);">
    <div class="container" style="text-align:center;padding-left:0;padding-right:0;">
      <div class="kicker" style="color:#FF8A6E;">SUMMARY</div>
      <h2 class="heading" style="font-size:clamp(18px,5vw,34px);margin-top:16px;max-width:720px;margin-left:auto;margin-right:auto;line-height:1.6;color:#fff;">契約管理システムの完成品ではなく、<br>再利用可能な開発基盤です。</h2>
      <p style="font-size:clamp(14px,2vw,15.5px);line-height:1.9;color:#B8B6D9;max-width:600px;margin:20px auto 0;">
        複数の AI エージェントと人が同じルールで開発を進めるための土台。共通基盤は残し、業務部分だけを置き換えて、次の案件にすぐ使えます。
      </p>
      <div class="recap-row">
        <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);border-radius:16px;padding:20px 28px;text-align:left;">
          <div class="pill" style="background:rgba(79,70,229,0.35);color:#C7C4FF;">KEEP</div>
          <div style="font-size:13px;color:#B8B6D9;margin-top:10px;line-height:1.8;">Next.js / Prisma / PostgreSQL・認証認可・ログ/エラー処理・Vitest/Playwright/CI・AI 向け開発ルール</div>
        </div>
        <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);border-radius:16px;padding:20px 28px;text-align:left;">
          <div class="pill" style="background:rgba(255,107,74,0.28);color:#FFB49E;">REPLACE</div>
          <div style="font-size:13px;color:#B8B6D9;margin-top:10px;line-height:1.8;">業務モジュール・DB スキーマ・画面/帳票・業務ルール・テスト仕様</div>
        </div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer-row" style="padding:32px clamp(20px,6vw,64px);">
    <span style="font-size:13px;color:var(--muted);">Agent Ready Template</span>
    <span style="font-size:13px;color:var(--muted);">作成：小枝 勇輝</span>
  </div>

</div>
`;
