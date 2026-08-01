"use client";

import { useActionState, useEffect, useRef } from "react";
import { createPartyAction, type PartyFormState } from "@/modules/party/actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const initialState: PartyFormState = {};

export function PartyForm() {
  const [state, formAction, pending] = useActionState(createPartyAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="name">名称</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="kind">分類</Label>
        <Input id="kind" name="kind" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="contactInfo">連絡先</Label>
        <Input id="contactInfo" name="contactInfo" />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive md:col-span-2">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-green-600 md:col-span-2">契約先を登録しました</p>
      )}
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "登録中..." : "契約先を登録"}
        </Button>
      </div>
    </form>
  );
}
