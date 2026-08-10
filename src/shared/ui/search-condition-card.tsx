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

/** 一覧画面の検索条件を、入力値を保持したまま開閉する共通カード。 */
export function SearchConditionCard({
  children,
  title = "検索条件",
  defaultExpanded = true,
}: SearchConditionCardProps) {
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
