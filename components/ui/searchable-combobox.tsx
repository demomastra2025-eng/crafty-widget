"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type SearchableComboboxOption = {
  value: string;
  label: string;
  keywords?: string;
};

type SearchableComboboxProps = {
  value?: string | null;
  options: SearchableComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  allowClear?: boolean;
  optionActionLabel?: string;
  optionActionIcon?: React.ReactNode;
  onOptionAction?: (value: string) => void;
  onValueChange: (value: string | null) => void;
};

export function SearchableCombobox({
  value,
  options,
  placeholder = "Выберите значение",
  searchPlaceholder = "Поиск",
  emptyText = "Ничего не найдено",
  disabled,
  allowClear = true,
  optionActionLabel,
  optionActionIcon,
  onOptionAction,
  onValueChange,
}: SearchableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value],
  );

  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;

    return options.filter((option) => {
      const haystack = `${option.label} ${option.keywords || ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [options, query]);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-auto min-h-9 w-full justify-between py-2 font-normal"
        >
          <span className="min-w-0 break-words whitespace-normal text-left">
            {selectedOption?.label || <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronsUpDown className="text-muted-foreground ml-2 size-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
        <div className="space-y-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>

          {allowClear && selectedOption ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                onValueChange(null);
                setOpen(false);
              }}
            >
              <X className="size-4" />
              Новый ввод
            </Button>
          ) : null}

          <div className="max-h-64 overflow-y-auto">
            {filteredOptions.length ? (
              <div className="space-y-1">
                {filteredOptions.map((option) => {
                  const selected = option.value === value;
                  return (
                    <div key={option.value} className="flex items-start gap-1">
                      <button
                        type="button"
                        className={cn(
                          "hover:bg-accent flex min-w-0 flex-1 items-start gap-2 rounded-sm px-2 py-2 text-left text-sm",
                          selected && "bg-accent",
                        )}
                        onClick={() => {
                          onValueChange(option.value);
                          setOpen(false);
                        }}
                      >
                        <Check className={cn("mt-0.5 size-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                        <span className="min-w-0 flex-1 break-words">{option.label}</span>
                      </button>
                      {onOptionAction ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-0.5 size-8 shrink-0"
                          title={optionActionLabel}
                          aria-label={optionActionLabel}
                          onClick={() => {
                            setOpen(false);
                            onOptionAction(option.value);
                          }}
                        >
                          {optionActionIcon}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-muted-foreground px-2 py-3 text-sm">{emptyText}</div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
