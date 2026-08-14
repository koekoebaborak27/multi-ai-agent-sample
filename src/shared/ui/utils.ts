import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 見た目を指定する文字列をまとめて1つにする。
 * 条件によって付けたり付けなかったりする指定を扱えるうえ、
 * 同じ種類の指定が重なった場合は後から渡したほうを優先して残す。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
