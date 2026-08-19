"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/ui/utils";

/** コンボボックスの選択肢1件分。契約先の全項目ではなく、選択に必要なid・名称だけを持つ */
export interface PartyComboboxOption {
  id: string;
  name: string;
}

interface PartyComboboxProps {
  options: PartyComboboxOption[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  id?: string;
  hasError?: boolean;
}

/**
 * 契約先を名称で絞り込んで選ぶコンボボックス。
 * 契約の検索条件・新規登録・更新フォームで共用する（§00.7）。登録済みの契約先が多くても
 * 目的の契約先を選べるよう、現行の「先頭env.PAGE_SIZE件だけのプルダウン」から置き換える。
 *
 * サーバー側では検索せず、渡された一覧をCommandがクライアント側で絞り込む（§00.9.2）。
 * 契約先の登録件数が数千件規模になった場合は、サーバー側検索への切り替えを検討する。
 */
export function PartyCombobox({
  options,
  value,
  onChange,
  placeholder = "契約先を選択してください",
  id,
  hasError,
}: PartyComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={hasError ? true : undefined}
          className="w-full justify-between font-normal"
        >
          <span className={cn(!selected && "text-muted-foreground")}>
            {selected ? selected.name : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput placeholder="契約先名で検索" />
          <CommandList>
            <CommandEmpty>該当する契約先がありません</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.name}
                  onSelect={() => {
                    onChange(option.id === value ? undefined : option.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 size-4", option.id === value ? "opacity-100" : "opacity-0")}
                  />
                  {option.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
