"use client";

import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { useIdentity } from "@/lib/hooks/use-identity";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";

export function NavAuthLinks() {
  const identity = useIdentity();
  const { signOut } = useClerk();

  if (identity.loading) return null;

  if (!identity.isAuthed) {
    return (
      <Button variant="ghost" render={<Link href="/sign-in" />}>
        Sign in
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" />}>
        <span className="text-lg">{identity.avatarEmoji}</span>
        {identity.displayName}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href="/profile" />}>
          <User className="size-4" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut({ redirectUrl: "/" })}>
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
