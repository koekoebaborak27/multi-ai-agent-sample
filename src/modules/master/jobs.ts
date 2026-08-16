import {
  buildMasterInfoExcel,
  buildMasterInfoExcelFileName,
} from "@/modules/master/excel-export";
import { masterRepository } from "@/modules/master/repository";
import { toCategoryDetail, toMasterDetail } from "@/modules/master/service";
import { MASTER_EXCEL_EXPORT_RETENTION_DAYS } from "@/modules/master/types";
import { storage } from "@/shared/storage";

// 裏側で動くプログラム（worker）だけが使う、時間のかかる処理をまとめたファイル。
// 画面から呼ぶ処理（service.ts）とは分けている。Excelの組み立て道具（exceljs）は容量が大きく、
// 画面側の配布物へ混ぜたくないため、公開窓口（index.ts）にも載せていない。
//
// 期限切れファイルを実際に削除する掃除処理は、この工程ではまだ実装していない
// （どのタイミングで削除するかは設計書§40.9のとおり決まっているが、削除後の見え方を
// ダウンロード側の実装と合わせて決めるため、別工程で追加する）。

/**
 * わざと待つ時間（ミリ秒）。約2分。
 *
 * データの件数に関わらず、この機能は必ず数分かかるようにしている。
 * この機能は「時間のかかる処理を裏側の仕組み（worker）に任せる」ときのお手本として作られており、
 * すぐ終わってしまうと、その使い方の良さが動きとして伝わらないため。
 * 以前のCSV出力は処理そのものが1〜2秒しかかからず、裏側の仕組みの起動待ちだけが目立つ結果になり、
 * 画面の中で完結する方式へ作り直した経緯がある。本機能はその逆の例として、あえて重い処理にしている。
 */
const ARTIFICIAL_DELAY_MS = 120_000;

/** ファイル置き場の中で、この機能が作ったファイルを置く場所 */
const STORAGE_DIRECTORY = "master-excel-exports";

/** Excelファイルであることを相手に伝えるための種別 */
const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** 生成に失敗したときに記録する、失敗の種類を表す値（設計書§40.10） */
const FAILURE_ERROR_CODE = "MASTER_EXCEL_EXPORT_FAILED";

/** 指定した時間だけ待つ */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 基準の日時から、指定した日数だけ先の日時を作る */
function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * マスタ情報Excelを1件ぶん作る。
 * 依頼の受付（service.requestExcelExport）で作られた実行履歴の番号を受け取り、
 * 状態を進めながらファイルを作って保存する（設計書§40.5.3）。
 */
export async function runMasterExcelExport(exportId: string): Promise<void> {
  // 「受付済み」のときだけ「作成中」へ進める。進められなかった場合は、
  // 同じ依頼をすでに誰かが処理している（またはやり直しでもう一度渡された）ということなので、
  // ここで何もせず終わる。ファイルが二重に作られるのを防ぐため。
  const started = await masterRepository.markExcelExportRunning(exportId);
  if (!started) return;

  try {
    const [categories, masters] = await Promise.all([
      masterRepository.listCategoriesForExport("code", "asc"),
      masterRepository.listMastersForExport({}, "category", "asc"),
    ]);

    // 件数が上限を超えていないことは依頼を受け付けた時点（service.requestExcelExport）で
    // 確認済みのため、ここでは確認し直さない。
    await sleep(ARTIFICIAL_DELAY_MS);

    const generatedAt = new Date();
    const buffer = await buildMasterInfoExcel({
      categories: categories.map(toCategoryDetail),
      masters: masters.map(toMasterDetail),
      generatedAt,
    });

    // 保存先のパスに実行履歴の番号を挟む。同じ秒に2件作られても、互いのファイルを
    // 上書きしないようにするため。
    const fileName = buildMasterInfoExcelFileName(generatedAt);
    const filePath = `${STORAGE_DIRECTORY}/${exportId}/${fileName}`;
    await storage.upload(filePath, buffer, XLSX_CONTENT_TYPE);

    const finishedAt = new Date();
    await masterRepository.markExcelExportReady(exportId, {
      filePath,
      fileName,
      categoryRowCount: categories.length,
      masterRowCount: masters.length,
      finishedAt,
      expiresAt: addDays(finishedAt, MASTER_EXCEL_EXPORT_RETENTION_DAYS),
    });
  } catch (error) {
    // 途中で失敗したことを実行履歴へ残してから、そのまま呼び出し元へ伝える。
    // 記録を残すのは境界（withJob）の役目という決まりだが、ここで受け止めているのは
    // 「画面の履歴一覧に失敗として表示する」という業務上の要件を満たすためであり、
    // 受け止めたあとは再び投げ直すので、ログを出す・再試行するかどうかの判断は
    // これまでどおり境界側（withJob → pg-boss）が行う。
    await masterRepository.markExcelExportFailed(exportId, FAILURE_ERROR_CODE);
    throw error;
  }
}
