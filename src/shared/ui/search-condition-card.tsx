"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

interface SearchConditionCardProps {
  children: ReactNode;
  title?: string;
  defaultExpanded?: boolean;
}

/**
 * 一覧画面の検索条件を囲む共通の枠。開いたり閉じたりできる。
 *
 * 閉じるときも中身を消さずに隠しているだけなので、入力した内容はそのまま残る。
 */
export function SearchConditionCard({
  children,
  title = "検索条件",
  defaultExpanded = true,
}: SearchConditionCardProps) {
  // 開閉ボタンと中身を結び付けるための名前。
  // 同じ画面にこの枠が複数あっても重ならないよう、自動で作られる番号を使う。
  const contentId = `search-condition-${useId()}`;
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-2xl">{title}</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={isExpanded ? `${title}を閉じる` : `${title}を開く`}
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </Button>
      </CardHeader>
      <CardContent id={contentId} hidden={!isExpanded}>
        {children}
      </CardContent>
    </Card>
  );
}
