import { handlers } from "@/modules/auth";

// ログインの仕組みが内部で使う窓口。
// ログイン画面からの送信や、Microsoft のログイン画面からの戻りなどをすべてここで受け取る。
// 処理の中身は auth モジュール側に用意されているため、ここでは受け口を用意するだけ。
export const { GET, POST } = handlers;
